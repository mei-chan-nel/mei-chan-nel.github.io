-- Read-only inspection. Run in info1-quiz-stats / SQL Editor first.
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='mock_exam_stats' order by ordinal_position;
select conname,pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid='public.mock_exam_stats'::regclass;
select p.oid::regprocedure as function,pg_get_functiondef(p.oid) as definition,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_role_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_mock_exam_stats','record_mock_exam_results');
select * from public.get_mock_exam_stats('001','1.0.0');
