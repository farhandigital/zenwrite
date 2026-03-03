<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { X } from 'lucide-svelte';

	function close() {
		appState.tocOpen = false;
	}

	interface Heading {
		level: number;
		text: string;
		index: number;
	}

	let headings: Heading[] = $derived.by(() => {
		const content = appState.currentDocument?.content || '';
		const regex = /^(#{1,6})\s+(.+)/gm;
		const found: Heading[] = [];
		for (const match of content.matchAll(regex)) {
			found.push({
				level: match[1].length,
				text: match[2],
				index: match.index
			});
		}
		return found;
	});

	function scrollToHeading(index: number) {
		appState.scrollToIndex = index;
		if (window.innerWidth <= 768) {
			appState.tocOpen = false;
		}
	}
</script>

{#if appState.tocOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="drawer-overlay" onclick={close}></div>
	<div class="drawer frosted-glass">
		<div class="drawer-header">
			<h3>Table of Contents</h3>
			<button class="icon-btn" onclick={close} title="Close ToC">
				<X size={20} />
			</button>
		</div>

		<div class="drawer-content">
			{#if headings.length > 0}
				<ul class="toc-list">
					{#each headings as heading}
						<li 
							style="padding-left: {(heading.level - 1) * 16}px;"
							class="toc-item"
						>
							<button onclick={() => scrollToHeading(heading.index)}>
								{heading.text}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-toc">
					<p class="muted">No headings found.</p>
					<p class="muted-small">Use # formatting (e.g. ## Title) to create structure in your document.</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.drawer-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0,0,0,0.2);
		z-index: 50;
	}

	.drawer {
		position: fixed;
		top: 0;
		left: 280px; /* Attach next to the sidebar on desktop */
		bottom: 0;
		width: 300px;
		background: var(--surface);
		z-index: 60;
		box-shadow: 4px 0 24px rgba(0,0,0,0.05);
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		animation: slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@media (max-width: 768px) {
		.drawer {
			left: 0;
		}
	}

	@keyframes slideInLeft {
		from { transform: translateX(-100%); }
		to { transform: translateX(0); }
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px;
		border-bottom: 1px solid var(--border);
	}

	.drawer-header h3 {
		font-size: 1.1rem;
		font-weight: 600;
	}

	.drawer-content {
		padding: 24px;
		flex: 1;
		overflow-y: auto;
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

	.toc-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.toc-item button {
		text-align: left;
		font-size: 0.95rem;
		color: var(--text-muted);
		transition: color 0.2s;
		line-height: 1.4;
		width: 100%;
		padding: 4px 8px;
		border-radius: 6px;
	}

	.toc-item button:hover {
		color: var(--accent);
		background: var(--accent-glow);
	}

	.empty-toc {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.muted-small {
		color: var(--text-muted);
		opacity: 0.7;
		font-size: 0.85rem;
		line-height: 1.5;
	}
</style>
