import { env } from '$env/dynamic/public';

/**
 * Base URL of the static-assets bucket (ourlittlefarm-assets, hosted on
 * Cloudflare R2) — brand art, hero photos, the logo. The `.r2.dev` default
 * is the public dev URL; production sets PUBLIC_ASSET_BASE_URL to the
 * bucket's custom domain.
 */
const ASSET_BASE =
	env.PUBLIC_ASSET_BASE_URL ?? 'https://pub-9ed0a91dba4749879e89a94774f50169.r2.dev';

/** URL for an asset key in the bucket. `encodeURI` handles spaces, keeps `/`. */
export const asset = (key: string) => `${ASSET_BASE}/${encodeURI(key)}`;

/**
 * The brand logo, served from the assets bucket. Single source of truth for
 * every on-site logo (navbar, etc.) — swap the file in R2 (same key) or repoint
 * PUBLIC_ASSET_BASE_URL to change it everywhere. Email templates use their own
 * BE-side URL (EMAIL_LOGO_URL) since email clients can't read this code.
 */
export const LOGO = asset('olf-logo.png');
