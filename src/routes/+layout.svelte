<script lang="ts">
import '../app.css';
import { onMount } from 'svelte';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';

let { children } = $props();

function handleGlobalShortcut(event: KeyboardEvent) {
	const mod1 = event.ctrlKey || event.metaKey;
	const mod2 = event.shiftKey;
	const key = event.key.toLowerCase();
	if (mod1 && mod2 && key === 'n') {
		event.preventDefault();
		docStore.createNew();
	}
	if (mod1 && key === ' ') {
		event.preventDefault();
		uiState.toggleZenMode();
	}
}

onMount(() => {
	uiState.initTheme();
	docStore.init();
});
</script>

<svelte:window onkeydown={handleGlobalShortcut} />

{#if docStore.documents.length > 0}
	<div class="app-layout">
		{@render children()}
	</div>
{:else}
	<div class="loading">Loading ZenWrite...</div>
{/if}

<style>
	.app-layout {
		display: flex;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.loading {
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-weight: 500;
		color: var(--text-muted);
		background-color: var(--bg);
	}
</style>
