#!/usr/bin/env bun
/**
 * Post-build CSP hash injector.
 *
 * Reads build/index.html, computes SHA-256 hashes for:
 *   - inline <script> elements   → injected into script-src
 *   - inline style="" attributes → injected into style-src (+ 'unsafe-hashes')
 *
 * Also whitelists Google Fonts in style-src / font-src.
 *
 * Writes the result into build/_headers so Cloudflare Pages picks it up.
 * The static/_headers file remains a clean hash-free template.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const BUILD_DIR = 'build';

// ─── Helpers ────────────────────────────────────────────────────────────────

function sha256(content) {
	return `'sha256-${createHash('sha256').update(content).digest('base64')}'`;
}

/** Parse a CSP string into a Map<directive, string[]> */
function parseCsp(csp) {
	const map = new Map();
	for (const part of csp
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean)) {
		const [name, ...values] = part.split(/\s+/);
		map.set(name, values);
	}
	return map;
}

/** Serialize a CSP Map back to a string */
function serializeCsp(map) {
	return (
		[...map.entries()]
			.map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
			.join('; ') + ';'
	);
}

// ─── Extract hashes from index.html ─────────────────────────────────────────

const html = readFileSync(`${BUILD_DIR}/index.html`, 'utf-8');

// Inline <script> elements (no src attribute)
const scriptHashes = [];
for (const match of html.matchAll(
	/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi,
)) {
	const content = match[1];
	if (content.trim()) {
		scriptHashes.push(sha256(content));
	}
}

// Inline style="" attribute values
const styleAttrHashes = [];
for (const match of html.matchAll(/\sstyle="([^"]*)"/gi)) {
	const content = match[1];
	if (content.trim()) {
		styleAttrHashes.push(sha256(content));
	}
}

console.log('  Inline script hashes:', scriptHashes);
console.log('  Inline style attr hashes:', styleAttrHashes);

// ─── Patch build/_headers ────────────────────────────────────────────────────

let headers = readFileSync(`${BUILD_DIR}/_headers`, 'utf-8');

headers = headers.replace(
	/^(\s*Content-Security-Policy: )(.+)$/m,
	(_, prefix, rawCsp) => {
		const csp = parseCsp(rawCsp);

		// script-src: add inline script hashes
		if (scriptHashes.length) {
			const existing = csp.get('script-src') ?? [];
			csp.set('script-src', [...new Set([...existing, ...scriptHashes])]);
		}

		// style-src: add Google Fonts + 'unsafe-hashes' + style attr hashes
		{
			const existing = csp.get('style-src') ?? [];
			const additions = [
				'https://fonts.googleapis.com',
				...(styleAttrHashes.length
					? ["'unsafe-hashes'", ...styleAttrHashes]
					: []),
			];
			csp.set('style-src', [...new Set([...existing, ...additions])]);
		}

		// font-src: add Google Fonts static CDN
		{
			const existing = csp.get('font-src') ?? [];
			csp.set('font-src', [
				...new Set([...existing, 'https://fonts.gstatic.com']),
			]);
		}

		return prefix + serializeCsp(csp);
	},
);

writeFileSync(`${BUILD_DIR}/_headers`, headers);
console.log(`✓ CSP updated in ${BUILD_DIR}/_headers`);
