#!/usr/bin/env bun

type Options = {
  request: string;
  out: string;
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
  json: boolean;
  debug: boolean;
  allowHosts: string[];
};

type FetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
};

type Seed = {
  url: string;
  reason: string;
  score: number;
  host: string;
  rootPath: string;
  verification: string;
};

type Page = {
  url: string;
  finalUrl: string;
  host: string;
  title: string;
  path: string;
  depth: number;
  markdown: string;
  headings: string[];
  fetchedAt: string;
  selector: string;
};

type Skipped = { url: string; reason: string };
type Failure = { url: string; reason: string; status?: number };

type SiteRule = {
  host: string;
  include: string;
  exclude?: string;
};

const VERSION = "2.2.0";
const DEFAULT_OUT = "official-docs-pack.zip";
const DEFAULT_INCLUDE = "article,main,[role=main]";
const DEFAULT_EXCLUDE = "script,style,noscript,template,svg,nav,header,footer,.sidebar,.toc,.breadcrumb,.breadcrumbs,.cookie,.cookie-banner";
const DOC_SEGMENTS = new Set(["docs", "doc", "documentation", "reference", "api", "apis", "guide", "guides", "manual", "learn", "handbook"]);
const BAD_PATH_PARTS = ["/blog", "/news", "/pricing", "/login", "/signin", "/signup", "/community", "/forum", "/forums", "/support", "/contact", "/careers", "/jobs", "/events", "/partners", "/customers", "/case-studies", "/showcase", "/marketplace", "/changelog"];
const BAD_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|tar|gz|tgz|mp4|mov|mp3|wav|woff2?|ttf|eot|css|js|map|json|xml|rss)(?:$|[?#])/i;

const REJECT_HOSTS = [
  "stackoverflow.com", "stackexchange.com", "reddit.com", "medium.com", "dev.to", "hashnode.dev", "hackernews.com", "news.ycombinator.com", "quora.com", "wikipedia.org", "youtube.com", "youtu.be", "discord.com", "discord.gg",
];

const KNOWN_DOC_HOSTS = [
  "developer.mozilla.org", "docs.python.org", "doc.rust-lang.org", "docs.rs", "pkg.go.dev", "go.dev", "nodejs.org", "bun.sh", "docs.deno.com", "www.typescriptlang.org", "react.dev", "nextjs.org", "vuejs.org", "angular.dev", "svelte.dev", "docs.djangoproject.com", "flask.palletsprojects.com", "fastapi.tiangolo.com", "docs.pydantic.dev", "ai.pydantic.dev", "docs.pytest.org", "numpy.org", "pandas.pydata.org", "docs.scipy.org", "pytorch.org", "www.tensorflow.org", "kubernetes.io", "docs.docker.com", "docs.github.com", "git-scm.com", "docs.gitlab.com", "developer.apple.com", "developer.android.com", "learn.microsoft.com", "cloud.google.com", "docs.aws.amazon.com", "docs.anthropic.com", "platform.claude.com", "code.claude.com", "platform.openai.com", "developers.openai.com", "modelcontextprotocol.io", "docs.langchain.com", "python.langchain.com", "js.langchain.com", "docs.llamaindex.ai", "docs.streamlit.io", "docs.expo.dev", "tauri.app", "electronjs.org", "vite.dev", "webpack.js.org", "rollupjs.org", "eslint.org", "prettier.io", "jestjs.io", "vitest.dev", "playwright.dev", "docs.cypress.io", "tailwindcss.com", "tanstack.com", "redux.js.org", "graphql.org", "www.apollographql.com", "docs.npmjs.com", "pnpm.io", "yarnpkg.com", "pip.pypa.io", "packaging.python.org", "setuptools.pypa.io", "docs.astral.sh", "ruff.rs", "docs.rs", "crates.io",
];

const SITE_RULES: SiteRule[] = [
  { host: "docs.anthropic.com", include: "#content-container,main,article", exclude: "nav,header,footer,.sidebar" },
  { host: "platform.claude.com", include: "#content-container,main,article,[role=main]", exclude: "nav,header,footer,.sidebar" },
  { host: "code.claude.com", include: "main,article,[role=main],#content-container", exclude: "nav,header,footer,.sidebar" },
  { host: "platform.openai.com", include: "main,article,[role=main]", exclude: "nav,header,footer,.sidebar" },
  { host: "developers.openai.com", include: "main,article,[role=main]", exclude: "nav,header,footer,.sidebar" },
  { host: "developer.mozilla.org", include: "article", exclude: "nav,header,footer" },
  { host: "docs.python.org", include: "div.body", exclude: "nav,header,footer,.sphinxsidebar" },
  { host: "doc.rust-lang.org", include: "main", exclude: "nav,header,footer" },
  { host: "docs.rs", include: "main", exclude: "nav,header,footer" },
  { host: "pkg.go.dev", include: "main", exclude: "nav,header,footer" },
  { host: "readthedocs.io", include: "div.document,.rst-content,main", exclude: "nav,.wy-nav-side,header,footer" },
  { host: "github.com", include: "article,main", exclude: "nav,header,footer,.sidebar" },
];

type KnownTarget = { aliases: string[]; url: string };
const KNOWN_TARGETS: KnownTarget[] = [
  { aliases: ["react", "reactjs"], url: "https://react.dev/reference/react" },
  { aliases: ["next", "next.js", "nextjs"], url: "https://nextjs.org/docs" },
  { aliases: ["vue", "vue.js", "vuejs"], url: "https://vuejs.org/guide/introduction.html" },
  { aliases: ["angular"], url: "https://angular.dev/overview" },
  { aliases: ["svelte", "sveltekit"], url: "https://svelte.dev/docs" },
  { aliases: ["typescript", "ts"], url: "https://www.typescriptlang.org/docs/" },
  { aliases: ["javascript mdn", "mdn javascript"], url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
  { aliases: ["python"], url: "https://docs.python.org/3/" },
  { aliases: ["rust"], url: "https://doc.rust-lang.org/book/" },
  { aliases: ["cargo"], url: "https://doc.rust-lang.org/cargo/" },
  { aliases: ["go", "golang"], url: "https://go.dev/doc/" },
  { aliases: ["node", "node.js", "nodejs"], url: "https://nodejs.org/api/" },
  { aliases: ["bun"], url: "https://bun.sh/docs" },
  { aliases: ["deno"], url: "https://docs.deno.com/" },
  { aliases: ["tauri"], url: "https://tauri.app/develop/" },
  { aliases: ["electron"], url: "https://www.electronjs.org/docs/latest/" },
  { aliases: ["vite"], url: "https://vite.dev/guide/" },
  { aliases: ["webpack"], url: "https://webpack.js.org/concepts/" },
  { aliases: ["rollup"], url: "https://rollupjs.org/introduction/" },
  { aliases: ["django"], url: "https://docs.djangoproject.com/en/stable/" },
  { aliases: ["flask"], url: "https://flask.palletsprojects.com/en/stable/" },
  { aliases: ["fastapi"], url: "https://fastapi.tiangolo.com/" },
  { aliases: ["pydantic ai", "pydantic-ai", "pydanticai"], url: "https://ai.pydantic.dev/" },
  { aliases: ["pydantic"], url: "https://docs.pydantic.dev/latest/" },
  { aliases: ["pytest"], url: "https://docs.pytest.org/en/stable/" },
  { aliases: ["ruff"], url: "https://docs.astral.sh/ruff/" },
  { aliases: ["uv"], url: "https://docs.astral.sh/uv/" },
  { aliases: ["numpy"], url: "https://numpy.org/doc/stable/" },
  { aliases: ["pandas"], url: "https://pandas.pydata.org/docs/" },
  { aliases: ["scipy"], url: "https://docs.scipy.org/doc/scipy/" },
  { aliases: ["pytorch", "torch"], url: "https://pytorch.org/docs/stable/index.html" },
  { aliases: ["tensorflow"], url: "https://www.tensorflow.org/api_docs" },
  { aliases: ["docker"], url: "https://docs.docker.com/" },
  { aliases: ["kubernetes", "k8s"], url: "https://kubernetes.io/docs/" },
  { aliases: ["github actions"], url: "https://docs.github.com/en/actions" },
  { aliases: ["github api", "github rest api"], url: "https://docs.github.com/en/rest" },
  { aliases: ["git"], url: "https://git-scm.com/docs" },
  { aliases: ["openai", "openai api"], url: "https://developers.openai.com/api/docs/" },
  { aliases: ["claude code", "anthropic claude code"], url: "https://code.claude.com/docs/en" },
  { aliases: ["anthropic", "claude api", "anthropic api"], url: "https://platform.claude.com/docs/en" },
  { aliases: ["model context protocol", "mcp"], url: "https://modelcontextprotocol.io/docs" },
  { aliases: ["langchain"], url: "https://docs.langchain.com/" },
  { aliases: ["llamaindex"], url: "https://docs.llamaindex.ai/" },
  { aliases: ["streamlit"], url: "https://docs.streamlit.io/" },
  { aliases: ["expo"], url: "https://docs.expo.dev/" },
  { aliases: ["tailwind", "tailwindcss"], url: "https://tailwindcss.com/docs" },
  { aliases: ["tanstack query", "react query"], url: "https://tanstack.com/query/latest/docs/framework/react/overview" },
  { aliases: ["redux"], url: "https://redux.js.org/introduction/getting-started" },
  { aliases: ["graphql"], url: "https://graphql.org/learn/" },
  { aliases: ["eslint"], url: "https://eslint.org/docs/latest/" },
  { aliases: ["prettier"], url: "https://prettier.io/docs/" },
  { aliases: ["jest"], url: "https://jestjs.io/docs/getting-started" },
  { aliases: ["vitest"], url: "https://vitest.dev/guide/" },
  { aliases: ["playwright"], url: "https://playwright.dev/docs/intro" },
  { aliases: ["cypress"], url: "https://docs.cypress.io/app/get-started/why-cypress" },
];

function usage(): string {
  return `Usage: bun docpack.ts <request-or-official-docs-url> [options]

Find official documentation for a user's request, crawl only verified docs pages,
and write an AI-agent optimized ZIP containing full Markdown docs and search indexes.

Options:
  --out <path>              Output ZIP path. Default: ${DEFAULT_OUT}
  --max-pages <number>      Maximum docs pages to package. Default: 80
  --max-depth <number>      Maximum link depth from verified seed. Default: 3
  --timeout-ms <number>     Fetch timeout in milliseconds. Default: 15000
  --allow-host <host>       Additional host accepted as official docs for this run. Repeatable.
  --json                    Print machine-readable summary.
  --debug                   Print discovery/crawl diagnostics to stderr.
  -h, --help                Show this help.

Exit codes:
  0  success
  2  invalid CLI usage
  10 no verified official documentation seed
  20 fetch/network/HTTP error prevented pack creation
  30 no usable docs pages extracted
  40 parser/package failure
  50 missing runtime dependency; run: bun install
`;
}

function fail(exitCode: number, message: string, details: Record<string, unknown> = {}): never {
  console.error(JSON.stringify({ status: "error", exitCode, message, ...details }, null, 2));
  process.exit(exitCode);
}

function debug(opts: Options, data: Record<string, unknown>): void {
  if (opts.debug) console.error(JSON.stringify({ status: "debug", ...data }));
}

function parseArgs(argv: string[]): Options {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(usage());
    process.exit(0);
  }

  const positional: string[] = [];
  const opts: Partial<Options> = { out: DEFAULT_OUT, maxPages: 80, maxDepth: 3, timeoutMs: 15000, json: false, debug: false, allowHosts: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--out":
        opts.out = requireValue(argv, ++i, arg);
        break;
      case "--max-pages": {
        const value = parsePositiveInt(requireValue(argv, ++i, arg), arg, 1);
        opts.maxPages = value;
        break;
      }
      case "--max-depth": {
        const value = parsePositiveInt(requireValue(argv, ++i, arg), arg, 0);
        opts.maxDepth = value;
        break;
      }
      case "--timeout-ms": {
        const value = parsePositiveInt(requireValue(argv, ++i, arg), arg, 1000);
        opts.timeoutMs = value;
        break;
      }
      case "--allow-host":
        opts.allowHosts = [...(opts.allowHosts ?? []), normalizeHost(requireValue(argv, ++i, arg))];
        break;
      case "--json":
        opts.json = true;
        break;
      case "--debug":
        opts.debug = true;
        break;
      default:
        if (arg.startsWith("-")) fail(2, `Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  if (positional.length !== 1) fail(2, "Exactly one request or URL is required", { usage: usage() });
  return {
    request: positional[0].trim(),
    out: opts.out ?? DEFAULT_OUT,
    maxPages: opts.maxPages ?? 80,
    maxDepth: opts.maxDepth ?? 3,
    timeoutMs: opts.timeoutMs ?? 15000,
    json: !!opts.json,
    debug: !!opts.debug,
    allowHosts: opts.allowHosts ?? [],
  };
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) fail(2, `${option} requires a value`);
  return value;
}

function parsePositiveInt(raw: string, option: string, min: number): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min) fail(2, `${option} must be an integer >= ${min}`);
  return value;
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s_]+/g, " ").replace(/["'`]/g, "").trim();
}

function extractFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.;]+$/, "");
}

function cleanUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|ref|source|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return undefined;
  }
}

function isRejectedHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return REJECT_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`));
}

function knownDocsHost(hostname: string, allowHosts: string[] = []): boolean {
  const host = normalizeHost(hostname);
  const all = [...KNOWN_DOC_HOSTS, ...allowHosts.map(normalizeHost)];
  return all.some((known) => host === normalizeHost(known) || host.endsWith(`.${normalizeHost(known)}`));
}

function hasDocsHostShape(hostname: string): boolean {
  const host = normalizeHost(hostname);
  const first = host.split(".")[0];
  return ["docs", "doc", "developer", "developers", "api", "reference", "learn"].includes(first);
}

function hasDocsPath(pathname: string): boolean {
  const parts = pathname.toLowerCase().split("/").filter(Boolean);
  return parts.some((part) => DOC_SEGMENTS.has(part));
}

function hasBadPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return BAD_PATH_PARTS.some((part) => path.includes(part));
}

function officialDocsScore(rawUrl: string, opts: Options): { score: number; reason: string } {
  const cleaned = cleanUrl(rawUrl);
  if (!cleaned) return { score: -1000, reason: "invalid-url" };
  const url = new URL(cleaned);
  const host = normalizeHost(url.hostname);
  const path = url.pathname.toLowerCase();
  if (isRejectedHost(host)) return { score: -1000, reason: "rejected-host" };
  if (BAD_EXTENSIONS.test(url.pathname)) return { score: -1000, reason: "binary-or-asset" };
  if (hasBadPath(path)) return { score: -200, reason: "non-docs-path" };

  let score = 0;
  const reasons: string[] = [];
  if (knownDocsHost(host, opts.allowHosts)) {
    score += 80;
    reasons.push("known-docs-host");
  }
  if (hasDocsHostShape(host)) {
    score += 35;
    reasons.push("docs-shaped-host");
  }
  if (hasDocsPath(path)) {
    score += 40;
    reasons.push("docs-shaped-path");
  }
  if (host === "github.com" && /\/[^/]+\/[^/]+\/(?:tree|blob)\/[^/]+\/(?:docs|documentation|examples|guides|README\.md)/i.test(url.pathname)) {
    score += 70;
    reasons.push("official-repo-docs-shaped-path");
  }
  if (url.pathname === "/" && (knownDocsHost(host, opts.allowHosts) || hasDocsHostShape(host))) {
    score += 10;
    reasons.push("docs-homepage");
  }
  return { score, reason: reasons.join("+") || "weak-docs-signal" };
}

function isAcceptedOfficialDocs(rawUrl: string, opts: Options): { ok: boolean; score: number; reason: string } {
  const scored = officialDocsScore(rawUrl, opts);
  return { ok: scored.score >= 70, score: scored.score, reason: scored.reason };
}

function rootPathFor(rawUrl: string): string {
  const url = new URL(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => DOC_SEGMENTS.has(part.toLowerCase()));
  if (index >= 0) return `/${parts.slice(0, index + 1).join("/")}`;
  if (url.hostname === "developer.mozilla.org" && parts.length >= 2 && parts[1].toLowerCase() === "docs") {
    return `/${parts.slice(0, 2).join("/")}`;
  }
  return "/";
}

function hostExplicitlyAllowed(hostname: string, allowHosts: string[]): boolean {
  const host = normalizeHost(hostname);
  return allowHosts.map(normalizeHost).some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function provenanceClass(reason: string): string | undefined {
  if (reason === "known-target") return "known-target";
  if (reason.startsWith("npm-metadata:") || reason.startsWith("pypi-metadata:")) return "registry-metadata";
  if (reason.startsWith("docs.rs-candidate:") || reason.startsWith("go-pkg-candidate:")) return "official-ecosystem-registry";
  if (reason === "user-url" || reason === "user-url-linked-docs") return "user-supplied";
  return undefined;
}

function hostsRelated(a: string, b: string): boolean {
  const left = normalizeHost(a);
  const right = normalizeHost(b);
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

function seedFromUrl(rawUrl: string, reason: string, opts: Options): Seed | undefined {
  const cleaned = cleanUrl(rawUrl);
  if (!cleaned) return undefined;
  const accepted = isAcceptedOfficialDocs(cleaned, opts);
  const url = new URL(cleaned);
  const host = normalizeHost(url.hostname);
  const knownHost = knownDocsHost(host);
  const allowedHost = hostExplicitlyAllowed(host, opts.allowHosts);
  const provenance = provenanceClass(reason);

  // Search discovery must never promote a merely docs-shaped URL to "official".
  // Non-known hosts require trusted provenance (registry/user-supplied) or an explicit operator allowlist.
  const provenanceAccepted = knownHost || allowedHost || provenance !== undefined;
  if (!accepted.ok || !provenanceAccepted) {
    debug(opts, {
      event: "seed-rejected",
      url: cleaned,
      score: accepted.score,
      reason: !accepted.ok ? accepted.reason : "unverified-provenance",
      discovery_reason: reason,
    });
    return undefined;
  }

  const verification = allowedHost
    ? "explicit-allow-host"
    : knownHost
      ? "known-official-docs-host"
      : provenance!;
  return {
    url: cleaned,
    reason: `${reason}:${accepted.reason}`,
    score: accepted.score,
    host,
    rootPath: rootPathFor(cleaned),
    verification,
  };
}

function dedupeSeeds(seeds: Seed[]): Seed[] {
  const seen = new Set<string>();
  const result: Seed[] = [];
  for (const seed of seeds.sort((a, b) => b.score - a.score)) {
    const key = cleanUrl(seed.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(seed);
  }
  return result;
}

function queryCandidates(request: string): string[] {
  const normalized = normalizeText(request);
  const explicit = Array.from(request.matchAll(/[`"']([^`"']+)[`"']/g)).map((m) => m[1].trim()).filter(Boolean);
  const afterFor = normalized.match(/(?:official docs?|documentation|docs?|reference)\s+(?:for|of)?\s*([@a-z0-9_.\/-]+)/i)?.[1];
  const cleaned = normalized
    .replace(/official/g, "")
    .replace(/documentation|docs|reference|manual|guide|api|sdk|cli|library|framework|package|for|of|the|a|an/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(new Set([...explicit, afterFor, cleaned, normalized].filter((x): x is string => !!x && x.length > 1)));
}

