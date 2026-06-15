# pigweed — frontend

> Copy this file into the pigweed frontend repo as `CLAUDE.md`. It's the
> complete brief: product, brand, the avatar system, and the exact API
> contract. The backend (pigweed-be) is feature-complete and stable — the
> frontend is the only thing left to build.

## What pigweed is

A hyperlocal, animal-themed social network. Every user is a
farm animal (CHICKEN / DOG / GOOSE — randomly assigned, rerollable). The
feed is **location-bounded**: you only see posts from animals within a
radius (~100km) of where you currently are. Travel and the feed travels
with you; each post stays anchored to where it was made. The vibe is
4chan-flavored anonymity (persistent animal pseudonym) with adult AI
moderation. 4chan rawness, Yik Yak locality, but with the moderation Yik
Yak never had.

> **Update (2026-06): no longer strictly anonymous.** ourlittlefarm is now a
> farm community + customer reviews — owners post updates (flagged "OP") and
> customers (the aunties buying eggs) review, often under their **real
> names**. The animal pseudonym is offered and is the default flavor, but
> `username` may be a real name and anonymity is **not** a guarantee. Treat
> "never real identity" as historical intent, not a hard rule. Unchanged:
> user geo is never stored server-side; no DMs. See pigweed-be/CLAUDE.md's
> matching 2026-06 note for the full reasoning.

## Visual identity — non-negotiable

- **Heavy SVG, GSAP-animated, math-driven.** Visual state _derives_ from
  data state. The backend stays numeric; the frontend goes feral.
