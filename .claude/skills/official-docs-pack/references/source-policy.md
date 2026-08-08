# Official Docs Source Policy

The pack may use broad discovery signals, but packaged content must stay within an accepted documentation trust boundary.

## Accepted Provenance Classes

A seed is acceptable only when it has docs-like URL/content signals, violates no rejection rule, and has one of these provenance classes:

1. **Known official documentation host**
   - A maintained first-party/official docs host recognized by the builder.
   - Examples: `docs.python.org`, `developer.mozilla.org`, `docs.github.com`, `docs.docker.com`, `platform.claude.com`, `code.claude.com`, `developers.openai.com`.

2. **Known target mapping**
   - A built-in project alias mapped to a maintained official docs URL.

3. **Trusted registry/project metadata link**
   - Documentation/homepage/repository metadata returned by a project registry such as npm or PyPI, when the resulting URL is docs-like and not rejected.
   - Registry provenance establishes the project-to-host relationship; URL shape alone does not.

4. **Official ecosystem documentation registry**
   - Examples: `docs.rs` for Rust crates and `pkg.go.dev` for Go packages.

5. **Explicit user-supplied docs URL**
   - A URL directly supplied as the requested source may be accepted when it is docs-like and not rejected.
   - This provenance applies only to that source boundary; it does not make unrelated search-discovered hosts official.

6. **Explicitly allowed host**
   - `--allow-host` is an operator trust override for a host whose ownership has already been established outside URL-shape heuristics.
   - Do not use it merely to force a candidate through validation.

## Rejected Sources

Never package:

- Stack Overflow, Reddit, Quora, Medium, Dev.to, Hacker News, forums, blogs/newsletters, or similar commentary sources.
- SEO/tutorial aggregators, scraped mirrors, unofficial translations, or copied documentation sites.
- Search-discovered hosts whose only evidence is a `docs.*` hostname or `/docs`-like path.
- General marketing/home pages with no documentation/reference/manual/API section.
- Pages requiring login, auth tokens, cookies, CAPTCHA, payment, private repositories, or browser-only JavaScript rendering.
- Binary-first resources such as PDF, images, video, archives, and downloads.

## Crawl Boundary

- Crawl within the accepted seed host and its docs root when possible.
- A cross-host link may be crawled only when the target host is independently known/allowed official documentation for the run.
- A search result never becomes official solely because its host/path looks documentation-like.
- Strip fragments and common tracking parameters before de-duplication.
- Skip assets, feeds, login/signup, issue trackers, marketing, pricing, blog/news, community, careers, and similar non-docs paths.
- Record skipped/rejected URLs in `manifest.json`; do not include them under `docs/`.

## Ambiguity Rule

If ownership/provenance cannot be established with the available trusted signals, exclude the source. A smaller source-grounded pack is preferable to a contaminated one.
