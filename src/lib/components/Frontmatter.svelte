<script lang="ts">
import { ChevronDown, ChevronRight, X } from 'lucide-svelte';
import { slide } from 'svelte/transition';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';
import {
	autoResizeTextarea,
	formatDate,
	getSuggestions,
	handleInput,
	handleTagInput,
	removeTag,
} from './frontmatter';

let isFrontmatterOpen = $state(false);

// ── tag autocomplete state ──
let tagInputValue = $state('');
let activeSuggestionIndex = $state(-1);
let dismissed = $state(false); // set by Escape, reset on next input

const suggestions = $derived(
	getSuggestions(tagInputValue, docStore.currentDocument?.config.tags ?? []),
);
const showSuggestions = $derived(
	!dismissed && suggestions.length > 0 && tagInputValue.trim().length > 0,
);

function applyTag(tag: string) {
	if (!docStore.currentDocument) return;
	const config = { ...docStore.currentDocument.config };
	const tags = [...(config.tags ?? [])];
	if (!tags.includes(tag)) {
		config.tags = [...tags, tag];
		docStore.updateCurrent({ config });
	}
	tagInputValue = '';
}

function handleTagKeydownWithSuggestions(e: KeyboardEvent) {
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		activeSuggestionIndex = Math.min(
			activeSuggestionIndex + 1,
			suggestions.length - 1,
		);
		return;
	}
	if (e.key === 'ArrowUp') {
		e.preventDefault();
		activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
		return;
	}
	if (e.key === 'Escape') {
		dismissed = true;
		activeSuggestionIndex = -1;
		return;
	}
	if ((e.key === 'Enter' || e.key === ',') && activeSuggestionIndex >= 0) {
		e.preventDefault();
		applyTag(suggestions[activeSuggestionIndex]);
		return;
	}

	// Handle Enter/comma for free-text tags (original behaviour)
	if (e.key === 'Enter' || e.key === ',') {
		e.preventDefault();
		const val = tagInputValue.trim();
		if (val && docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags ?? [])];
			if (!tags.includes(val)) {
				tags.push(val);
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
			tagInputValue = '';
		}
		return;
	}

	// Backspace on empty input removes last tag
	if (e.key === 'Backspace' && tagInputValue === '') {
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags ?? [])];
			if (tags.length > 0) {
				tags.pop();
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
		}
	}
}

function handleTagInputChange(e: Event) {
	dismissed = false; // re-show suggestions on new input
	const cleared = handleTagInput(e);
	if (cleared) tagInputValue = '';
}
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
					{#each (docStore.currentDocument.config.tags || []) as tag, i (tag)}
						<span class="fm-tag">
							{tag}
							<button type="button" class="fm-tag-remove" aria-label="Remove tag" onclick={(e) => removeTag(i, e)}>
								<X size={12} strokeWidth={2.5}/>
							</button>
						</span>
					{/each}
					<div class="fm-tag-input-wrap">
						<input 
							id="fm-tags-input" 
							type="text" 
							class="fm-tag-input"
							bind:value={tagInputValue}
							onkeydown={handleTagKeydownWithSuggestions}
							oninput={handleTagInputChange}
							autocomplete="off"
							placeholder={(docStore.currentDocument.config.tags ?? []).length === 0 ? 'Add tags…' : ''}
						/>

						{#if showSuggestions}
							<ul class="tag-suggestions" role="listbox">
								{#each suggestions as suggestion, i (suggestion)}
									<li
										class="tag-suggestion-item"
										class:active={i === activeSuggestionIndex}
										role="option"
										aria-selected={i === activeSuggestionIndex}
										onmousedown={(e) => { e.preventDefault(); applyTag(suggestion); }}
									>
										{suggestion}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
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

	/* ── tag autocomplete ── */
	.fm-tag-input-wrap {
		position: relative;
		flex: 1;
		min-width: 80px;
	}

	.fm-tag-input {
		width: 100%;
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

	.tag-suggestions {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 50;
		background: var(--overlay);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 4px;
		list-style: none;
		margin: 0;
		min-width: 140px;
		max-width: 240px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.tag-suggestion-item {
		padding: 6px 10px;
		font-size: 0.82rem;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background 0.12s, color 0.12s;
	}

	.tag-suggestion-item:hover,
	.tag-suggestion-item.active {
		background: var(--accent-glow);
		color: var(--accent);
	}

	.fm-value-input::placeholder {
		color: var(--text-muted);
		opacity: 0.5;
	}
</style>
