export const EXIT_USAGE = 2;

export class RunnerError extends Error {
	constructor(message, exitCode = 1) {
		super(message);
		this.exitCode = exitCode;
	}
}

export const TASK_ID_PATTERN = /^TASK-[A-Za-z0-9][A-Za-z0-9._-]{0,58}$/u;

export function cleanValue(value) {
	let result = value
		.trim()
		.replace(/\s*<!--.*?-->\s*$/u, '')
		.trim();
	for (const [start, end] of [
		['`', '`'],
		['**', '**'],
		['__', '__'],
		['"', '"'],
		["'", "'"]
	]) {
		if (result.startsWith(start) && result.endsWith(end)) {
			result = result.slice(start.length, -end.length).trim();
		}
	}
	return result;
}

export function updateFence(line, fence) {
	const match = line.match(/^\s*(`{3,}|~{3,})/u);
	if (!match) return { fence, changed: false };

	const marker = match[1];
	if (!fence) {
		return { fence: { character: marker[0], length: marker.length }, changed: true };
	}
	if (marker[0] === fence.character && marker.length >= fence.length) {
		return { fence: null, changed: true };
	}
	return { fence, changed: true };
}

export function parseTaskFields(lines, startIndex, endIndex, taskId) {
	const fields = new Map();
	let fence = null;

	for (let index = startIndex; index < endIndex; index += 1) {
		const fenceResult = updateFence(lines[index], fence);
		fence = fenceResult.fence;
		if (fenceResult.changed || fence) continue;

		const match = lines[index].match(
			/^[-*+]\s+(?:\*\*|__)?(status|requested_by|automation_started_at|automation_error_at|automation_error)(?:\*\*|__)?\s*:\s*(.*?)\s*$/iu
		);
		if (!match) continue;

		const key = match[1].toLowerCase();
		if (fields.has(key)) {
			throw new RunnerError(`${taskId} に ${key} が複数あります。`, EXIT_USAGE);
		}
		fields.set(key, { 
			value: cleanValue(match[2]), 
			lineIndex: index,
			originalKey: match[1],
			fullMatch: match[0]
		});
	}

	return fields;
}

export function parseQueue(markdown) {
	const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
	const lines = markdown.split(/\r?\n/u);
	const queueStart = lines.findIndex((line) =>
		/^##\s+📥\uFE0F?\s*指示キュー（自動処理）\s*$/u.test(line.trim())
	);
	if (queueStart < 0) return { eol, lines, tasks: [] };

	let queueEnd = lines.length;
	let fence = null;
	for (let index = queueStart + 1; index < lines.length; index += 1) {
		const fenceResult = updateFence(lines[index], fence);
		fence = fenceResult.fence;
		if (fenceResult.changed || fence) continue;
		if (/^##(?:\s|$)/u.test(lines[index])) {
			queueEnd = index;
			break;
		}
	}

	const tasks = [];
	let current = null;
	fence = null;
	for (let index = queueStart + 1; index < queueEnd; index += 1) {
		const fenceResult = updateFence(lines[index], fence);
		fence = fenceResult.fence;
		if (fenceResult.changed || fence) continue;

		const heading = lines[index].match(/^###\s+(.+?)\s*$/u);
		if (!heading) continue;
		if (current) current.endIndex = index;
		current = {
			id: cleanValue(heading[1]),
			headingIndex: index,
			startIndex: index + 1,
			endIndex: queueEnd,
			fields: null
		};
		tasks.push(current);
	}

	const seenIds = new Set();
	for (const task of tasks) {
		if (!TASK_ID_PATTERN.test(task.id)) {
			throw new RunnerError(
				`無効なタスクIDです: ${task.id}。TASK- で始まる半角英数字・._- を使用してください。`,
				EXIT_USAGE
			);
		}
		if (seenIds.has(task.id)) {
			throw new RunnerError(`タスクIDが重複しています: ${task.id}`, EXIT_USAGE);
		}
		seenIds.add(task.id);
		task.fields = parseTaskFields(lines, task.startIndex, task.endIndex, task.id);
	}

	return { eol, lines, tasks };
}

export function taskStatus(task) {
	return task?.fields.get('status')?.value.toUpperCase();
}

export function readyTasksFromParsed(parsed) {
	return parsed.tasks
		.filter(
			(task) =>
				task.id !== 'TASK-TEMPLATE' &&
				taskStatus(task) === 'READY' &&
				task.fields.get('requested_by')?.value === '岩田リーダー'
		)
		.map((task) => task.id);
}

export function findReadyTasks(markdown) {
	return readyTasksFromParsed(parseQueue(markdown));
}
