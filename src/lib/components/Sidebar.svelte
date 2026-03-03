<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { FileText, Plus, Settings, List, Moon, Sun, Download, Trash } from 'lucide-svelte';

	function handleFileClick(id: string) {
		appState.currentDocId = id;
		// On mobile, maybe close sidebar
	}

	function createNew() {
		appState.createNew();
	}

	function deleteDoc(id: string, event: MouseEvent) {
		event.stopPropagation();
		if (confirm('Are you sure you want to delete this document?')) {
			appState.deleteDoc(id);
		}
	}

	function getTitle(title: string) {
		return title.trim().length > 0 ? title : 'Untitled Document';
	}
</script>

<aside class="sidebar frosted-glass" class:open={appState.sidebarOpen}>
	<div class="sidebar-header">
		<h2>ZenWrite</h2>
		<div class="window-actions">
			<button class="icon-btn" onclick={createNew} title="New Note">
				<Plus size={18} />
			</button>
			<button class="icon-btn" onclick={() => appState.toggleTheme()} title="Toggle Theme">
				{#if appState.theme === 'dark'}
					<Sun size={18} />
				{:else}
					<Moon size={18} />
				{/if}
			</button>
		</div>
	</div>

	<div class="file-list">
		{#each appState.documents as doc (doc.id)}
			<div 
				class="file-item" 
				class:active={appState.currentDocId === doc.id}
				onclick={() => handleFileClick(doc.id)}
				onkeydown={(e) => e.key === 'Enter' && handleFileClick(doc.id)}
				role="button"
				tabindex="0"
			>
				<div class="file-item-left">
					<FileText size={16} class="file-icon" />
					<span class="file-title">{getTitle(doc.title)}</span>
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
		<button class="menu-item" onclick={() => appState.tocOpen = !appState.tocOpen}>
			<List size={18} />
			<span>Table of Contents</span>
		</button>
		<button class="menu-item" onclick={() => appState.settingsOpen = !appState.settingsOpen}>
			<Settings size={18} />
			<span>Astro Settings</span>
		</button>
	</div>
</aside>

<style>
	.sidebar {
		width: 280px;
		height: 100%;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		background: var(--surface);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 40;
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
		align-items: center;
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
		align-items: center;
		gap: 12px;
		overflow: hidden;
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
