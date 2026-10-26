from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import urllib.parse, os
BASELINE=Path(os.environ["STATISTICS_QA_BASELINE"]).resolve()
SOURCE=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  path=urllib.parse.urlsplit(path).path
  if path.startswith('/before/lab/statistics/'):
   return str(BASELINE/path.removeprefix('/before/'))
  if path.startswith('/before/'):path=path.removeprefix('/before')
  return str(SOURCE/path.lstrip('/'))
 def log_message(self,*args):pass
ThreadingHTTPServer(('127.0.0.1',8766),Handler).serve_forever()
