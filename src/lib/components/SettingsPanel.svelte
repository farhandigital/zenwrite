<script lang="ts">
import { X } from 'lucide-svelte';
import { appState } from '$lib/state.svelte';

function close() {
	appState.settingsOpen = false;
}

function handleInput(key: string, e: Event) {
	const target = e.target as HTMLInputElement;
	const val = target.value;
	if (appState.currentDocument) {
		const config = { ...appState.currentDocument.config };
		if (key === 'tags') {
			config.tags = val
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
		} else {
			config[key] = val;
		}
		appState.updateCurrent({ config });
	}
}
</script>

{#if appState.settingsOpen}
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
			{#if appState.currentDocument}
				<div class="form-group">
					<label for="pubDate">Publish Date / Year Format</label>
					<input 
						id="pubDate" 
						type="text" 
						value={appState.currentDocument.config.pubDate || ''} 
						oninput={(e) => handleInput('pubDate', e)}
						placeholder="YYYY-MM-DD"
					/>
				</div>

				<div class="form-group">
					<label for="description">Description</label>
					<textarea 
						id="description" 
						rows="3" 
						value={appState.currentDocument.config.description || ''} 
						oninput={(e) => handleInput('description', e)}
						placeholder="Short summary of the post..."
					></textarea>
				</div>

				<div class="form-group">
					<label for="tags">Tags (comma separated)</label>
					<input 
						id="tags" 
						type="text" 
						value={(appState.currentDocument.config.tags || []).join(', ')} 
						oninput={(e) => handleInput('tags', e)}
						placeholder="tech, writing, zen"
					/>
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
