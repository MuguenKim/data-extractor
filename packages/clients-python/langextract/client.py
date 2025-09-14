from typing import Any, Dict, Optional
import json
import urllib.request


class ExtractorClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key

    def _headers(self) -> Dict[str, str]:
        h = {"content-type": "application/json"}
        if self.api_key:
            h["authorization"] = f"Bearer {self.api_key}"
        return h

    def _req(self, path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url=f"{self.base_url}{path}",
            method=method,
            data=data,
            headers=self._headers(),
        )
        with urllib.request.urlopen(req) as resp:  # nosec B310
            raw = resp.read().decode("utf-8")
            return json.loads(raw)

    def health(self):
        return self._req("/health")

    def create_or_update_workflow(self, body: Dict[str, Any]):
        return self._req("/workflows", method="POST", body=body)

    def infer_schema(self, body: Dict[str, Any]):
        return self._req("/infer_schema", method="POST", body=body)

    def extract(self, params: Dict[str, str], body: Dict[str, Any]):
        qs = "&".join([f"{k}={v}" for k, v in params.items()])
        return self._req(f"/extract?{qs}", method="POST", body=body)

    def job(self, id: str):
        return self._req(f"/jobs/{id}")

    def validate(self, body: Dict[str, Any]):
        return self._req("/validate", method="POST", body=body)

