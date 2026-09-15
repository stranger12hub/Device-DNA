-- Demo reset for Device DNA.
-- Run in Supabase SQL Editor when you need a clean database for testing.
-- This clears app records only. Storage files must be removed through the Storage UI/API.

truncate table
  public.approval_requests,
  public.warranty_records,
  public.parts,
  public.repair_events,
  public.repair_access_requests,
  public.device_scores,
  public.documents,
  public.device_access,
  public.devices,
  public.profiles
restart identity cascade;
