# Turning on the hosted version (Supabase)

> **Status (Nov 23, 2026):** the project `early-birds` exists (Canada Central, ref `qmdgmlatmtlvntgxpzwo`). Steps 1, 2, 3 (function deployed), the security lock-down (`0002_lock_down_functions.sql`) and step 6 are done, and the app points at it. Still to do by hand: **step 3's Gemini secret, step 4 and step 5.**

Until these steps are done, the apps run in browser-only demo mode. Each device keeps its own copy of the data. After them, a family's phone and a clinic's laptop see the same data, and sign-in uses real accounts.

The code is already in place: `supabase/migrations/0001_platform.sql` (tables, security rules, demo clinics), `supabase/functions/propose-mapping` (AI column matching), and `web/src/platform/hosted.ts` (the app side).

## 1. Create the project (about 3 minutes)

1. Go to <https://supabase.com> and sign in (GitHub works).
2. **New project**:
   - Name: `early-birds`.
   - Region: **Canada (Central)**.
   - Database password: let it generate one and save it in your password manager. The app doesn't need it.
   - Plan: Free.
3. Wait until the project says it's ready.

## 2. Create the database (2 minutes)

1. Left menu → **SQL Editor** → **New query**.
2. Paste the whole of `supabase/migrations/0001_platform.sql` and press **Run**. It should say "Success. No rows returned".

## 3. Deploy the AI column-matching function (3 minutes)

1. Left menu → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `propose-mapping`.
3. Replace the editor's code with `supabase/functions/propose-mapping/index.ts` and press **Deploy**.
4. **Edge Functions → Secrets** → add:
   - `GEMINI_API_KEY` = your key from Google AI Studio.

   The key stays on the server. Nobody adds it to the website.

## 4. Make sign-in emails send a code (2 minutes)

The family app asks for a 6-digit code, not a link.

1. Left menu → **Authentication** → **Email Templates**.
2. Open **Magic Link** and set:
   - Subject: `Your Early Birds sign-in code`
   - Body:
     ```html
     <h2>Your Early Birds sign-in code</h2>
     <p>Enter this code in the app: <strong style="font-size:24px">{{ .Token }}</strong></p>
     <p>It works for one hour. If you didn't ask for it, you can ignore this email.</p>
     ```
3. Do the same for **Confirm signup**, which is used the first time an email signs in.
4. **Authentication → Providers → Email**:
   - Email: **enabled**.
   - Confirm email: **on**.
   - Email OTP length: **6**.

The free built-in email sends only a few messages an hour. That's fine for trying it yourself. On Demo Day, visitors use **Open the demo family**, which needs no email. If you want real codes for many people, add a free SMTP sender such as Resend under **Authentication → SMTP Settings**.

## 5. Create the demo accounts (3 minutes)

Left menu → **Authentication** → **Users** → **Add user** → **Create new user**. For each line below, enter the email and the password `early-birds-demo`, and tick **Auto Confirm User**:

| Email | Who |
| --- | --- |
| `admin@maplegrove.example` | Maple Grove admin |
| `intake@maplegrove.example` | Maple Grove intake staff |
| `manager@maplegrove.example` | Maple Grove manager |
| `admin@lakeshore.example` | Lakeshore admin |
| `admin@riviere-est.example` | Rivière-Est admin |
| `demo.family@example.com` | The demo family (the family app's "Open the demo family" button) |

Staff accounts are linked to their clinic automatically, because the migration lists them as invited. The demo data uses fictional `.example` addresses, so these accounts never receive email. That is why they use a password.

## 6. Give the app the project's public address (1 minute)

1. **Project Settings → API** (or **Data API**).
2. Copy the **Project URL**, and the **anon / publishable** key.

The anon key is designed to be public: the security rules from step 2 decide what each person can see. **Never** copy the `service_role` / secret key anywhere.

Then either send those two values to Claude, who puts them in `web/src/platform/hosted.ts` (`PROJECT`), or create `web/.env.local` yourself:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`.env.local` works only on your own computer. For the public site (GitHub Pages and the QR codes), the values must be in `hosted.ts`.

## 7. First run

1. Open the **clinic portal** and sign in as `admin@maplegrove.example`. The first sign-in imports Maple Grove's Nov 13 export and publishes the estimates. Wait a few seconds.
2. Open the **family app** on your phone and tap **Open the demo family**. You should see the two Maple Grove children.
3. On the laptop: **Data → Run tonight's sync now**. Within a few seconds the phone shows one child as booked. This is a live update; you don't need to reload.

To test with your own email, a staff admin needs a referral with that email in an import. Then sign in to the family app with that email and the emailed code.

## Turning it off again

Add `?local` to the page address (for example `…/team12-waitlist/?local`) to use the browser-only demo, even when the project is set.
