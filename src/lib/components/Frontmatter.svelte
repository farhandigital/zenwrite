<script lang="ts">
import { ChevronDown, ChevronRight, X } from 'lucide-svelte';
import { slide } from 'svelte/transition';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';
import {
	autoResizeTextarea,
	formatDate,
	handleInput,
	handleTagInput,
	handleTagKeydown,
	removeTag,
} from './frontmatter';

let isFrontmatterOpen = $state(false);
</script>

{#if docStore.currentDocument}
	<div class="doc-meta">
		<span>Created {formatDate(docStore.currentDocument.createdAt)}</span>
		<span class="meta-divider">·</span>
		<span>Updated {formatDate(docStore.currentDocument.updatedAt)}</span>
		<span class="meta-divider">·</span>
		<button 
			class="fm-toggle-btn" 
			onclick={() => isFrontmatterOpen = !isFrontmatterOpen}
			title="Toggle Properties"
		>
			{#if isFrontmatterOpen}
				<ChevronDown size={14} />
			{:else}
				<ChevronRight size={14} />
			{/if}
			<span>Properties</span>
		</button>
	</div>

	{#if isFrontmatterOpen}
		<div class="frontmatter-container" class:zen={uiState.zenMode} transition:slide={{ duration: 200 }}>
			<div class="fm-row">
				<div class="fm-label">Description</div>
				<textarea 
					class="fm-value-input fm-textarea" 
					rows="1" 
					value={docStore.currentDocument.config.description || ''} 
					oninput={(e) => {
						handleInput('description', e);
						autoResizeTextarea(e.target as HTMLTextAreaElement);
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
	{/if}
{/if}

<style>
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

	.fm-toggle-btn {
		display: flex;
		align-items: center;
		gap: 2px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		opacity: 0.7;
		padding: 2px 6px;
		border-radius: 4px;
		transition: all 0.2s;
		letter-spacing: 0.01em;
	}

	.fm-toggle-btn:hover {
		opacity: 1;
		background: rgba(128, 128, 128, 0.1);
		color: var(--text);
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
</style>