async function discoverKnownTargets(request: string, opts: Options): Promise<Seed[]> {
  const normalized = normalizeText(request);
  const seeds: Seed[] = [];
  for (const target of KNOWN_TARGETS) {
    if (target.aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      const seed = seedFromUrl(target.url, "known-target", opts);
      if (seed) seeds.push(seed);
    }
  }
  return seeds;
}

async function discoverNpm(request: string, opts: Options): Promise<Seed[]> {
  const seeds: Seed[] = [];
  for (const name of queryCandidates(request).slice(0, 5)) {
    if (!/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name)) continue;
    const encoded = name.startsWith("@") ? name.replace("/", "%2f") : name;
    try {
      const meta = await fetchJson(`https://registry.npmjs.org/${encoded}`, opts);
      const latest = meta?.["dist-tags"]?.latest;
      const pkg = latest ? meta?.versions?.[latest] : undefined;
      const urls = [
        pkg?.homepage,
        pkg?.repository?.url,
        meta?.homepage,
        meta?.repository?.url,
        `https://www.npmjs.com/package/${name}`,
      ].filter(Boolean).map(String).map(normalizeRepositoryUrl);
      for (const url of urls) {
        const seed = seedFromUrl(url, `npm-metadata:${name}`, opts);
        if (seed) seeds.push(seed);
      }
    } catch {
      // Registry misses are expected during broad discovery.
    }
  }
  return seeds;
}

