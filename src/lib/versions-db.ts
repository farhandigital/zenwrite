/**
 * versions-db.ts
 *
 * A completely separate IndexedDB database ("zenwrite-versions-db") that
 * stores point-in-time snapshots of documents. Intentionally isolated from
 * the main "zenwrite-db" so that version history can be inspected, exported,
 * or wiped without touching primary document storage.
 *
 * Retention policy
 * ─────────────────
 * • Auto versions  – capped at MAX_AUTO_VERSIONS (50) per document; oldest
 *   are pruned automatically on every write.
 * • Manual checkpoints – never pruned; user must delete explicitly.
 */

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { DocumentMetadata } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DocumentVersion {
	/** UUID for this version snapshot. */
	id: string;
	/** ID of the document this version belongs to. */
	docId: string;
	/** Snapshot of document title. */
	title: string;
	/** Snapshot of body content (raw markdown). */
	content: string;
	/** Snapshot of frontmatter config. */
	metadata: DocumentMetadata;
	/** Unix timestamp (ms) when this version was created. */
	createdAt: number;
	/** Pre-computed word count (title + content) for display. */
	wordCount: number;
	/** Raw character count of content. */
	charCount: number;
	/**
	 * null   → automatic version (subject to pruning)
	 * string → user-supplied label (manual checkpoint, never pruned)
	 */
	label: string | null;
}

// ─── DB schema ────────────────────────────────────────────────────────────────

interface VersionsDBSchema extends DBSchema {
	versions: {
		key: string;
		value: DocumentVersion;
		indexes: {
			'by-doc': string;
			'by-created': number;
		};
	};
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'zenwrite-versions-db';
const DB_VERSION = 1;
export const MAX_AUTO_VERSIONS = 50;

// ─── Singleton promise ────────────────────────────────────────────────────────

let _dbPromise: Promise<IDBPDatabase<VersionsDBSchema>> | null = null;

export function initVersionsDB(): void {
	if (typeof window === 'undefined' || _dbPromise) return;

	_dbPromise = openDB<VersionsDBSchema>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			const store = db.createObjectStore('versions', { keyPath: 'id' });
			store.createIndex('by-doc', 'docId');
			store.createIndex('by-created', 'createdAt');
		},
	});
}

async function db(): Promise<IDBPDatabase<VersionsDBSchema>> {
	if (!_dbPromise) initVersionsDB();
	return _dbPromise!;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Returns all versions for a document, newest first.
 */
export async function getVersionsForDoc(
	docId: string,
): Promise<DocumentVersion[]> {
	try {
		const store = await db();
		const all = await store.getAllFromIndex('versions', 'by-doc', docId);
		return all.sort((a, b) => b.createdAt - a.createdAt);
	} catch (err) {
		console.error('[versions] Failed to load versions:', err);
		return [];
	}
}

/**
 * Returns a single version by id.
 */
export async function getVersion(
	id: string,
): Promise<DocumentVersion | undefined> {
	try {
		const store = await db();
		return store.get('versions', id);
	} catch (err) {
		console.error('[versions] Failed to get version:', err);
		return undefined;
	}
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Persists a new version to the database.
 */
export async function saveVersion(version: DocumentVersion): Promise<void> {
	try {
		const store = await db();
		await store.put('versions', version);
	} catch (err) {
		console.error('[versions] Failed to save version:', err);
		throw err;
	}
}

/**
 * Persists a new version and prunes stale auto versions for that document.
 * Use this when you want the automatic retention policy to be applied.
 */
export async function saveVersionWithPruning(
	version: DocumentVersion,
): Promise<void> {
	try {
		const store = await db();
		await store.put('versions', version);
		await _pruneAutoVersions(store, version.docId);
	} catch (err) {
		console.error('[versions] Failed to save version with pruning:', err);
		throw err;
	}
}

/**
 * Removes a single version by id.
 */
export async function deleteVersion(id: string): Promise<void> {
	try {
		const store = await db();
		await store.delete('versions', id);
	} catch (err) {
		console.error('[versions] Failed to delete version:', err);
		throw err;
	}
}

/**
 * Removes ALL versions (auto + manual) belonging to a document.
 * Called when the document itself is deleted.
 */
export async function deleteVersionsForDoc(docId: string): Promise<void> {
	try {
		const store = await db();
		const all = await store.getAllFromIndex('versions', 'by-doc', docId);
		const tx = store.transaction('versions', 'readwrite');
		await Promise.all(all.map((v) => tx.store.delete(v.id)));
		await tx.done;
	} catch (err) {
		console.error('[versions] Failed to delete doc versions:', err);
		throw err;
	}
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _pruneAutoVersions(
	store: IDBPDatabase<VersionsDBSchema>,
	docId: string,
): Promise<void> {
	const all = await store.getAllFromIndex('versions', 'by-doc', docId);
	const autoVersions = all
		.filter((v) => v.label === null)
		.sort((a, b) => b.createdAt - a.createdAt); // newest first

	if (autoVersions.length <= MAX_AUTO_VERSIONS) return;

	const toDelete = autoVersions.slice(MAX_AUTO_VERSIONS);
	const tx = store.transaction('versions', 'readwrite');
	await Promise.all(toDelete.map((v) => tx.store.delete(v.id)));
	await tx.done;
}
