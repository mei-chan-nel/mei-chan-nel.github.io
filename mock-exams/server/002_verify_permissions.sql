-- Read-only post-deployment checks. First column should be 2; booleans all true.
select public.mock_exam_stats_health() as protocol;
select
 has_function_privilege('anon','public.get_mock_exam_stats(text,text)','execute') as public_read_works,
 not has_function_privilege('anon','public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb,jsonb)','execute') as anon_write_denied,
 not has_function_privilege('authenticated','public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb,jsonb)','execute') as signedin_write_denied,
 has_function_privilege('service_role','public.replace_mock_exam_results(uuid,text,text,text,bigint,jsonb,jsonb)','execute') as server_write_allowed,
 not has_table_privilege('anon','public.mock_exam_stats','INSERT,UPDATE,DELETE,TRUNCATE') as direct_write_denied,
 not has_table_privilege('anon','public.mock_exam_attempt_snapshots','SELECT,INSERT,UPDATE,DELETE') as snapshot_private;
select p.oid::regprocedure as function,
 not has_function_privilege('anon',p.oid,'execute') as legacy_rpc_public_write_denied
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='record_mock_exam_results';
