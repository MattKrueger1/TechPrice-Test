-- SMS notification preferences for buyers (profiles table)
alter table profiles
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_phone text,
  add column if not exists sms_notify_new_bid boolean not null default true,
  add column if not exists sms_notify_deadline boolean not null default true;

-- SMS notification preferences for resellers (reseller_profiles table)
alter table reseller_profiles
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_phone text,
  add column if not exists sms_notify_new_rfq boolean not null default true,
  add column if not exists sms_notify_deadline boolean not null default true;
