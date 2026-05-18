import { describe, it, expect } from 'vitest';
import { randomUsername } from './username';

describe('randomUsername', () => {
	it('returns names within the contract 3–30 char bound', () => {
		for (let i = 0; i < 200; i++) {
			const name = randomUsername();
			expect(name.length).toBeGreaterThanOrEqual(3);
			expect(name.length).toBeLessThanOrEqual(30);
		}
	});

	it('produces Adjective_Noun_NNNN shape', () => {
		expect(randomUsername()).toMatch(/^[A-Za-z]+_[A-Za-z]+_\d{4}$/);
	});

	it('is non-deterministic across calls', () => {
		const names = new Set(Array.from({ length: 50 }, () => randomUsername()));
		expect(names.size).toBeGreaterThan(1);
	});
});
