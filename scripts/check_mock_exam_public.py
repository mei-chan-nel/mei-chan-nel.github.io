"""Read-only hosted RPC probe using the existing publishable key. No DB writes."""
import argparse,json,re,urllib.request,urllib.error,uuid
from datetime import datetime,timezone
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--report',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=(root/'mock-exams/engine/stats.mjs').read_text()
url=re.search(r'url:\s*[\"\']([^\"\']+)',source).group(1)
key=re.search(r'publishableKey:\s*[\"\']([^\"\']+)',source).group(1)
exam_id='qa_mock_probe_'+uuid.uuid4().hex
req=urllib.request.Request(url+'/rest/v1/rpc/get_mock_exam_stats',
 data=json.dumps({'p_exam_id':exam_id,'p_exam_version':1}).encode(),headers={'apikey':key,'Content-Type':'application/json'})
report={'at':datetime.now(timezone.utc).isoformat(),'project':url,'exam_id':exam_id,'exam_version':1,'read_only':True,'passed':False}
try:
 with urllib.request.urlopen(req,timeout=15) as response:
  body=json.load(response);report['http_status']=response.status
  report['passed']=isinstance(body,dict) and isinstance(body.get('items'),list)
  if report['passed']:report['row_count']=len(body['items'])
except (urllib.error.URLError,TimeoutError,ValueError) as error:report['error']=str(error)
print(json.dumps(report,ensure_ascii=False,indent=2))
if args.report:
 args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(0 if report['passed'] else 1)
