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
		const config = { ...docStore.currentDocument.config };
		config[key] = val;
		docStore.updateCurrent({ config });
	}
}

export function removeTag(index: number, e: MouseEvent) {
	e.stopPropagation();
	e.preventDefault();
	if (docStore.currentDocument) {
		const config = { ...docStore.currentDocument.config };
		const tags = [...(config.tags || [])];
		tags.splice(index, 1);
		config.tags = tags;
		docStore.updateCurrent({ config });
	}
}

export function handleTagKeydown(e: KeyboardEvent) {
	const target = e.target as HTMLInputElement;
	if (e.key === ',' || e.key === 'Enter') {
		e.preventDefault();
		const val = target.value.trim();
		if (val && docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			if (!tags.includes(val)) {
				tags.push(val);
				config.tags = tags;
				docStore.updateCurrent({ config });
			}
			target.value = '';
		}
	} else if (e.key === 'Backspace' && target.value === '') {
		if (docStore.currentDocument) {
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			if (tags.length > 0) {
				tags.pop();
				config.tags = tags;
				docStore.updateCurrent({ config });
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
			const config = { ...docStore.currentDocument.config };
			const tags = [...(config.tags || [])];
			for (const nt of newTags) {
				if (!tags.includes(nt)) {
					tags.push(nt);
				}
			}
			config.tags = tags;
			docStore.updateCurrent({ config });
		}
		target.value = '';
	}
}
