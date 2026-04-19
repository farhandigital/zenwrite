import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { Document } from './types';

interface ZenWriteDB extends DBSchema {
	documents: {
		key: string;
		value: Document;
	};
}

let dbPromise: Promise<IDBPDatabase<ZenWriteDB>> | undefined;

export function initDB() {
	if (typeof window !== 'undefined' && !dbPromise) {
		dbPromise = openDB<ZenWriteDB>('zenwrite-db', 2, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					// Fresh install — create the store
					db.createObjectStore('documents', { keyPath: 'id' });
				}
			},
			terminated() {
				dbPromise = undefined;
			},
		});

		dbPromise
			.then((db) => {
				db.addEventListener('close', () => {
					dbPromise = undefined;
				});
				db.addEventListener('versionchange', () => {
					db.close();
					dbPromise = undefined;
				});
			})
			.catch(() => {
				dbPromise = undefined;
			});
	}
}

async function withRetry<T>(
	operation: (db: IDBPDatabase<ZenWriteDB>) => Promise<T>,
): Promise<T> {
	if (!dbPromise) initDB();
	try {
		const db = await (dbPromise as unknown as Promise<
			IDBPDatabase<ZenWriteDB>
		>);
		return await operation(db);
	} catch (err: unknown) {
		const error = err as Error;
		if (
			error?.name === 'InvalidStateError' ||
			error?.message?.includes('closing')
		) {
			console.warn('[zenwrite] DB connection closed, recovering...', error);
			dbPromise = undefined;
			initDB();
			const db = await (dbPromise as unknown as Promise<
				IDBPDatabase<ZenWriteDB>
			>);
			return await operation(db);
		}
		throw err;
	}
}

export async function getDocuments(): Promise<Document[]> {
	try {
		return await withRetry((db) => db.getAll('documents'));
	} catch (err) {
		console.error('[zenwrite] Failed to load documents:', err);
		return [];
	}
}

export async function getDocument(id: string): Promise<Document | undefined> {
	try {
		return await withRetry((db) => db.get('documents', id));
	} catch (err) {
		console.error('[zenwrite] Failed to get document:', err);
		return undefined;
	}
}

export async function saveDocument(doc: Document): Promise<void> {
	try {
		await withRetry((db) => db.put('documents', doc));
	} catch (err) {
		console.error('[zenwrite] Failed to save document:', err);
		throw err;
	}
}

export async function deleteDocument(id: string): Promise<void> {
	try {
		await withRetry((db) => db.delete('documents', id));
	} catch (err) {
		console.error('[zenwrite] Failed to delete document:', err);
		throw err;
	}
}
