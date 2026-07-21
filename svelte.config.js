import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		prerender: {
			// IR資料(PDF)は運用側で後から static/ir/ に配置する。未配置時の404でビルドを止めない。
			handleHttpError: ({ path, message }) => {
				if (path.startsWith('/ir/')) return;
				throw new Error(message);
			}
		}
	}
};

export default config;
