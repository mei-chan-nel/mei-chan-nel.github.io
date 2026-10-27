-- Apply through the Supabase migration workflow, after checking existing schema.
-- This migration never changes quiz_question_stats or its RPCs.
begin;
create table if not exists public.mock_exam_attempt_snapshots (
 attempt_id uuid primary key, token_hash text not null, exam_id text not null,
 exam_version text not null, revision bigint not null check(revision>0),
 results jsonb not null, updated_at timestamptz not null default now()
);
alter table public.mock_exam_attempt_snapshots enable row level security;
revoke all on public.mock_exam_attempt_snapshots from anon, authenticated;
create table if not exists public.mock_exam_rate_limits (
 identity_hash text not null, bucket timestamptz not null, requests integer not null,
 primary key(identity_hash,bucket)
);
alter table public.mock_exam_rate_limits enable row level security;
revoke all on public.mock_exam_rate_limits from anon, authenticated;
create or replace function public.consume_mock_exam_budget(p_identity_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
 insert into public.mock_exam_rate_limits values(p_identity_hash,date_trunc('hour',now()),1)
 on conflict(identity_hash,bucket) do update set requests=mock_exam_rate_limits.requests+1 returning requests into n;
 return n<=120;
end $$;
revoke all on function public.consume_mock_exam_budget(text) from public,anon,authenticated;
grant execute on function public.consume_mock_exam_budget(text) to service_role;

-- Only the trusted Edge Function passes computed scores. Replaces a previous
-- snapshot atomically: old counts are removed, latest counts added. No increment
-- endpoint is exposed to browsers. Client revisions are monotonic per attempt.
create or replace function public.replace_mock_exam_results(
 p_attempt_id uuid,p_token_hash text,p_exam_id text,p_exam_version text,
 p_revision bigint,p_results jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.mock_exam_attempt_snapshots%rowtype; r record; counts jsonb; old_results jsonb := '[]'::jsonb;
begin
 if p_revision<1 or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>200 then raise exception 'invalid submission';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_attempt_id::text,0));
 select * into old from public.mock_exam_attempt_snapshots where attempt_id=p_attempt_id for update;
 if found then
  if old.token_hash<>p_token_hash or old.exam_id<>p_exam_id or old.exam_version<>p_exam_version then raise exception 'attempt mismatch';end if;
  if p_revision<old.revision then return jsonb_build_object('status','stale','revision',old.revision);end if;
  if p_revision=old.revision then
   if p_results<>old.results then raise exception 'revision conflict';end if;
   return jsonb_build_object('status','duplicate','revision',old.revision);
  end if;
  old_results:=old.results;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_results) x(scoring_id text,section_id text,answer_key text,points numeric,max_points numeric)
 where scoring_id is null or section_id not in ('q1','q2a','q2b','q3','q4') or answer_key is null or points is null or max_points is null or points<0 or points>max_points or max_points<=0) then raise exception 'invalid score';end if;
 if (select count(*)<>count(distinct x->>'scoring_id') from jsonb_array_elements(p_results) x) then raise exception 'duplicate scoring id';end if;
 -- Stable order avoids lock inversions when different attempts update many units.
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
  select answer_counts into counts from public.mock_exam_stats where exam_id=p_exam_id and exam_version=p_exam_version and scoring_id=r.scoring_id for update;
  counts:=jsonb_set(coalesce(counts,'{}'),array[r.answer_key],to_jsonb(coalesce((counts->>r.answer_key)::bigint,0)+r.delta));
  if (counts->>r.answer_key)::bigint=0 then counts:=counts-r.answer_key;end if;
  update public.mock_exam_stats set answer_counts=counts,answered_count=answered_count+r.delta,
   correct_count=correct_count+r.correct_delta,points_sum=points_sum+r.points_delta,updated_at=now()
   where exam_id=p_exam_id and exam_version=p_exam_version and scoring_id=r.scoring_id;
 end loop;
 insert into public.mock_exam_attempt_snapshots values(p_attempt_id,p_token_hash,p_exam_id,p_exam_version,p_revision,p_results,now())
 on conflict(attempt_id) do update set revision=excluded.revision,results=excluded.results,updated_at=now();
 return jsonb_build_object('status','recorded','revision',p_revision);
end $$;
revoke all on function public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb) to service_role;
commit;
