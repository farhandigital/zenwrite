<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import { Download, Menu } from 'lucide-svelte';

	let titleInput: HTMLInputElement | undefined = $state();
	let contentTextarea: HTMLTextAreaElement | undefined = $state();

	// Keep textarea height synced with content
	function autoResize() {
		if (contentTextarea) {
			contentTextarea.style.height = 'auto';
			contentTextarea.style.height = contentTextarea.scrollHeight + 'px';
		}
	}

	function handleTitleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		appState.updateCurrent({ title: target.value });
	}

	function handleContentChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		appState.updateCurrent({ content: target.value });
		autoResize();
	}

	function exportMarkdown() {
		const doc = appState.currentDocument;
		if (!doc) return;
		
		const astroFrontmatterStr = appState.getAstroExport(doc);
		const blob = new Blob([astroFrontmatterStr], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		
		const a = document.createElement('a');
		a.href = url;
		// Create a clean filename
		const filename = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Trigger resize on mount and doc change
	// We'll use an effect or reactive statement in svelte 5.
	$effect(() => {
		if (appState.currentDocument?.content !== undefined) {
			// small delay to let dom paint before reading scrollHeight
			setTimeout(autoResize, 0);
		}
	});
</script>

<div class="editor-container">
	{#if appState.currentDocument}
		<div class="top-nav">
			<button class="mobile-menu" onclick={() => appState.sidebarOpen = !appState.sidebarOpen}>
				<Menu size={24} />
			</button>
			<div class="glass-pill-actions">
				<button class="action-btn" onclick={exportMarkdown} title="Export Astro Markdown">
					<Download size={16} /> <span>Export to Astro</span>
				</button>
			</div>
		</div>

		<div class="editor-content" role="region" aria-label="Editor Area">
			<input 
				class="title-input" 
				type="text" 
				placeholder="Untitled Document" 
				value={appState.currentDocument.title} 
				oninput={handleTitleChange} 
				bind:this={titleInput}
			/>
			
			<textarea 
				class="markdown-input" 
				placeholder="Write your thoughts here... Use standard Markdown." 
				value={appState.currentDocument.content} 
				oninput={handleContentChange}
				bind:this={contentTextarea}
			></textarea>
		</div>
	{:else}
		<div class="empty-state">
			<h3>No document selected</h3>
			<p>Select a document from the sidebar or create a new one.</p>
		</div>
	{/if}
</div>

<style>
	.editor-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		position: relative;
		height: 100vh;
		overflow-y: auto;
		scroll-behavior: smooth;
	}

	.top-nav {
		position: sticky;
		top: 0;
		padding: 24px 40px;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		z-index: 20;
		pointer-events: none;
	}

	.mobile-menu {
		display: none;
		pointer-events: auto;
		color: var(--text-muted);
	}

	@media (max-width: 768px) {
		.top-nav {
			justify-content: space-between;
			padding: 16px 20px;
		}
		.mobile-menu {
			display: block;
		}
	}

	.glass-pill-actions {
		display: flex;
		background: var(--overlay);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		padding: 6px 16px;
		border-radius: 40px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.05);
		pointer-events: auto;
		transition: all 0.3s ease;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text);
		transition: opacity 0.2s;
	}

	.action-btn:hover {
		opacity: 0.7;
		color: var(--accent);
	}

	.editor-content {
		max-width: 800px;
		width: 100%;
		margin: 0 auto;
		padding: 40px 60px 180px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.title-input {
		font-family: var(--font-editor);
		font-size: 3rem;
		font-weight: 700;
		color: var(--text);
		border: none;
		outline: none;
		background: transparent;
		line-height: 1.2;
		letter-spacing: -0.03em;
		width: 100%;
	}

	.title-input::placeholder {
		color: var(--text-muted);
		opacity: 0.5;
	}

	.markdown-input {
		font-family: var(--font-editor);
		font-size: 1.25rem;
		line-height: 1.8;
		color: var(--text);
		border: none;
		outline: none;
		background: transparent;
		resize: none;
		min-height: 60vh;
		width: 100%;
		overflow: hidden;
		padding-bottom: 30px;
	}

	.markdown-input::placeholder {
		color: var(--text-muted);
		opacity: 0.5;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.empty-state h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 8px;
	}

	/* Responsive design limits */
	@media (max-width: 768px) {
		.editor-content {
			padding: 20px 30px 120px;
		}
		.title-input {
			font-size: 2.2rem;
		}
		.markdown-input {
			font-size: 1.1rem;
		}
	}
</style>
