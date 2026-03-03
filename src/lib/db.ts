import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Document } from './types';

interface ZenWriteDB extends DBSchema {
	documents: {
		key: string;
		value: Document;
		indexes: { 'updatedAt': number };
	};
}

let dbPromise: Promise<IDBPDatabase<ZenWriteDB>>;

export function initDB() {
	if (typeof window !== 'undefined' && !dbPromise) {
		dbPromise = openDB<ZenWriteDB>('zenwrite-db', 1, {
			upgrade(db) {
				const store = db.createObjectStore('documents', { keyPath: 'id' });
				store.createIndex('updatedAt', 'updatedAt');
			},
		});
	}
}

export async function getDocuments() {
	if (!dbPromise) initDB();
	const db = await dbPromise;
	return db.getAllFromIndex('documents', 'updatedAt');
}

export async function getDocument(id: string) {
	if (!dbPromise) initDB();
	const db = await dbPromise;
	return db.get('documents', id);
}

export async function saveDocument(doc: Document) {
	if (!dbPromise) initDB();
	const db = await dbPromise;
	doc.updatedAt = Date.now();
	await db.put('documents', doc);
}

export async function deleteDocument(id: string) {
	if (!dbPromise) initDB();
	const db = await dbPromise;
	await db.delete('documents', id);
}
