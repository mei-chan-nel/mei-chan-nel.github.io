-- Disposable PostgreSQL fixture, NEVER apply this file to a real project.
create role anon;
create role authenticated;
create role service_role;
create table public.mock_exam_stats(exam_id text,exam_version text,section_id text,scoring_id text,answer_counts jsonb not null default '{}',answered_count bigint not null default 0,correct_count bigint not null default 0,points_sum numeric not null default 0,updated_at timestamptz default now(),primary key(exam_id,exam_version,scoring_id));
create function public.get_mock_exam_stats(p_exam_id text,p_exam_version text)
returns setof public.mock_exam_stats language sql security definer as $$
 select * from public.mock_exam_stats where exam_id=p_exam_id and exam_version=p_exam_version order by scoring_id
$$;
create function public.record_mock_exam_results(text,text,jsonb) returns void language sql as $$ select $$;
revoke all on function public.record_mock_exam_results(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_mock_exam_results(text,text,jsonb) to service_role;
-- Sentinel representing the existing learning app. Neither schema nor data may change.
create table public.quiz_question_stats(question_id text primary key,answered_count integer);
insert into public.quiz_question_stats values('legacy-sentinel',17);
