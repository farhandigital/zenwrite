import type { Document } from './types';

/**
 * Migrate old documents that use `config` to new format using `metadata`.
 * This handles backward compatibility with documents stored before the refactor.
 */
export function migrateDocument(doc: unknown): Document | null {
	if (!doc || typeof doc !== 'object') return null;

	const data = doc as Record<string, any>;

	// Already migrated or new document
	if (data.metadata !== undefined) {
		return data as Document;
	}

	// Old format with `config` — migrate it
	if (data.config !== undefined) {
		return {
			...data,
			metadata: data.config,
		} as Document;
	}

	// Malformed document
	return null;
}

/**
 * Migrate an array of documents.
 */
export function migrateDocuments(docs: unknown[]): Document[] {
	return docs
		.map(migrateDocument)
		.filter((doc): doc is Document => doc !== null);
}
