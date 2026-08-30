# Crypto Watcher Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that lets users track crypto prices with customizable alerts for price thresholds and percentage moves, plus on-demand price checks and optional daily summaries. Owner receives anonymized aggregate usage statistics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto traders
- crypto hobbyists

## Success criteria

- Users can create and manage watchlists with price alerts
- System sends timely alerts based on price thresholds/changes
- Owner receives daily aggregate statistics about bot usage

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with watchlist management options
- **Add Coin** (button, actor: user, callback: add_coin:start) — Begin adding a cryptocurrency to watchlist
  - inputs: ticker symbol, friendly name
  - outputs: updated watchlist confirmation
- **Create Alert** (button, actor: user, callback: alert:create) — Configure price threshold or percentage move alert
  - inputs: alert type, value, timeframe
  - outputs: alert confirmation message
- **/price** (command, actor: user, command: /price) — Check current price of specified ticker or entire watchlist
  - inputs: ticker symbol or 'all'
  - outputs: price data with 24h change
- **Manage Preferences** (button, actor: user, callback: prefs:edit) — Configure quiet hours, summary time, and cooldown settings

## Flows

### Watchlist Management
_Trigger:_ add_coin:start

1. Select coin from quick buttons or enter custom ticker
2. Optionally set friendly name
3. Confirm addition to watchlist

_Data touched:_ User profile, Watchlist entry

### Alert Creation
_Trigger:_ alert:create

1. Choose alert type (threshold/percent move)
2. Set value and timeframe parameters
3. Confirm alert rule activation

_Data touched:_ Watchlist entry

### Price Check
_Trigger:_ /price

1. Parse ticker parameter
2. Fetch current price data
3. Format response with 24h change

_Data touched:_ Watchlist entry

### Daily Summary
_Trigger:_ scheduled_daily

1. Check user preferences for enabled status
2. Compile watchlist prices
3. Send formatted summary message

_Data touched:_ User profile, Watchlist entry

### Alert Processing
_Trigger:_ price_update_event

1. Check all active watchlist entries
2. Evaluate alert conditions
3. Send alerts during active hours

_Data touched:_ Watchlist entry, Alert event log

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **OWNER_CHAT_ID** — Where aggregate statistics and alert samples are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `OWNER_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing OWNER_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User Profile** _(retention: persistent)_ — User-specific preferences and settings
  - fields: chat_id, timezone, quiet_hours, summary_time, cooldown_period
- **Watchlist Entry** _(retention: persistent)_ — Tracked cryptocurrency with alert rules
  - fields: ticker, friendly_name, alert_rules, last_alert_time, last_alert_price
- **Alert Event Log** _(retention: persistent)_ — Anonymized alert statistics for owner
  - fields: user_id_hash, ticker, alert_type, timestamp

## Integrations

- **Telegram** (required) — Bot API messaging
- **Price Feed API** (required) — Cryptocurrency price data
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /stats - View aggregate usage statistics
- /top_alerts - See most common alert tickers

## Notifications

- Price threshold alerts
- Percentage move alerts
- Daily summary digest
- Unknown ticker error messages

## Permissions & privacy

- All user data stored privately per account
- Alert event logs anonymize user identifiers
- No third-party data sharing

## Edge cases

- Unknown ticker symbols
- Price feed API failures
- Alert cooldown period enforcement
- Quiet hours during alert windows

## Required tests

- Verify alert triggers with price thresholds
- Test percent-move alerts across timeframes
- Validate daily summary formatting
- Confirm quiet hours blocking

## Assumptions

- Price feed API is available with retry logic
- Users understand cryptocurrency ticker symbols
- 24-hour cooldown is sufficient for alert suppression
