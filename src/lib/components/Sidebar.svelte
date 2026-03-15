<script lang="ts">
import {
	Archive,
	FileText,
	Focus,
	History,
	List,
	Moon,
	Plus,
	Search,
	Sun,
	Trash,
	X,
} from 'lucide-svelte';
import MiniSearch from 'minisearch';
import { docStore } from '$lib/doc-store.svelte';
import type { Document } from '$lib/types';
import { uiState } from '$lib/ui-state.svelte';

// --- Search ---

let searchQuery = $state('');

// Reactive MiniSearch index — rebuilt whenever documents change.
const miniSearch = $derived.by(() => {
	const ms = new MiniSearch<Document>({
		idField: 'id',
		fields: ['title', 'content', 'tags'],
		storeFields: ['id'],
		extractField: (doc: Document, field: string) => {
			if (field === 'tags') return (doc.config.tags ?? []).join(' ');
			return (doc as unknown as Record<string, unknown>)[field] as string;
		},
		searchOptions: {
			prefix: true,
			fuzzy: 0.2,
			boost: { title: 3, tags: 2 },
		},
	});
	ms.addAll(docStore.documents);
	return ms;
});

const displayedDocs = $derived.by(() => {
	const q = searchQuery.trim();
	if (!q) return docStore.documents;
	const hits = miniSearch.search(q);
	const hitIds = new Set(hits.map((h) => h.id));
	return docStore.documents.filter((d) => hitIds.has(d.id));
});

function clearSearch() {
	searchQuery = '';
}

// --- Document actions ---

function handleFileClick(id: string) {
	docStore.switchDocument(id);
	// On mobile, maybe close sidebar
}

function createNew() {
	docStore.createNew();
}

function deleteDoc(id: string, event: MouseEvent) {
	event.stopPropagation();
	if (confirm('Are you sure you want to delete this document?')) {
		docStore.deleteDoc(id);
	}
}

function getTitle(title: string) {
	return title.trim().length > 0 ? title : 'Untitled Document';
}

function formatDate(ts: number): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).format(new Date(ts));
}
</script>

