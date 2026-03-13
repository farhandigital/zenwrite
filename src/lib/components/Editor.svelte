<script lang="ts">
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { Check, Copy, Maximize2, Menu, Minimize2, X } from 'lucide-svelte';
import { untrack } from 'svelte';
import { docStore } from '$lib/doc-store.svelte';
import {
	customHighlightStyle,
	handleEnterKeyAtDOMLevel,
	markdownKeymap,
	minimalTheme,
} from '$lib/editor/commands';
import { uiState } from '$lib/ui-state.svelte';

let titleInput: HTMLTextAreaElement | undefined = $state();
let editorContainer: HTMLDivElement | undefined = $state();
let editorView: EditorView | undefined;
let lastAutoScrollTime = 0;
const autoScrollCooldown = 80;

function autoResizeTitle() {
	if (!titleInput) return;
	titleInput.style.height = 'auto';
	titleInput.style.height = `${titleInput.scrollHeight}px`;
}

function handleTitleChange(e: Event) {
	const target = e.target as HTMLTextAreaElement;
	docStore.updateCurrent({ title: target.value });
	autoResizeTitle();
}

function handleTitleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && editorView) {
		e.preventDefault();
		editorView.focus();
	}
}

function handleInput(key: string, e: Event) {
	const target = e.target as HTMLInputElement | HTMLTextAreaElement;
	const val = target.value;
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.config };
		config[key] = val;
		docStore.updateCurrent({ config });
	}
}

function removeTag(index: number, e: MouseEvent) {
	e.stopPropagation();
	e.preventDefault();
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.config };
		const tags = [...(config.tags || [])];
		tags.splice(index, 1);
		config.tags = tags;
		docStore.updateCurrent({ config });
	}
}

function handleTagKeydown(e: KeyboardEvent) {
	const target = e.target as HTMLInputElement;
	if (e.key === ',' || e.key === 'Enter') {
		e.preventDefault();
		const val = target.value.trim();
		if (val && docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			if (!tags.includes(val)) {
				tags.push(val);
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
			target.value = '';
		}
	} else if (e.key === 'Backspace' && target.value === '') {
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			if (tags.length > 0) {
				tags.pop();
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
		}
	}
}

function handleTagInput(e: Event) {
	const target = e.target as HTMLInputElement;
	if (target.value.includes(',')) {
		const newTags = target.value
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			for (const nt of newTags) {
				if (!tags.includes(nt)) {
					tags.push(nt);
				}
			}
			config.tags = tags;
			docStore.updateCurrent({ config });
		}
		target.value = '';
	}
}

let copied = $state(false);

function formatDate(ts: number): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).format(new Date(ts));
}

async function copyMarkdown() {
	const doc = docStore.currentDocument;
	if (!doc) return;

	const markdownContent = docStore.getAstroExport(doc);
	await navigator.clipboard.writeText(markdownContent);

	copied = true;
	setTimeout(() => {
		copied = false;
	}, 2000);
}

function handleGlobalKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && uiState.zenMode) {
		uiState.zenMode = false;
	}
}

let initializedId: string | null = null;

$effect(() => {
	const currentDocument = docStore.currentDocument;

	if (currentDocument && editorContainer) {
		untrack(() => {
			if (initializedId !== currentDocument.id) {
				if (editorView) {
					editorView.destroy();
				}

				editorView = new EditorView({
					doc: currentDocument.content,
					extensions: [
						drawSelection(),
						handleEnterKeyAtDOMLevel,
						EditorView.lineWrapping,
						keymap.of(markdownKeymap),
						markdown(),
						syntaxHighlighting(customHighlightStyle, { fallback: true }),
						minimalTheme,
						EditorView.theme({}, { dark: uiState.theme === 'dark' }),
						EditorView.updateListener.of((update) => {
							if (update.docChanged) {
								docStore.updateCurrent({
									content: update.state.doc.toString(),
								});
							}
							if (update.selectionSet && editorView) {
								const cursor = update.state.selection.main.head;
								const coords = editorView.coordsAtPos(cursor);
								if (!coords) return;

								let scrollableParent: HTMLElement | null =
									editorView.scrollDOM.parentElement;
								while (scrollableParent) {
									if (
										scrollableParent.scrollHeight >
										scrollableParent.clientHeight
									)
										break;
									scrollableParent = scrollableParent.parentElement;
								}
								if (!scrollableParent) return;

								const parentRect = scrollableParent.getBoundingClientRect();
								const scrollThreshold = 120;

								if (coords.bottom > parentRect.bottom - scrollThreshold) {
									const now = Date.now();
									if (now - lastAutoScrollTime > autoScrollCooldown) {
										const scrollAmount =
											coords.bottom - (parentRect.bottom - scrollThreshold);
										scrollableParent.scrollTop += scrollAmount;
										lastAutoScrollTime = now;
									}
								}
							}
						}),
					],
					parent: editorContainer,
				});
				initializedId = currentDocument.id;
			}
		});
	} else if (!currentDocument && editorView) {
		untrack(() => {
			editorView!.destroy();
			editorView = undefined;
			initializedId = null;
		});
	}
});

