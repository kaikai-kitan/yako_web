#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync, unwatchFile, watchFile } from 'node:fs';
import { open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOARD_PATH = resolve(PROJECT_ROOT, 'TEAM_BOARD.md');
const LOCK_PATH = resolve(PROJECT_ROOT, '.yako-team-board-runner.lock');

const WATCH_INTERVAL_MS = 500;
const LOCK_STALE_MS = 10_000;
const CODEX_TIMEOUT_MS = 30 * 60 * 1000;
const CHILD_TERMINATE_GRACE_MS = 5_000;
import {
	EXIT_USAGE,
	RunnerError,
	parseQueue,
	taskStatus,
	readyTasksFromParsed,
	findReadyTasks
} from './board-parser.mjs';

export { findReadyTasks };

const EXIT_LOCKED = 3;
const EXIT_IO = 4;
const EXIT_STATE = 5;

function buildCodexPrompt(taskId) {
	return `YAKO_TEAM_BOARD_AUTORUN_V1
TARGET_TASK_ID: ${taskId}
YAKO_WEB のチームマネージャーとして、リポジトリの AGENTS.md と TEAM_BOARD.md を読み、チーム運用ルールに従ってください。
TARGET_TASK_ID と完全一致し、requested_by が「岩田リーダー」、status が IN_PROGRESS のタスク1件だけを処理してください。ランナーが対象タスクを安全に確定し、開始状態へ更新済みです。他のタスクやテンプレートは処理しないでください。
要件を分析し、システム実装が必要なら tanaka サブエージェントを起動して完了を待ち、その後にデザイン実装が必要なら suzuki サブエージェントを起動して完了を待ってください。両者の結果を統合し、必要な検証を行ってください。
完了時は既存の status 行を DONE に置換してください。利用者の判断・追加情報・権限が必要な場合や実行上の問題がある場合は、既存の status 行を NEEDS_INPUT に置換してください。status 行を追加して重複させないでください。TEAM_BOARD.md の対象タスクに結果と検証内容を簡潔に記録してください。
コミット、push、デプロイ、Git リモートの変更は絶対に行わないでください。ワークスペース外への書き込み、ネットワークアクセス、追加の承認を必要とする操作は行わず、必要な場合は NEEDS_INPUT として理由を記録してください。`;
}

function printUsage() {
	console.log(`Usage: node scripts/team-board-runner.mjs [--once | --watch] [--dry-run]

  --once     指示キューを1回確認する（既定）
  --watch    TEAM_BOARD.md を監視し、変更時に確認する
  --dry-run  対象を表示するだけで Codex を起動しない
  --help     このヘルプを表示する`);
}

function parseArgs(args) {
	let mode = 'once';
	let modeWasSet = false;
	let dryRun = false;

	for (const arg of args) {
		if (arg === '--once' || arg === '--watch') {
			const nextMode = arg.slice(2);
			if (modeWasSet && mode !== nextMode) {
				throw new RunnerError('--once と --watch は同時に指定できません。', EXIT_USAGE);
			}
			mode = nextMode;
			modeWasSet = true;
		} else if (arg === '--dry-run') {
			dryRun = true;
		} else if (arg === '--help' || arg === '-h') {
			return { help: true, mode, dryRun };
		} else {
			throw new RunnerError(`不明な引数です: ${arg}`, EXIT_USAGE);
		}
	}

	return { help: false, mode, dryRun };
}


async function readBoard() {
	try {
		return await readFile(BOARD_PATH, 'utf8');
	} catch (error) {
		throw new RunnerError(`TEAM_BOARD.md を読み込めません: ${error.message}`, EXIT_IO);
	}
}

async function writeParsedBoard(parsed) {
	try {
		await writeFile(BOARD_PATH, parsed.lines.join(parsed.eol), 'utf8');
	} catch (error) {
		throw new RunnerError(`TEAM_BOARD.md を更新できません: ${error.message}`, EXIT_IO);
	}
}

async function claimTask(taskId) {
	const parsed = parseQueue(await readBoard());
	const task = parsed.tasks.find((candidate) => candidate.id === taskId);
	if (
		!task ||
		task.id === 'TASK-TEMPLATE' ||
		taskStatus(task) !== 'READY' ||
		task.fields.get('requested_by')?.value !== '岩田リーダー'
	) {
		throw new RunnerError(`${taskId} は実行可能な READY タスクではありません。`, EXIT_STATE);
	}

	const statusField = task.fields.get('status');
	parsed.lines[statusField.lineIndex] = statusField.fullMatch.replace(statusField.value, 'IN_PROGRESS');
	const startedAt = `- automation_started_at: ${new Date().toISOString()}`;
	const existingStartedAt = task.fields.get('automation_started_at');
	if (existingStartedAt) parsed.lines[existingStartedAt.lineIndex] = startedAt;
	else parsed.lines.splice(statusField.lineIndex + 1, 0, startedAt);
	await writeParsedBoard(parsed);
}

function sanitizeError(message) {
	return String(message)
		.replace(/[\r\n]+/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim()
		.slice(0, 500);
}

async function markTaskNeedsInput(taskId, reason) {
	const parsed = parseQueue(await readBoard());
	const task = parsed.tasks.find((candidate) => candidate.id === taskId);
	const status = taskStatus(task);
	if (!task || (status !== 'READY' && status !== 'IN_PROGRESS')) return false;

	const statusField = task.fields.get('status');
	parsed.lines[statusField.lineIndex] = statusField.fullMatch.replace(statusField.value, 'NEEDS_INPUT');

	const indicesToRemove = [];
	if (task.fields.has('automation_error')) indicesToRemove.push(task.fields.get('automation_error').lineIndex);
	if (task.fields.has('automation_error_at')) indicesToRemove.push(task.fields.get('automation_error_at').lineIndex);
	indicesToRemove.sort((a, b) => b - a).forEach(idx => parsed.lines.splice(idx, 1));

	parsed.lines.splice(
		statusField.lineIndex + 1,
		0,
		`- automation_error_at: ${new Date().toISOString()}`,
		`- automation_error: ${sanitizeError(reason)}`
	);
	await writeParsedBoard(parsed);
	return true;
}

async function recoverInterruptedTasks() {
	const parsed = parseQueue(await readBoard());
	const interrupted = parsed.tasks
		.filter(
			(task) =>
				task.id !== 'TASK-TEMPLATE' &&
				taskStatus(task) === 'IN_PROGRESS' &&
				task.fields.get('requested_by')?.value === '岩田リーダー'
		)
		.sort(
			(left, right) => right.fields.get('status').lineIndex - left.fields.get('status').lineIndex
		);

	for (const task of interrupted) {
		const statusField = task.fields.get('status');
		parsed.lines[statusField.lineIndex] = statusField.fullMatch.replace(statusField.value, 'NEEDS_INPUT');

		const indicesToRemove = [];
		if (task.fields.has('automation_error')) indicesToRemove.push(task.fields.get('automation_error').lineIndex);
		if (task.fields.has('automation_error_at')) indicesToRemove.push(task.fields.get('automation_error_at').lineIndex);
		indicesToRemove.sort((a, b) => b - a).forEach(idx => parsed.lines.splice(idx, 1));

		parsed.lines.splice(
			statusField.lineIndex + 1,
			0,
			`- automation_error_at: ${new Date().toISOString()}`,
			'- automation_error: 前回のランナーが完了前に停止したため、安全のため処理を中断しました。内容を確認してからREADYへ戻してください。'
		);
	}

	if (interrupted.length > 0) {
		await writeParsedBoard(parsed);
		console.log(
			`[team-board] 中断状態のタスク ${interrupted.length} 件を NEEDS_INPUT にしました。`
		);
	}
}

function processIsAlive(pid) {
	if (!Number.isSafeInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === 'EPERM';
	}
}

async function removeStaleLock() {
	let owner;
	try {
		owner = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return;
		let lockStat;
		try {
			lockStat = await stat(LOCK_PATH);
		} catch (statError) {
			if (statError.code === 'ENOENT') return;
			throw new RunnerError(`ロックを確認できません: ${statError.message}`, EXIT_IO);
		}
		if (Date.now() - lockStat.mtimeMs < LOCK_STALE_MS) {
			throw new RunnerError('別のランナーがロックを初期化中です。', EXIT_LOCKED);
		}
	}

	if (owner && processIsAlive(owner.pid)) {
		throw new RunnerError(`別のランナーが実行中です (PID ${owner.pid})。`, EXIT_LOCKED);
	}
	try {
		await unlink(LOCK_PATH);
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw new RunnerError(`古いロックを削除できません: ${error.message}`, EXIT_IO);
		}
	}
}

async function acquireLock() {
	const token = randomUUID();
	for (let attempt = 0; attempt < 3; attempt += 1) {
		let handle = null;
		try {
			handle = await open(LOCK_PATH, 'wx', 0o600);
			await handle.writeFile(`${JSON.stringify({ pid: process.pid, token })}\n`, 'utf8');
			await handle.close();
			return token;
		} catch (error) {
			if (handle) {
				await handle.close().catch(() => {});
			}
			if (error.code !== 'EEXIST') {
				await unlink(LOCK_PATH).catch(() => {});
				throw new RunnerError(`ロックを作成できません: ${error.message}`, EXIT_IO);
			}
			await removeStaleLock();
		}
	}
	throw new RunnerError('ランナーのロックを取得できません。', EXIT_LOCKED);
}

function releaseLockSync(token) {
	try {
		const owner = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
		if (owner.token === token) unlinkSync(LOCK_PATH);
	} catch (error) {
		if (error.code !== 'ENOENT') console.error(`[team-board] ロック解放エラー: ${error.message}`);
	}
}

let activeChild = null;
let activeTaskId = null;
let activeTaskFailurePromise = null;

async function failActiveTask(reason) {
	const taskId = activeTaskId;
	if (!taskId) return;
	if (!activeTaskFailurePromise) {
		activeTaskFailurePromise = markTaskNeedsInput(taskId, reason).finally(() => {
			if (activeTaskId === taskId) activeTaskId = null;
			activeTaskFailurePromise = null;
		});
	}
	await activeTaskFailurePromise;
}

function runCodex(taskId) {
	return new Promise((resolvePromise, rejectPromise) => {
		let timedOut = false;
		let killTimer = null;
		const child = spawn(
			'codex',
			[
				'--ask-for-approval',
				'never',
				'exec',
				'--sandbox',
				'workspace-write',
				'--cd',
				PROJECT_ROOT,
				'--ephemeral',
				'--strict-config',
				'-c',
				'shell_environment_policy.inherit="core"',
				'-c',
				'shell_environment_policy.ignore_default_excludes=false',
				'-'
			],
			{ cwd: PROJECT_ROOT, shell: false, stdio: ['pipe', 'inherit', 'inherit'] }
		);
		activeChild = child;

		const timeoutTimer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGTERM');
			killTimer = setTimeout(() => child.kill('SIGKILL'), CHILD_TERMINATE_GRACE_MS);
		}, CODEX_TIMEOUT_MS);

		const clearTimers = () => {
			clearTimeout(timeoutTimer);
			if (killTimer) clearTimeout(killTimer);
		};

		child.stdin.on('error', (error) => {
			if (error.code !== 'EPIPE') {
				console.error(`[team-board] Codex stdin エラー: ${error.message}`);
			}
		});
		child.once('error', (error) => {
			clearTimers();
			if (activeChild === child) activeChild = null;
			rejectPromise(
				new RunnerError(
					`Codex を起動できません: ${error.message}`,
					error.code === 'ENOENT' ? 127 : 1
				)
			);
		});
		child.once('close', (code, signal) => {
			clearTimers();
			if (activeChild === child) activeChild = null;
			if (timedOut) {
				rejectPromise(new RunnerError('Codex が30分以内に完了しなかったため停止しました。', 124));
			} else if (code === 0) {
				resolvePromise();
			} else {
				rejectPromise(
					new RunnerError(
						`Codex が異常終了しました (${signal ? `signal ${signal}` : `code ${code}`})。`,
						code || 1
					)
				);
			}
		});
		child.stdin.end(buildCodexPrompt(taskId));
	});
}

