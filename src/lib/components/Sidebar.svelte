<script lang="ts">
import { FileText, Focus, List, Moon, Plus, Sun, Trash } from 'lucide-svelte';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';

function handleFileClick(id: string) {
	docStore.currentDocId = id;
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

		<div class="file-list">
			{#each docStore.documents as doc (doc.id)}
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
								{#each doc.config.tags as tag }
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
		</div>

		<div class="sidebar-footer">
			<button class="menu-item" onclick={() => uiState.tocOpen = !uiState.tocOpen}>
				<List size={18} />
				<span>Table of Contents</span>
			</button>
			<button class="menu-item zen-toggle" onclick={() => uiState.toggleZenMode()} title="Enter Zen Mode">
				<Focus size={18} />
				<span>Zen Mode</span>
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

	.file-list {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
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
