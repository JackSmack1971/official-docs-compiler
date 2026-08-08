#!/usr/bin/env python3
"""Static validator for the official-docs-pack Agent Skill package."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def check(name: str, passed: bool, details: str = "") -> dict[str, str]:
    return {"name": name, "status": "pass" if passed else "fail", "details": details}


def parse_frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        return {}
    data: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def main() -> int:
    raw = sys.argv[1] if len(sys.argv) > 1 else "."
    root = Path(raw).resolve()
    results: list[dict[str, str]] = []

    skill_md = root / "SKILL.md"
    scripts = root / "scripts"
    references = root / "references"
    docpack_ts = scripts / "docpack.ts"
    fetch_ts = scripts / "fetch.ts"
    validate_pack = scripts / "validate-pack.py"
    package_json = scripts / "package.json"
    tsconfig_json = scripts / "tsconfig.json"

    results.append(check("single-top-level-skill-root", root.name == "official-docs-pack", f"root={root.name}"))
    results.append(check("skill-md-exists", skill_md.is_file(), str(skill_md)))

    text = skill_md.read_text(encoding="utf-8") if skill_md.is_file() else ""
    frontmatter = parse_frontmatter(text)
    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")
    argument_hint = frontmatter.get("argument-hint", "")
    compatibility = frontmatter.get("compatibility", "")

    results.append(check("frontmatter-name", name == "official-docs-pack", f"name={name!r}"))
    results.append(check("name-length", 0 < len(name) <= 64, f"length={len(name)}"))
    results.append(check("description-present", bool(description), f"length={len(description)}"))
    results.append(check("description-startup-bound", 0 < len(description) <= 1024, f"length={len(description)}"))
    description_lower = description.lower()
    has_positive_route = "use when" in description_lower or "trigger when" in description_lower
    has_negative_route = "do not use" in description_lower
    results.append(check("description-routing-rule", has_positive_route and has_negative_route, "requires positive and negative routing boundary"))
    trigger_terms = ["official", "documentation", "zip", "do not use"]
    missing_terms = [term for term in trigger_terms if term not in description_lower]
    results.append(check("description-trigger-terms", not missing_terms and has_positive_route, f"missing={missing_terms}, positive_route={has_positive_route}"))
    results.append(check("argument-hint-present", bool(argument_hint), f"argument-hint={argument_hint!r}"))
    results.append(check("compatibility-present", bool(compatibility), f"compatibility={compatibility!r}"))
    results.append(check("skill-root-resolution", "${CLAUDE_SKILL_DIR}" in text, "bundled scripts resolve through CLAUDE_SKILL_DIR"))

    body_lines = text.splitlines()
    results.append(check("skill-md-concise", len(body_lines) <= 220, f"lines={len(body_lines)}"))
    results.append(check("positive-negative-examples", "Positive routing examples:" in text and "Negative routing examples:" in text, "routing examples present"))
    results.append(check("stop-rule-present", "## Definition of Done / Stop Rule" in text and "Stop immediately" in text, "explicit exit condition present"))
    results.append(check("failure-modes-present", "## Failure Modes" in text and "BLOCKED:" in text, "bounded failures present"))
    results.append(check("generated-pack-validation-required", "validate-pack.py" in text and "Deliver only after" in text, "deterministic artifact validation required"))
    results.append(check("progressive-disclosure-language", "conditionally read" in text.lower() and "references/" in text, "conditional reference loading present"))

    local_refs = re.findall(r"`(references/[^`]+)`", text)
    bad_refs = [ref for ref in local_refs if len(Path(ref).parts) != 2]
    missing_refs = [ref for ref in local_refs if not (root / ref).is_file()]
    results.append(check("one-level-reference-links", not bad_refs, f"bad={bad_refs}"))
    results.append(check("reference-links-exist", not missing_refs, f"missing={missing_refs}"))

    expected_refs = ["SOP.md", "source-policy.md", "output-spec.md", "selectors.md", "validation.md"]
    missing_expected = [item for item in expected_refs if not (references / item).is_file()]
    results.append(check("expected-references-exist", not missing_expected, f"missing={missing_expected}"))
    nested_refs = [
        str(path.relative_to(root))
        for path in references.glob("**/*")
        if path.is_file() and len(path.relative_to(references).parts) > 1
    ] if references.is_dir() else []
    results.append(check("no-nested-reference-chains", not nested_refs, f"nested={nested_refs}"))

    local_chain_links: list[str] = []
    if references.is_dir():
        for md in references.glob("*.md"):
            md_text = re.sub(r"```.*?```", "", md.read_text(encoding="utf-8"), flags=re.DOTALL)
            local_chain_links.extend(re.findall(r"\]\((?!https?://)([^)#]+)", md_text))
    results.append(check("references-no-local-chain-links", not local_chain_links, f"local_links={local_chain_links}"))

    results.append(check("scripts-dir-exists", scripts.is_dir(), str(scripts)))
    for script in [docpack_ts, fetch_ts, validate_pack, scripts / "validate-skill.sh", tsconfig_json]:
        results.append(check(f"script-exists:{script.name}", script.is_file(), str(script)))

    docpack_text = docpack_ts.read_text(encoding="utf-8") if docpack_ts.is_file() else ""
    required_symbols = ["isAcceptedOfficialDocs", "REJECT_HOSTS", "officialDocsScore", "canCrawlLink", "provenanceClass", "hostExplicitlyAllowed", "verification"]
    missing_symbols = [term for term in required_symbols if term not in docpack_text]
    results.append(check("docpack-official-provenance-gates", not missing_symbols, f"missing={missing_symbols}"))
    results.append(check("docpack-search-shape-guard", "unverified-provenance" in docpack_text and "outside-trusted-docs-host" in docpack_text, "search/cross-host provenance guards present"))
    results.append(check("docpack-zip-output", all(term in docpack_text for term in ["JSZip", "index/chunks.jsonl", "AGENT_INDEX.md"]), "zip/index outputs present"))
    results.append(check("docpack-no-browser-dependency", not re.search(r"(?:from\s+[\"\'](?:puppeteer|playwright)|import\s*\((?:\"|\')(?:puppeteer|playwright))", docpack_text, re.I), "no browser automation import"))

    validate_pack_text = validate_pack.read_text(encoding="utf-8") if validate_pack.is_file() else ""
    pack_checks = ["required-files", "manifest-status", "manifest-seeds", "manifest-pages", "sources-cover-docs", "chunks-grounded", "docs-source-frontmatter"]
    missing_pack_checks = [term for term in pack_checks if term not in validate_pack_text]
    results.append(check("pack-validator-quality-gates", not missing_pack_checks, f"missing={missing_pack_checks}"))

    package_version = ""
    if not package_json.is_file():
        results.append(check("package-json-valid", False, f"not found: {package_json}"))
    else:
        try:
            package = json.loads(package_json.read_text(encoding="utf-8"))
            package_version = str(package.get("version", ""))
            deps = package.get("dependencies", {})
            required = {"linkedom", "turndown", "turndown-plugin-gfm", "jszip"}
            missing_deps = sorted(required - set(deps))
            results.append(check("package-json-valid", True, "valid JSON"))
            results.append(check("dependencies-listed", not missing_deps, f"missing={missing_deps}"))
            results.append(check("package-private", package.get("private") is True, "private=true"))
            results.append(check("package-version", bool(re.fullmatch(r"\d+\.\d+\.\d+", package_version)), f"version={package_version!r}"))
            scripts_cfg = package.get("scripts", {})
            results.append(check("package-validation-scripts", all(name in scripts_cfg for name in ["validate", "validate-pack", "typecheck"]), f"scripts={sorted(scripts_cfg)}"))
            dev_deps = package.get("devDependencies", {})
            missing_dev_deps = sorted({"typescript", "@types/bun"} - set(dev_deps))
            results.append(check("typecheck-dependencies", not missing_dev_deps, f"missing={missing_dev_deps}"))
        except Exception as exc:  # noqa: BLE001
            results.append(check("package-json-valid", False, str(exc)))

    ts_version = re.search(r'const VERSION = "([^"]+)";', docpack_text)
    results.append(check("version-consistency", bool(ts_version and package_version and ts_version.group(1) == package_version), f"docpack={ts_version.group(1) if ts_version else None!r}, package={package_version!r}"))

    package_text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in root.rglob("*") if path.is_file() and path.name != "validate-skill.py" and "__pycache__" not in path.parts)
    results.append(check("no-hardcoded-install-path", "~/.claude/skills/" not in package_text and ".codex/skills/official-docs-pack" not in package_text, "no hardcoded installation path"))

    status = "pass" if results and all(item["status"] == "pass" for item in results) else "fail"
    print(json.dumps({"status": status, "checks": results}, indent=2))
    return 0 if status == "pass" else 1


if __name__ == "__main__":
    if len(sys.argv) > 2:
        print(json.dumps({"status": "error", "message": "Usage: validate-skill.py [skill-root]"}, indent=2), file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main())
