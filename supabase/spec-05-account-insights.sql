-- Spec 05: the funnel needs profile visits and website (bio link) taps.
-- Run once in the Supabase SQL editor (after ig-analytics.sql).
-- Both are daily counts from the account insights API, collected by the
-- nightly sync from the day this migration + code ship. Older days stay
-- null and the UI says "collecting since" honestly.

alter table ig_account_snapshots add column if not exists profile_views int;
alter table ig_account_snapshots add column if not exists website_clicks int;
