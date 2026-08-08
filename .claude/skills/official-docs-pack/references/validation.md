# Validation Spec

## Skill Package Validation

Run from the skill root:

```bash
bash scripts/validate-skill.sh
```

Expected result: JSON with `"status": "pass"` and all checks passing.

The validator checks routing metadata, progressive-disclosure references, required scripts, deterministic pack validation, dependency declarations, source-gating symbols, and basic package hygiene.

## Generated Pack Validation

Validate every output ZIP before delivery:

```bash
python3 scripts/validate-pack.py ./official-docs-pack.zip
```

The validator fails unless the archive has the required files, a successful manifest with seeds/pages, consistent docs/source-ledger/chunk paths, valid JSONL chunks, and source frontmatter in every packaged Markdown page.

## Functional Smoke Tests

Run these in a network-capable environment after `bun install`.

### Help

```bash
bun scripts/docpack.ts --help
```

Pass: usage mentions official docs, ZIP output, crawl bounds, and `--allow-host`.

### Known official docs

```bash
bun scripts/docpack.ts "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview" \
  --out /tmp/mdn-docs.zip --max-pages 3 --json
python3 scripts/validate-pack.py /tmp/mdn-docs.zip
```

Pass: both commands exit `0`.

### Third-party rejection

```bash
bun scripts/docpack.ts "https://stackoverflow.com/questions/11828270/how-do-i-exit-vim" \
  --out /tmp/bad.zip --json
```

Pass: exits non-zero; `/tmp/bad.zip` is not presented as a completed pack.

### Search-shape provenance guard

Use a search-discovered URL on an otherwise unknown `docs.*` host. Pass: it is not accepted merely because the hostname/path looks documentation-like. An explicit trusted `--allow-host` override is required if ownership has been independently established.

## Failure Evidence

```text
BLOCKED: official docs pack not produced
Request: <request>
Command: <exact command>
Observed: <short JSON/error excerpt>
Likely cause: <no accepted official source|dependency missing|blocked/JS-rendered|HTTP error|pack validation failed>
Next safe step: <official docs URL|trusted host confirmation|browser-capable/manual export>
```
