"""Tiny static server for local play. Same as `python -m http.server`, but tells the
browser to always re-check files, so edits show up on a normal reload."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with http.server.ThreadingHTTPServer(("", port), NoCacheHandler) as srv:
        print(f"Serving on http://localhost:{port}")
        srv.serve_forever()
