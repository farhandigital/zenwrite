<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { untrack } from 'svelte';
	import { Download, Menu } from 'lucide-svelte';
	import { EditorView, keymap } from '@codemirror/view';
	import { markdown } from '@codemirror/lang-markdown';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { tags as t } from '@lezer/highlight';
	import { EditorSelection } from '@codemirror/state';
	import type { Command } from '@codemirror/view';

	let titleInput: HTMLInputElement | undefined = $state();
	let editorContainer: HTMLDivElement | undefined = $state();
	let editorView: EditorView | undefined;

	const customHighlightStyle = HighlightStyle.define([
		{ tag: t.heading, color: "var(--accent)", fontWeight: "bold" },
		{ tag: t.strong, fontWeight: "bold" },
		{ tag: t.emphasis, fontStyle: "italic" },
		{ tag: t.link, color: "var(--accent)", textDecoration: "underline" },
		{ tag: t.url, color: "var(--text-muted)" },
		{ tag: t.quote, color: "var(--text-muted)", fontStyle: "italic", borderLeft: "4px solid var(--accent)", paddingLeft: "15px" },
		{ tag: t.list, color: "var(--text)" },
		{ tag: t.monospace, backgroundColor: "var(--accent-glow)", borderRadius: "3px", padding: "2px 4px", fontFamily: "monospace", fontSize: "1.1rem" },
		{ tag: t.strikethrough, textDecoration: "line-through" }
	]);

	const minimalTheme = EditorView.theme({
		"&": {
			color: "var(--text)",
			backgroundColor: "transparent",
			height: "100%"
		},
		".cm-content": {
			fontFamily: "var(--font-editor)",
			fontSize: "1.25rem",
			lineHeight: "1.8",
			padding: "0 0 30px 0",
			whiteSpace: "pre-wrap"
		},
		"&.cm-focused": {
			outline: "none"
		},
		".cm-cursor, .cm-dropCursor": { 
			borderLeftColor: "var(--text)", 
			borderLeftWidth: "2px" 
		},
		".cm-scroller": {
			overflow: "visible", /* Let parent handle scrolling */
			fontFamily: "var(--font-editor)",
		},
		".cm-line": {
			padding: "0"
		}
	});

	/**
	 * Wraps/unwraps the current selection with a symmetric inline markdown marker.
	 * - No selection → inserts `marker + marker` and places cursor between them.
	 * - Selection already wrapped → removes the surrounding markers.
	 * - Otherwise → wraps the selection.
	 */
	function toggleInlineMarkup(marker: string): Command {
		return (view) => {
			const { state } = view;
			const changes = state.changeByRange((range) => {
				const selectedText = state.sliceDoc(range.from, range.to);

				// Toggle OFF: selection includes the markers
				if (
					selectedText.startsWith(marker) &&
					selectedText.endsWith(marker) &&
					selectedText.length >= marker.length * 2
				) {
					const inner = selectedText.slice(marker.length, -marker.length);
					return {
						changes: { from: range.from, to: range.to, insert: inner },
						range: EditorSelection.range(range.from, range.from + inner.length)
					};
				}

				// Toggle OFF: markers surround the selection in the document
				const before = state.sliceDoc(range.from - marker.length, range.from);
				const after = state.sliceDoc(range.to, range.to + marker.length);
				if (before === marker && after === marker) {
					return {
						changes: [
							{ from: range.from - marker.length, to: range.from, insert: '' },
							{ from: range.to, to: range.to + marker.length, insert: '' }
						],
						range: EditorSelection.range(
							range.from - marker.length,
							range.to - marker.length
						)
					};
				}

				// Insert placeholder and position cursor between markers when nothing is selected
				if (range.empty) {
					return {
						changes: { from: range.from, insert: marker + marker },
						range: EditorSelection.cursor(range.from + marker.length)
					};
				}

				// Wrap selected text
				return {
					changes: [
						{ from: range.from, insert: marker },
						{ from: range.to, insert: marker }
					],
					range: EditorSelection.range(
						range.from + marker.length,
						range.to + marker.length
					)
				};
			});

			view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
			return true;
		};
	}

	/**
	 * Wraps the selected text as a Markdown link: [text](url)
	 * - No selection → inserts `[](url)` and places cursor where you type link text
	 * - Selection → wraps as `[selection](url)` and selects the placeholder 'url'
	 */
	const insertLink: Command = (view) => {
		const { state } = view;
		const changes = state.changeByRange((range) => {
			const selectedText = state.sliceDoc(range.from, range.to);
			if (range.empty) {
				// Insert []() and place cursor inside []
				const insert = '[](url)';
				return {
					changes: { from: range.from, insert },
					range: EditorSelection.cursor(range.from + 1)
				};
			}
			// Wrap selected text, select 'url' placeholder so user can immediately type
			const insert = `[${selectedText}](url)`;
			const urlStart = range.from + selectedText.length + 3; // after `[selected](`
			const urlEnd = urlStart + 3; // length of 'url'
			return {
				changes: { from: range.from, to: range.to, insert },
				range: EditorSelection.range(urlStart, urlEnd)
			};
		});

		view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
		return true;
	};

	const markdownKeymap = [
		{ key: 'Mod-b', run: toggleInlineMarkup('**') },
		{ key: 'Mod-i', run: toggleInlineMarkup('*') },
		{ key: 'Mod-`', run: toggleInlineMarkup('`') },
		{ key: 'Mod-Shift-s', run: toggleInlineMarkup('~~') },
		{ key: 'Mod-k', run: insertLink },
	];

	function handleTitleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		appState.updateCurrent({ title: target.value });
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
							EditorView.lineWrapping,
							markdown(),
							syntaxHighlighting(customHighlightStyle, { fallback: true }),
							minimalTheme,
							keymap.of(markdownKeymap),
							EditorView.updateListener.of((update) => {
								if (update.docChanged) {
									appState.updateCurrent({ content: update.state.doc.toString() });
								}
							})
						],
						parent: editorContainer
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
					scrollIntoView: true
				});
				editorView!.focus();
				// Immediately clear the state
				appState.scrollToIndex = null;
			});
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
			padding: 20px 30px 120px;
		}
		.title-input {
			font-size: 2.2rem;
		}
		.codemirror-wrapper :global(.cm-content) {
			font-size: 1.1rem;
		}
	}
</style>