async function terminateActiveChild() {
	const child = activeChild;
	if (!child || child.exitCode !== null || child.signalCode !== null) return;

	await new Promise((resolvePromise) => {
		let forceTimer = null;
		let finalTimer = null;
		const finish = () => {
			if (forceTimer) clearTimeout(forceTimer);
			if (finalTimer) clearTimeout(finalTimer);
			resolvePromise();
		};
		child.once('close', finish);
		child.kill('SIGTERM');
		forceTimer = setTimeout(() => child.kill('SIGKILL'), CHILD_TERMINATE_GRACE_MS);
		finalTimer = setTimeout(finish, CHILD_TERMINATE_GRACE_MS + 2_000);
	});
}

async function inspectBoard(dryRun) {
	const markdown = await readBoard();
	const taskIds = findReadyTasks(markdown);
	if (taskIds.length === 0) {
		console.log('[team-board] 対象の READY タスクはありません。');
		return false;
	}

	console.log(`[team-board] 対象の READY タスク ${taskIds.length} 件: ${taskIds.join(', ')}`);
	if (dryRun) {
		console.log('[team-board] dry-run: Codex は起動しません。');
		return false;
	}

	const taskId = taskIds[0];
	await claimTask(taskId);
	activeTaskId = taskId;
	console.log(`[team-board] ${taskId} を IN_PROGRESS にして Codex を起動します。`);

	try {
		await runCodex(taskId);
	} catch (error) {
		await failActiveTask(error.message).catch((markError) => {
			console.error(`[team-board] 失敗状態を記録できません: ${markError.message}`);
		});
		throw error;
	}

	const latest = parseQueue(await readBoard());
	const completedTask = latest.tasks.find((task) => task.id === taskId);
	const completedStatus = taskStatus(completedTask);
	if (completedStatus !== 'DONE' && completedStatus !== 'NEEDS_INPUT') {
		const stateError = new RunnerError(
			`${taskId} の終了状態が不正です (${completedStatus || 'MISSING'})。`,
			EXIT_STATE
		);
		await failActiveTask(stateError.message).catch((markError) => {
			console.error(`[team-board] 失敗状態を記録できません: ${markError.message}`);
		});
		throw stateError;
	}

	activeTaskId = null;
	console.log(`[team-board] ${taskId} が ${completedStatus} で終了しました。`);
	return readyTasksFromParsed(latest).length > 0;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printUsage();
		return;
	}

	const lockToken = await acquireLock();
	let debounceTimer = null;
	let processing = false;
	let pending = false;
	let shuttingDown = false;
	let watching = false;
	let shutdownPromise = null;

	const stopWatching = () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		if (watching) {
			unwatchFile(BOARD_PATH, onBoardChange);
			watching = false;
		}
	};

	const cleanup = () => {
		stopWatching();
		releaseLockSync(lockToken);
	};

	const shutdown = (exitCode) => {
		if (shutdownPromise) return shutdownPromise;
		shuttingDown = true;
		stopWatching();
		shutdownPromise = (async () => {
			await terminateActiveChild();
			await failActiveTask('ランナーがシグナルにより停止されました。').catch((error) => {
				console.error(`[team-board] 中断状態を記録できません: ${error.message}`);
			});
			releaseLockSync(lockToken);
			process.exit(exitCode);
		})();
		return shutdownPromise;
	};

	process.once('exit', () => releaseLockSync(lockToken));
	process.once('SIGINT', () => void shutdown(130));
	process.once('SIGTERM', () => void shutdown(143));

	const runSerialized = async () => {
		if (processing) {
			pending = true;
			return;
		}
		processing = true;
		try {
			do {
				pending = false;
				const moreReady = await inspectBoard(options.dryRun);
				if (options.dryRun || (!moreReady && !pending)) break;
			} while (!shuttingDown);
		} finally {
			processing = false;
		}
	};

	function onBoardChange(current, previous) {
		if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) return;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			void runSerialized().catch((error) => {
				console.error(`[team-board] ${error.message}`);
				void shutdown(error.exitCode || 1);
			});
		}, WATCH_INTERVAL_MS);
	}

	try {
		if (options.mode === 'watch') {
			watchFile(BOARD_PATH, { interval: WATCH_INTERVAL_MS, persistent: true }, onBoardChange);
			watching = true;
			console.log('[team-board] TEAM_BOARD.md を監視中です。Ctrl+C で終了します。');
		}

		if (!options.dryRun) await recoverInterruptedTasks();
		await runSerialized();
		if (options.mode === 'once') cleanup();
	} catch (error) {
		cleanup();
		throw error;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`[team-board] ${error.message}`);
		process.exitCode = error.exitCode || 1;
	});
}