<aside class="sidebar frosted-glass" class:open={uiState.sidebarOpen} class:zen={uiState.zenMode}>
	<!-- Inner wrapper stays at fixed 280px so content doesn't squish during the
	     width-collapse animation. overflow:hidden on the aside clips it cleanly. -->
	<div class="sidebar-inner">
		<div class="sidebar-header">
			<h2>ZenWrite</h2>
			<div class="window-actions">
				<button class="icon-btn" onclick={createNew} title="New Note">
					<Plus size={18} />
				</button>
				<button class="icon-btn" onclick={() => uiState.toggleTheme()} title="Toggle Theme">
					{#if uiState.theme === 'dark'}
						<Sun size={18} />
					{:else}
						<Moon size={18} />
					{/if}
				</button>
			</div>
		</div>

		<!-- Search bar -->
		<div class="search-bar">
			<Search size={14} class="search-icon" />
			<input
				id="sidebar-search"
				class="search-input"
				type="search"
				placeholder="Search notes…"
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button class="clear-btn" onclick={clearSearch} title="Clear search" aria-label="Clear search">
					<X size={12} />
				</button>
			{/if}
		</div>

		<div class="file-list">
			{#if displayedDocs.length === 0}
				<div class="empty-state">
					<Search size={24} class="empty-icon" />
					<p>No results for<br /><strong>"{searchQuery}"</strong></p>
				</div>
			{:else}
				{#each displayedDocs as doc (doc.id)}
					<div 
						class="file-item" 
						class:active={docStore.currentDocId === doc.id}
						onclick={() => handleFileClick(doc.id)}
						onkeydown={(e) => e.key === 'Enter' && handleFileClick(doc.id)}
						role="button"
						tabindex="0"
					>
						<div class="file-item-left">
							<FileText size={16} class="file-icon" />
							<div class="file-meta">
								<span class="file-title">{getTitle(doc.title)}</span>
								<span class="file-date">{formatDate(doc.createdAt)}</span>
								<span class="file-tags">
									{#each doc.config.tags as tag (tag)}
										<span class="tag">{tag}</span>
									{/each}
								</span>
							</div>
						</div>
						<div class="file-item-actions">
							<button class="icon-btn danger" onclick={(e) => deleteDoc(doc.id, e)} title="Delete Note">
								<Trash size={14} />
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<div class="sidebar-footer">
			<button class="menu-item" onclick={() => uiState.tocOpen = !uiState.tocOpen}>
				<List size={18} />
				<span>Table of Contents</span>
			</button>
			<button
				class="menu-item history-btn"
				onclick={() => uiState.versionsOpen = !uiState.versionsOpen}
				title="Version History"
			>
				<History size={18} />
				<span>Version History</span>
			</button>
			<button class="menu-item zen-toggle" onclick={() => uiState.toggleZenMode()} title="Enter Zen Mode">
				<Focus size={18} />
				<span>Zen Mode</span>
			</button>
			<button
				class="menu-item backup-btn"
				onclick={() => uiState.backupOpen = !uiState.backupOpen}
				title="Backup & Restore"
			>
				<Archive size={18} />
				<span>Backup & Restore</span>
			</button>
		</div>
	</div>
</aside>

<style>
	.sidebar {
		width: 280px;
		height: 100%;
		overflow: hidden;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		background: var(--surface);
		transition:
			width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			border-color 0.3s;
		z-index: 40;
	}

	/* Zen: collapse width to 0, releasing layout space so the editor
	   expands to fill the full viewport and re-centers via margin: auto. */
	.sidebar.zen {
		width: 0;
		border-right-color: transparent;
	}

	/* Fixed-width inner wrapper prevents content from reflowing
	   during the width-collapse animation */
	.sidebar-inner {
		width: 280px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.sidebar-header {
		padding: 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
	}

	.sidebar-header h2 {
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.window-actions {
		display: flex;
		gap: 8px;
	}

	/* ---- Search bar ---- */
	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
		margin: 10px 12px 6px;
		background: var(--border);
		border-radius: 8px;
		border: 1px solid transparent;
		transition: border-color 0.2s, background 0.2s;

		&:focus-within {
			border-color: var(--accent);
			background: var(--surface);
		}
	}

	.search-bar :global(.search-icon) {
		position: absolute;
		left: 10px;
		color: var(--text-muted);
		pointer-events: none;
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		padding: 8px 10px 8px 32px;
		font-size: 0.82rem;
		color: var(--text);
		width: 100%;

		&::placeholder {
			color: var(--text-muted);
			opacity: 0.6;
		}

		/* Remove the native "x" clear button in webkit */
		&::-webkit-search-cancel-button {
			display: none;
		}
	}

	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		margin-right: 6px;
		border-radius: 50%;
		color: var(--text-muted);
		background: transparent;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: rgba(127, 127, 127, 0.2);
			color: var(--text);
		}
	}

	/* ---- Empty state ---- */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 40px 20px;
		color: var(--text-muted);
		text-align: center;
	}

	.empty-state :global(.empty-icon) {
		opacity: 0.35;
	}

	.empty-state p {
		font-size: 0.82rem;
		line-height: 1.5;
		opacity: 0.7;
	}

	.empty-state strong {
		opacity: 0.9;
	}

	/* ---- File list ---- */
	.file-list {
		flex: 1;
		overflow-y: auto;
		padding: 6px 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.file-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 10px 12px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.file-item:hover {
		background: var(--border);
	}

	.file-item.active {
		background: var(--accent-glow);
		color: var(--accent);
	}

	.file-item.active :global(.file-icon) {
		color: var(--accent);
	}

	.file-item-left {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		overflow: hidden;
		flex: 1;
	}

	.file-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
	}

	.file-date {
		font-size: 0.72rem;
		color: var(--text-muted);
		opacity: 0.7;
		letter-spacing: 0.01em;
	}
	
	.file-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 2px;
        
        & .tag {
            font-size: 0.65rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-muted);
            background-color: var(--border);
            padding: 2px 8px;
            border-radius: 99px;
            border: 1px solid transparent;
            transition: background-color 0.2s, color 0.2s;
        }
    }

    /* Make the tags pop beautifully when the file is selected */
    .file-item.active .file-tags .tag {
        background-color: var(--surface);
        color: var(--accent);
        border-color: var(--accent-glow);
    }

	:global(.file-icon) {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.file-title {
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
	}

	.file-item-actions {
		opacity: 0;
		transition: opacity 0.2s;
	}

	.file-item:hover .file-item-actions {
		opacity: 1;
	}

	.sidebar-footer {
		padding: 12px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		width: 100%;
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.menu-item:hover {
		background: var(--border);
		color: var(--text);
	}

	.zen-toggle {
		color: var(--text-muted);
	}

	.zen-toggle:hover {
		background: var(--accent-glow);
		color: var(--accent);
	}

	.history-btn:hover {
		background: rgba(34, 197, 94, 0.08);
		color: #16a34a;
	}

	.backup-btn:hover {
		background: rgba(99, 102, 241, 0.08);
		color: #6366f1;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		color: var(--text-muted);
		transition: all 0.2s;
	}

	.icon-btn:hover {
		background: var(--border);
		color: var(--text);
	}

	.icon-btn.danger:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	@media (max-width: 768px) {
		.sidebar {
			position: fixed;
			left: 0;
			top: 0;
			transform: translateX(-100%);
		}
		.sidebar.open {
			transform: translateX(0);
		}
	}
</style>