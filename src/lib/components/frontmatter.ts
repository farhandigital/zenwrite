import { docStore } from '$lib/doc-store.svelte';

export function formatDate(ts: number): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).format(new Date(ts));
}

export function autoResizeTextarea(target: HTMLTextAreaElement) {
	target.style.height = 'auto';
	target.style.height = `${target.scrollHeight}px`;
}

export function handleInput(key: string, e: Event) {
	const target = e.target as HTMLInputElement | HTMLTextAreaElement;
	const val = target.value;
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.metadata };
		config[key] = val;
		docStore.updateCurrent({ metadata: config });
	}
}

export function removeTag(index: number, e: MouseEvent) {
	e.stopPropagation();
	e.preventDefault();
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.metadata };
		const tags = [...(config.tags || [])];
		tags.splice(index, 1);
		config.tags = tags;
		docStore.updateCurrent({ metadata: config });
	}
}

export function handleTagKeydown(e: KeyboardEvent) {
	const target = e.target as HTMLInputElement;
	if (e.key === ',' || e.key === 'Enter') {
		e.preventDefault();
		const val = target.value.trim();
		if (val && docStore.currentDocument) {
			const config = { ...docStore.currentDocument.metadata };
			const tags = [...(config.tags || [])];
			if (!tags.includes(val)) {
				tags.push(val);
				config.tags = tags;
				docStore.updateCurrent({ metadata: config });
			}
			target.value = '';
		}
	} else if (e.key === 'Backspace' && target.value === '') {
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.metadata };
			const tags = [...(config.tags || [])];
			if (tags.length > 0) {
				tags.pop();
				config.tags = tags;
				docStore.updateCurrent({ metadata: config });
			}
		}
	}
}

export function handleTagInput(e: Event) {
	const target = e.target as HTMLInputElement;
	if (target.value.includes(',')) {
		const newTags = target.value
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.metadata };
			const tags = [...(config.tags || [])];
			for (const nt of newTags) {
				if (!tags.includes(nt)) {
					tags.push(nt);
				}
			}
			config.tags = tags;
			docStore.updateCurrent({ metadata: config });
		}
		return true; // caller should clear the input value
	}
	return false;
}

/** All unique tags across all documents, sorted alphabetically. */
export function getAllTags(): string[] {
	const set = new Set<string>();
	for (const doc of docStore.documents) {
		for (const tag of doc.metadata.tags ?? []) {
			if (tag) set.add(tag);
		}
	}
	return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns up to `limit` tag suggestions for the current input value.
 * Excludes tags already on the document.
 * Ranks: exact-prefix matches first, then contains, then alphabetical.
 */
export function getSuggestions(
	input: string,
	currentTags: string[],
	limit = 6,
): string[] {
	const q = input.toLowerCase().trim();
	if (!q) return [];

	const current = new Set(currentTags);
	const all = getAllTags().filter((t) => !current.has(t));

	return all
		.filter((t) => t.toLowerCase().includes(q))
		.sort((a, b) => {
			const aStarts = a.toLowerCase().startsWith(q);
			const bStarts = b.toLowerCase().startsWith(q);
			if (aStarts !== bStarts) return aStarts ? -1 : 1;
			return a.localeCompare(b);
		})
		.slice(0, limit);
}
