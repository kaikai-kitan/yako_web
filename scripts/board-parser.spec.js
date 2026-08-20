import { describe, it, expect } from 'vitest';
import {
	cleanValue,
	updateFence,
	parseTaskFields,
	parseQueue,
	findReadyTasks,
	RunnerError
} from './board-parser.mjs';

describe('board-parser', () => {
	describe('cleanValue', () => {
		it('removes HTML comments and trims', () => {
			expect(cleanValue('  value <!-- comment -->  ')).toBe('value');
			expect(cleanValue('value')).toBe('value');
		});

		it('strips surrounding quotes and markdown markers', () => {
			expect(cleanValue('**value**')).toBe('value');
			expect(cleanValue('__value__')).toBe('value');
			expect(cleanValue('`value`')).toBe('value');
			expect(cleanValue('"value"')).toBe('value');
			expect(cleanValue("'value'")).toBe('value');
		});
	});

	describe('updateFence', () => {
		it('detects fence start', () => {
			const { fence, changed } = updateFence('```js', null);
			expect(changed).toBe(true);
			expect(fence).toEqual({ character: '`', length: 3 });
		});

		it('detects fence end', () => {
			const { fence, changed } = updateFence('```', { character: '`', length: 3 });
			expect(changed).toBe(true);
			expect(fence).toBeNull();
		});

		it('ignores unmatched fence ends', () => {
			const { fence, changed } = updateFence('~~', { character: '`', length: 3 });
			expect(changed).toBe(false);
			expect(fence).toEqual({ character: '`', length: 3 });
		});
	});

	describe('parseTaskFields', () => {
		it('parses valid fields', () => {
			const lines = [
				'- status: READY',
				'* requested_by: 岩田リーダー',
				'- automation_started_at: 2026-08-20T00:00:00Z',
				'- automation_error: Some error',
				'- automation_error_at: 2026-08-20T00:01:00Z'
			];
			const fields = parseTaskFields(lines, 0, lines.length, 'TASK-1');
			expect(fields.get('status').value).toBe('READY');
			expect(fields.get('status').lineIndex).toBe(0);
			expect(fields.get('requested_by').value).toBe('岩田リーダー');
			expect(fields.get('automation_started_at').value).toBe('2026-08-20T00:00:00Z');
			expect(fields.get('automation_error').value).toBe('Some error');
			expect(fields.get('automation_error_at').value).toBe('2026-08-20T00:01:00Z');
		});

		it('throws on duplicate fields', () => {
			const lines = [
				'- status: READY',
				'- status: DONE'
			];
			expect(() => parseTaskFields(lines, 0, lines.length, 'TASK-1')).toThrow(RunnerError);
		});
	});

	describe('parseQueue', () => {
		it('extracts tasks from the queue', () => {
			const markdown = `
## 📥 指示キュー（自動処理）

### TASK-123
- status: READY
- requested_by: 岩田リーダー

### TASK-456
- status: IN_PROGRESS
- requested_by: 田中

## 💬 タイムライン
`;
			const parsed = parseQueue(markdown);
			expect(parsed.tasks).toHaveLength(2);
			expect(parsed.tasks[0].id).toBe('TASK-123');
			expect(parsed.tasks[0].fields.get('status').value).toBe('READY');
			expect(parsed.tasks[1].id).toBe('TASK-456');
			expect(parsed.tasks[1].fields.get('status').value).toBe('IN_PROGRESS');
		});

		it('ignores tasks inside code fences', () => {
			const markdown = `
## 📥 指示キュー（自動処理）

\`\`\`markdown
### TASK-IGNORE
- status: READY
\`\`\`

### TASK-VALID
- status: READY
`;
			const parsed = parseQueue(markdown);
			expect(parsed.tasks).toHaveLength(1);
			expect(parsed.tasks[0].id).toBe('TASK-VALID');
		});

		it('throws on invalid task IDs', () => {
			const markdown = `
## 📥 指示キュー（自動処理）

### INVALID タスク
- status: READY
`;
			expect(() => parseQueue(markdown)).toThrow(RunnerError);
		});

		it('throws on duplicate task IDs', () => {
			const markdown = `
## 📥 指示キュー（自動処理）

### TASK-1
- status: READY

### TASK-1
- status: DONE
`;
			expect(() => parseQueue(markdown)).toThrow(RunnerError);
		});
	});

	describe('findReadyTasks', () => {
		it('returns ready tasks requested by 岩田リーダー', () => {
			const markdown = `
## 📥 指示キュー（自動処理）

### TASK-TEMPLATE
- status: READY
- requested_by: 岩田リーダー

### TASK-1
- status: READY
- requested_by: 岩田リーダー

### TASK-2
- status: READY
- requested_by: 田中

### TASK-3
- status: IN_PROGRESS
- requested_by: 岩田リーダー
`;
			const ready = findReadyTasks(markdown);
			expect(ready).toEqual(['TASK-1']);
		});
	});
});
