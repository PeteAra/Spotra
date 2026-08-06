-- Track whether we've sent the first-login welcome email.
alter table public.accounts
  add column if not exists welcome_email_sent_at timestamptz;

-- Existing accounts should not receive a retroactive welcome blast.
update public.accounts
set welcome_email_sent_at = created_at
where welcome_email_sent_at is null;
