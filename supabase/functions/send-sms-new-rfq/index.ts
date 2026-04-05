import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM  = Deno.env.get('TWILIO_PHONE_NUMBER')!
const SITE_URL     = Deno.env.get('SITE_URL') || 'http://localhost:3000'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const rfq = payload.record  // the new row from the rfqs table

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the vendors listed on this RFQ
    const { data: items } = await supabase
      .from('rfq_items')
      .select('vendor')
      .eq('rfq_id', rfq.id)

    if (!items || items.length === 0) return ok('No items on RFQ')

    const vendors = [...new Set(items.map((i: any) => i.vendor).filter(Boolean))]

    // Find verified resellers authorized for any of these vendors
    const { data: authorizations } = await supabase
      .from('reseller_vendors')
      .select('reseller_id, vendor')
      .in('vendor', vendors)
      .eq('verified', true)

    if (!authorizations || authorizations.length === 0) {
      return ok('No authorized resellers for these vendors')
    }

    const resellerIds = [...new Set(authorizations.map((a: any) => a.reseller_id))]

    // Get SMS prefs — only resellers who have opted in
    const { data: resellers } = await supabase
      .from('reseller_profiles')
      .select('id, company, sms_enabled, sms_phone, sms_notify_new_rfq')
      .in('id', resellerIds)
      .eq('sms_enabled', true)
      .eq('sms_notify_new_rfq', true)

    if (!resellers || resellers.length === 0) return ok('No opted-in resellers')

    const deadline = rfq.deadline
      ? new Date(rfq.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'TBD'

    const link = `${SITE_URL}/bidbridge-reseller-dashboard.html?rfq=${rfq.id}`

    const results = await Promise.allSettled(
      resellers.map((r: any) => {
        const matchedVendors = authorizations
          .filter((a: any) => a.reseller_id === r.id)
          .map((a: any) => a.vendor)
          .join(', ')

        const location = rfq.delivery_location || rfq.location || ''
        const locationPart = location ? ` · ${location}` : ''

        const msg = `New RFQ: "${rfq.title}" · ${matchedVendors} · Due ${deadline}.\n${link}`
        return sendSms(r.sms_phone, msg)
      })
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    console.log(`SMS results — sent: ${sent}, failed: ${failed}`)

    return ok(`Sent ${sent}, failed ${failed}`)

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