async function discoverPyPI(request: string, opts: Options): Promise<Seed[]> {
  const seeds: Seed[] = [];
  for (const name of queryCandidates(request).slice(0, 5)) {
    if (!/^[a-z0-9_.-]+$/i.test(name)) continue;
    try {
      const meta = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, opts);
      const info = meta?.info ?? {};
      const projectUrls = Object.values(info.project_urls ?? {}).map(String);
      const urls = [info.docs_url, info.home_page, ...projectUrls, `https://pypi.org/project/${name}/`].filter(Boolean).map(String);
      for (const url of urls) {
        const seed = seedFromUrl(url, `pypi-metadata:${name}`, opts);
        if (seed) seeds.push(seed);
      }
    } catch {
      // Registry misses are expected during broad discovery.
    }
  }
  return seeds;
}

async function discoverRustDocs(request: string, opts: Options): Promise<Seed[]> {
  const seeds: Seed[] = [];
  for (const name of queryCandidates(request).slice(0, 5)) {
    if (!/^[a-z0-9_-]+$/i.test(name)) continue;
    const seed = seedFromUrl(`https://docs.rs/${name}/latest/${name.replace(/-/g, "_")}/`, `docs.rs-candidate:${name}`, opts);
    if (seed) seeds.push(seed);
  }
  return seeds;
}

