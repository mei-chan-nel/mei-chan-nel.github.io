"""Read-only production probe using only the existing publishable key.
No SQL writes, no submission POST and no service-role key. Optional JSON report.
"""
import argparse,json,re,urllib.request,urllib.error
from datetime import datetime,timezone
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--report',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=(root/'mock-exams/engine/stats.mjs').read_text()
url=re.search(r'url:\s*"([^"]+)"',source).group(1)
key=re.search(r'publishableKey:\s*"([^"]+)"',source).group(1)
checks=[]
for name,path,payload in [('existing_read_rpc','/rest/v1/rpc/get_mock_exam_stats',{'p_exam_id':'001','p_exam_version':'1.0.0'}),('edge_configuration','/functions/v1/mock-exam-submit',None)]:
 req=urllib.request.Request(url+path,data=json.dumps(payload).encode() if payload is not None else None,
  headers={'apikey':key,'Origin':'https://mei-chan-nel.com','Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=15) as response:
   body=json.load(response)
   ok=isinstance(body,list) if payload else isinstance(body,dict) and body.get('protocol')==2 and body.get('ready') is True
   check={'check':name,'passed':ok,'http_status':response.status}
   if payload and isinstance(body,list):check['row_count']=len(body)
   elif isinstance(body,dict):check['verification_enabled']=body.get('verificationEnabled')
 except (urllib.error.URLError,TimeoutError,ValueError) as error:
  check={'check':name,'passed':False,'error':str(error)}
 checks.append(check);print(json.dumps(check,ensure_ascii=False))
report={'at':datetime.now(timezone.utc).isoformat(),'project':url,'read_only':True,'checks':checks}
if args.report:
 args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(0 if all(c['passed'] for c in checks) else 1)
