-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
-- Tracks active Stripe subscriptions for both buyers and resellers.
create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  role                    text not null check (role in ('buyer', 'reseller')),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  plan                    text not null check (plan in (
                            'buyer_per_rfq',   -- one-time $49 per RFQ post
                            'buyer_business',  -- $199/mo unlimited RFQs
                            'buyer_enterprise',
                            'reseller_per_bid',  -- one-time $9.99 per bid
                            'reseller_starter',  -- $49/mo 10 bids
                            'reseller_growth',   -- $99/mo 25 bids
                            'reseller_unlimited' -- $149/mo unlimited
                          )),
  status                  text not null default 'incomplete'
                            check (status in ('active','past_due','cancelled','incomplete','trialing')),
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role (Edge Functions) can insert/update
create policy "Service role full access to subscriptions"
  on public.subscriptions for all
  using (true)
  with check (true);

-- ─── BID CREDITS ─────────────────────────────────────────────────────────────
-- Tracks per-bid credit balance for resellers on bundle plans.
-- Also used to record individual pay-per-bid purchases.
create table if not exists public.bid_credits (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  credits_remaining   int not null default 0 check (credits_remaining >= 0),
  credits_total       int not null default 0,
  plan                text,                    -- which plan granted these credits
  period_start        timestamptz,             -- when this credit period began
  period_end          timestamptz,             -- credits expire at period end (no rollover)
  stripe_payment_id   text,                    -- for pay-per-bid one-time charges
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.bid_credits enable row level security;

create policy "Users can read own bid credits"
  on public.bid_credits for select
  using (auth.uid() = user_id);

create policy "Service role full access to bid_credits"
  on public.bid_credits for all
  using (true)
  with check (true);

-- ─── CREDIT LEDGER ───────────────────────────────────────────────────────────
-- Immutable audit log of every credit event (granted, used, expired).
create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       text not null check (event in ('granted','used','expired','refunded')),
  credits     int not null,  -- positive = granted/refunded, negative = used/expired
  rfq_id      uuid,          -- set when event = 'used' (buyer RFQ post)
  bid_id      uuid,          -- set when event = 'used' (reseller bid submit)
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "Users can read own ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

create policy "Service role full access to credit_ledger"
  on public.credit_ledger for all
  using (true)
  with check (true);

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger bid_credits_updated_at
  before update on public.bid_credits
  for each row execute function public.set_updated_at();
