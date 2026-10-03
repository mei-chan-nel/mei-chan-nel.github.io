"""Preview the portal and its sibling learning app at their public URL paths."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APP_ROOT = ROOT.parent / "info1-quiz-app"
APP_PREFIX = "/info1-quiz-app"


class PreviewRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, app_root: Path, **kwargs):
        self.app_root = app_root
        super().__init__(*args, **kwargs)

    def translate_path(self, path: str) -> str:
        request_path = urlsplit(path).path
        if request_path != APP_PREFIX and not request_path.startswith(APP_PREFIX + "/"):
            return super().translate_path(path)

        portal_directory = self.directory
        try:
            self.directory = str(self.app_root)
            return super().translate_path(request_path.removeprefix(APP_PREFIX) or "/")
        finally:
            self.directory = portal_directory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8773)
    parser.add_argument("--app-root", type=Path, default=DEFAULT_APP_ROOT)
    args = parser.parse_args()
    app_root = args.app_root.expanduser().resolve()
    if not app_root.is_dir():
        parser.error("Learning app repository not found. Set --app-root to its checkout.")

    handler = partial(PreviewRequestHandler, directory=str(ROOT), app_root=app_root)
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        print(f"Preview: http://{args.host}:{server.server_port}/program-trace/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
