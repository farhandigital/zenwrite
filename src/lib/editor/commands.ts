import { HighlightStyle } from '@codemirror/language';
import { EditorSelection } from '@codemirror/state';
import type { Command } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

export const customHighlightStyle = HighlightStyle.define([
	{ tag: t.heading, color: 'var(--accent)', fontWeight: 'bold' },
	{ tag: t.strong, fontWeight: 'bold' },
	{ tag: t.emphasis, fontStyle: 'italic' },
	{ tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
	{ tag: t.url, color: 'var(--text-muted)' },
	{
		tag: t.quote,
		color: 'var(--text-muted)',
		fontStyle: 'italic',
		borderLeft: '4px solid var(--accent)',
		paddingLeft: '15px',
	},
	{ tag: t.list, color: 'var(--text)' },
	{
		tag: t.monospace,
		backgroundColor: 'var(--accent-glow)',
		borderRadius: '3px',
		padding: '2px 4px',
		fontFamily: 'monospace',
		fontSize: '1.1rem',
	},
	{ tag: t.strikethrough, textDecoration: 'line-through' },
]);

export const minimalTheme = EditorView.theme({
	'&': {
		color: 'var(--text)',
		backgroundColor: 'transparent',
		height: '100%',
		caretColor: 'var(--accent)',
	},
	'.cm-content': {
		fontFamily: 'var(--font-editor)',
		fontSize: '1.25rem',
		lineHeight: '1.8',
		padding: '0 0 30px 0',
		whiteSpace: 'pre-wrap',
	},
	'&.cm-focused': {
		outline: 'none',
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'var(--accent)',
		borderLeftWidth: '3px',
		transition: 'left 80ms ease-out, top 80ms ease-out',
	},
	'&.cm-focused .cm-cursor': {
		borderLeftColor: 'var(--accent)',
	},
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
		{
			backgroundColor: 'var(--accent-glow) !important',
		},
	'.cm-scroller': {
		overflow: 'visible' /* Let parent handle scrolling */,
		fontFamily: 'var(--font-editor)',
	},
	'.cm-line': {
		padding: '0',
	},
});

/**
 * Wraps/unwraps the current selection with a symmetric inline markdown marker.
 * - No selection → inserts `marker + marker` and places cursor between them.
 * - Selection already wrapped → removes the surrounding markers.
 * - Otherwise → wraps the selection.
 */
export function toggleInlineMarkup(marker: string): Command {
	return (view) => {
		const { state } = view;
		const changes = state.changeByRange((range) => {
			const selectedText = state.sliceDoc(range.from, range.to);

			// Toggle OFF: selection includes the markers
			if (
				selectedText.startsWith(marker) &&
				selectedText.endsWith(marker) &&
				selectedText.length >= marker.length * 2
			) {
				const inner = selectedText.slice(marker.length, -marker.length);
				return {
					changes: { from: range.from, to: range.to, insert: inner },
					range: EditorSelection.range(range.from, range.from + inner.length),
				};
			}

			// Toggle OFF: markers surround the selection in the document
			const before = state.sliceDoc(range.from - marker.length, range.from);
			const after = state.sliceDoc(range.to, range.to + marker.length);
			if (before === marker && after === marker) {
				return {
					changes: [
						{ from: range.from - marker.length, to: range.from, insert: '' },
						{ from: range.to, to: range.to + marker.length, insert: '' },
					],
					range: EditorSelection.range(
						range.from - marker.length,
						range.to - marker.length,
					),
				};
			}

			// Insert placeholder and position cursor between markers when nothing is selected
			if (range.empty) {
				return {
					changes: { from: range.from, insert: marker + marker },
					range: EditorSelection.cursor(range.from + marker.length),
				};
			}

			// Wrap selected text
			return {
				changes: [
					{ from: range.from, insert: marker },
					{ from: range.to, insert: marker },
				],
				range: EditorSelection.range(
					range.from + marker.length,
					range.to + marker.length,
				),
			};
		});

		view.dispatch(
			state.update(changes, { scrollIntoView: true, userEvent: 'input' }),
		);
		return true;
	};
}

/**
 * Wraps the selected text as a Markdown link: [text](url)
 * - No selection → inserts `[](url)` and places cursor where you type link text
 * - Selection → wraps as `[selection](url)` and selects the placeholder 'url'
 */
export const insertLink: Command = (view) => {
	const { state } = view;
	const changes = state.changeByRange((range) => {
		const selectedText = state.sliceDoc(range.from, range.to);
		if (range.empty) {
			// Insert []() and place cursor inside []
			const insert = '[](url)';
			return {
				changes: { from: range.from, insert },
				range: EditorSelection.cursor(range.from + 1),
			};
		}
		// Wrap selected text, select 'url' placeholder so user can immediately type
		const insert = `[${selectedText}](url)`;
		const urlStart = range.from + selectedText.length + 3; // after `[selected](`
		const urlEnd = urlStart + 3; // length of 'url'
		return {
			changes: { from: range.from, to: range.to, insert },
			range: EditorSelection.range(urlStart, urlEnd),
		};
	});

	view.dispatch(
		state.update(changes, { scrollIntoView: true, userEvent: 'input' }),
	);
	return true;
};

export const handleEnterKeyAtDOMLevel = EditorView.domEventHandlers({
	keydown(event, view) {
		if (
			event.code === 'Enter' &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.shiftKey &&
			!event.altKey
		) {
			const { state } = view;
			const { from } = state.selection.main;

			const lineStart = state.doc.lineAt(from).from;
			const lineEnd = state.doc.lineAt(from).to;
			const lineText = state.sliceDoc(lineStart, lineEnd);
			const blockQuoteMatch = lineText.match(/^(>\s*)/);

			if (blockQuoteMatch) {
				const quotePrefix = blockQuoteMatch[1];
				const contentAfterQuote = lineText.slice(quotePrefix.length);

				// If the line is just "> " or ">" with nothing after, exit the block quote
				if (!contentAfterQuote.trim()) {
					event.preventDefault();
					const changes = state.changeByRange((range) => ({
						changes: { from: range.from, to: range.to, insert: '\n' },
						range: EditorSelection.cursor(range.from + 1),
					}));
					view.dispatch(
						state.update(changes, { scrollIntoView: true, userEvent: 'input' }),
					);
					return true;
				}

				event.preventDefault();
				const changes = state.changeByRange((range) => ({
					changes: { from: range.from, to: range.to, insert: '\n> ' },
					range: EditorSelection.cursor(range.from + 3),
				}));
				view.dispatch(
					state.update(changes, { scrollIntoView: true, userEvent: 'input' }),
				);
				return true;
			}

			return false;
		}
		return false;
	},
});

/**
 * Custom Enter key handler that ensures new lines are always created,
 * even at the end of the document or with no content below.
 */
const insertNewline: Command = (view) => {
	const { state, dispatch } = view;
	const changes = state.changeByRange((range) => ({
		changes: { from: range.from, to: range.to, insert: '\n' },
		range: EditorSelection.cursor(range.from + 1),
	}));

	dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
	return true;
};

export const markdownKeymap = [
	{ key: 'Enter', run: insertNewline },
	{ key: 'Mod-b', run: toggleInlineMarkup('**') },
	{ key: 'Mod-i', run: toggleInlineMarkup('*') },
	{ key: 'Mod-`', run: toggleInlineMarkup('`') },
	{ key: 'Mod-Shift-s', run: toggleInlineMarkup('~~') },
	{ key: 'Mod-k', run: insertLink },
];
