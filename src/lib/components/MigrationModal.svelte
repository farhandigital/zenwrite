<script lang="ts">
import {
	AlertTriangle,
	Archive,
	CheckCircle,
	Download,
	RefreshCw,
	ShieldCheck,
} from 'lucide-svelte';
import { docStore } from '$lib/doc-store.svelte';
import { migrationStore } from '$lib/migration-store.svelte';

const { onDone }: { onDone: () => void } = $props();

function handleStart() {
	migrationStore.run((doc) => docStore.getAstroExport(doc));
}

function handleDismiss() {
	migrationStore.dismiss();
	onDone();
}
</script>

<!-- Backdrop (non-dismissible) -->
<div class="backdrop" aria-hidden="true"></div>

<!-- Modal -->
<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="migration-title">

	<!-- Icon -->
	<div class="icon-wrap" class:warning={migrationStore.phase === 'prompt' || migrationStore.phase === 'detecting'}
		class:spinning={migrationStore.phase === 'backing-up' || migrationStore.phase === 'migrating'}
		class:success={migrationStore.phase === 'done'}
		class:error={migrationStore.phase === 'error'}>
		{#if migrationStore.phase === 'done'}
			<CheckCircle size={28} />
		{:else if migrationStore.phase === 'error'}
			<AlertTriangle size={28} />
		{:else if migrationStore.phase === 'backing-up'}
			<Archive size={28} />
		{:else if migrationStore.phase === 'migrating'}
			<RefreshCw size={28} />
		{:else}
			<ShieldCheck size={28} />
		{/if}
	</div>

	<!-- Title & description -->
	{#if migrationStore.phase === 'detecting'}
		<h2 id="migration-title">Checking your documents…</h2>
		<p>One moment while we inspect your library.</p>

	{:else if migrationStore.phase === 'prompt'}
		<h2 id="migration-title">One-time data upgrade needed</h2>
		<p>
			We found <strong>{migrationStore.total} document{migrationStore.total === 1 ? '' : 's'}</strong>
			stored in the old format. Before upgrading, we'll create a backup zip so your data is safe.
		</p>

		<div class="info-row">
			<div class="info-step">
				<Download size={14} />
				<span>Download backup</span>
			</div>
			<div class="info-arrow">→</div>
			<div class="info-step">
				<RefreshCw size={14} />
				<span>Upgrade {migrationStore.total} doc{migrationStore.total === 1 ? '' : 's'}</span>
			</div>
			<div class="info-arrow">→</div>
			<div class="info-step">
				<CheckCircle size={14} />
				<span>Done forever</span>
			</div>
		</div>

		<button class="btn primary" onclick={handleStart}>
			<Archive size={15} />
			Back up &amp; upgrade now
		</button>

	{:else if migrationStore.phase === 'backing-up'}
		<h2 id="migration-title">Creating backup…</h2>
		<p>Saving a zip of all your documents. Check your downloads folder.</p>
		<div class="progress-bar">
			<div class="progress-fill indeterminate"></div>
		</div>

	{:else if migrationStore.phase === 'migrating'}
		<h2 id="migration-title">Upgrading documents…</h2>
		<p>
			Migrating <strong>{migrationStore.migrated} / {migrationStore.total}</strong>
			document{migrationStore.total === 1 ? '' : 's'}
		</p>
		<div class="progress-bar">
			<div
				class="progress-fill"
				style:width="{migrationStore.total > 0 ? (migrationStore.migrated / migrationStore.total) * 100 : 0}%"
			></div>
		</div>
		<p class="sub">Do not close this tab.</p>

	{:else if migrationStore.phase === 'done'}
		<h2 id="migration-title">All done!</h2>
		<p>
			{migrationStore.total} document{migrationStore.total === 1 ? '' : 's'} successfully upgraded.
			Your backup zip has been downloaded — keep it safe.
		</p>
		<button class="btn primary" onclick={handleDismiss}>
			<CheckCircle size={15} />
			Open ZenWrite
		</button>

	{:else if migrationStore.phase === 'error'}
		<h2 id="migration-title">Something went wrong</h2>
		<p class="error-text">{migrationStore.error}</p>
		<p>Your data has not been modified. You can try refreshing the page.</p>
	{/if}

</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		z-index: 200;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		z-index: 201;
		width: min(480px, 92vw);
		background: var(--overlay, #1a1a2e);
		border: 1px solid var(--border, rgba(255,255,255,0.1));
		border-radius: 20px;
		padding: 36px 32px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
		box-shadow:
			0 24px 64px rgba(0, 0, 0, 0.4),
			0 0 0 1px rgba(255, 255, 255, 0.04);
	}

	/* ── Icon ── */
	.icon-wrap {
		width: 60px;
		height: 60px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.3s;
	}

	.icon-wrap.warning {
		background: rgba(251, 191, 36, 0.12);
		color: #fbbf24;
	}

	.icon-wrap.spinning {
		background: rgba(99, 102, 241, 0.12);
		color: var(--accent, #6366f1);
		animation: pulse 1.8s ease-in-out infinite;
	}

	.icon-wrap.success {
		background: rgba(34, 197, 94, 0.12);
		color: #22c55e;
	}

	.icon-wrap.error {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.55; }
	}

	/* ── Title & body ── */
	h2 {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		color: var(--text, #f1f5f9);
		margin: 0;
	}

	p {
		font-size: 0.875rem;
		color: var(--text-muted, #94a3b8);
		line-height: 1.6;
		margin: 0;
	}

	p strong {
		color: var(--text, #f1f5f9);
		font-weight: 600;
	}

	.sub {
		font-size: 0.78rem;
		opacity: 0.55;
	}

	.error-text {
		font-size: 0.8rem;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 8px;
		padding: 10px 14px;
		width: 100%;
		box-sizing: border-box;
		word-break: break-word;
	}

	/* ── Info steps ── */
	.info-row {
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(255,255,255,0.03);
		border: 1px solid var(--border, rgba(255,255,255,0.08));
		border-radius: 12px;
		padding: 12px 16px;
		width: 100%;
		box-sizing: border-box;
		justify-content: center;
		flex-wrap: wrap;
	}

	.info-step {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.78rem;
		color: var(--text-muted, #94a3b8);
		font-weight: 500;
	}

	.info-arrow {
		font-size: 0.78rem;
		color: var(--border, rgba(255,255,255,0.2));
	}

	/* ── Progress bar ── */
	.progress-bar {
		width: 100%;
		height: 6px;
		background: rgba(255,255,255,0.07);
		border-radius: 99px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent, #6366f1);
		border-radius: 99px;
		transition: width 0.3s ease;
	}

	.progress-fill.indeterminate {
		width: 40%;
		animation: indeterminate 1.4s ease-in-out infinite;
	}

	@keyframes indeterminate {
		0%   { transform: translateX(-150%); }
		100% { transform: translateX(350%); }
	}

	/* ── Button ── */
	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		font-size: 0.9rem;
		font-weight: 600;
		padding: 11px 24px;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		width: 100%;
		margin-top: 4px;
	}

	.btn.primary {
		background: var(--accent, #6366f1);
		color: #fff;
	}

	.btn.primary:hover {
		filter: brightness(1.12);
		transform: translateY(-1px);
	}

	.btn.primary:active {
		transform: translateY(0);
	}
</style>
