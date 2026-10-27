"""Against a disposable local Postgres container only. Never run on production.
Start postgres:17-alpine with --network none; pass its container name as argv[1].
"""
import subprocess,json,sys,uuid,os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
container=sys.argv[1]
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
cmd=['docker','--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-U','postgres','-At','-v','ON_ERROR_STOP=1']
def sql(text,ok=True):
 r=subprocess.run(cmd,input=text,text=True,capture_output=True,env=env)
 if ok and r.returncode:raise AssertionError(r.stderr)
 if not ok:assert r.returncode!=0,r.stdout
 return r.stdout.strip()
sql('''create role anon;create role authenticated;create role service_role;
create table mock_exam_stats(exam_id text,exam_version text,section_id text,scoring_id text,answer_counts jsonb not null default '{}',answered_count bigint not null default 0,correct_count bigint not null default 0,points_sum numeric not null default 0,updated_at timestamptz default now(),primary key(exam_id,exam_version,scoring_id));''')
sql((Path(__file__).resolve().parents[1]/'server/001_mock_exam_safe_stats.sql').read_text())
def result(key='1|_',points=0,unit='q2a-02',section='q2a',maximum=3):return [{'scoring_id':unit,'section_id':section,'answer_key':key,'points':points,'max_points':maximum}]
def send(attempt,revision,rows,token='owned',ok=True):
 # Test-generated UUID/JSON only, no untrusted input interpolated here.
 query=f"select replace_mock_exam_results('{attempt}','{token}','001','1.0.0',{revision},'{json.dumps(rows)}'::jsonb);"
 return sql(query,ok)
def counters(unit):return sql(f"select answered_count||','||correct_count||','||points_sum from mock_exam_stats where scoring_id='{unit}';")
a=str(uuid.uuid4());r=result();send(a,1,r);send(a,1,r);assert counters('q2a-02')=='1,0,0'
send(a,2,result('1|5',3));assert counters('q2a-02')=='1,1,3';assert sql("select answer_counts from mock_exam_stats where scoring_id='q2a-02'")== '{"1|5": 1}'
send(a,1,r);assert counters('q2a-02')=='1,1,3'
send(a,2,r,ok=False);send(a,3,r,token='intruder',ok=False);assert counters('q2a-02')=='1,1,3'
b=str(uuid.uuid4());send(b,1,result('5|1',3));assert counters('q2a-02')=='2,2,6'
send(a,3,[]);assert counters('q2a-02')=='1,1,3'
print('PASS: retry, regrade replacement, stale revision, conflict, token mismatch, empty snapshot')
ids=[str(uuid.uuid4())for _ in range(16)];good=result('0',2,'q1-01','q1',2)
with ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda id:send(id,1,good),ids*2))
assert counters('q1-01')=='16,16,32';print('PASS: 32 concurrent submissions of 16 attempts counted once each')
c=str(uuid.uuid4())
with ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda rev:send(c,rev,result(str(rev%2),2 if rev%2==0 else 0,'q1-02','q1',2)),[10,3,4,1,9,2,8,5,6,7]))
assert counters('q1-02')=='1,1,2';assert sql(f"select revision from mock_exam_attempt_snapshots where attempt_id='{c}'")=='10';print('PASS: concurrent out-of-order revisions converge to latest snapshot')
assert sql("select has_function_privilege('anon','replace_mock_exam_results(uuid,text,text,text,bigint,jsonb)','execute')")=='f'
assert sql("select has_function_privilege('authenticated','replace_mock_exam_results(uuid,text,text,text,bigint,jsonb)','execute')")=='f'
assert sql("select has_function_privilege('service_role','replace_mock_exam_results(uuid,text,text,text,bigint,jsonb)','execute')")=='t'
assert sql("select bool_and(consume_mock_exam_budget('sample-ip')) from generate_series(1,120)")=='t'
assert sql("select consume_mock_exam_budget('sample-ip')")=='f'
print('PASS: service_role-only access and request budget')
