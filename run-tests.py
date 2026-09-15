#!/usr/bin/env python3
"""Run the browser test suite headlessly. Exit 0 if all pass, 1 otherwise."""
import http.server, socketserver, threading, subprocess, tempfile, shutil, sys, os

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGE = "/test.html"
TIMEOUT = 60

result = {"body": None}
done = threading.Event()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        result["body"] = self.rfile.read(n).decode("utf-8", "replace")
        self.send_response(204)
        self.end_headers()
        done.set()

    def log_message(self, *a):
        pass


def find_chrome():
    cands = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("google-chrome"), shutil.which("chromium"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for c in cands:
        if c and os.path.exists(c):
            return c
    sys.exit("Chrome not found. Install Chrome or set the CHROME env var.")


def main():
    chrome = os.environ.get("CHROME") or find_chrome()
    srv = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    profile = tempfile.mkdtemp(prefix="sleeptest-")
    proc = subprocess.Popen(
        [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
         "--no-default-browser-check", "--user-data-dir=" + profile,
         f"http://127.0.0.1:{port}{PAGE}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    ok = done.wait(TIMEOUT)
    proc.terminate()
    try:
        proc.wait(10)
    except subprocess.TimeoutExpired:
        proc.kill()
    srv.shutdown()
    shutil.rmtree(profile, ignore_errors=True)

    if not ok:
        print(f"TIMEOUT: no results after {TIMEOUT}s", file=sys.stderr)
        return 1

    print(result["body"])
    return 0 if "\nFAIL " not in "\n" + result["body"] else 1


if __name__ == "__main__":
    sys.exit(main())