async function discoverGoDocs(request: string, opts: Options): Promise<Seed[]> {
  const seeds: Seed[] = [];
  const urlLike = request.match(/(?:^|\s)((?:github\.com|golang\.org|go\.uber\.org|google\.golang\.org|k8s\.io)\/[a-z0-9_./-]+)/i)?.[1];
  if (urlLike) {
    const seed = seedFromUrl(`https://pkg.go.dev/${urlLike}`, `go-pkg-candidate:${urlLike}`, opts);
    if (seed) seeds.push(seed);
  }
  return seeds;
}

async function discoverDuckDuckGo(request: string, opts: Options): Promise<Seed[]> {
  const seeds: Seed[] = [];
  const query = `${request} official documentation docs`;
  try {
    const html = await fetchRaw(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, opts);
    const links = extractSearchLinks(html.body);
    for (const link of links.slice(0, 20)) {
      const seed = seedFromUrl(link, "search-result", opts);
      if (seed) seeds.push(seed);
    }
  } catch (error) {
    debug(opts, { event: "search-discovery-failed", error: error instanceof Error ? error.message : String(error) });
  }
  return seeds;
}

function extractSearchLinks(html: string): string[] {
  const links: string[] = [];
  const hrefRe = /href=["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefRe)) {
    let href = decodeHtml(match[1]);
    if (href.startsWith("//duckduckgo.com/l/?") || href.startsWith("/l/?")) {
      try {
        const parsed = new URL(href, "https://duckduckgo.com");
        href = parsed.searchParams.get("uddg") ?? href;
      } catch {
        continue;
      }
    }
    const cleaned = cleanUrl(href);
    if (cleaned) links.push(cleaned);
  }
  return Array.from(new Set(links));
}

