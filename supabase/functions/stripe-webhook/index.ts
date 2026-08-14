/**
 * stripe-webhook
 *
 * Receives Stripe events and updates Supabase accordingly.
 *
 * Events handled:
 *   checkout.session.completed       → grant credits / activate subscription
 *   customer.subscription.updated    → update status/period
 *   customer.subscription.deleted    → mark cancelled
 *   invoice.payment_failed           → mark past_due
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Credits granted per bundle plan per billing period
const PLAN_CREDITS: Record<string, number | null> = {
  buyer_per_rfq:         1,     // 1 RFQ post credit
  buyer_business:        null,  // unlimited — no credit tracking needed
  reseller_per_bid:      1,     // 1 bid credit
  reseller_starter:      10,
  reseller_growth:       25,
  reseller_unlimited:    null,  // unlimited
};

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );
  } catch (err) {
    console.error('Webhook signature failed:', err);
    return new Response('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { user_id, plan, rfq_id } = session.metadata ?? {};
        if (!user_id || !plan) break;

        const stripeCustomerId = session.customer as string;
        const isSubscription = session.mode === 'subscription';
        const stripeSubId = isSubscription ? session.subscription as string : null;

        // Upsert subscription record
        await supabase.from('subscriptions').upsert({
          user_id,
          role: plan.startsWith('buyer') ? 'buyer' : 'reseller',
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubId,
          plan,
          status: 'active',
          current_period_end: isSubscription
            ? await getSubPeriodEnd(stripeSubId!)
            : null,
        }, { onConflict: 'user_id' });  // one active sub per user for now

        // Grant credits
        const credits = PLAN_CREDITS[plan];
        if (credits !== null && credits !== undefined) {
          const now = new Date();
          const periodEnd = isSubscription
            ? await getSubPeriodEnd(stripeSubId!)
            : null;

          await supabase.from('bid_credits').upsert({
            user_id,
            credits_remaining: credits,
            credits_total: credits,
            plan,
            period_start: now.toISOString(),
            period_end: periodEnd,
            stripe_payment_id: isSubscription ? null : session.payment_intent as string,
          }, { onConflict: 'user_id' });

          await supabase.from('credit_ledger').insert({
            user_id,
            event: 'granted',
            credits,
            rfq_id: rfq_id ?? null,
            note: `${plan} — checkout.session.completed`,
          });
        }

        // If buyer per-RFQ, auto-publish the RFQ now that payment is confirmed
        if (plan === 'buyer_per_rfq' && rfq_id) {
          await supabase
            .from('rfqs')
            .update({ status: 'active' })
            .eq('id', rfq_id)
            .eq('status', 'pending_payment');
        }

        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase
          .from('subscriptions')
          .update({
            status: sub.status === 'active' ? 'active'
                  : sub.status === 'past_due' ? 'past_due'
                  : sub.status === 'trialing' ? 'trialing'
                  : sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        // On renewal (new period), top up credits
        if (sub.status === 'active') {
          const plan = sub.metadata?.plan;
          const credits = plan ? PLAN_CREDITS[plan] : null;
          if (credits !== null && credits !== undefined && plan) {
            await supabase.from('bid_credits').update({
              credits_remaining: credits,
              credits_total: credits,
              period_start: new Date(sub.current_period_start * 1000).toISOString(),
              period_end: new Date(sub.current_period_end * 1000).toISOString(),
            }).eq('user_id', userId);

            await supabase.from('credit_ledger').insert({
              user_id: userId,
              event: 'granted',
              credits,
              note: `${plan} — renewal`,
            });
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }
});

async function getSubPeriodEnd(subId: string): Promise<string | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    return new Date(sub.current_period_end * 1000).toISOString();
  } catch {
    return null;
  }
}
