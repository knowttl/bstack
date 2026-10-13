import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from greeter.greeting import greeting


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path == "/health":
            self.reply(200, "ok")
        elif url.path == "/greet":
            name = parse_qs(url.query).get("name", ["world"])[0]
            self.reply(200, greeting(name))
        else:
            self.reply(404, "not found")

    def reply(self, status: int, body: str) -> None:
        payload = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        return None


def main(port: int) -> None:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"listening on {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main(int(sys.argv[1]))
