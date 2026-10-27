-- Run in info1-quiz-stats / SQL Editor as postgres. Transactional and repeatable.
-- Only mock_exam_* objects are touched. Existing read/legacy record RPCs stay intact.
begin;
do $$
declare k text;
begin
 if to_regclass('public.mock_exam_stats') is null then raise exception 'Existing mock_exam_stats is missing'; end if;
 foreach k in array array['exam_id','exam_version','section_id','scoring_id','answer_counts','answered_count','correct_count','points_sum','updated_at'] loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='mock_exam_stats' and column_name=k) then raise exception 'Missing mock_exam_stats column: %',k; end if;
 end loop;
 if to_regprocedure('public.get_mock_exam_stats(text,text)') is null then raise exception 'Existing get_mock_exam_stats(text,text) is missing'; end if;
 if not exists(select 1 from pg_index i where i.indrelid='public.mock_exam_stats'::regclass and i.indisunique and i.indpred is null and
  (select array_agg(a.attname::text order by a.attname) from unnest(i.indkey) x(n) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=x.n) = array['exam_id','exam_version','scoring_id']) then
  raise exception 'Expected unique key (exam_id,exam_version,scoring_id)';
 end if;
 if not has_function_privilege('anon','public.get_mock_exam_stats(text,text)','EXECUTE') then raise exception 'Existing read RPC is not public'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_mock_exam_results' and
  (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then
  raise exception 'Legacy record_mock_exam_results must remain service_role-only';
 end if;
end $$;
-- Remove direct browser writes to this mock-only aggregate (read RPC unchanged).
-- Preserve its existing read/RLS behavior; only write privileges are restricted.
revoke insert,update,delete,truncate,references,trigger on public.mock_exam_stats from public,anon,authenticated;
create table if not exists public.mock_exam_attempt_snapshots (
 attempt_id uuid primary key, token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 exam_id text not null, exam_version text not null,
 revision bigint not null check(revision between 1 and 10000),
 section_ids jsonb not null, results jsonb not null,
 updated_at timestamptz not null default now()
);
-- A pre-release older table requires explicit review rather than guessing scopes.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='mock_exam_attempt_snapshots' and column_name='section_ids') then
  raise exception 'Pre-release snapshot schema found: review before migration';
 end if;
end $$;
alter table public.mock_exam_attempt_snapshots enable row level security;
revoke all on public.mock_exam_attempt_snapshots from public,anon,authenticated;
create table if not exists public.mock_exam_rate_limits (
 identity_hash text not null, bucket timestamptz not null, requests integer not null,
 primary key(identity_hash,bucket)
);
alter table public.mock_exam_rate_limits enable row level security;
revoke all on public.mock_exam_rate_limits from public,anon,authenticated;

