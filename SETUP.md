# PinDeleter — owner setup guide

This guide takes you from an empty set of accounts to a live site at **https://pindeleter.kriosity.in**.
Everything else (code, database, emails, legal pages) is already in this repository.

You will:

1. create accounts (Supabase, Vercel, GitHub, PayPal, Resend, Pinterest developer, Google Cloud),
2. put secrets into Supabase and Vercel,
3. run `supabase db push` and one Vault SQL file,
4. deploy.

Budget about 2 hours for the first run (most of it is waiting for DNS and approvals).

> Commands are shown in grey boxes. Run them in a terminal opened in this project folder.
> Anything in `CAPITALS_LIKE_THIS` is a value you replace.

---

## 1. Prerequisites

| Tool                          | Why                                     | How                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js 20+**               | builds the website                      | Download the LTS installer from <https://nodejs.org>. Check: `node -v` shows `v20` or higher.                                                                                          |
| **Supabase CLI**              | pushes the database and functions       | macOS: `brew install supabase/tap/supabase`. Windows: `scoop install supabase`. Linux: `npm i -g supabase` or see <https://supabase.com/docs/guides/cli>. Check: `supabase --version`. |
| **Git + GitHub account**      | Vercel deploys from GitHub              | <https://github.com/signup>                                                                                                                                                            |
| **Vercel account**            | hosts the website                       | <https://vercel.com/signup> (sign up with GitHub)                                                                                                                                      |
| **Docker Desktop** (optional) | only for running Supabase locally       | <https://www.docker.com/products/docker-desktop>                                                                                                                                       |
| **Deno** (optional)           | only for running the backend unit tests | <https://deno.com>                                                                                                                                                                     |

Push this folder to a new **private** GitHub repository:

```bash
git add -A
git commit -m "PinDeleter initial version"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USER/pindeleter.git
git push -u origin main
```

Install the project dependencies once:

```bash
npm install
```

---

## 2. Supabase project + database

1. Go to <https://supabase.com/dashboard> → **New project**.
   - Name: `pindeleter`
   - Database password: click **Generate** and save it in your password manager.
   - Region: pick the one closest to most of your users (e.g. **Frankfurt** for EU/India, **N. Virginia** for the US).
2. Wait ~2 minutes until the project is ready. Note the **Project ref** (the `abcdxyz…` part of the URL `https://supabase.com/dashboard/project/abcdxyz…`).
3. Log the CLI in and link it to the project:

```bash
supabase login
```

```bash
supabase link --project-ref YOUR-PROJECT-REF
```

(It asks for the database password from step 1.)

4. Enable the two extensions the migrations need. Dashboard → **Database → Extensions** → search and enable **pg_cron** and **pg_net**. (The migration also tries to enable them; doing it in the UI first avoids permission surprises.)
5. Create all tables, security rules, functions and schedules:

```bash
supabase db push
```

6. Give the scheduled jobs the URL and key they need (stored encrypted in Supabase Vault):

   - Dashboard → **Project Settings → API**. Copy the **Project URL** and the **service_role** key (under "Project API keys"; click _Reveal_). If your project shows the newer "API Keys" page, open the **Legacy API keys** tab and copy `service_role`.
   - Open `supabase/vault-seed.sql.example`, copy its contents into Dashboard → **SQL Editor → New query**, replace the two placeholder values, and click **Run**. The last line should list two rows: `project_url` and `service_role_key`.
   - Never commit the filled-in file (`supabase/vault-seed.sql` is already in `.gitignore`).

7. Check the schedules exist: SQL Editor → run `select jobname, schedule from cron.job;` → you should see `pindeleter-jobs-worker`, `pindeleter-sync-worker` and `pindeleter-maintenance`.

---

## 3. Supabase Auth settings

Dashboard → **Authentication**:

