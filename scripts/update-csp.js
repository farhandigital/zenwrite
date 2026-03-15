#!/usr/bin/env bun
/**
 * Post-build headers writer + CSP hash injector.
 *
 * Reads scripts/_headers.source — a human-readable template that supports:
 *   - Backslash line continuation (\) to split long header values across lines
 *   - # comment lines (stripped from the final output)
 *   - {{CSP_SCRIPT_HASHES}} placeholder for build-time inline script hashes
 *
 * Then:
 *   1. Processes line continuations into single lines
 *   2. Strips comment lines
 *   3. Computes SHA-256 hashes of all inline <script> blocks in build/index.html
 *   4. Replaces {{CSP_SCRIPT_HASHES}} with the computed hashes
 *   5. Writes the final result to build/_headers for Cloudflare Pages
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE_FILE = resolve(__dirname, '_headers.source');
const BUILD_DIR = 'build';

// ─── SHA-256 helper ───────────────────────────────────────────────────────────

function sha256(content) {
	return `'sha256-${createHash('sha256').update(content).digest('base64')}'`;
}

// ─── Source file processor ────────────────────────────────────────────────────

/**
 * Processes the _headers.source file into a valid Cloudflare Pages _headers
 * string by:
 *   - Stripping comment lines (lines whose trimmed content starts with #)
 *   - Joining backslash continuation lines into single lines
 *   - Collapsing multiple consecutive blank lines into one
 *
 * Continuation rules:
 *   A line ending with \ (ignoring trailing whitespace) continues on the next
 *   non-comment line. The backslash and all leading whitespace on the
 *   continuation are stripped; the pieces are joined with a single space.
 *
 * Example source:
 *   Content-Security-Policy: \
 *     default-src 'none'; \
 *     script-src 'self';
 *
 * Becomes:
 *   Content-Security-Policy: default-src 'none'; script-src 'self';
 */
function processSource(raw) {
	const lines = raw.split('\n');
	const output = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Skip comment-only lines (allows # anywhere in the indented block)
		if (line.trim().startsWith('#')) {
			i++;
			continue;
		}

		const rightTrimmed = line.trimEnd();

		if (rightTrimmed.endsWith('\\')) {
			// Start accumulating a continuation sequence.
			// Remove the trailing backslash (and any whitespace before it).
			let acc = rightTrimmed.slice(0, -1).trimEnd();
			i++;

			while (i < lines.length) {
				const next = lines[i];

				// Skip comment lines embedded within a continuation block
				if (next.trim().startsWith('#')) {
					i++;
					continue;
				}

				const nextTrimmed = next.trim();

				if (nextTrimmed.endsWith('\\')) {
					// Another continuation — strip leading whitespace and backslash
					acc += ' ' + nextTrimmed.slice(0, -1).trimEnd();
					i++;
				} else {
					// Final line of this continuation
					acc += ' ' + nextTrimmed;
					i++;
					break;
				}
			}

			output.push(acc);
		} else {
			output.push(rightTrimmed);
			i++;
		}
	}

	// Collapse consecutive blank lines into a single blank line
	const collapsed = [];
	let prevBlank = false;
	for (const line of output) {
		const isBlank = line.trim() === '';
		if (isBlank && prevBlank) continue;
		collapsed.push(line);
		prevBlank = isBlank;
	}

	return collapsed.join('\n');
}

// ─── Inline script hashes from index.html ────────────────────────────────────

const html = readFileSync(`${BUILD_DIR}/index.html`, 'utf-8');

const scriptHashes = [];
for (const match of html.matchAll(
	/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi,
)) {
	const content = match[1];
	if (content.trim()) {
		scriptHashes.push(sha256(content));
	}
}

console.log('  Inline script hashes:', scriptHashes);

// ─── Build the final _headers ─────────────────────────────────────────────────

const source = readFileSync(SOURCE_FILE, 'utf-8');
let headers = processSource(source);

// Inject computed hashes into the CSP placeholder.
// If there are no hashes, remove the placeholder and its preceding space cleanly.
if (scriptHashes.length > 0) {
	headers = headers.replace('{{CSP_SCRIPT_HASHES}}', scriptHashes.join(' '));
} else {
	headers = headers.replace(' {{CSP_SCRIPT_HASHES}}', '');
}

writeFileSync(`${BUILD_DIR}/_headers`, headers);
console.log(`✓ _headers written to ${BUILD_DIR}/_headers`);