create or replace function public.consume_mock_exam_budget(p_identity_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; h timestamptz := date_trunc('hour',now());
begin
 if p_identity_hash is null or p_identity_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid identity'; end if;
 -- All callers lock the global row first. The count stops at the cap.
 insert into public.mock_exam_rate_limits values('global',h,1)
 on conflict(identity_hash,bucket) do update set requests=public.mock_exam_rate_limits.requests+1
 where public.mock_exam_rate_limits.requests<6000 returning requests into n;
 if n is null then return false; end if;
 n:=null;
 insert into public.mock_exam_rate_limits values(p_identity_hash,h,1)
 on conflict(identity_hash,bucket) do update set requests=public.mock_exam_rate_limits.requests+1
 where public.mock_exam_rate_limits.requests<120 returning requests into n;
 return n is not null;
end $$;
revoke all on function public.consume_mock_exam_budget(text) from public,anon,authenticated;
grant execute on function public.consume_mock_exam_budget(text) to service_role;

create or replace function public.replace_mock_exam_results(
 p_attempt_id uuid,p_token_hash text,p_exam_id text,p_exam_version text,
 p_revision bigint,p_section_ids jsonb,p_results jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.mock_exam_attempt_snapshots%rowtype; r record; counts jsonb;
 old_results jsonb := '[]'::jsonb; count_next bigint; scope jsonb;
begin
 if p_attempt_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or
  p_exam_id is null or length(p_exam_id) not between 1 and 80 or p_exam_version is null or length(p_exam_version) not between 1 and 80 or
  p_revision is null or p_revision not between 1 and 10000 or p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>200 or
  p_section_ids is null or jsonb_typeof(p_section_ids)<>'array' or jsonb_array_length(p_section_ids) not between 1 and 5 then raise exception 'invalid submission'; end if;
 if exists(select 1 from jsonb_array_elements(p_section_ids) x where jsonb_typeof(x)<>'string' or x#>>'{}' not in ('q1','q2a','q2b','q3','q4')) or
  (select count(*)<>count(distinct x) from jsonb_array_elements(p_section_ids) x) then raise exception 'invalid scope'; end if;
 select jsonb_agg(x order by x) into scope from jsonb_array_elements(p_section_ids) x;
 perform pg_advisory_xact_lock(hashtextextended(p_attempt_id::text,0));
 select * into old from public.mock_exam_attempt_snapshots where attempt_id=p_attempt_id for update;
 if found then
  if old.token_hash<>p_token_hash or old.exam_id<>p_exam_id or old.exam_version<>p_exam_version or old.section_ids<>scope then return jsonb_build_object('status','conflict'); end if;
  if p_revision<old.revision then return jsonb_build_object('status','stale','revision',old.revision); end if;
  if p_revision=old.revision then
   if p_results<>old.results then return jsonb_build_object('status','conflict'); end if;
   return jsonb_build_object('status','duplicate','revision',old.revision);
  end if;
  old_results:=old.results;
 end if;
 if exists(select 1 from jsonb_array_elements(p_results) x where jsonb_typeof(x)<>'object' or
  jsonb_typeof(x->'points') is distinct from 'number' or jsonb_typeof(x->'max_points') is distinct from 'number') then raise exception 'invalid numeric score'; end if;
 if exists(select 1 from jsonb_to_recordset(p_results) x(scoring_id text,section_id text,answer_key text,points numeric,max_points numeric)
 where scoring_id is null or length(scoring_id) not between 1 and 100 or section_id is null or not (scope ? section_id) or
  answer_key is null or length(answer_key) not between 1 and 200 or replace(answer_key,'|','') ~ '^_+$' or
  points is null or max_points is null or points<0 or points>max_points or max_points<=0 or max_points>1000) then raise exception 'invalid score'; end if;
 if (select count(*)<>count(distinct x->>'scoring_id') from jsonb_array_elements(p_results) x) then raise exception 'duplicate scoring id'; end if;
 -- Stable ordering prevents row-lock inversions between different attempts.
 for r in
  with changes as (
   select x->>'scoring_id' scoring_id,x->>'section_id' section_id,x->>'answer_key' answer_key,
    (x->>'points')::numeric points,(x->>'max_points')::numeric max_points,1 sign from jsonb_array_elements(p_results) x
   union all select x->>'scoring_id',x->>'section_id',x->>'answer_key',(x->>'points')::numeric,(x->>'max_points')::numeric,-1 from jsonb_array_elements(old_results) x
  ) select scoring_id,section_id,answer_key,sum(sign)::bigint delta,
   sum(sign*points) points_delta,sum(case when points=max_points then sign else 0 end)::bigint correct_delta
   from changes group by scoring_id,section_id,answer_key order by scoring_id,answer_key
 loop
  insert into public.mock_exam_stats(exam_id,exam_version,section_id,scoring_id,answer_counts,answered_count,correct_count,points_sum)
  values(p_exam_id,p_exam_version,r.section_id,r.scoring_id,'{}',0,0,0) on conflict(exam_id,exam_version,scoring_id) do nothing;
  select answer_counts into counts from public.mock_exam_stats where exam_id=p_exam_id and exam_version=p_exam_version and scoring_id=r.scoring_id and section_id=r.section_id for update;
  if not found then raise exception 'section mismatch'; end if;
  count_next:=coalesce((counts->>r.answer_key)::bigint,0)+r.delta;
  if count_next<0 then raise exception 'aggregate drift'; end if;
  counts:=jsonb_set(coalesce(counts,'{}'),array[r.answer_key],to_jsonb(count_next));
  if count_next=0 then counts:=counts-r.answer_key; end if;
  update public.mock_exam_stats set answer_counts=counts,answered_count=answered_count+r.delta,
   correct_count=correct_count+r.correct_delta,points_sum=points_sum+r.points_delta,updated_at=now()
   where exam_id=p_exam_id and exam_version=p_exam_version and scoring_id=r.scoring_id;
  if exists(select 1 from public.mock_exam_stats where exam_id=p_exam_id and exam_version=p_exam_version and scoring_id=r.scoring_id and
   (answered_count<0 or correct_count<0 or correct_count>answered_count or points_sum<0)) then raise exception 'aggregate drift'; end if;
 end loop;
 insert into public.mock_exam_attempt_snapshots(attempt_id,token_hash,exam_id,exam_version,revision,section_ids,results)
 values(p_attempt_id,p_token_hash,p_exam_id,p_exam_version,p_revision,scope,p_results)
 on conflict(attempt_id) do update set revision=excluded.revision,results=excluded.results,updated_at=now();
 return jsonb_build_object('status','recorded','revision',p_revision);
end $$;
revoke all on function public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb,jsonb) to service_role;

create or replace function public.mock_exam_stats_health()
returns integer language sql security definer set search_path='' as $$ select 2 $$;
revoke all on function public.mock_exam_stats_health() from public,anon,authenticated;
grant execute on function public.mock_exam_stats_health() to service_role;
-- Only transient rate counters are removable; snapshots are kept for deduplication.
create or replace function public.prune_mock_exam_rate_limits()
returns void language sql security definer set search_path='' as $$
 delete from public.mock_exam_rate_limits where bucket<date_trunc('hour',now())-interval '2 hours'
$$;
revoke all on function public.prune_mock_exam_rate_limits() from public,anon,authenticated;
grant execute on function public.prune_mock_exam_rate_limits() to service_role;
notify pgrst, 'reload schema';
commit;
