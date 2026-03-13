<script lang="ts">
import { X } from 'lucide-svelte';
import { docStore } from '$lib/doc-store.svelte';
import { uiState } from '$lib/ui-state.svelte';

function close() {
	uiState.settingsOpen = false;
}

function handleInput(key: string, e: Event) {
	const target = e.target as HTMLInputElement;
	const val = target.value;
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.config };
		config[key] = val;
		docStore.updateCurrent({ config });
	}
}

function removeTag(index: number) {
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.config };
		const tags = [...(config.tags || [])];
		tags.splice(index, 1);
		config.tags = tags;
		docStore.updateCurrent({ config });
	}
}

function handleTagKeydown(e: KeyboardEvent) {
	const target = e.target as HTMLInputElement;
	if (e.key === ',' || e.key === 'Enter') {
		e.preventDefault();
		const val = target.value.trim();
		if (val && docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			if (!tags.includes(val)) {
				tags.push(val);
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
			target.value = '';
		}
	} else if (e.key === 'Backspace' && target.value === '') {
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			if (tags.length > 0) {
				tags.pop();
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
		}
	}
}

function handleTagInput(e: Event) {
	const target = e.target as HTMLInputElement;
	if (target.value.includes(',')) {
		const newTags = target.value
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			for (const nt of newTags) {
				if (!tags.includes(nt)) {
					tags.push(nt);
				}
			}
			config.tags = tags;
			docStore.updateCurrent({ config });
		}
		target.value = '';
	}
}
</script>

{#if uiState.settingsOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="drawer-overlay" onclick={close}></div>
	<div class="drawer frosted-glass">
		<div class="drawer-header">
			<h3>Frontmatter</h3>
			<button class="icon-btn" onclick={close} title="Close settings">
				<X size={20} />
			</button>
		</div>

		<div class="drawer-content">
			{#if docStore.currentDocument}
				<div class="form-group">
					<label for="pubDate">Publish Date / Year Format</label>
					<input 
						id="pubDate" 
						type="text" 
						value={docStore.currentDocument.config.pubDate || ''} 
						oninput={(e) => handleInput('pubDate', e)}
						placeholder="YYYY-MM-DD"
					/>
				</div>

				<div class="form-group">
					<label for="description">Description</label>
					<textarea 
						id="description" 
						rows="3" 
						value={docStore.currentDocument.config.description || ''} 
						oninput={(e) => handleInput('description', e)}
						placeholder="Short summary of the post..."
					></textarea>
				</div>

				<div class="form-group">
					<label for="tags">Tags (comma separated)</label>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div 
						class="tags-input-container" 
						onclick={() => document.getElementById('tags')?.focus()}
					>
						{#each (docStore.currentDocument.config.tags || []) as tag, i}
							<span class="tag">
								{tag}
								<button type="button" class="tag-remove" onclick={() => removeTag(i)} aria-label="Remove tag">
									<X size={12} />
								</button>
							</span>
						{/each}
						<input 
							id="tags" 
							type="text" 
							class="tag-input"
							onkeydown={handleTagKeydown}
							oninput={handleTagInput}
							placeholder={(docStore.currentDocument.config.tags || []).length === 0 ? "tech, writing, zen" : ""}
						/>
					</div>
				</div>
                
				<div class="info-box">
					<p>Other keys can be added programmatically. Title is managed automatically.</p>
				</div>
			{:else}
				<p class="muted">No document selected.</p>
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
		right: 0;
		bottom: 0;
		width: 320px;
		background: var(--surface);
		z-index: 60;
		box-shadow: -4px 0 24px rgba(0,0,0,0.1);
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--border);
		animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
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
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	input, textarea {
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
		font-size: 0.95rem;
		transition: border-color 0.2s;
		resize: vertical;
	}

	input:focus, textarea:focus {
		border-color: var(--accent);
		outline: none;
	}

	.tags-input-container {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg);
		min-height: 42px;
		align-items: center;
		transition: border-color 0.2s;
		cursor: text;
	}

	.tags-input-container:focus-within {
		border-color: var(--accent);
	}

	.tag {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--accent-glow);
		color: var(--accent);
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 500;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.tag-remove {
		background: transparent;
		border: none;
		color: currentColor;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.tag-remove:hover {
		opacity: 1;
	}

	.tag-input {
		flex: 1;
		min-width: 80px;
		border: none;
		background: transparent;
		padding: 4px 0;
		font-size: 0.95rem;
		color: var(--text);
	}

	.tag-input:focus {
		outline: none;
		border-color: transparent;
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

	.info-box {
		padding: 12px;
		background: var(--accent-glow);
		border-radius: 8px;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}
    
	.info-box p {
		font-size: 0.85rem;
		color: var(--accent);
		line-height: 1.4;
	}
	
	.muted {
		color: var(--text-muted);
	}
</style>
