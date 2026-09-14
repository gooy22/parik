# Arena Line

PWA for a device-local account and virtual sports bets. The sports screen,
header, account, and coupon belong to this app; no third-party iframe or masking
controls are used.

## Data

`dist/feed.mjs` subscribes to the anonymous, read-only SignalR feed used by the
provider's public web client. It requests live events, the next 24 hours of
prematch events, and markets for those events. The browser-published SDK key is
not an account credential. Local credentials and bets never go to this feed.

The client applies event and market deltas, watches selected events across tab
changes, reconnects after interruption, and disables unavailable quotes.
Disconnected data is never replaced with invented matches. This public-client
interface has no stability guarantee; provider changes may require adapting the
adapter. Only explicitly mapped market/outcome types appear in the coupon.

## Account and virtual bets

Existing `arena-accounts-v1` and `arena-session-v1` records are preserved. The
requested profile is seeded on first sign-in with an initial virtual balance of
134,599 UAH. Accounts, balance, transactions, and bets persist in this browser's
local storage, not across devices. This is a simulation, not production identity
verification or a real-money wallet.

Single bets, accumulators, and systems validate the current quote and balance,
store a receipt, and debit virtual funds in one storage write. Web Locks serialize
concurrent tabs where supported. Changed odds require explicit acceptance;
duplicate submissions reuse a receipt ID. Accepted bets appear in the account's
history. A read-only Worker API fetches the provider's official daily results
archive and completed-event history. The client checks open bets every 30 seconds
while visible, on login, and on returning to the page. Confirmed results settle
eligible markets, move bets to «Розраховані», and credit gross virtual payouts.
Status and credit are saved atomically and cannot be applied twice. Old quote IDs
are decoded to support already accepted bets. Deposits and withdrawals only
adjust virtual funds.

Unconfirmed, missing or ambiguous results remain pending. In particular, kill
scores alone do not prove Dota/LoL map winners; mixed-series map winner markets
require explicit confirmation. Whole-series winners, map totals and handicaps,
supported score totals and exact scores are evaluated from archived scores.
The app does not run settlement while the browser is closed: it catches up when
opened again. Clearing browser storage removes the local account history.

Match cards and accepted selections open a native full match page with overview,
H2H, recent results, live odds overview, and grouped map markets. The odds overview
compares the first observed quote on that page with its current quote; it does
not fabricate historical prices. The bottom navigation includes «Мої ставки».

## Validation and publishing

- `npm test`
- `node --check dist/app.js`
- `node --check dist/sports.mjs`
- `node --check dist/feed.mjs`

Run `npm run build` to package the authored `dist/` assets into a Cloudflare
Worker together with `worker/api.mjs`. The generated entrypoint is
`dist/server/index.js`; `.openai/hosting.json` retains the existing Site ID.
The results API accepts only fixed public provider paths and validated event IDs,
with a short shared archive cache. It sends no local credentials or stakes.
The service worker uses network-first assets, excludes result API responses,
and removes previous app caches on activation.
