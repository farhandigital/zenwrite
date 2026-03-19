/**
 * migration-store.svelte.ts
 *
 * Detects whether any documents in IDB still have the old format
 * (pre-metadata structure), and if so, runs a guided migration:
 *
 *   1. Export a safety backup zip (downloaded to the user's machine)
 *   2. Migrate + persist each document to the new format in IDB
 *   3. Mark as done in localStorage so the modal never shows again
 *
 * The store exposes reactive state that MigrationModal.svelte renders.
 * The inline migration in db.ts::getDocuments() acts as a silent fallback
 * in case the user somehow skips the modal.
 */

import { exportBackup } from './backup';
import { getDocuments, getRawDocuments, saveDocument } from './db';
import { migrateDocument, needsMigration } from './migrations';
import type { Document } from './types';

export type MigrationPhase =
	| 'idle'
	| 'detecting'
	| 'prompt' // Legacy docs found — waiting for user to click "Start"
	| 'backing-up'
	| 'migrating'
	| 'done'
	| 'error';

const MIGRATION_DONE_KEY = 'zenwrite-v2-migration-done';

class MigrationStore {
	phase: MigrationPhase = $state('idle');
	error: string = $state('');

	/** Total docs that need migration. */
	total: number = $state(0);
	/** How many have been migrated so far. */
	migrated: number = $state(0);

	/** True while the migration modal should block the UI. */
	get isActive(): boolean {
		return this.phase !== 'idle';
	}

	/**
	 * Call this before DocStore.init() in the layout.
	 * Reads raw IDB (bypassing migration logic) to see if any legacy docs
	 * exist. Sets phase to 'prompt' if so, otherwise silently marks done.
	 *
	 * Returns true if the migration modal should be shown.
	 */
	detect = async (): Promise<boolean> => {
		// Already done in a previous session — no modal needed.
		if (localStorage.getItem(MIGRATION_DONE_KEY)) return false;

		this.phase = 'detecting';
		try {
			const raw = await getRawDocuments();
			const legacyDocs = raw.filter(needsMigration);

			if (legacyDocs.length === 0) {
				localStorage.setItem(MIGRATION_DONE_KEY, '1');
				this.phase = 'idle';
				return false;
			}

			this.total = legacyDocs.length;
			this.phase = 'prompt';
			return true;
		} catch (err) {
			this.error =
				err instanceof Error ? err.message : 'Unknown error during detection';
			this.phase = 'error';
			return true; // Show modal so user sees the error
		}
	};

	/**
	 * Runs the full migration flow (backup → migrate).
	 * Called when the user clicks "Start" in the modal.
	 */
	run = async (getAstroExport: (doc: Document) => string): Promise<void> => {
		try {
			// ── Step 1: Backup ───────────────────────────────────────────────
			this.phase = 'backing-up';
			// getDocuments() returns migrated copies in memory but still reads
			// raw IDB — safe to use here for the backup content.
			const allDocs = await getDocuments();
			await exportBackup(allDocs, getAstroExport);

			// ── Step 2: Migrate ──────────────────────────────────────────────
			this.phase = 'migrating';
			this.migrated = 0;

			// Re-read raw to find actual legacy docs (getDocuments migrates in-memory,
			// the write-back in getDocuments already handled it — but let's be
			// explicit here for the progress counter).
			const raw = await getRawDocuments();
			for (const item of raw) {
				if (needsMigration(item)) {
					const migrated = migrateDocument(item);
					if (migrated) {
						await saveDocument(migrated);
					}
					this.migrated += 1;
				}
			}

			// ── Step 3: Done ─────────────────────────────────────────────────
			localStorage.setItem(MIGRATION_DONE_KEY, '1');
			this.phase = 'done';
		} catch (err) {
			this.error =
				err instanceof Error ? err.message : 'Migration failed unexpectedly';
			this.phase = 'error';
		}
	};

	/** Called by the layout after the user dismisses the "done" screen. */
	dismiss = () => {
		this.phase = 'idle';
	};
}

export const migrationStore = new MigrationStore();
