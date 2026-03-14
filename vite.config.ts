import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					// Check for zip.js by its node_modules path
					if (id.includes('node_modules/@zip.js')) {
						return 'vendor-zip';
					}
					// Separate codemirror chunk
					if (
						id.includes('node_modules/@codemirror') ||
						id.includes('node_modules/codemirror')
					) {
						return 'vendor-codemirror';
					}
					// Lucide icons in separate chunk
					if (id.includes('node_modules/lucide-svelte')) {
						return 'vendor-lucide';
					}
				},
			},
		},
	},
});