1. **URL Configuration**
   - **Site URL**: `https://pindeleter.kriosity.in`
   - **Redirect URLs** — add all of:
     - `https://pindeleter.kriosity.in/auth/callback`
     - `https://pindeleter.kriosity.in/**`
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/**`
2. **Sign In / Providers → Email**: enabled, **Confirm email** can stay on. (Magic links double as confirmation.)
3. **Sign In / Providers → Google**: enable it.
   - In Google Cloud: <https://console.cloud.google.com> → create a project "PinDeleter" → **APIs & Services → OAuth consent screen**: External, app name "PinDeleter", support email `support@kriosity.in`, authorised domain `kriosity.in`, privacy policy `https://pindeleter.kriosity.in/privacy`, terms `https://pindeleter.kriosity.in/terms`. Publish the app.
   - **Credentials → Create credentials → OAuth client ID** → _Web application_.
     - Authorised JavaScript origins: `https://pindeleter.kriosity.in`
     - Authorised redirect URI: the **Callback URL** shown on Supabase's Google provider page (looks like `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`).
   - Paste the Google **Client ID** and **Client secret** into Supabase and save.
   - Full guide: <https://supabase.com/docs/guides/auth/social-login/auth-google>
4. **Emails → SMTP Settings**: Supabase's built-in email sender is rate-limited and only for testing. Turn on **Custom SMTP** and use Resend (after section 9):
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, sender `noreply@kriosity.in`, sender name `PinDeleter`.
5. **Emails → Templates** — customise these (copy is suggested; keep the `{{ .ConfirmationURL }}` variable):
   - **Magic Link** — Subject: `Your PinDeleter sign-in link`. Body:
     ```html
     <h2>Sign in to PinDeleter</h2>
     <p>Click the button to sign in. This link expires in 1 hour and works once.</p>
     <p>
       <a
         href="{{ .ConfirmationURL }}"
         style="background:#FF3D7F;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700"
         >Sign in</a
       >
     </p>
     <p>Or enter this code: <strong>{{ .Token }}</strong></p>
     <p>If you didn't request this, you can ignore this email.</p>
     <p style="color:#6E6880;font-size:12px">PinDeleter by Kriosity · support@kriosity.in</p>
     ```
   - **Confirm signup** — same style, subject `Confirm your PinDeleter account`.

---

## 4. Supabase secrets (Edge Function environment)

Set every secret below with `supabase secrets set NAME=value` (you can set several in one command).
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically — don't set them.

| Secret                    | What it is                                                                                                       | How to get it                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                | Public site address (CORS + OAuth redirects + email links)                                                       | `https://pindeleter.kriosity.in`                                                                                        |
| `APP_ENV`                 | `production`, or `development` to also allow `http://localhost:5173`                                             | `production`                                                                                                            |
| `PINTEREST_MOCK`          | `true` = demo mode with simulated Pinterest data (works before Pinterest approves you). `false` = real Pinterest | start with `true`                                                                                                       |
| `PINTEREST_CLIENT_ID`     | Pinterest app ID                                                                                                 | developers.pinterest.com → My apps (section 10)                                                                         |
| `PINTEREST_CLIENT_SECRET` | Pinterest app secret key                                                                                         | same page                                                                                                               |
| `PINTEREST_API_BASE`      | Pinterest API base                                                                                               | `https://api.pinterest.com/v5` (or `https://api-sandbox.pinterest.com/v5` for sandbox testing)                          |
| `TOKEN_ENCRYPTION_KEY`    | 32-byte key that encrypts Pinterest tokens (AES-256-GCM)                                                         | run `openssl rand -base64 32`. **Keep a copy in your password manager — if lost, every user must reconnect Pinterest.** |
| `PAYPAL_ENV`              | `sandbox` or `live`                                                                                              | start with `sandbox`                                                                                                    |
| `PAYPAL_CLIENT_ID`        | PayPal REST app client ID (also shown in the browser — that's normal)                                            | section 8                                                                                                               |
| `PAYPAL_CLIENT_SECRET`    | PayPal REST app secret                                                                                           | section 8                                                                                                               |
| `PAYPAL_WEBHOOK_ID`       | ID of the webhook you create in PayPal                                                                           | section 8                                                                                                               |
| `RESEND_API_KEY`          | Resend API key for sending email                                                                                 | section 9                                                                                                               |
| `EMAIL_FROM`              | Sender shown on emails                                                                                           | `PinDeleter <noreply@kriosity.in>`                                                                                      |
| `ADMIN_EMAIL`             | Where contact-form messages go                                                                                   | `support@kriosity.in`                                                                                                   |
| `DELETE_RPS`              | Max Pinterest calls per second per account                                                                       | `5` (lower it if you see many rate-limit pauses)                                                                        |

Example (one line, demo mode, sandbox payments):

```bash
supabase secrets set SITE_URL=https://pindeleter.kriosity.in APP_ENV=production PINTEREST_MOCK=true PINTEREST_API_BASE=https://api.pinterest.com/v5 TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" PAYPAL_ENV=sandbox EMAIL_FROM="PinDeleter <noreply@kriosity.in>" ADMIN_EMAIL=support@kriosity.in DELETE_RPS=5
```

> ⚠️ The example generates `TOKEN_ENCRYPTION_KEY` on the fly. Run `openssl rand -base64 32` yourself first, save the value, and paste it instead if you want a copy.

Add the others as you get them, e.g.:

```bash
supabase secrets set PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_WEBHOOK_ID=... RESEND_API_KEY=...
```

Check what's set: `supabase secrets list`.

---

## 5. Deploy the Edge Functions

`supabase/config.toml` already marks `paypal-webhook`, `contact-submit` and `config` as public (`verify_jwt = false`); the CLI applies that automatically.

```bash
supabase functions deploy
```

This deploys all 17 functions. Re-run it whenever the code in `supabase/functions` changes.
Quick test (should print JSON with `"mockMode":true`):

```bash
curl https://YOUR-PROJECT-REF.supabase.co/functions/v1/config
```

---

## 6. Vercel (the website)

1. <https://vercel.com/new> → **Import** your GitHub repository.
2. Framework preset: **Vite** (detected). Build command `npm run build`, output `dist` (already in `vercel.json`).
3. **Environment Variables** (Production + Preview):
   - `VITE_SUPABASE_URL` = your Project URL, e.g. `https://YOUR-PROJECT-REF.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the **anon / public** key from Supabase → Project Settings → API. (Public by design; never put the service_role key here.)
4. Click **Deploy**.
5. Project → **Settings → Domains** → add `pindeleter.kriosity.in`.

---

## 7. DNS (at the kriosity.in registrar)

Add one record:

| Type  | Name / Host  | Value                  | TTL         |
| ----- | ------------ | ---------------------- | ----------- |
| CNAME | `pindeleter` | `cname.vercel-dns.com` | Auto / 3600 |

Wait until Vercel shows the domain as **Valid** (minutes to a few hours). HTTPS is automatic.

---

## 8. PayPal

### 8.1 Business account (from India)

1. Create a **PayPal Business** account at <https://www.paypal.com/in/business> using the business name **Kriosity** and your PAN.
2. Complete **KYC** (PAN, address proof, bank account).
3. **Link your Indian bank account** (Settings → Money, banks and cards). PayPal pays out international receipts to your bank automatically (no manual withdrawal needed in India).
4. Set the **purpose code** for incoming payments to **P0802 — Software consultancy / implementation** or **P0807 — Off-site software exports** (Settings → Account settings → Purpose code). This is required for export of services.

### 8.2 REST apps (sandbox + live)

1. <https://developer.paypal.com/dashboard> → log in with the business account.
2. Toggle **Sandbox** → **Apps & Credentials → Create App** → name `PinDeleter Sandbox`, type _Merchant_. Copy the **Client ID** and **Secret**.
3. Toggle **Live** → create `PinDeleter Live` the same way. Copy its Client ID and Secret (used at go-live).
4. In each app's settings make sure **Accept payments** is on, and enable **Advanced Credit and Debit Card Payments** if offered (guest card checkout works through the PayPal buttons either way).

### 8.3 Sandbox buyer accounts (testing)

Sandbox → **Testing Tools → Sandbox Accounts → Create account** → _Personal (buyer)_, country e.g. United States, with some balance. Use its email/password in the PayPal popup while `PAYPAL_ENV=sandbox`. You can also test card checkout with PayPal's sandbox test cards.

### 8.4 Webhook

In the **Sandbox** app (and later the Live app) → **Webhooks → Add webhook**:

- URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/paypal-webhook`
- Events: **Checkout order approved** (`CHECKOUT.ORDER.APPROVED`), **Payment capture completed** (`PAYMENT.CAPTURE.COMPLETED`), **Payment capture denied** (`PAYMENT.CAPTURE.DENIED`), **Payment capture refunded** (`PAYMENT.CAPTURE.REFUNDED`), **Payment capture reversed** (`PAYMENT.CAPTURE.REVERSED`).
- Save, then copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`.

### 8.5 Invoices, GST and records

- Every successful payment emails the buyer a receipt with a receipt/invoice number, plan, USD amount, PayPal capture ID, date and your business name and address — this is the customer's invoice. Copies of each payment are in Supabase → Table editor → `payments`.
- Sales to overseas customers are generally **export of services**. Keep PayPal statements and the FIRC/FIRA (Foreign Inward Remittance Advice) PayPal issues for each payout (download from PayPal → Statements).
- **Check with a Chartered Accountant** about GST registration and filing a **Letter of Undertaking (LUT)** so exports can be zero-rated, and about sales to customers in India (which attract GST).

---

## 9. Resend (email)

1. <https://resend.com/signup> → **Domains → Add domain** → `kriosity.in`.
2. Add the DNS records Resend shows (SPF `TXT`, DKIM `TXT`/`CNAME`, optional `MX` for bounces) at your registrar. Wait for **Verified**.
3. **API Keys → Create** (permission: _Sending access_, domain `kriosity.in`). Put it in `RESEND_API_KEY`, and use it for Supabase SMTP (section 3.4).
4. Make sure `support@kriosity.in` is a real mailbox you read — contact-form messages and replies go there.

---

## 10. Pinterest developer app

1. Convert your Pinterest account to a **Business account** (free): Pinterest → Settings → Account management → Convert to business.
2. <https://developers.pinterest.com> → **My apps → Connect app**. Fill in:
   - **App name**: PinDeleter
   - **Company**: Kriosity
   - **Website**: `https://pindeleter.kriosity.in`
   - **Redirect URI**: `https://pindeleter.kriosity.in/app/connect/pinterest/callback`
   - **Privacy policy URL**: `https://pindeleter.kriosity.in/privacy`
   - **Suggested app description**:
     > PinDeleter helps Pinterest users clean up their own accounts. After the user signs in with Pinterest OAuth, PinDeleter lists their boards and pins (boards:read, pins:read, user_accounts:read) so they can filter by board, date, keyword and engagement. The user downloads a backup, reviews the list, types DELETE to confirm, and PinDeleter deletes only the selected pins (pins:write) at a rate-limit-safe pace with live progress. PinDeleter never creates or edits pins, never reads or stores passwords, never sells data or uses it for ads or AI training, and deletes tokens when the user disconnects.
3. Request **Trial access**. While in Trial, only your own (developer) account can connect; others will see an error ("consumer type not supported").
4. When approved, copy the **App ID** and **App secret key**:

```bash
supabase secrets set PINTEREST_CLIENT_ID=... PINTEREST_CLIENT_SECRET=... PINTEREST_MOCK=false
```

5. Test on your own account: sign in to PinDeleter → Connect Pinterest → sync → dry run on a few pins → delete 2–3 pins you don't need.
6. **Request Standard access** with a demo video. Record (screen capture, 2–4 minutes, with voice-over or captions):
   - [ ] The home page and the non-affiliation footer.
   - [ ] Sign-up/login to PinDeleter.
   - [ ] Clicking **Connect Pinterest**, the Pinterest consent screen showing the requested scopes, and returning to the app.
   - [ ] Sync progress with boards and pins counting up.
   - [ ] Filtering by board, date and "No engagement", and selecting pins.
   - [ ] The review page: per-board summary, **backup download (JSON + CSV)**, the "I have downloaded my backup" checkbox, dry run toggle, and typing DELETE.
   - [ ] The job page with live progress, pause/resume, and the log.
   - [ ] The pins gone on Pinterest.
   - [ ] **Disconnect** on the Accounts page, and Settings → Delete my account.
   - [ ] The Privacy Policy page section on Pinterest data.

---

## 11. Go-live checklist

- [ ] `supabase db push` done; Vault secrets set; `cron.job` shows 3 schedules.
- [ ] All secrets set (`supabase secrets list`), `APP_ENV=production`.
- [ ] `supabase functions deploy` done; `/functions/v1/config` responds.
- [ ] Vercel env vars set; `https://pindeleter.kriosity.in` loads with a padlock.
- [ ] Auth Site URL + redirect URLs set; magic link and Google sign-in work.
- [ ] Custom SMTP (Resend) configured; sign-in emails arrive quickly.
- [ ] A full test in **demo mode**: sign up → connect → sync → filter → select 60 pins → upgrade with a sandbox buyer → delete → retry failed → download report → disconnect → delete account.
- [ ] Contact form delivers to `support@kriosity.in` and the sender gets an acknowledgement.
- [ ] Pinterest approved → `PINTEREST_MOCK=false` with real client ID/secret.

### Switching PayPal from sandbox to live

1. Create the **Live** webhook (same URL and events) in the Live app and copy its ID.
2. Set the live values and redeploy nothing else (functions read secrets at runtime):

```bash
supabase secrets set PAYPAL_ENV=live PAYPAL_CLIENT_ID=LIVE_CLIENT_ID PAYPAL_CLIENT_SECRET=LIVE_SECRET PAYPAL_WEBHOOK_ID=LIVE_WEBHOOK_ID
```

3. The website reads the client ID from the `config` function, so no Vercel change is needed. Make one real $4.99 purchase with your own card and refund it from PayPal to confirm the refund webhook revokes the plan.

---

## 12. Troubleshooting

| Problem                                                        | Fix                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jobs stay "Queued" / syncs stop after ~40 s**                | The cron isn't calling the workers. Check `select * from cron.job_run_details order by start_time desc limit 10;` and `select * from net._http_response order by created desc limit 10;`. Most often the Vault secrets are missing or the service_role key is wrong — re-run the vault seed SQL. Also confirm `pg_cron` and `pg_net` are enabled. |
| **CORS error in the browser console**                          | `SITE_URL` must exactly match the site origin (`https://pindeleter.kriosity.in`, no trailing slash). For local dev set `APP_ENV=development` in your local functions env.                                                                                                                                                                         |
| **Pinterest: "redirect_uri mismatch"**                         | The Redirect URI in the Pinterest app must be exactly `https://pindeleter.kriosity.in/app/connect/pinterest/callback`, and `SITE_URL` must be `https://pindeleter.kriosity.in`.                                                                                                                                                                   |
| **Pinterest: 401 "consumer type is not supported"**            | Your Pinterest app is still in **Trial** — only the developer account can connect. Use demo mode (`PINTEREST_MOCK=true`) for other accounts until Standard access is approved.                                                                                                                                                                    |
| **"This connection link has expired"**                         | OAuth states last 10 minutes and work once. Start the connection again.                                                                                                                                                                                                                                                                           |
| **PayPal webhook returns 400 "Signature verification failed"** | `PAYPAL_WEBHOOK_ID` doesn't match the environment. Sandbox webhooks need the sandbox webhook ID and `PAYPAL_ENV=sandbox`; live needs live values. The "Webhook simulator" in PayPal's dashboard cannot be verified — use real sandbox payments.                                                                                                   |
| **PayPal buttons don't appear**                                | (1) `PAYPAL_CLIENT_ID` not set → the checkout says "Payments are temporarily unavailable". (2) A browser extension is blocking paypal.com. (3) If you changed `vercel.json`, the CSP must still allow `https://*.paypal.com` and `https://*.paypalobjects.com` in `script-src`, `frame-src` and `connect-src`.                                    |
| **Magic link emails are slow or missing**                      | Configure Resend SMTP in Supabase (section 3.4); the built-in sender is limited to a few emails per hour.                                                                                                                                                                                                                                         |
| **Users must reconnect Pinterest after a deploy**              | `TOKEN_ENCRYPTION_KEY` changed. Restore the original value.                                                                                                                                                                                                                                                                                       |
| **Many "rate-limited" pauses**                                 | Lower `DELETE_RPS` (e.g. `3`). Jobs resume automatically either way.                                                                                                                                                                                                                                                                              |

### Local development (optional)

```bash
cp .env.example .env.local
```

```bash
supabase start
```

```bash
supabase db reset
```

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Set `TOKEN_ENCRYPTION_KEY` in `supabase/functions/.env`, then:

```bash
supabase functions serve --env-file supabase/functions/.env
```

```bash
npm run dev
```

Put the local URL and anon key printed by `supabase start` into `.env.local`. For cron locally, run the vault seed with `http://host.docker.internal:54321` (or `http://kong:8000`) as `project_url` and the local service role key.