- **No whitespace.** Every surface is deliberately, saturatedly colored.
  No `#fff`. Punk, not Apple-clean. (Page background is your call — the
  backend doesn't care.)
- **Bushy borders.** A post card's border grows visually "bushier" as its
  net score rises. Pure frontend math from `upvoteCount - downvoteCount`.
- **UNMODERATED badge = shiny.** Posts/comments with `moderated: false`
  slipped past AI moderation because OpenAI was momentarily down. They're
  rare-by-nature collectibles — render them with a distinct shiny/foil
  treatment. Can't be farmed, pure serendipity. Lean into the rarity.
- **Hidden comments collapse.** Comments with `hidden: true` (community
  net-score < -5) render collapsed with click-to-reveal (Reddit-style).
  The body still ships in the payload, so reveal needs no extra fetch.

## The avatar system (the core FE-specific build)

The backend gives you two fields per user: `animal` (enum) and
`avatarSeed` (int). The avatar is a **pure function** `(animal, seed) →
SVG`. No image storage, no CDN, no AI, $0. You render it client-side.

- Hand-drawn **layered** SVG per animal — body, wing/limb, head, eye,
  accent, accessory are _separate paths_ with `var(--...)` fills, not one
  flat shape. (The user draws these on iPad — vector tool, not Procreate.)
- A **colored circle background** behind the silhouette. The whole tile
  is the punk DNA.
- Seed math distributes colors from a curated punk palette across every
  slot. **Split the palette**: backgrounds from a saturated/mid-dark
  sub-palette, bodies from a brighter/contrasting sub-palette, so the
  silhouette never camouflages into the circle. Hash the seed _differently
  per slot_ so they don't correlate.
- Pattern library (spots/stripes/scratches as SVG `<pattern>`) and an
  accessory pool (hat/cig/mohawk) — seed picks which, if any.
- Two users, same animal, different seed → visibly distinct. ~100M
  permutations per animal from ~6 layered regions.
- Reroll: `POST /users/me/avatar/reroll` → returns new `{animal, avatarSeed}`.
  Each click IS the commit (no "save" button). Used on signup + settings.

## Stack

SvelteKit + TypeScript + GSAP (Vite is built in).

- **Svelte's reactivity is a gift for this app.** "Visual state derives
  from data state" (bushy borders from net score, avatar from seed) is
  literally Svelte's core model — reactive declarations (`$:` / runes)
  recompute the visual math the instant the data changes. No manual
  memoization.
- **SVG is first-class in Svelte components.** Inline `<svg>` with
  `style="--body-fill: {color}"` bindings is the natural way to do the
  layered avatar tinting — no special imports or loaders needed. Drop the
  hand-drawn silhouettes in as Svelte components, bind CSS custom
  properties computed from `avatarSeed`.
- **GSAP**: drive timelines from Svelte `actions` (`use:` directives) or
  `onMount`. Plays fine with Svelte's lifecycle.
- **Data layer**: `@tanstack/svelte-query` for cache + SSE-driven
  invalidation, OR plain SvelteKit `load` functions + stores if you want
  to stay lighter. Either works; svelte-query pays off once the feed has
  optimistic vote/award updates.
- **No CSS framework needed.** The "no whitespace / all deliberate color"
  rule means bespoke CSS anyway. Svelte's scoped `<style>` blocks fit
  this perfectly.
- Deploy target is **Cloudflare** (`@sveltejs/adapter-cloudflare`).
  This is a **SvelteKit app, not a static bundle** —
  `+*.server.ts` (session resolution, cookie forwarding) needs the
  SvelteKit server runtime, which Cloudflare Workers provides via the
  adapter. Keep that server layer a thin BFF: it resolves
  sessions, forwards cookies, and shapes data for pages — it never
  owns a DB, auth logic, or domain rules (those live in pigweed-be).
  The SSE feed is still consumed client-side (`EventSource`), so no
  long-lived-connection constraints apply to the FE host.

## Backend connection

- Base URL: `http://localhost:3000` in dev. Set via env var.
- **Auth is cookie-based** (Better Auth). Send `credentials: "include"`
  on every fetch. No bearer tokens for web.
- Auth endpoints live under `/api/auth/*` (Better Auth handles them).
  Everything else is the custom API below.

## Auth flow

**Sign up** — `POST /api/auth/sign-up/email`

```json
{
	"email": "...",
	"password": "...",
	"name": "...",
	"username": "punk_chicken_42",
	"gender": "MALE|FEMALE|NONBINARY|UNDISCLOSED"
}
```

`animal` + `avatarSeed` are server-assigned (do NOT send them). Username
errors come back specific: `USERNAME_IS_ALREADY_TAKEN`, `USERNAME_TOO_SHORT`
(min 3), `USERNAME_TOO_LONG` (max 30). Check availability live as the
user types: `GET /api/auth/is-username-available?username=foo`.

**Sign in** — `POST /api/auth/sign-in/email` (email+password) OR
`POST /api/auth/sign-in/username` (username+password).

**Session** — `GET /api/auth/get-session`. The `user` object includes
everything you need for the nav/profile in ONE call (Better Auth
additionalFields): `username, gender, animal, avatarSeed, coinBalance,
unlockCoins`, plus standard `id, name, email, emailVerified, image`.
Don't make separate calls to hydrate the user header.

**Email verification (optional, not enforced yet)** — OTP flow:
`POST /api/auth/email-otp/send-verification-otp { email, type:
"email-verification" }` then `POST /api/auth/email-otp/verify-email
{ email, otp }`. Same plugin does `forget-password` and OTP `sign-in`
via the `type` field.

**Passkeys (WebAuthn)** — The BE has `@better-auth/passkey` wired
(`POST /api/auth/passkey/add-passkey`, `POST /api/auth/sign-in/passkey`,
`GET /api/auth/passkey/list-user-passkeys`,
`POST /api/auth/passkey/{delete,update}-passkey`). The FE consumes them
through the `authClient` exported from `src/lib/api/auth.ts` — a single
`createAuthClient({ baseURL, plugins: [usernameClient(), passkeyClient()] })`
that owns every `/api/auth/*` call. The `passkeyClient()` wraps the
`navigator.credentials.*` ceremonies, so callers just await
`authClient.signIn.passkey()`, `authClient.passkey.addPasskey({ name })`,
`authClient.passkey.listUserPasskeys()`, `authClient.passkey.deletePasskey({ id })`.
Surfaces: the **"Sign in with a passkey" button on `/login`** and the
**`/settings` page** (server-redirects strangers to `/login`, lists
enrolled passkeys, add/delete inline). Dev `rpID` must match —
`PASSKEY_RP_ID=localhost` + `PASSKEY_ORIGIN=http://localhost:5173` on the
BE; changing the FE port means changing both BE env vars in lockstep
(passkeys silently refuse on any mismatch).

## i18n (Paraglide-JS v2)

Locales: `en` (base) + `ko`. Source of truth: `messages/en.json` +
`messages/ko.json` (every locale implements every key). The Vite plugin
(`paraglideVitePlugin` in `vite.config.ts`) regenerates
`src/lib/paraglide/` on every dev/build — that directory is gitignored,
don't edit it. Locale resolution strategy is `['cookie',
'preferredLanguage', 'globalVariable', 'baseLocale']`: a `PARAGLIDE_LOCALE`
cookie wins (persisted user choice), then `navigator.languages` on first
visit, then `globalVariable` (set by `src/hooks.server.ts` during SSR via
`paraglideMiddleware`), then `en` as the fallback.

Use in components: `import { m } from '$lib/paraglide/messages.js'; m.hello_world()`.

The `Locale` enum is shared with the BE via `@meteorclass/pigweed-contract`.
Adding a locale = add to `pigweed-be/contract/src/index.ts` + rebuild the
contract + add to `pigweed-be/src/utils/i18n.ts` (BE dict) + add a
`messages/<locale>.json` file here + list it in `project.inlang/settings.json`.

## API contract — every endpoint

### Posts

`GET /posts?lat=&lng=&radius=&sort=&page=&limit=`

- `lat`/`lng` optional. If present → feed filtered to `radius` km
  (default 100). If absent → all posts (browse-all).
- `sort=rank` → "hot" composite score (needs geo; silently falls back to
  newest without it). Anything else → newest. **Response echoes
  `"sort": "newest"|"rank"`** — use it to set the active tab; if you
  requested rank but got newest, geo was missing.
- `sort=rank` auto-applies an animal-affinity boost from the signed-in
  user's animal (server-derived — you do NOT pass it).
- Response: `{ posts: [...], page, limit, radiusKm, sort }`.

`GET /posts/:id` — single post.

Post object shape (feed + single):

```
{ id, title, body, latitude, longitude, createdAt, updatedAt,
  upvoteCount, downvoteCount, moderated,
  author: { id, name, image },
  media: [{ id, url, kind, order, width, height }],
  myVote: "UP"|"DOWN"|null,        // the signed-in viewer's vote
  awards: [{ awardTypeId, assetKey, name, count }] }  // sorted, desc by count
