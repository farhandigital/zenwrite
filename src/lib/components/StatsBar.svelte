<script lang="ts">
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';

const stats = $derived.by(() => {
	const doc = docStore.currentDocument;
	if (!doc) return null;

	// Combine title + content for a holistic count
	const fullText = [doc.title, doc.content].filter(Boolean).join(' ');

	const words =
		fullText.trim() === '' ? 0 : fullText.trim().split(/\s+/).length;
	// Character count on body content only (title is metadata-ish, but chars is more useful for body)
	const chars = doc.content.length;
	const readingTime = Math.max(1, Math.ceil(words / 200));

	return { words, chars, readingTime };
});
</script>

{#if stats}
	<div class="stats-bar" class:zen={uiState.zenMode} aria-label="Document statistics">
		<div class="stats-pill">
			<span class="stat">
				<span class="stat-value">{stats.words.toLocaleString()}</span>
				<span class="stat-label">words</span>
			</span>
			<span class="stat-divider" aria-hidden="true">·</span>
			<span class="stat">
				<span class="stat-value">{stats.chars.toLocaleString()}</span>
				<span class="stat-label">chars</span>
			</span>
			<span class="stat-divider" aria-hidden="true">·</span>
			<span class="stat">
				<span class="stat-value">{stats.readingTime}</span>
				<span class="stat-label">min read</span>
			</span>
		</div>
	</div>
{/if}

<style>
	.stats-bar {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: center;
		padding: 16px 40px;
		pointer-events: none;
		transition: opacity 0.4s ease;
	}

	.stats-bar.zen {
		opacity: 0;
	}

	.stats-bar.zen:hover {
		opacity: 1;
	}

	.stats-pill {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		background: var(--overlay);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		border-radius: 40px;
		padding: 6px 18px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
	}

	.stat {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.stat-value {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--text-muted);
	}

	.stat-divider {
		color: var(--border);
		font-size: 0.85rem;
		user-select: none;
	}
</style>
