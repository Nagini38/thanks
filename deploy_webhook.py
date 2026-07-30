#!/usr/bin/env python3
"""GitHub webhook — auto-deploy thanks (no Flask needed)"""
import http.server
import json, subprocess, os, hmac, hashlib, datetime, threading

DEPLOY_PATH = os.path.expanduser("~/sites/thanks")
LOG_PATH = os.path.expanduser("~/webhook_thanks.log")

def log(msg):
    with open(LOG_PATH, "a") as f:
        f.write(f"[{datetime.datetime.now()}] {msg}\n")

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

    def do_POST(self):
        if self.path == "/deploy-thanks":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            # Verify signature if secret set
            sig = self.headers.get("X-Hub-Signature-256", "")
            secret = os.environ.get("WEBHOOK_SECRET", "")
            if secret and sig:
                expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
                if not hmac.compare_digest(expected, sig):
                    self.send_error(403)
                    return

            try:
                payload = json.loads(body)
                ref = payload.get("ref", "")
                if "main" in ref or "master" in ref:
                    def pull():
                        log("Pull starting...")
                        r = subprocess.run(["git", "pull"], cwd=DEPLOY_PATH, capture_output=True, text=True, timeout=30)
                        log(f"git pull: {r.stdout.strip()}")
                        if r.stderr: log(f"stderr: {r.stderr.strip()}")
                        log("Deploy done")
                    threading.Thread(target=pull, daemon=True).start()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"deploying"}')
            except Exception as e:
                log(f"Error: {e}")
                self.send_error(500)

    def log_message(self, *a):
        pass  # silence

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", 9002), Handler)
    log("Webhook listening on :9002")
    server.serve_forever()

