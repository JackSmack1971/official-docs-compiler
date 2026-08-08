#!/usr/bin/env python3
"""Deterministically validate an official-docs-pack output ZIP."""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlparse

REQUIRED = {"README.md", "AGENT_INDEX.md", "manifest.json", "sources.csv", "index/chunks.jsonl"}
DOC_RE = re.compile(r"^docs/.+\.md$")
SOURCE_URL_RE = re.compile(r"(?m)^source_url:\s*[\"']?(https?://[^\s\"']+)")


def result(name: str, passed: bool, details: str = "") -> dict[str, str]:
    return {"name": name, "status": "pass" if passed else "fail", "details": details}


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "message": "Usage: validate-pack.py <pack.zip>"}, indent=2), file=sys.stderr)
        return 2

    path = Path(sys.argv[1]).resolve()
    checks: list[dict[str, str]] = []
    checks.append(result("zip-exists", path.is_file(), str(path)))
    if not path.is_file():
        print(json.dumps({"status": "fail", "checks": checks}, indent=2))
        return 1

    try:
        with zipfile.ZipFile(path) as zf:
            names = set(zf.namelist())
            bad_member = next((n for n in names if n.startswith("/") or ".." in Path(n).parts), None)
            checks.append(result("safe-member-paths", bad_member is None, f"bad={bad_member!r}"))
            checks.append(result("required-files", REQUIRED.issubset(names), f"missing={sorted(REQUIRED - names)}"))

            doc_names = sorted(n for n in names if DOC_RE.match(n))
            checks.append(result("docs-present", bool(doc_names), f"count={len(doc_names)}"))

            try:
                manifest = json.loads(zf.read("manifest.json"))
                checks.append(result("manifest-json", isinstance(manifest, dict), "valid JSON object"))
            except Exception as exc:  # noqa: BLE001
                manifest = {}
                checks.append(result("manifest-json", False, str(exc)))

            pages = manifest.get("pages", []) if isinstance(manifest, dict) else []
            seeds = manifest.get("seeds", []) if isinstance(manifest, dict) else []
            checks.append(result("manifest-status", manifest.get("status") == "ok", f"status={manifest.get('status')!r}"))
            checks.append(result("manifest-seeds", isinstance(seeds, list) and len(seeds) > 0, f"count={len(seeds) if isinstance(seeds, list) else 'invalid'}"))
            checks.append(result("manifest-pages", isinstance(pages, list) and len(pages) > 0, f"count={len(pages) if isinstance(pages, list) else 'invalid'}"))

            page_paths = {p.get("path") for p in pages if isinstance(p, dict) and isinstance(p.get("path"), str)}
            checks.append(result("manifest-doc-paths-exist", page_paths == set(doc_names), f"manifest={len(page_paths)} zip={len(doc_names)}"))

            source_rows: list[dict[str, str]] = []
            try:
                source_text = zf.read("sources.csv").decode("utf-8")
                source_rows = list(csv.DictReader(io.StringIO(source_text)))
                required_cols = {"path", "title", "url", "host", "depth", "status"}
                cols = set(source_rows[0].keys()) if source_rows else set()
                checks.append(result("sources-schema", bool(source_rows) and required_cols.issubset(cols), f"rows={len(source_rows)} cols={sorted(cols)}"))
            except Exception as exc:  # noqa: BLE001
                checks.append(result("sources-schema", False, str(exc)))

            source_paths = {r.get("path") for r in source_rows if r.get("path")}
            checks.append(result("sources-cover-docs", source_paths == set(doc_names), f"sources={len(source_paths)} docs={len(doc_names)}"))
            source_urls = {r.get("url") for r in source_rows if r.get("url")}
            bad_source_url = next((u for u in source_urls if not u or urlparse(u).scheme not in {"http", "https"}), None)
            checks.append(result("sources-http-urls", bad_source_url is None, f"bad={bad_source_url!r}"))

            chunks: list[dict] = []
            chunk_error = ""
            try:
                raw = zf.read("index/chunks.jsonl").decode("utf-8")
                for line_no, line in enumerate(raw.splitlines(), 1):
                    if not line.strip():
                        continue
                    item = json.loads(line)
                    if not isinstance(item, dict):
                        raise ValueError(f"line {line_no}: chunk is not an object")
                    chunks.append(item)
            except Exception as exc:  # noqa: BLE001
                chunk_error = str(exc)
            checks.append(result("chunks-jsonl", bool(chunks) and not chunk_error, chunk_error or f"count={len(chunks)}"))

            bad_chunk = next((c for c in chunks if c.get("path") not in set(doc_names) or c.get("url") not in source_urls or not isinstance(c.get("text"), str) or not c.get("text", "").strip()), None)
            checks.append(result("chunks-grounded", bad_chunk is None and bool(chunks), "all chunks map to packaged docs/source URLs" if bad_chunk is None else f"bad={bad_chunk}"))

            frontmatter_error = ""
            for name in doc_names:
                try:
                    text = zf.read(name).decode("utf-8")
                except Exception as exc:  # noqa: BLE001
                    frontmatter_error = f"{name}: {exc}"
                    break
                match = SOURCE_URL_RE.search(text[:3000])
                if not text.startswith("---\n") or not match or match.group(1) not in source_urls:
                    frontmatter_error = f"{name}: missing/ungrounded source_url frontmatter"
                    break
            checks.append(result("docs-source-frontmatter", not frontmatter_error and bool(doc_names), frontmatter_error or f"count={len(doc_names)}"))
    except zipfile.BadZipFile as exc:
        checks.append(result("valid-zip", False, str(exc)))
    else:
        checks.append(result("valid-zip", True, "zip opened successfully"))

    status = "pass" if checks and all(c["status"] == "pass" for c in checks) else "fail"
    print(json.dumps({"status": status, "zip": str(path), "checks": checks}, indent=2))
    return 0 if status == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
