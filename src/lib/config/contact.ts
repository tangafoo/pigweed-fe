import { env } from '$env/dynamic/public';

/**
 * The farm's WhatsApp number — E.164 digits, no leading `+`. It's a published
 * contact (not a secret), so this mirrors the assets.ts/LOGO pattern: a constant
 * with an env override (PUBLIC_WHATSAPP_PHONE) so it can change without a code
 * edit. Single source of truth for every wa.me link on the site.
 */
export const WHATSAPP_PHONE = env.PUBLIC_WHATSAPP_PHONE ?? '60172332992';

/** Build a wa.me deep link, optionally pre-filling the chat with `message`. */
export const whatsappUrl = (message?: string) =>
	`https://wa.me/${WHATSAPP_PHONE}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

/**
 * wa.me link to a SPECIFIC customer's number (the farm is the sender —
 * `WHATSAPP_PHONE` would be the wrong target). Normalizes to digits;
 * local 0-prefixed numbers get Malaysia's country code (users type
 * "+60…" or "017…" — see the signup phone placeholder).
 */
export const whatsappUrlTo = (phone: string, message: string) => {
	const digits = phone.replace(/\D/g, '');
	const intl = digits.startsWith('0') ? `6${digits}` : digits;
	return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
};
