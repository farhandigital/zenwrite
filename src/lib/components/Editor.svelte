<script lang="ts">
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import { EditorView, keymap } from '@codemirror/view';
import { Download, Maximize2, Menu, Minimize2 } from 'lucide-svelte';
import { untrack } from 'svelte';
import {
	customHighlightStyle,
	handleEnterKeyAtDOMLevel,
	markdownKeymap,
	minimalTheme,
} from '$lib/editor/commands';
import { appState } from '$lib/state.svelte';

let titleInput: HTMLInputElement | undefined = $state();
let editorContainer: HTMLDivElement | undefined = $state();
let editorView: EditorView | undefined;
let autoSelectedDocIds = new Set<string>();

function handleTitleChange(e: Event) {
	const target = e.target as HTMLInputElement;
	appState.updateCurrent({ title: target.value });
}

function handleTitleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && editorView) {
		e.preventDefault();
		editorView.focus();
	}
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
	const filename =
		(doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function handleGlobalKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && appState.zenMode) {
		appState.zenMode = false;
	}
}

let initializedId: string | null = null;

$effect(() => {
	const cDoc = appState.currentDocument;

	if (cDoc && editorContainer) {
		untrack(() => {
			if (initializedId !== cDoc.id) {
				if (editorView) {
					editorView.destroy();
				}

				editorView = new EditorView({
					doc: cDoc.content,
					extensions: [
						handleEnterKeyAtDOMLevel,
						EditorView.lineWrapping,
						keymap.of(markdownKeymap),
						markdown(),
						syntaxHighlighting(customHighlightStyle, { fallback: true }),
						minimalTheme,
						EditorView.theme({}, { dark: appState.theme === 'dark' }),
						EditorView.updateListener.of((update) => {
							if (update.docChanged) {
								appState.updateCurrent({
									content: update.state.doc.toString(),
								});
							}
						}),
					],
					parent: editorContainer,
				});
				initializedId = cDoc.id;
			}
		});
	} else if (!cDoc && editorView) {
		untrack(() => {
			editorView!.destroy();
			editorView = undefined;
			initializedId = null;
		});
	}
});

$effect(() => {
	if (appState.scrollToIndex !== null && editorView) {
		const pos = appState.scrollToIndex;
		// Untrack to prevent circular dependencies
		untrack(() => {
			editorView!.dispatch({
				selection: { anchor: pos, head: pos },
				scrollIntoView: true,
			});
			editorView!.focus();
			// Immediately clear the state
			appState.scrollToIndex = null;
		});
	}
});

$effect(() => {
	// Auto-focus and select title only for newly created documents
	if (
		appState.currentDocument &&
		titleInput &&
		!autoSelectedDocIds.has(appState.currentDocument.id)
	) {
		untrack(() => {
			titleInput!.focus();
			titleInput!.select();
			autoSelectedDocIds.add(appState.currentDocument!.id);
		});
	}
});
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="editor-container">
	{#if appState.currentDocument}
		<div class="top-nav" class:zen={appState.zenMode}>
			<button class="mobile-menu" onclick={() => appState.sidebarOpen = !appState.sidebarOpen}>
				<Menu size={24} />
			</button>
			<div class="glass-pill-actions">
				<button class="action-btn" onclick={exportMarkdown} title="Export Astro Markdown">
					<Download size={16} /> <span>Export to Astro</span>
				</button>
				<div class="pill-divider"></div>
				<button 
					class="action-btn zen-btn" 
					class:active={appState.zenMode}
					onclick={() => appState.toggleZenMode()} 
					title={appState.zenMode ? 'Exit Zen Mode (Esc)' : 'Enter Zen Mode'}
				>
					{#if appState.zenMode}
						<Minimize2 size={16} /> <span>Exit Zen</span>
					{:else}
						<Maximize2 size={16} /> <span>Zen Mode</span>
					{/if}
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
				onkeydown={handleTitleKeydown}
				bind:this={titleInput}
			/>
			
			<div bind:this={editorContainer} class="codemirror-wrapper"></div>
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

	.top-nav.zen {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s ease;
	}

	.top-nav.zen:hover {
		opacity: 1;
		pointer-events: auto;
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
		align-items: center;
		gap: 4px;
		background: var(--overlay);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		padding: 6px 12px;
		border-radius: 40px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.05);
		pointer-events: auto;
		transition: all 0.3s ease;
	}

	.pill-divider {
		width: 1px;
		height: 16px;
		background: var(--border);
		margin: 0 4px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text);
		transition: opacity 0.2s, color 0.2s;
		padding: 4px 8px;
		border-radius: 20px;
	}

	.action-btn:hover {
		opacity: 0.7;
		color: var(--accent);
	}

	.zen-btn.active {
		color: var(--accent);
		background: var(--accent-glow);
	}

	.zen-btn.active:hover {
		opacity: 1;
		color: var(--accent);
	}

	.editor-content {
		max-width: 800px;
		width: calc(100% - 48px);
		margin: 48px auto;
		padding: 48px 60px 180px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		
		/* Light glass effect */
		background: rgba(128, 128, 128, 0.02);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid var(--border);
		border-radius: 20px;
		box-shadow: 
			0 8px 32px rgba(0, 0, 0, 0.03),
			inset 0 0 0 1px rgba(255, 255, 255, 0.05);
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

	.codemirror-wrapper {
		width: 100%;
		min-height: 60vh;
	}

	/* We target the CM elements to ensure clean styling within our dark/light scope */
	.codemirror-wrapper :global(.cm-editor) {
		background-color: transparent !important;
	}
	
	.codemirror-wrapper :global(.cm-scroller) {
		overflow: visible !important; 
		height: auto !important;
	}

	.codemirror-wrapper :global(.cm-content) {
		min-height: 60vh;
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
			padding: 32px 24px 120px;
			margin: 24px auto;
			width: calc(100% - 32px);
			border-radius: 16px;
		}
		.title-input {
			font-size: 2.2rem;
		}
		.codemirror-wrapper :global(.cm-content) {
			font-size: 1.1rem;
		}
	}
</style>
