/**
 * create-checkout
 *
 * Creates a Stripe Checkout session for either:
 *   - Buyer posting an RFQ (one-time or subscription)
 *   - Reseller submitting a bid (one-time or subscription)
 *
 * POST body: { plan, rfq_id?, success_url, cancel_url }
 *
 * Plans map to Stripe Price IDs stored in env vars:
 *   STRIPE_PRICE_BUYER_PER_RFQ
 *   STRIPE_PRICE_BUYER_BUSINESS
 *   STRIPE_PRICE_RESELLER_PER_BID
 *   STRIPE_PRICE_RESELLER_STARTER
 *   STRIPE_PRICE_RESELLER_GROWTH
 *   STRIPE_PRICE_RESELLER_UNLIMITED
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_MAP: Record<string, string> = {
  buyer_per_rfq:        Deno.env.get('STRIPE_PRICE_BUYER_PER_RFQ')!,
  buyer_business:       Deno.env.get('STRIPE_PRICE_BUYER_BUSINESS')!,
  reseller_per_bid:     Deno.env.get('STRIPE_PRICE_RESELLER_PER_BID')!,
  reseller_starter:     Deno.env.get('STRIPE_PRICE_RESELLER_STARTER')!,
  reseller_growth:      Deno.env.get('STRIPE_PRICE_RESELLER_GROWTH')!,
  reseller_unlimited:   Deno.env.get('STRIPE_PRICE_RESELLER_UNLIMITED')!,
};

// One-time payment plans (vs recurring subscriptions)
const ONE_TIME_PLANS = new Set(['buyer_per_rfq', 'reseller_per_bid']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    // Authenticate the user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { plan, rfq_id, success_url, cancel_url } = await req.json();

    if (!plan || !PRICE_MAP[plan]) return json({ error: 'Invalid plan' }, 400);
    if (!success_url || !cancel_url) return json({ error: 'Missing redirect URLs' }, 400);

    // Get or create Stripe customer for this user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let stripeCustomerId: string | undefined;
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;
    }

    const isOneTime = ONE_TIME_PLANS.has(plan);

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: isOneTime ? 'payment' : 'subscription',
      line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
      success_url,
      cancel_url,
      metadata: {
        user_id: user.id,
        plan,
        ...(rfq_id ? { rfq_id } : {}),
      },
      ...(isOneTime ? {} : {
        subscription_data: {
          metadata: { user_id: user.id, plan },
        },
      }),
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
