"""Local development server for the EST_MAP dashboard and analysis APIs."""

from __future__ import annotations

import argparse
import json
import os
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from api.analysis_core import generate_coach, scenario_payload


ROOT = Path(__file__).resolve().parent
MAX_REQUEST_BYTES = 25_000


class DashboardHandler(SimpleHTTPRequestHandler):
    def json_response(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def read_json(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            raise ValueError("요청 크기가 올바르지 않습니다.")
        return json.loads(self.rfile.read(content_length).decode("utf-8"))

    def do_POST(self) -> None:  # noqa: N802
        endpoint = urlparse(self.path).path
        if endpoint not in {"/api/scenario", "/api/coach"}:
            self.json_response({"error": "요청 경로를 찾을 수 없습니다."}, HTTPStatus.NOT_FOUND)
            return

        try:
            request_payload = self.read_json()
            context = scenario_payload(request_payload)

            if endpoint == "/api/scenario":
                self.json_response(context)
            else:
                self.json_response(generate_coach(context))

        except json.JSONDecodeError:
            self.json_response({"error": "JSON 요청 형식이 올바르지 않습니다."}, HTTPStatus.BAD_REQUEST)
        except ValueError as error:
            self.json_response({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:
            self.json_response(
                {"error": f"분석 처리 중 서버 오류가 발생했습니다. ({type(error).__name__})"},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the EST_MAP local dashboard/API server.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="Open the dashboard in the default browser")
    args = parser.parse_args()

    os.chdir(ROOT)
    address = f"http://127.0.0.1:{args.port}"
    server = ThreadingHTTPServer(("127.0.0.1", args.port), DashboardHandler)

    print(f"EST_MAP API server: {address}")
    print("Press Ctrl+C to stop the server.")

    if args.open:
        webbrowser.open(address)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEST_MAP API server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
