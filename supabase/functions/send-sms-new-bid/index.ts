import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM  = Deno.env.get('TWILIO_PHONE_NUMBER')!
const SITE_URL     = Deno.env.get('SITE_URL') || 'http://localhost:3000'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const bid = payload.record  // the new row from the bids table

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get RFQ title + buyer
    const { data: rfq } = await supabase
      .from('rfqs')
      .select('id, title, buyer_id')
      .eq('id', bid.rfq_id)
      .single()

    if (!rfq) return ok('RFQ not found')

    // Get buyer SMS prefs
    const { data: buyer } = await supabase
      .from('profiles')
      .select('sms_enabled, sms_phone, sms_notify_new_bid')
      .eq('id', rfq.buyer_id)
      .single()

    if (!buyer?.sms_enabled || !buyer?.sms_notify_new_bid || !buyer?.sms_phone) {
      return ok('Buyer SMS not enabled')
    }

    // Get reseller name for the message
    const { data: reseller } = await supabase
      .from('reseller_profiles')
      .select('company, contact_first, contact_last')
      .eq('id', bid.reseller_id)
      .single()

    const resellerName = reseller?.company ||
      `${reseller?.contact_first || ''} ${reseller?.contact_last || ''}`.trim() ||
      'A reseller'

    const total = bid.total_price
      ? '$' + Number(bid.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'amount TBD'

    const link = `${SITE_URL}/bidbridge-compare-bids_1.html?rfq=${rfq.id}`
    const msg  = `New bid: ${total} from ${resellerName}.\n${link}`

    await sendSms(buyer.sms_phone, msg)
    return ok('SMS sent')

  } catch (err) {
    console.error(err)
    return new Response(String(err), { status: 500 })
  }
})

async function sendSms(to: string, body: string) {
  const url   = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const res   = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  })
  if (!res.ok) throw new Error(`Twilio: ${await res.text()}`)
}

const ok = (msg: string) => new Response(JSON.stringify({ msg }), { status: 200 })