```

`POST /posts` (auth) — `{ title, body, latitude, longitude, media? }`.
**lat/lng REQUIRED** (get from browser geolocation API). On moderation
block → `422 { error, code: "CONTENT_FLAGGED", categories }`. Display
`error` (e.g. "flagged for hateful speech").

`PATCH /posts/:id` (auth, author only) — `{ title?, body? }`.
`DELETE /posts/:id` (auth, author only) — soft delete.

### Comments

`GET /posts/:postId/comments` — flat list, every comment carries
`parentCommentId` + `depth`. **You build the tree client-side.** Each:

```
{ id, postId, parentCommentId, depth, body, createdAt, updatedAt,
  deletedAt, upvoteCount, downvoteCount, moderated,
  author: { id, name, image } | null,   // null when deleted
  myVote, awards, hidden }               // hidden = collapse it
```

Deleted comments stay in the list (tree integrity) with body
`"[deleted]"`, author `null`.

`GET /comments/:id/replies` — `{ parent, comments: [...] }` — a comment

- all its descendants. Used for sub-thread pages / "read more".

`POST /posts/:postId/comments` (auth) — `{ body, parentCommentId? }`.
Same `422 CONTENT_FLAGGED` on moderation block.

`PATCH /comments/:id` (auth, author) — `{ body }`.
`DELETE /comments/:id` (auth, author) — soft delete.

### Votes

`PUT /posts/:postId/vote` (auth) — `{ value: "UP"|"DOWN" }`. Idempotent.
`DELETE /posts/:postId/vote` (auth) — unvote.
`PUT /comments/:commentId/vote` / `DELETE /comments/:commentId/vote` — same.
All return `{ upvoteCount, downvoteCount, myVote }`. Re-clicking the
active button = send DELETE (toggle off is a FE decision).

### Awards

`GET /awards/types` (public) — `[{ id, assetKey, name, priceCoins }]`.
Render the gift picker from this. `assetKey` maps to your local SVG file.

`POST /posts/:postId/awards` (auth) — `{ awardTypeId }`. Spends
`coinBalance`. `422` if insufficient. `POST /comments/:commentId/awards`
same.

`GET /posts/:postId/awards/granters` (auth) — full attributed list. **Gated**:
post author sees free; everyone else needs an unlock. Locked →
`402 { error, unlockCoins, unlockEndpoint }`. Show "spend 1 unlockCoin
to see who gifted this" with their current `unlockCoins` balance.

`POST /posts/:postId/awards/granters/unlock` (auth) — spends 1
`unlockCoin`, permanent for that post. `402` if no unlockCoins
("grant more awards to earn some" — every 10 awards granted = +5
unlockCoins, automatic). Comment equivalents exist for both.

### Achievements & live events

`GET /users/:userId/achievements` (public) — earned achievements list.

`GET /users/me/events` (auth) — **SSE stream**. Open once after sign-in
with `EventSource`. Listen for `achievement_unlocked` events:

```js
const es = new EventSource(`${API}/users/me/events`, { withCredentials: true });
es.addEventListener('achievement_unlocked', (e) => {
	const { achievement, newCoinBalance } = JSON.parse(e.data);
	toast(`🏆 ${achievement.name}!  +${achievement.rewardCoins} coins`);
});
```

Also emits `connected` (handshake) and `ping` (heartbeat, ignore).

### Misc

`GET /coins/balance` (auth) — `{ balance, unlockCoins }`.
`GET /coins/packs` (public) — Stripe coin packs catalog.
`POST /coins/checkout` (auth) — `{ coinPackId }` → `{ url }` (redirect
to Stripe). `GET /users/:userId/votes?target=posts|comments` (public,
paginated) — a user's vote history for profile pages.
`POST /users/me/avatar/reroll` (auth) — `{ animal, avatarSeed }`.

## Backend-signal → FE-behavior cheatsheet

| Signal                           | Do this                                                  |
| -------------------------------- | -------------------------------------------------------- |
| `myVote: "UP"`                   | highlight the upvote button as active                    |
| `awards: [...]`                  | render badge stack; `.slice(0,3)` for the preview        |
| `hidden: true`                   | collapse comment, click-to-reveal (body's already there) |
| `moderated: false`               | UNMODERATED shiny/foil badge — rare, celebrate it        |
| response `sort` ≠ requested      | geo was missing; show newest tab active                  |
| `402` on granters                | "spend 1 unlockCoin" modal, show their balance           |
| `422 CONTENT_FLAGGED`            | show `error` text; let them edit & retry                 |
| `upvoteCount - downvoteCount`    | drive bushy-border intensity                             |
| SSE `achievement_unlocked`       | toast + bump the coin balance in UI                      |
| author `null` + body `[deleted]` | render as "[deleted]" stub, keep in tree                 |

## Things NOT to do

- Don't send `viewerAnimal`, user geo, or any identity-coupled value as a
  param the server can derive from the session. (The backend rejects /
  ignores these by design.)
- Don't build DMs. Anonymous + direct-message = harassment vector;
  off the roadmap entirely.
- Don't store the user's location anywhere server-side — you pass lat/lng
  per request from the browser geolocation API; it's never persisted.
- Don't poll for achievements/coins — the SSE stream pushes them.
- Don't use white / un-styled surfaces. Every pixel is deliberate color.

## Reference

Full product reasoning, moderation philosophy, and the "why" behind every
decision lives in pigweed-be's `CLAUDE.md`. Read it once for context;
this file is the day-to-day FE contract.
