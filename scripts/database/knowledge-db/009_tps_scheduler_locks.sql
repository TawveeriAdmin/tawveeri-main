-- 009_tps_scheduler_locks.sql
-- E6 scheduler: category-scoped atomic overlap lock + run finish, reusing the
-- E4 scraping_runs table as the persistent run log/lock. A 'running' row with
-- store_name='tps:<category>' is the lock; pg_advisory_xact_lock serializes the
-- check+insert so concurrent same-category acquires cannot both succeed. Stale
-- running rows (older than p_stale_min) are treated as dead so a crash cannot
-- freeze a category permanently. service_role/postgres only; owner-applied.

create or replace function public.tps_acquire_run(p_category text, p_source text default 'schedule', p_stale_min int default 30)
returns bigint language plpgsql security invoker as $fn$
declare v_id bigint; v_key text := 'tps:'||p_category;
begin
  if p_category not in ('mobile','air_conditioner') then raise exception 'invalid category %', p_category; end if;
  perform pg_advisory_xact_lock(hashtext('tps_lock:'||p_category));  -- serialize per category
  if exists (select 1 from scraping_runs where store_name=v_key and status='running' and started_at > now() - make_interval(mins => p_stale_min)) then
    return null;  -- overlap: a same-category run is active
  end if;
  insert into scraping_runs (store_name, run_type, status, started_at, created_at, job_type, triggered_by, metadata)
  values (v_key, 'manual', 'running', now(), now(), 'discovery', p_source, jsonb_build_object('category',p_category,'source',p_source))
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function public.tps_finish_run(p_run_id bigint, p_status text, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security invoker as $fn$
begin
  if p_status not in ('success','failed','partial') then raise exception 'invalid status %', p_status; end if;
  update scraping_runs
    set status=p_status, finished_at=now(),
        duration_ms=(extract(epoch from (now()-started_at))*1000)::bigint,
        metadata=coalesce(metadata,'{}'::jsonb) || coalesce(p_metadata,'{}'::jsonb)
  where id=p_run_id;
end $fn$;

revoke all on function public.tps_acquire_run(text,text,int) from public, anon, authenticated;
revoke all on function public.tps_finish_run(bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.tps_acquire_run(text,text,int) to service_role;
grant execute on function public.tps_finish_run(bigint,text,jsonb) to service_role;
