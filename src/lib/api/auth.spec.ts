import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the better-auth client surfaces BEFORE importing auth.ts. The
// module instantiates `authClient` at load time, so the mock factory has
// to be ready by then. vi.hoisted lifts the fn() refs above vi.mock's
// auto-hoisting so we can use them from inside the factory AND from the
// test bodies.
const {
	mockSignInEmail,
	mockSignInUsername,
	mockSignUpEmail,
	mockGetSession,
	mockIsUsernameAvailable
} = vi.hoisted(() => ({
	mockSignInEmail: vi.fn(),
	mockSignInUsername: vi.fn(),
	mockSignUpEmail: vi.fn(),
	mockGetSession: vi.fn(),
	mockIsUsernameAvailable: vi.fn()
}));

vi.mock('better-auth/svelte', () => ({
	createAuthClient: () => ({
		signIn: { email: mockSignInEmail, username: mockSignInUsername },
		signUp: { email: mockSignUpEmail },
		getSession: mockGetSession,
		isUsernameAvailable: mockIsUsernameAvailable,
		passkey: {}
	})
}));
vi.mock('@better-auth/passkey/client', () => ({ passkeyClient: () => ({}) }));
vi.mock('better-auth/client/plugins', () => ({ usernameClient: () => ({}) }));

import { signIn, signUp, isUsernameAvailable, getSession } from './auth';

describe('signIn', () => {
	beforeEach(() => {
		mockSignInEmail.mockReset();
		mockSignInUsername.mockReset();
	});

	it('routes through email path when identifier contains "@"', async () => {
		mockSignInEmail.mockResolvedValue({ error: null });
		const result = await signIn('foo@bar.com', 'pw');
		expect(mockSignInEmail).toHaveBeenCalledWith({ email: 'foo@bar.com', password: 'pw' });
		expect(mockSignInUsername).not.toHaveBeenCalled();
		expect(result).toEqual({ ok: true });
	});

	it('routes through username path when identifier has no "@"', async () => {
		mockSignInUsername.mockResolvedValue({ error: null });
		const result = await signIn('punk_chicken', 'pw');
		expect(mockSignInUsername).toHaveBeenCalledWith({ username: 'punk_chicken', password: 'pw' });
		expect(mockSignInEmail).not.toHaveBeenCalled();
		expect(result).toEqual({ ok: true });
	});

	it('surfaces the auth-client error message on failure', async () => {
		mockSignInEmail.mockResolvedValue({ error: { message: 'Bad credentials' } });
		const result = await signIn('foo@bar.com', 'pw');
		expect(result).toEqual({ ok: false, message: 'Bad credentials' });
	});

	it('falls back to a generic message when error has no message', async () => {
		mockSignInEmail.mockResolvedValue({ error: {} });
		const result = await signIn('foo@bar.com', 'pw');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message.toLowerCase()).toContain('wrong credentials');
	});

	it('returns a network-failure message when the client throws', async () => {
		mockSignInEmail.mockRejectedValue(new Error('boom'));
		const result = await signIn('foo@bar.com', 'pw');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message.toLowerCase()).toContain('reach the farm');
	});
});

describe('signUp', () => {
	const baseInput = {
		email: 'foo@bar.com',
		password: 'verysafepw',
		username: 'punk_chicken',
		gender: 'UNDISCLOSED' as const
	};

	beforeEach(() => {
		mockSignUpEmail.mockReset();
	});

	it('returns ok on success', async () => {
		mockSignUpEmail.mockResolvedValue({ error: null });
		expect(await signUp(baseInput)).toEqual({ ok: true });
	});

	it('passes username as `name` (pigweed is pseudonymous, never surfaces real name)', async () => {
		mockSignUpEmail.mockResolvedValue({ error: null });
		await signUp(baseInput);
		expect(mockSignUpEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				email: baseInput.email,
				password: baseInput.password,
				username: baseInput.username,
				name: baseInput.username,
				gender: baseInput.gender
			})
		);
	});

	it('maps USERNAME_IS_ALREADY_TAKEN → field: "username"', async () => {
		mockSignUpEmail.mockResolvedValue({ error: { code: 'USERNAME_IS_ALREADY_TAKEN' } });
		const result = await signUp(baseInput);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.field).toBe('username');
			expect(result.message.toLowerCase()).toContain('taken');
		}
	});

	it('maps USERNAME_TOO_SHORT → field: "username" with min-3 message', async () => {
		mockSignUpEmail.mockResolvedValue({ error: { code: 'USERNAME_TOO_SHORT' } });
		const result = await signUp({ ...baseInput, username: 'pu' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.field).toBe('username');
			expect(result.message).toContain('3');
		}
	});

	it('maps USERNAME_TOO_LONG → field: "username" with max-30 message', async () => {
		mockSignUpEmail.mockResolvedValue({ error: { code: 'USERNAME_TOO_LONG' } });
		const result = await signUp({ ...baseInput, username: 'p'.repeat(40) });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.field).toBe('username');
			expect(result.message).toContain('30');
		}
	});

	it('returns a generic error without `field` for unknown codes', async () => {
		mockSignUpEmail.mockResolvedValue({
			error: { code: 'SOME_OTHER_ERROR', message: 'something broke' }
		});
		const result = await signUp(baseInput);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.field).toBeUndefined();
			expect(result.message).toBe('something broke');
		}
	});

	it('returns a network-failure message when the client throws', async () => {
		mockSignUpEmail.mockRejectedValue(new Error('boom'));
		const result = await signUp(baseInput);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message.toLowerCase()).toContain('reach the farm');
	});
});

describe('isUsernameAvailable', () => {
	beforeEach(() => {
		mockIsUsernameAvailable.mockReset();
	});

	it('returns true when available', async () => {
		mockIsUsernameAvailable.mockResolvedValue({ data: { available: true }, error: null });
		expect(await isUsernameAvailable('punk')).toBe(true);
	});

	it('returns false when taken', async () => {
		mockIsUsernameAvailable.mockResolvedValue({ data: { available: false }, error: null });
		expect(await isUsernameAvailable('punk')).toBe(false);
	});

	it('returns null when the client surfaces an error', async () => {
		mockIsUsernameAvailable.mockResolvedValue({ data: null, error: { message: 'oops' } });
		expect(await isUsernameAvailable('punk')).toBeNull();
	});

	it('returns null when the data shape is unexpected (degrade gracefully)', async () => {
		mockIsUsernameAvailable.mockResolvedValue({ data: {}, error: null });
		expect(await isUsernameAvailable('punk')).toBeNull();
	});

	it('returns null when the client throws', async () => {
		mockIsUsernameAvailable.mockRejectedValue(new Error('boom'));
		expect(await isUsernameAvailable('punk')).toBeNull();
	});
});

describe('getSession', () => {
	beforeEach(() => {
		mockGetSession.mockReset();
	});

	it('returns the parsed session on success', async () => {
		const session = {
			user: { id: '1', username: 'punk_chicken' },
			session: { id: 's', expiresAt: '2099-01-01' }
		};
		mockGetSession.mockResolvedValue({ data: session });
		expect(await getSession()).toEqual(session);
	});

	it('returns null when the response has no user (logged-out shape)', async () => {
		mockGetSession.mockResolvedValue({ data: {} });
		expect(await getSession()).toBeNull();
	});

	it('returns null when data is null', async () => {
		mockGetSession.mockResolvedValue({ data: null });
		expect(await getSession()).toBeNull();
	});

	it('returns null when the client throws', async () => {
		mockGetSession.mockRejectedValue(new Error('boom'));
		expect(await getSession()).toBeNull();
	});
});
