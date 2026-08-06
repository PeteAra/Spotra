# Spotra

Calendar-based reservation SaaS MVP. Create a workspace, open spots, share a link, let people claim a spot.

**Domain:** [spotra.dev](https://spotra.dev)

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase (Auth / Postgres / RLS)
- Google OAuth only
- TanStack Query, React Hook Form, Zod, shadcn-style UI
- Vercel hosting

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Google** under Authentication → Providers.
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://spotra.dev/auth/callback`
4. Run the SQL migration in the Supabase SQL editor:

   [`supabase/migrations/20260723000000_init.sql`](supabase/migrations/20260723000000_init.sql)

   Or with the Supabase CLI:

   ```bash
   npx supabase db push
   ```

### 3. Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` locally, `https://spotra.dev` in production
- `RESEND_API_KEY` — from [resend.com](https://resend.com) (optional locally; emails are skipped if unset)
- `RESEND_FROM_EMAIL` — verified sender, e.g. `Spotra <hello@spotra.dev>`

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flows

1. **Admin** — Landing → Google sign-in → create workspace → add spots (capacity default 1) → share link.
2. **Participant** — Open share link → Google sign-in (darkened gate until auth) → claim / cancel via spot confirmations.
3. **Duplicate** — Same weekday in month, all weekdays, or previous month when navigating forward.
4. **Users** — Admins manage members and view claim history at `/workspace/[slug]/users`.

## Deploy (Vercel)

1. Push the repo and import into Vercel.
2. Set the same env vars; set `NEXT_PUBLIC_SITE_URL=https://spotra.dev`.
3. Attach the `spotra.dev` domain in Vercel project settings.
4. Add production redirect URL in Supabase Auth: `https://spotra.dev/auth/callback`.
5. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, and verify your sending domain in Resend.

## Notes

- Reservation history is never deleted.
- Claims are capacity-safe via `claim_slot` RPC.
- New users get a welcome email; every successful claim sends a confirmation (via Resend).
