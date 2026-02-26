# vPay Accounting Dashboard

Accounting dashboard for vPay co-founders with:

- Whitelisted Privy auth
- Earnings + expenses management (create/edit + soft-delete + audit log)
- Financial analytics (totals, per-person balances, category split, monthly charts, recent activity)
- One-time Google Sheets import bootstrap

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- Prisma + Vercel Postgres
- Privy + email whitelist table
- Recharts

## Environment

Create `.env.local` from `.env.example` and fill:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_VERIFICATION_KEY=
DATABASE_URL=
DIRECT_URL=
```

## Local setup

```bash
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

App routes:

- `/dashboard` analytics
- `/manage` transaction management
- `/login` sign-in

## Data import behavior

`npm run db:seed` does all of:

- Seeds allowed emails:
  - `amir.razagh76@gmail.com`
  - `jarrett@biptap.com`
  - `ma.paypal93@gmail.com`
- Imports Google Sheets tabs:
  - `Earnings`
  - `Expenses`
- Normalizes names/categories/amount/date
- Upserts with deterministic `source_hash` so reruns are idempotent

## Notes

- Expenses with blank dates are imported as undated and excluded from monthly charts.
- Only whitelisted + active emails can access `/dashboard` and `/manage`.
