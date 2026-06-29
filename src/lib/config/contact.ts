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
