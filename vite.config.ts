import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 4200,
		host: '127.0.0.1',
		strictPort: true,
	},
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					// Separate codemirror chunk
					if (
						id.includes('node_modules/@codemirror') ||
						id.includes('node_modules/codemirror')
					) {
						return 'vendor-codemirror';
					}
				},
			},
		},
	},
});
