<script lang="ts">
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import {
	AlertTriangle,
	Check,
	Copy,
	Maximize2,
	Menu,
	Minimize2,
	X,
} from 'lucide-svelte';
import { untrack } from 'svelte';
import { fade, fly } from 'svelte/transition';
import { docStore } from '$lib/doc-store.svelte';
import {
	customHighlightStyle,
	handleEnterKeyAtDOMLevel,
	markdownKeymap,
	minimalTheme,
} from '$lib/editor/commands';
import { tabPresence } from '$lib/tab-presence.svelte';
import { uiState } from '$lib/ui-state.svelte';
import Frontmatter from './Frontmatter.svelte';
import StatsBar from './StatsBar.svelte';

let titleInput: HTMLTextAreaElement | undefined = $state();
let editorContainer: HTMLDivElement | undefined = $state();
let editorView: EditorView | undefined;
let lastAutoScrollTime = 0;
const autoScrollCooldown = 80;

// ─── Conflict warning state ───────────────────────────────────────────────────

/**
 * The user can manually dismiss the warning for the current session.
 * It resets whenever the document changes so they always see it once
 * when switching to a doc that has a conflict.
 */
let warningDismissed = $state(false);

$effect(() => {
	// Re-arm the warning whenever the active document changes
	// (reading currentDocId makes this effect re-run on every doc switch).
	docStore.currentDocId; // eslint-disable-line @typescript-eslint/no-unused-expressions
	warningDismissed = false;
});

const showConflictWarning = $derived(
	tabPresence.hasConflict && !warningDismissed,
);

// ─── Title textarea ───────────────────────────────────────────────────────────

function autoResizeTitle() {
	if (!titleInput) return;
	titleInput.style.height = 'auto';
	titleInput.style.height = `${titleInput.scrollHeight}px`;
}

function handleTitleChange(e: Event) {
	const target = e.target as HTMLTextAreaElement;
	const doc = docStore.currentDocument;
	if (!doc) return;
	docStore.updateCurrent({
		metadata: {
			...doc.metadata,
			title: target.value,
		},
	});
	autoResizeTitle();
}

function handleTitleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && editorView) {
		e.preventDefault();
		editorView.focus();
	}
}

// ─── Copy markdown ────────────────────────────────────────────────────────────

let copied = $state(false);

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

// ─── Zen mode ─────────────────────────────────────────────────────────────────
// No manual Escape handler needed: the browser exits fullscreen on Esc natively,
// which fires fullscreenchange, handled by uiState.init().

// ─── CodeMirror ───────────────────────────────────────────────────────────────

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

// ─── Update editor when document content changes (e.g., after restore) ──────

$effect(() => {
	if (editorView && docStore.currentDocument) {
		const newContent = docStore.currentDocument.content;
		untrack(() => {
			const currentContent = editorView!.state.doc.toString();
			if (currentContent !== newContent) {
				editorView!.dispatch({
					changes: {
						from: 0,
						to: currentContent.length,
						insert: newContent,
					},
				});
			}
		});
	}
});

$effect(() => {
	if (uiState.scrollToIndex !== null && editorView) {
		const pos = uiState.scrollToIndex;
		untrack(() => {
			editorView!.dispatch({
				selection: { anchor: pos, head: pos },
				scrollIntoView: true,
			});
			editorView!.focus();
			uiState.scrollToIndex = null;
		});
	}
});

$effect(() => {
	if (docStore.currentDocument?.isNew && titleInput) {
		untrack(() => {
			titleInput!.focus();
			docStore._patchDocument({ isNew: false });
		});
	}
});

$effect(() => {
	if (docStore.currentDocument?.metadata.title !== undefined && titleInput) {
		untrack(() => autoResizeTitle());
	}
});
</script>



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

		<!-- ── Multi-tab conflict warning ──────────────────────────────────── -->
		{#if showConflictWarning}
			<div
				class="conflict-banner"
				role="alert"
				aria-live="polite"
				in:fly={{ y: -8, duration: 220 }}
				out:fade={{ duration: 160 }}
			>
				<div class="conflict-pill">
					<AlertTriangle size={14} class="conflict-icon" />
					<span class="conflict-msg">
						{#if tabPresence.conflictCount === 1}
							This document is open in another tab — edits may overwrite each other.
						{:else}
							This document is open in {tabPresence.conflictCount} other tabs — edits may overwrite each other.
						{/if}
					</span>
					<button
						class="conflict-dismiss"
						onclick={() => (warningDismissed = true)}
						aria-label="Dismiss warning"
						title="Dismiss"
					>
						<X size={12} strokeWidth={2.5} />
					</button>
				</div>
			</div>
		{/if}

		<div class="editor-content" role="region" aria-label="Editor Area">
			<textarea
				rows="1"
				class="title-input"
				placeholder="Untitled Document"
				value={docStore.currentDocument.metadata.title}
				oninput={handleTitleChange}
				onkeydown={handleTitleKeydown}
				bind:this={titleInput}
			></textarea>

			<Frontmatter />

			<div bind:this={editorContainer} class="codemirror-wrapper"></div>
		</div>

		<StatsBar />
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
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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

	/* ── Conflict warning ──────────────────────────────────────────────────── */

	.conflict-banner {
		display: flex;
		justify-content: center;
		/* Sits flush below the top-nav without a gap, negative margin pulls it
		   up into the space the top-nav's bottom padding already reserves. */
		margin-top: -16px;
		padding: 0 40px 12px;
		pointer-events: none;
		z-index: 15;
	}

	.conflict-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: rgba(245, 158, 11, 0.10);
		border: 1px solid rgba(245, 158, 11, 0.35);
		color: #b45309; /* amber-700 — readable on light bg */
		border-radius: 40px;
		padding: 6px 10px 6px 14px;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.4;
		pointer-events: auto;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow: 0 2px 8px rgba(245, 158, 11, 0.12);
		max-width: 520px;
	}

	:global(html.dark) .conflict-pill {
		background: rgba(245, 158, 11, 0.12);
		border-color: rgba(245, 158, 11, 0.30);
		color: #fbbf24; /* amber-400 — readable on dark bg */
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.conflict-pill :global(.conflict-icon) {
		flex-shrink: 0;
		opacity: 0.9;
	}

	.conflict-msg {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.conflict-dismiss {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: inherit;
		opacity: 0.55;
		cursor: pointer;
		transition: opacity 0.15s, background 0.15s;
		margin-left: 2px;
	}

	.conflict-dismiss:hover {
		opacity: 1;
		background: rgba(245, 158, 11, 0.18);
	}

	/* ── Editor card ─────────────────────────────────────────────────────── */

	.editor-content {
		max-width: 800px;
		width: calc(100% - 48px);
		margin: 48px auto;
		padding: 48px 60px 180px;
		display: flex;
		flex-direction: column;
		gap: 24px;

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

	.codemirror-wrapper {
		width: 100%;
		min-height: 60vh;
	}

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
		.conflict-banner {
			padding: 0 16px 10px;
		}
		.conflict-msg {
			white-space: normal;
		}
	}
</style>