async function discoverSeeds(opts: Options): Promise<Seed[]> {
  const explicitUrl = extractFirstUrl(opts.request);
  const seeds: Seed[] = [];
  if (explicitUrl) {
    const direct = seedFromUrl(explicitUrl, "user-url", opts);
    if (direct) seeds.push(direct);
    // If a homepage was supplied and rejected, try to discover docs links from it without packaging the homepage.
    if (!direct) {
      try {
        const fetched = await fetchRaw(explicitUrl, opts);
        const links = extractLinksFromHtml(fetched.body, fetched.finalUrl);
        const sourceHost = normalizeHost(new URL(fetched.finalUrl).hostname);
        for (const link of links.slice(0, 100)) {
          const candidate = cleanUrl(link);
          if (!candidate) continue;
          const candidateHost = normalizeHost(new URL(candidate).hostname);
          if (!hostsRelated(sourceHost, candidateHost) && !knownDocsHost(candidateHost, opts.allowHosts)) continue;
          const seed = seedFromUrl(candidate, "user-url-linked-docs", opts);
          if (seed) seeds.push(seed);
        }
      } catch (error) {
        debug(opts, { event: "user-url-link-discovery-failed", url: explicitUrl, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  seeds.push(...await discoverKnownTargets(opts.request, opts));
  seeds.push(...await discoverNpm(opts.request, opts));
  seeds.push(...await discoverPyPI(opts.request, opts));
  seeds.push(...await discoverRustDocs(opts.request, opts));
  seeds.push(...await discoverGoDocs(opts.request, opts));
  seeds.push(...await discoverDuckDuckGo(opts.request, opts));

  return dedupeSeeds(seeds).slice(0, 6);
}

async function fetchJson(url: string, opts: Options): Promise<any> {
  const result = await fetchRaw(url, opts, "application/json,text/json,*/*;q=0.8");
  return JSON.parse(result.body);
}

async function fetchRaw(url: string, opts: Options, accept = "text/html,text/markdown,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"): Promise<FetchResult> {
  const cleaned = cleanUrl(url);
  if (!cleaned) throw new Error(`Invalid URL: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const response = await fetch(cleaned, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": `claude-skill-official-docs-pack/${VERSION}`,
      },
    });
    const body = await response.text();
    return {
      url: cleaned,
      finalUrl: response.url || cleaned,
      status: response.status,
      contentType: response.headers.get("content-type")?.toLowerCase() ?? "",
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRepositoryUrl(raw: string): string {
  let value = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  if (value.startsWith("git://github.com/")) value = value.replace("git://github.com/", "https://github.com/");
  if (value.startsWith("git@github.com:")) value = value.replace("git@github.com:", "https://github.com/");
  return value;
}

async function loadDependencies() {
  try {
    const linkedom = await import("linkedom");
    const turndownModule = await import("turndown");
    const gfmModule = await import("turndown-plugin-gfm");
    const jszipModule = await import("jszip");
    return {
      parseHTML: linkedom.parseHTML,
      TurndownService: turndownModule.default,
      gfm: gfmModule.gfm,
      JSZip: jszipModule.default,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(50, "Missing runtime dependency. Run: bun install", { error: message });
  }
}

function matchingRule(url: URL): SiteRule | undefined {
  return SITE_RULES.find((rule) => url.hostname === rule.host || url.hostname.endsWith(`.${rule.host}`));
}

function removeElements(root: ParentNode, selector: string): void {
  if (!selector.trim()) return;
  for (const node of Array.from(root.querySelectorAll(selector))) node.remove();
}

function absolutizeLinks(root: ParentNode, base: string): void {
  for (const node of Array.from(root.querySelectorAll("a[href]"))) {
    const href = node.getAttribute("href");
    if (!href) continue;
    try { node.setAttribute("href", new URL(href, base).href); } catch { /* ignore */ }
  }
  for (const node of Array.from(root.querySelectorAll("img[src]"))) {
    const src = node.getAttribute("src");
    if (!src) continue;
    try { node.setAttribute("src", new URL(src, base).href); } catch { /* ignore */ }
  }
}

function chooseContent(document: Document, includeSelector: string): { html: string; selector: string; textLength: number } {
  const ranked = Array.from(document.querySelectorAll(includeSelector))
    .map((node) => ({ node, textLength: (node.textContent ?? "").replace(/\s+/g, " ").trim().length }))
    .sort((a, b) => b.textLength - a.textLength);
  const best = ranked[0];
  if (best && best.textLength >= 200) return { html: (best.node as Element).outerHTML, selector: includeSelector, textLength: best.textLength };
  const body = document.body;
  return { html: body?.innerHTML ?? document.documentElement.outerHTML, selector: "body", textLength: (body?.textContent ?? "").replace(/\s+/g, " ").trim().length };
}

function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function isMarkdownResponse(contentType: string, url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return contentType.includes("markdown") || path.endsWith(".md") || path.endsWith(".markdown");
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const hrefs = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)).map((m) => decodeHtml(m[1]));
  const links: string[] = [];
  for (const href of hrefs) {
    try {
      const parsed = new URL(href, baseUrl);
      const cleaned = cleanUrl(parsed.href);
      if (cleaned) links.push(cleaned);
    } catch {
      // ignore malformed links
    }
  }
  return Array.from(new Set(links));
}

function extractTitle(document: Document, markdown: string): string {
  const h1 = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
  if (h1) return h1;
  const title = document.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim();
  if (title) return title;
  const mdHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return mdHeading || "Untitled documentation page";
}

function extractHeadings(markdown: string): string[] {
  return Array.from(markdown.matchAll(/^#{1,3}\s+(.+)$/gm)).map((m) => m[1].trim()).slice(0, 24);
}

async function pageToMarkdown(fetched: FetchResult, depth: number, opts: Options): Promise<{ page: Page; links: string[] }> {
  const { parseHTML, TurndownService, gfm } = await loadDependencies();
  const finalUrl = cleanUrl(fetched.finalUrl || fetched.url) ?? fetched.url;
  const parsedUrl = new URL(finalUrl);
  const fetchedAt = new Date().toISOString();

  if (fetched.status < 200 || fetched.status >= 300) {
    throw new Error(`HTTP ${fetched.status}`);
  }
  if (BAD_EXTENSIONS.test(parsedUrl.pathname)) {
    throw new Error("binary-or-asset");
  }

  if (isMarkdownResponse(fetched.contentType, finalUrl)) {
    const markdown = cleanMarkdown(fetched.body);
    if (markdown.length < 80) throw new Error("markdown-output-too-short");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || parsedUrl.pathname.split("/").filter(Boolean).pop() || parsedUrl.hostname;
    return {
      page: {
        url: fetched.url,
        finalUrl,
        host: normalizeHost(parsedUrl.hostname),
        title,
        path: stableDocPath(finalUrl, title),
        depth,
        markdown,
        headings: extractHeadings(markdown),
        fetchedAt,
        selector: "markdown-native",
      },
      links: [],
    };
  }

  const { document } = parseHTML(fetched.body);
  const links = extractLinksFromHtml(fetched.body, finalUrl);
  absolutizeLinks(document, finalUrl);
  const rule = matchingRule(parsedUrl);
  const includeSelector = rule?.include ?? DEFAULT_INCLUDE;
  const excludeSelector = [DEFAULT_EXCLUDE, rule?.exclude].filter(Boolean).join(",");
  removeElements(document, excludeSelector);
  removeElements(document, "[hidden],[aria-hidden='true']");

  const selected = chooseContent(document, includeSelector);
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
  turndown.use(gfm);
  const markdown = cleanMarkdown(turndown.turndown(selected.html));
  if (markdown.length < 80) throw new Error("markdown-output-too-short");
  const title = extractTitle(document, markdown);

  return {
    page: {
      url: fetched.url,
      finalUrl,
      host: normalizeHost(parsedUrl.hostname),
      title,
      path: stableDocPath(finalUrl, title),
      depth,
      markdown,
      headings: extractHeadings(markdown),
      fetchedAt,
      selector: selected.selector,
    },
    links,
  };
}

function stableDocPath(url: string, title: string): string {
  const parsed = new URL(url);
  const raw = `${normalizeHost(parsed.hostname)}-${parsed.pathname}`.replace(/\/index\.?[a-z]*$/i, "");
  const slug = slugify(raw || title).slice(0, 90) || "docs-page";
  return `docs/${slug}-${shortHash(url)}.md`;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/https?:\/\//g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function shortHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function decodeHtml(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function canCrawlLink(link: string, seeds: Seed[], opts: Options): { ok: boolean; reason: string } {
  const cleaned = cleanUrl(link);
  if (!cleaned) return { ok: false, reason: "invalid-url" };
  const url = new URL(cleaned);
  const host = normalizeHost(url.hostname);
  if (isRejectedHost(host)) return { ok: false, reason: "rejected-host" };
  if (BAD_EXTENSIONS.test(url.pathname)) return { ok: false, reason: "asset" };
  if (hasBadPath(url.pathname)) return { ok: false, reason: "bad-path" };

  const matchingSeed = seeds.find((seed) => seed.host === host || host.endsWith(`.${seed.host}`) || seed.host.endsWith(`.${host}`));
  if (!matchingSeed) {
    // Cross-host crawling requires independently trusted host provenance for this run.
    // A docs-shaped hostname/path alone is intentionally insufficient here.
    if (!knownDocsHost(host, opts.allowHosts)) return { ok: false, reason: "outside-trusted-docs-host" };
    const accepted = isAcceptedOfficialDocs(cleaned, opts);
    return accepted.ok ? { ok: true, reason: "accepted-related-official-docs" } : { ok: false, reason: "outside-docs-host" };
  }
  if (matchingSeed.rootPath !== "/" && !url.pathname.startsWith(matchingSeed.rootPath)) {
    return { ok: false, reason: "outside-docs-root" };
  }
  if (hasDocsPath(url.pathname) || matchingSeed.rootPath !== "/" || knownDocsHost(host, opts.allowHosts)) {
    return { ok: true, reason: "inside-docs-scope" };
  }
  return { ok: false, reason: "weak-docs-link" };
}

async function crawl(seeds: Seed[], opts: Options): Promise<{ pages: Page[]; skipped: Skipped[]; failures: Failure[] }> {
  const queue: Array<{ url: string; depth: number }> = seeds.map((seed) => ({ url: seed.url, depth: 0 }));
  const seen = new Set<string>();
  const pages: Page[] = [];
  const skipped: Skipped[] = [];
  const failures: Failure[] = [];

  while (queue.length > 0 && pages.length < opts.maxPages) {
    const item = queue.shift()!;
    const cleaned = cleanUrl(item.url);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);

    const allowed = canCrawlLink(cleaned, seeds, opts);
    if (!allowed.ok) {
      skipped.push({ url: cleaned, reason: allowed.reason });
      continue;
    }

    try {
      const fetched = await fetchRaw(cleaned, opts);
      const { page, links } = await pageToMarkdown(fetched, item.depth, opts);
      pages.push(page);
      debug(opts, { event: "page-added", url: page.finalUrl, path: page.path, depth: item.depth });

      if (item.depth < opts.maxDepth) {
        for (const link of links) {
          const next = cleanUrl(link);
          if (!next || seen.has(next)) continue;
          const ok = canCrawlLink(next, seeds, opts);
          if (ok.ok) queue.push({ url: next, depth: item.depth + 1 });
          else if (skipped.length < 500) skipped.push({ url: next, reason: ok.reason });
        }
      }
    } catch (error) {
      failures.push({ url: cleaned, reason: error instanceof Error ? error.message : String(error) });
      debug(opts, { event: "page-failed", url: cleaned, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { pages, skipped: dedupeSkipped(skipped), failures };
}

function dedupeSkipped(skipped: Skipped[]): Skipped[] {
  const seen = new Set<string>();
  const result: Skipped[] = [];
  for (const item of skipped) {
    const key = `${item.url}|${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.slice(0, 1000);
}

function pageFrontmatter(page: Page): string {
  return [
    "---",
    `title: ${JSON.stringify(page.title)}`,
    `source_url: ${JSON.stringify(page.finalUrl)}`,
    `host: ${JSON.stringify(page.host)}`,
    `depth: ${page.depth}`,
    `selector: ${JSON.stringify(page.selector)}`,
    `fetched_at: ${JSON.stringify(page.fetchedAt)}`,
    "---",
    "",
  ].join("\n");
}

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeSourcesCsv(pages: Page[]): string {
  const rows = [["path", "title", "url", "host", "depth", "status"]];
  for (const page of pages) rows.push([page.path, page.title, page.finalUrl, page.host, String(page.depth), "packaged"]);
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function makeReadme(opts: Options, seeds: Seed[], pages: Page[], skipped: Skipped[], failures: Failure[]): string {
  const seedLines = seeds.map((seed) => `- ${seed.url} (${seed.reason}, root: ${seed.rootPath})`).join("\n") || "- None";
  return `# Official Documentation Pack

Generated: ${new Date().toISOString()}
Request: ${opts.request}

This ZIP contains only pages accepted by the official-docs source policy. Discovery may inspect search or package metadata, but packaged content is limited to verified documentation pages.

## Contents

- Full pages: ${pages.length}
- Verified seeds: ${seeds.length}
- Skipped/rejected links recorded: ${skipped.length}
- Fetch/extraction failures recorded: ${failures.length}

## Verified Seed URLs

${seedLines}

## How Agents Should Use This Pack

1. Read \`AGENT_INDEX.md\` for navigation.
2. Search \`index/chunks.jsonl\` for relevant terms.
3. Open the matching \`docs/*.md\` file for full context.
4. Cite or reason from \`source_url\` frontmatter, not from memory.

## Source Policy Summary

Accepted content must be first-party documentation, known official documentation, official generated API docs, official repository docs, or documentation URLs from official package metadata. Unofficial tutorials, Q&A, blogs, mirrors, forums, login-gated pages, and binary assets are excluded.
`;
}

function makeAgentIndex(pages: Page[]): string {
  const lines = ["# Agent Index", "", "Use this file as the navigation map. Open full pages under `docs/` for complete source context.", ""];
  for (const page of pages.sort((a, b) => a.path.localeCompare(b.path))) {
    lines.push(`## ${page.title}`);
    lines.push("");
    lines.push(`- Path: \`${page.path}\``);
    lines.push(`- Source: ${page.finalUrl}`);
    lines.push(`- Host: ${page.host}`);
    lines.push(`- Depth: ${page.depth}`);
    if (page.headings.length) {
      lines.push(`- Headings: ${page.headings.slice(0, 8).join("; ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function chunksForPage(page: Page): Array<Record<string, unknown>> {
  const chunks: Array<Record<string, unknown>> = [];
  const maxChars = 4200;
  const blocks = page.markdown.split(/\n(?=#{1,3}\s+)/g);
  let buffer = "";
  let heading = page.title;
  let index = 0;

  function flush() {
    const text = buffer.trim();
    if (!text) return;
    chunks.push({ path: page.path, url: page.finalUrl, title: page.title, heading, chunk_index: index++, text });
    buffer = "";
  }

  for (const block of blocks) {
    const blockHeading = block.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
    if (blockHeading) heading = blockHeading;
    if ((buffer + "\n\n" + block).length > maxChars) flush();
    if (block.length > maxChars) {
      for (let i = 0; i < block.length; i += maxChars) {
        buffer = block.slice(i, i + maxChars);
        flush();
      }
    } else {
      buffer = buffer ? `${buffer}\n\n${block}` : block;
    }
  }
  flush();
  return chunks;
}

function makeChunksJsonl(pages: Page[]): string {
  return pages.flatMap(chunksForPage).map((chunk) => JSON.stringify(chunk)).join("\n") + "\n";
}

async function writeZip(opts: Options, seeds: Seed[], pages: Page[], skipped: Skipped[], failures: Failure[]): Promise<Record<string, unknown>> {
  const { JSZip } = await loadDependencies();
  const zip = new JSZip();
  const manifest = {
    status: "ok",
    generator: "official-docs-pack",
    version: VERSION,
    generated_at: new Date().toISOString(),
    request: opts.request,
    settings: { max_pages: opts.maxPages, max_depth: opts.maxDepth, timeout_ms: opts.timeoutMs, allow_hosts: opts.allowHosts },
    seeds,
    pages: pages.map((page) => ({ path: page.path, title: page.title, url: page.finalUrl, host: page.host, depth: page.depth, headings: page.headings, selector: page.selector, fetched_at: page.fetchedAt })),
    skipped,
    failures,
  };

  zip.file("README.md", makeReadme(opts, seeds, pages, skipped, failures));
  zip.file("AGENT_INDEX.md", makeAgentIndex(pages));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("sources.csv", makeSourcesCsv(pages));
  zip.file("index/chunks.jsonl", makeChunksJsonl(pages));
  for (const page of pages) {
    zip.file(page.path, pageFrontmatter(page) + page.markdown + "\n");
  }

  const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await Bun.write(opts.out, content);
  return { ...manifest, output_zip: opts.out, zip_bytes: content.length };
}

async function main(): Promise<void> {
  const opts = parseArgs(Bun.argv.slice(2));
  const seeds = await discoverSeeds(opts);
  debug(opts, { event: "seeds", seeds });
  if (!seeds.length) fail(10, "No verified official documentation seed found", { request: opts.request });

  const { pages, skipped, failures } = await crawl(seeds, opts);
  if (!pages.length) fail(30, "No usable official docs pages extracted", { request: opts.request, seeds, failures });

  const summary = await writeZip(opts, seeds, pages, skipped, failures);
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Created ${opts.out}`);
    console.log(`Packaged ${pages.length} official docs pages from ${seeds.length} verified seed(s).`);
    if (failures.length) console.log(`Recorded ${failures.length} fetch/extraction failure(s) in manifest.json.`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(40, "Unexpected doc pack failure", { error: message });
});
