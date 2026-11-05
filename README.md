# Xecutd Journal

A private trading journal with Supabase email authentication, account-isolated journal data, trade review tools, and an installable web app shell.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and public publishable/anon key.
3. Add `GEMINI_API_KEY` if you want Raku's AI endpoints to use Gemini locally. `FINANCE_CALENDAR_API_KEY` is optional.
4. Run `npm run dev` and open the local URL printed in the terminal.

## Supabase setup

Run [`supabase/migrations/20261104_user_journals.sql`](supabase/migrations/20261104_user_journals.sql) in the Supabase SQL Editor. It creates the account-scoped journal table with row-level security and Realtime updates.

Configure Supabase Auth URL settings with the deployed site URL and the local development URL as allowed redirects. The browser uses only the project URL and public publishable/anon key; never use a service-role or secret key in a `VITE_` variable.

## Cloudflare Worker deployment

This project deploys as a Cloudflare Worker using `worker.ts` and `wrangler.jsonc`, with the built Vite app served from `dist`. Build with `npm run build`, then deploy the Worker with `npx wrangler deploy` (or use the repository's connected Worker deployment).

Set the browser values `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` in the build environment. Also set these bindings in the deployed Worker's **runtime** Variables and Secrets settings. `keep_vars` is enabled in `wrangler.jsonc`, so dashboard-managed plain variables are preserved by future Wrangler deployments:

- `SUPABASE_URL` — the Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` — the same project's public key used by the browser.
- `GEMINI_API_KEY` — a server-side secret for Gemini-backed Raku responses.
- `FINANCE_CALENDAR_API_KEY` — optional server-side secret for the economic calendar.

The Worker verifies each Supabase access token before using Gemini or the economic-calendar service. Build-time `VITE_` values do not automatically become Worker runtime bindings. Never use a service-role key for session verification, and do not commit `.env.local` or other `.env` files. `.gitignore` excludes them and build artifacts while keeping `.env.example` as a safe template.

## Install as an app

The site includes a web app manifest, icons, and a service worker. Once deployed over HTTPS, Chrome can install Xecutd Journal as a standalone app from the browser’s install option. The service worker caches the app shell only; API requests and journal data continue to use their network services.
