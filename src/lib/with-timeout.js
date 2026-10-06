/** Stop waiting for an unavailable service without leaving the UI loading forever. */
export async function withTimeout(promise, milliseconds = 15000) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error('読み込みがタイムアウトしました')), milliseconds);
			})
		]);
	} finally {
		clearTimeout(timer);
	}
}
