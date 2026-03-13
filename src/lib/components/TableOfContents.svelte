<script lang="ts">
import { X } from 'lucide-svelte';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';

interface Heading {
	level: number;
	text: string;
	index: number;
}

let headings: Heading[] = $derived.by(() => {
	const content = docStore.currentDocument?.content || '';
	const regex = /^(#{1,6})\s+(.+)/gm;
	const found: Heading[] = [];
	for (const match of content.matchAll(regex)) {
		found.push({
			level: match[1].length,
			text: match[2],
			index: match.index,
		});
	}
	return found;
});

function scrollToHeading(index: number) {
	uiState.scrollToIndex = index;
	// On mobile, close the panel after navigating
	if (window.innerWidth <= 768) {
		uiState.tocOpen = false;
	}
}

function close() {
	uiState.tocOpen = false;
}
</script>

<!--
	The ToC is a persistent right-column panel (always in the DOM).
	- width: 0 when closed → 280px when open, so it occupies/releases layout space
	  symmetrically with the 280px left Sidebar, keeping the Editor always centered.
	- zen mode: slides translateX(100%) off-screen while retaining its layout space,
	  mirroring the sidebar's translateX(-100%), so the editor stays perfectly still.
-->
<aside
	class="toc-panel frosted-glass"
	class:open={uiState.tocOpen}
	class:zen={uiState.zenMode}
	aria-label="Table of Contents"
>
	<div class="toc-inner">
		<div class="toc-header">
			<h3>Table of Contents</h3>
			<button class="icon-btn" onclick={close} title="Close ToC">
				<X size={20} />
			</button>
		</div>

		<div class="toc-content">
			{#if headings.length > 0}
				<ul class="toc-list">
					{#each headings as heading (heading.index)}
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
					<p class="muted-small">
						Use # formatting (e.g. ## Title) to create structure in your document.
					</p>
				</div>
			{/if}
		</div>
	</div>
</aside>

<style>
	/* --- Panel shell: transitions width to enter/leave the flex layout --- */
	.toc-panel {
		width: 0;
		height: 100%;
		flex-shrink: 0;
		overflow: hidden;
		background: var(--surface);
		border-left: 1px solid transparent;
		transition:
			width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			border-color 0.3s,
			transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 40;
	}

	.toc-panel.open {
		width: 280px;
		border-left-color: var(--border);
	}

	/* Zen: collapse width to 0, releasing layout space so the editor expands
	   to full viewport width and re-centers itself via margin: auto. */
	.toc-panel.zen {
		width: 0;
		border-left-color: transparent;
	}

	/* --- Inner wrapper: fixed at full panel width so content never reflows during animation --- */
	.toc-inner {
		width: 280px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.toc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 20px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.toc-header h3 {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.toc-content {
		padding: 16px;
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
		gap: 2px;
	}

	.toc-item button {
		text-align: left;
		font-size: 0.875rem;
		color: var(--text-muted);
		transition: color 0.2s, background 0.2s;
		line-height: 1.4;
		width: 100%;
		padding: 6px 8px;
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
		padding-top: 4px;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.muted-small {
		color: var(--text-muted);
		opacity: 0.7;
		font-size: 0.82rem;
		line-height: 1.5;
	}

	/* On mobile: the panel becomes fixed/overlay (same as sidebar) */
	@media (max-width: 768px) {
		.toc-panel {
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			width: 0;
			transform: none;
		}

		.toc-panel.open {
			width: 280px;
		}

		.toc-panel.zen {
			transform: none;
		}
	}
</style>