$effect(() => {
	if (uiState.scrollToIndex !== null && editorView) {
		const pos = uiState.scrollToIndex;
		// Untrack to prevent circular dependencies
		untrack(() => {
			editorView!.dispatch({
				selection: { anchor: pos, head: pos },
				scrollIntoView: true,
			});
			editorView!.focus();
			// Immediately clear the state
			uiState.scrollToIndex = null;
		});
	}
});

$effect(() => {
	// Auto-focus title for brand-new documents so the cursor lands there,
	// signalling clearly that the user should start by writing a title.
	// `isNew` is persisted in the DB so this survives page reloads and
	// never misfires when navigating back to an existing document.
	if (docStore.currentDocument?.isNew && titleInput) {
		untrack(() => {
			titleInput!.focus();
			// Clear the flag immediately so it only fires once, ever.
			docStore.updateCurrent({ isNew: false });
		});
	}
});

$effect(() => {
	// Resize the textarea to fit the current title whenever the document
	// changes (switching docs) or when the textarea first mounts.
	// Reading both `currentDocument.title` and `titleInput` makes Svelte
	// re-run this effect on either change.
	if (docStore.currentDocument?.title !== undefined && titleInput) {
		untrack(() => autoResizeTitle());
	}
});
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="editor-container">
	{#if docStore.currentDocument}
		<div class="top-nav" class:zen={uiState.zenMode}>
			<button class="mobile-menu" onclick={() => uiState.sidebarOpen = !uiState.sidebarOpen}>
				<Menu size={24} />
			</button>
			<div class="glass-pill-actions">
				<button class="action-btn" onclick={copyMarkdown} title="Copy Markdown to clipboard">
					{#if copied}
						<Check size={16} /> <span>Copied!</span>
					{:else}
						<Copy size={16} /> <span>Copy Markdown</span>
					{/if}
				</button>
				<div class="pill-divider"></div>
				<button 
					class="action-btn zen-btn" 
					class:active={uiState.zenMode}
					onclick={uiState.toggleZenMode} 
					title={uiState.zenMode ? 'Exit Zen Mode (Esc)' : 'Enter Zen Mode'}
				>
					{#if uiState.zenMode}
						<Minimize2 size={16} /> <span>Exit Zen</span>
					{:else}
						<Maximize2 size={16} /> <span>Zen Mode</span>
					{/if}
				</button>
			</div>
		</div>

		<div class="editor-content" role="region" aria-label="Editor Area">
			<textarea 
				rows="1"
				class="title-input" 
				placeholder="Untitled Document" 
				value={docStore.currentDocument.title} 
				oninput={handleTitleChange}
				onkeydown={handleTitleKeydown}
				bind:this={titleInput}
			></textarea>

			<div class="doc-meta">
				<span>Created {formatDate(docStore.currentDocument.createdAt)}</span>
				<span class="meta-divider">·</span>
				<span>Updated {formatDate(docStore.currentDocument.updatedAt)}</span>
			</div>
			
			<div class="frontmatter-container" class:zen={uiState.zenMode}>
				<div class="fm-row">
					<div class="fm-label">Description</div>
					<textarea 
						class="fm-value-input fm-textarea" 
						rows="1" 
						value={docStore.currentDocument.config.description || ''} 
						oninput={(e) => {
							handleInput('description', e);
							const target = e.target as HTMLTextAreaElement;
							target.style.height = 'auto';
							target.style.height = `${target.scrollHeight}px`;
						}}
						placeholder="Add a short description..."
					></textarea>
				</div>
				<div class="fm-row">
					<div class="fm-label">Publish Date</div>
					<input 
						type="text" 
						class="fm-value-input" 
						value={docStore.currentDocument.config.pubDate || ''} 
						oninput={(e) => handleInput('pubDate', e)}
						placeholder="YYYY-MM-DD"
					/>
				</div>
				<div class="fm-row">
					<div class="fm-label">Tags</div>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="fm-tags-wrapper" onclick={() => document.getElementById('fm-tags-input')?.focus()}>
						{#each (docStore.currentDocument.config.tags || []) as tag, i}
							<span class="fm-tag">
								{tag}
								<button type="button" class="fm-tag-remove" aria-label="Remove tag" onclick={(e) => removeTag(i, e)}>
									<X size={12} strokeWidth={2.5}/>
								</button>
							</span>
						{/each}
						<input 
							id="fm-tags-input" 
							type="text" 
							class="fm-tag-input"
							onkeydown={handleTagKeydown}
							oninput={handleTagInput}
							placeholder={(docStore.currentDocument.config.tags || []).length === 0 ? "Add tags..." : ""}
						/>
					</div>
				</div>
			</div>
			
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
		font-size: 2rem;
		font-weight: 700;
		color: var(--text);
		border: none;
		outline: none;
		background: transparent;
		line-height: 1.2;
		letter-spacing: -0.03em;
		width: 100%;
		resize: none;
		overflow: hidden;
		height: auto;
	}

	.title-input::placeholder {
		color: var(--text-muted);
		opacity: 0.5;
	}

	.doc-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.78rem;
		color: var(--text-muted);
		opacity: 0.6;
		letter-spacing: 0.01em;
		margin-top: -12px;
	}

	.meta-divider {
		opacity: 0.5;
	}

	.frontmatter-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 24px;
		margin-bottom: 24px;
		padding-top: 24px;
		border-top: 1px dashed var(--border);
		transition: opacity 0.4s ease;
	}

	.frontmatter-container.zen {
		opacity: 0;
		pointer-events: none;
		height: 0;
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: none;
	}

	.fm-row {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		min-height: 32px;
	}

	.fm-label {
		width: 130px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		height: 32px;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-muted);
		opacity: 0.7;
		padding-left: 8px;
	}

	.fm-value-input, .fm-tags-wrapper {
		flex: 1;
		font-family: inherit;
		font-size: 0.9rem;
		color: var(--text);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 6px 10px;
		transition: all 0.2s;
	}
	
	.fm-value-input:hover, .fm-tags-wrapper:hover {
		background: rgba(128, 128, 128, 0.04);
	}

	.fm-value-input:focus, .fm-tags-wrapper:focus-within {
		background: rgba(128, 128, 128, 0.04);
		border-color: var(--border);
		outline: none;
	}

	.fm-textarea {
		resize: none;
		min-height: 32px;
		/* Default height fits one line. We auto-resize via js. */
	}

	.fm-tags-wrapper {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		cursor: text;
		min-height: 32px;
	}

	.fm-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 99px;
		font-size: 0.8rem;
		color: var(--text);
		transition: all 0.2s;
	}

	.fm-tag:hover {
		background: var(--accent-glow);
		border-color: rgba(59, 130, 246, 0.3);
		color: var(--accent);
	}

	.fm-tag-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: inherit;
		opacity: 0.5;
		cursor: pointer;
		padding: 0;
		transition: opacity 0.2s;
	}

	.fm-tag-remove:hover {
		opacity: 1;
	}

	.fm-tag-input {
		flex: 1;
		min-width: 80px;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text);
		font-family: inherit;
		font-size: 0.9rem;
		padding: 2px 0;
	}

	.fm-tag-input::placeholder {
		color: var(--text-muted);
		opacity: 0.5;
	}
	
	.fm-value-input::placeholder {
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
