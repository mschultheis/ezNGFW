import adapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';

const isDemo = process.env.DEMO_BUILD === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: isDemo
			? staticAdapter({ fallback: '404.html' })
			: adapter(),
		paths: {
			base: isDemo ? (process.env.DEMO_BASE || '/ezNGFW').replace(/\/+$/, '') : ''
		}
	}
};

export default config;
