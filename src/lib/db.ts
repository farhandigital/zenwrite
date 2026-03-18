import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { migrateDocument, migrateDocuments } from './migrations';
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
			upgrade(db, oldVersion, _newVersion, transaction) {
				if (oldVersion < 1) {
					// Fresh install — create the store (no index needed)
					db.createObjectStore('documents', { keyPath: 'id' });
				}
				if (oldVersion >= 1) {
					// v1→v2: drop the unused updatedAt index
					const store = transaction.objectStore('documents');
					store.deleteIndex('updatedAt');
				}
			},
		});
	}
}

export async function getDocuments(): Promise<Document[]> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		const docs = await db.getAll('documents');
		return migrateDocuments(docs);
	} catch (err) {
		console.error('[zenwrite] Failed to load documents:', err);
		return [];
	}
}

export async function getDocument(id: string): Promise<Document | undefined> {
	try {
		if (!dbPromise) initDB();
		const db = await dbPromise;
		const doc = await db.get('documents', id);
		return doc ? (migrateDocument(doc) ?? undefined) : undefined;
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
