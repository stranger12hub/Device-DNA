-- Device DNA fresh reset for hackathon/test data.
-- Run once in the Supabase SQL editor when you want a clean app.
-- This clears application records only; Clerk users/auth accounts are not stored here.

truncate table
  public.approval_requests,
  public.documents,
  public.device_scores,
  public.warranty_records,
  public.parts,
  public.repair_events,
  public.repair_access_requests,
  public.device_access,
  public.devices,
  public.profiles
restart identity cascade;

select pg_notify('pgrst', 'reload schema');
