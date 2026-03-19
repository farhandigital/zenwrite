import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { migrateDocument, needsMigration } from './migrations';
import type { Document } from './types';

interface ZenWriteDB extends DBSchema {
	documents: {
		key: string;
		value: Document;
	};
}

let dbPromise: Promise<IDBPDatabase<ZenWriteDB>>;

export function initDB() {
	if (typeof window !== 'undefined' && !dbPromise) {
		dbPromise = openDB<ZenWriteDB>('zenwrite-db', 2, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					// Fresh install — create the store
					db.createObjectStore('documents', { keyPath: 'id' });
				}
			},
		});
	}
}

/**
 * Returns all documents exactly as stored in IDB, with no migration applied.
 * Used only by migrationStore for pre-flight detection.
 */
export async function getRawDocuments(): Promise<unknown[]> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		return db.getAll('documents');
	} catch (err) {
		console.error('[zenwrite] Failed to read raw documents:', err);
		return [];
	}
}

export async function getDocuments(): Promise<Document[]> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		const raw = await db.getAll('documents');

		// Migrate old-format docs and write them back to IDB so they're
		// clean on disk. After one full load cycle, this becomes a no-op.
		const docs: Document[] = [];
		for (const item of raw) {
			if (needsMigration(item)) {
				const migrated = migrateDocument(item);
				if (migrated) {
					await db.put('documents', migrated);
					docs.push(migrated);
				}
			} else {
				docs.push(item);
			}
		}
		return docs;
	} catch (err) {
		console.error('[zenwrite] Failed to load documents:', err);
		return [];
	}
}

export async function getDocument(id: string): Promise<Document | undefined> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		const raw = await db.get('documents', id);
		if (!raw) return undefined;
		if (needsMigration(raw)) {
			const migrated = migrateDocument(raw);
			if (migrated) await db.put('documents', migrated);
			return migrated ?? undefined;
		}
		return raw;
	} catch (err) {
		console.error('[zenwrite] Failed to get document:', err);
		return undefined;
	}
}

export async function saveDocument(doc: Document): Promise<void> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		doc.metadata.updatedAt = Date.now();
		await db.put('documents', doc);
	} catch (err) {
		console.error('[zenwrite] Failed to save document:', err);
		throw err;
	}
}

export async function deleteDocument(id: string): Promise<void> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		await db.delete('documents', id);
	} catch (err) {
		console.error('[zenwrite] Failed to delete document:', err);
		throw err;
	}
}
