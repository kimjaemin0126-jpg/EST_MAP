"""Vercel Function: POST /api/scenario."""

from __future__ import annotations

import json
import sys
from http import HTTPStatus
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
ROOT = API_DIR.parent
for path in (API_DIR, ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from analysis_core import scenario_payload  # noqa: E402
from vercel_api import ApiHandler  # noqa: E402


class handler(ApiHandler):
    def do_POST(self) -> None:  # noqa: N802
        try:
            self.json_response(scenario_payload(self.read_json()))
        except json.JSONDecodeError:
            self.json_response({"error": "JSON 요청 형식이 올바르지 않습니다."}, HTTPStatus.BAD_REQUEST)
        except ValueError as error:
            self.json_response({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:
            # Return JSON instead of letting Vercel surface an opaque 502.
            self.json_response({"error": f"시나리오 계산 중 서버 오류가 발생했습니다: {type(error).__name__}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_GET(self) -> None:  # noqa: N802
        self.method_not_allowed()
