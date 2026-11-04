# Xecutd Journal

A private trading journal with Supabase email authentication, account-isolated journal data, trade review tools, and an installable web app shell.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and public publishable/anon key.
3. Add `GEMINI_API_KEY` if you want the Buddy AI endpoints to use Gemini locally. `FINANCE_CALENDAR_API_KEY` is optional.
4. Run `npm run dev` and open the local URL printed in the terminal.

## Supabase setup

Run [`supabase/migrations/20261104_user_journals.sql`](supabase/migrations/20261104_user_journals.sql) in the Supabase SQL Editor. It creates the account-scoped journal table with row-level security and Realtime updates.

Configure Supabase Auth URL settings with the deployed site URL and the local development URL as allowed redirects. The browser uses only the project URL and public publishable/anon key; never use a service-role or secret key in a `VITE_` variable.

## Cloudflare Pages deployment

Connect the GitHub repository to Cloudflare Pages with the repository root as the project root, `npm run build` as the build command, and `dist` as the build output directory. The `functions/` directory provides the Buddy and economic-calendar API routes for Pages.

Set these values in Cloudflare Pages project settings:

- `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` as build environment variables. The publishable key variable takes precedence.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as Pages Function variables for verifying signed-in requests. Use the same Supabase project and public key as the browser settings.
- `GEMINI_API_KEY` as a server-side Pages Function secret for Gemini-backed Buddy responses.
- `FINANCE_CALENDAR_API_KEY` as an optional server-side Pages Function secret if the economic calendar endpoint is enabled.

The Pages Functions verify the Supabase access token before using Gemini or the economic-calendar service. Do not commit `.env.local` or other `.env` files. `.gitignore` excludes them and build artifacts while keeping `.env.example` as a safe template.

## Install as an app

The site includes a web app manifest, icons, and a service worker. Once deployed over HTTPS, Chrome can install Xecutd Journal as a standalone app from the browser’s install option. The service worker caches the app shell only; API requests and journal data continue to use their network services.
