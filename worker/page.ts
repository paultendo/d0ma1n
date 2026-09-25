import type { ScanResult, DomainVariant, ReverseScanResult } from "../src/types.js";

/** Facts the homepage shows, computed by the worker from the scanner's own data. */
export type LandingData = {
  examples: Array<{
    real: string; fake: string; index: number; original: string; char: string; codepoint: string; name: string;
    block: string; similarity: number; registrable: boolean; punycode: string;
    registration: { registered: boolean; since?: string; registrar?: string } | null;
  }>;
  fontStrip: Array<{ font: string; danger: number | null }>;
  strip: { real: string; fake: string };
  registries: Array<{ tld: string; accepts: boolean | null; rule: string; assumed: boolean }>;
  stats: { tlds: number; fonts: number };
};

/** Generate the main landing page HTML. */
export function renderLandingPage(data: LandingData): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>d0ma1n - Lookalike domains you can't see</title>
  <meta name="description" content="Lookalike domains, measured glyph by glyph and checked against every TLD's registry rules. Find the fakes of your domain before someone registers them.">
  <meta property="og:title" content="d0ma1n - Lookalike domains you can't see">
  <meta property="og:description" content="Find the lookalikes of your domain that someone could register, measured glyph by glyph.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://d0ma1n.app">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  ${STYLES}
</head>
<body class="home">
  <div class="container">
    <header class="topbar">
      <a href="/" class="logo">d<span>0</span>ma<span>1</span>n</a>
      <nav aria-label="Sections">
        <a href="#method">Method</a><a href="#fonts">Fonts</a><a href="#registries">Registries</a><a href="#report">Report</a>
        <a href="https://github.com/paultendo/d0ma1n">GitHub</a>
      </nav>
    </header>
    ${homeSpecimen()}
    ${RESULTS_CONTAINER}
    ${homeMethod()}
    ${homeFonts(data)}
    ${homeRegistries(data)}
    ${homeReport()}
    ${homeNumbers(data)}
    <section class="closing">
      <h2>Check your own domain</h2>
      <button type="button" onclick="scanFromTop()">Scan a domain</button>
    </section>
    ${FOOTER}
  </div>
  ${SCRIPT}
  <script>window.HOME = ${json};</script>
  ${HOME_SCRIPT}
</body>
</html>`;
}

function homeSpecimen(): string {
  return `
<section class="specimen" id="specimen">
  <p class="kicker">Example <span id="spec-n">1</span> of <span id="spec-total">5</span>. One of these is not the real domain.</p>
  <h1 class="headline">Which one is the real <em id="brand">google.com</em>?</h1>
  <div class="plates" id="plates">
    <button type="button" class="plate" data-side="0"><span class="plate-tag">A</span><span class="plate-stamp"></span><span class="plate-domain" id="plate-0"></span></button>
    <button type="button" class="plate" data-side="1"><span class="plate-tag">B</span><span class="plate-stamp"></span><span class="plate-domain" id="plate-1"></span></button>
  </div>
  <div class="verdict" id="verdict" aria-live="polite"></div>
  <div class="try">
    <p class="try-label">Your domain</p>
    <form class="scan-form" action="javascript:void(0)" onsubmit="doScan()">
      <input type="text" id="domain-input" placeholder="yourcompany.com" autocomplete="off" spellcheck="false" aria-label="Domain to scan">
      <button type="submit" id="scan-btn">Scan</button>
    </form>
  </div>
</section>`;
}

function homeMethod(): string {
  return `
<section class="sec reveal-up" id="method">
  <div class="sec-head"><div>
    <h2>How d0ma1n measures a lookalike</h2>
    <p class="lede">The lookalike data comes from <a href="https://github.com/paultendo/confusable-vision">confusable-vision</a>, an open-source project that measures how alike two characters look.</p>
    <p class="lede">It casts parallel rays through each character&rsquo;s outline at 36 angles and records where each ray crosses ink. When two characters cross in the same places at every angle, at the same size and on the same baseline, a reader will take one for the other. <a href="https://github.com/paultendo/confusable-vision/blob/main/docs/metric-calibration.md">How the method was tested</a></p>
    <p class="lede">Below, your browser draws the letter o and the small capital <span class="swapch">&#x1D0F;</span> and compares them one angle at a time.</p>
  </div></div>
  <div class="raylab">
    <figure><canvas id="ray-a" width="320" height="320" aria-label="The Latin letter o, with rays crossing it"></canvas>
      <div class="bars" id="bars-a" aria-hidden="true"></div>
      <figcaption><span class="mono">U+006F</span><span>Latin small letter o</span></figcaption></figure>
    <div class="raylab-mid" aria-live="polite">
      <div class="big" id="ray-angle">0&deg;</div><div class="lbl">ray angle</div>
      <div class="big" id="ray-diff" style="margin-top:1.4rem">0</div><div class="lbl">crossings that differ</div>
      <div class="match" id="ray-match">same signature</div>
    </div>
    <figure><canvas id="ray-b" width="320" height="320" aria-label="The small capital letter ᴏ, with rays crossing it"></canvas>
      <div class="bars" id="bars-b" aria-hidden="true"></div>
      <figcaption><span class="mono">U+1D0F</span><span>Latin letter small capital o</span></figcaption></figure>
  </div>
  <div class="chips" role="group" aria-label="Font">
    <button type="button" class="chip" data-font="Arial" aria-pressed="true">Arial</button>
    <button type="button" class="chip" data-font="Times New Roman" aria-pressed="false">Times New Roman</button>
    <button type="button" class="chip" data-font="Georgia" aria-pressed="false">Georgia</button>
    <button type="button" class="chip" data-font="Verdana" aria-pressed="false">Verdana</button>
  </div>
  <p class="footnote">This demonstration uses 25 rays at one angle at a time. The published measurements use 50 rays at each of 36 angles, in every macOS system font and in Roboto, and test shape and size separately.</p>
</section>`;
}

function homeFonts(data: LandingData): string {
  const { real, fake } = data.strip;
  const mark = (w: string) => [...w].map((c, i) => (c !== [...real][i] ? `<mark>${escHtml(c)}</mark>` : escHtml(c))).join("");
  // The stamp is graded live in the browser (the glyphs the visitor actually sees, fallback included); the line under it
  // is the published per-font measurement, where the font has the character at all
  const cards = data.fontStrip.map(({ font, danger }) => {
    const f = escHtml(font);
    const measured = danger === null ? "" : danger >= 0.95 ? `Measured identical in ${f}` : `Measured alike in ${f}, ${Math.round(danger * 100)}%`;
    return `<div class="spec" data-font="${f}" data-measured="${escHtml(measured)}"><span class="spec-font">${f}</span>
      <div class="spec-words" style="font-family:'${f}', var(--font-specimen)"><span>${escHtml(real)}</span><span>${mark(fake)}</span></div>
      <span class="stamp">&nbsp;</span><span class="spec-note"></span></div>`;
  }).join("");
  return `
<section class="sec reveal-up" id="fonts">
  <div class="sec-head"><div>
    <h2>The same lookalike in eight fonts</h2>
    <p class="lede">Whether a swap shows depends on the font. In Arial, <span class="swapch">&#x1D0F;</span> and o are identical; in Georgia they are not. When a font doesn&rsquo;t include a character, the browser draws it with another font, and that substitute can be just as convincing. Each card is graded from what your browser actually draws.</p>
  </div></div>
  <div class="specimens">${cards}</div>
  <p class="footnote">The grade is the share of ink the two glyphs have in common when drawn at the same size on the same baseline. Where the font includes <span class="swapch">&#x1D0F;</span>, the card also gives the published measurement for that font. 448 of the 857 measured pairs are lookalikes only because the browser substitutes a font like this.</p>
</section>`;
}

function homeRegistries(data: LandingData): string {
  const tiles = data.registries.map((r, i) => {
    const cls = r.accepts === null ? "unknown" : r.accepts ? "yes" : "no";
    const verdict = r.accepts === null ? "rules unknown"
      : r.accepts ? "accepts"
      : r.rule === "ascii" ? (r.assumed ? "ASCII only (assumed)" : "ASCII only") : "refuses";
    return `<div class="tile ${cls}" style="transition-delay:${i * 45}ms"><div class="tile-tld">.${escHtml(r.tld)}</div><div class="tile-v">${verdict}</div></div>`;
  }).join("");
  return `
<section class="sec reveal-up" id="registries">
  <div class="sec-head"><div>
    <h2>Can someone register it?</h2>
    <p class="lede">Each registry decides which characters it accepts in a domain name, so a lookalike that .com would sell may be refused by .de. d0ma1n checks every result against the rules of its own TLD. These are the verdicts for g<span class="swapch">&#x1D0F;</span>ogle at twelve of them.</p>
    <p class="lede"><span class="swapch">&#x1D0F;</span> is a Latin letter, so g<span class="swapch">&#x1D0F;</span>ogle is written in a single script. Registries refuse labels that mix scripts, such as google with a Cyrillic &#x43E;, and d0ma1n applies the same rule.</p>
  </div></div>
  <div class="board">${tiles}</div>
  <div class="board-note"><span class="seg"><span><b>${data.stats.tlds.toLocaleString("en-GB")}</b> TLDs with known rules</span><span>IANA IDN tables</span><span>ICANN registry agreement</span><span>Country-code registry policies</span></span></div>
</section>`;
}

function homeReport(): string {
  return `
<section class="sec reveal-up" id="report">
  <div class="sec-head"><div>
    <h2>The report</h2>
    <p class="lede">A scan lists registered lookalikes first, including any with mail servers, since those can send phishing email. Next come the ones still available to register, then the ones no registry would accept. Each result names the swapped character and the font in which it is hardest to spot.</p>
  </div></div>
  <div class="window">
    <div class="window-bar"><i></i><i></i><i></i><span class="window-url">d0ma1n.app/scan/paypal.com</span></div>
    <div class="window-body"><div id="preview"><div class="loading"><div class="spinner"></div><p>Loading a live scan&hellip;</p></div></div></div>
  </div>
  <div class="window-caption"><span>Live scan of paypal.com</span><a href="/scan/paypal.com">Open the full report</a></div>
</section>`;
}

function homeNumbers(data: LandingData): string {
  return `
<section class="sec reveal-up" id="data">
  <div class="sec-head"><div>
    <h2>Where the data comes from</h2>
    <p class="lede">d0ma1n and its data are open source. confusable-vision measures which characters look alike, namespace-guard packages those measurements as a library, and d0ma1n adds registry rules and DNS checks.</p>
  </div></div>
  <div class="numbers">
    <div class="num"><div class="num-v">857</div><div class="num-k">lookalike pairs, measured at the size characters appear in text and checked against pairs with known answers</div>
      <div class="num-src"><span class="seg"><a href="https://github.com/paultendo/confusable-vision">confusable-vision</a><span>CC-BY-4.0</span></span></div></div>
    <div class="num"><div class="num-v">${data.stats.fonts}</div><div class="num-k">fonts with their own scores, so a report can name the font in which a lookalike is hardest to spot</div>
      <div class="num-src"><span class="seg"><a href="https://www.npmjs.com/package/namespace-guard">namespace-guard</a><span>MIT</span></span></div></div>
    <div class="num"><div class="num-v">${data.stats.tlds.toLocaleString("en-GB")}</div><div class="num-k">TLDs whose registry rules are checked for every result</div>
      <div class="num-src"><span class="seg"><a href="https://github.com/paultendo/d0ma1n">d0ma1n</a><span>MIT</span></span></div></div>
  </div>
</section>`;
}

/** Generate a shareable scan results page with embedded data (no second request). */
export function renderScanPage(result: ScanResult): string {
  const desc = `${result.original}: ${result.totalGenerated} confusable variants found.`;
  // Escape for safe embedding in <script> tag
  const jsonData = JSON.stringify(result).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>d0ma1n - ${escHtml(result.original)}</title>
  <meta name="description" content="${escHtml(desc)}">
  <meta property="og:title" content="d0ma1n - ${escHtml(result.original)}">
  <meta property="og:description" content="${escHtml(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://d0ma1n.app/scan/${escHtml(result.original)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  ${STYLES}
</head>
<body>
  <div class="container">
    <header class="hero hero--compact">
      <a href="/" class="logo">d<span>0</span>ma<span>1</span>n</a>
      <p class="tagline">Scan results for <strong>${escHtml(result.original)}</strong></p>
      <form class="scan-form" action="javascript:void(0)" onsubmit="doScan()">
        <input type="text" id="domain-input" value="${escHtml(result.original)}" placeholder="yourcompany.com" autocomplete="off" spellcheck="false">
        <button type="submit" id="scan-btn">Scan</button>
      </form>
    </header>
    ${RESULTS_CONTAINER}
    ${FOOTER}
  </div>
  ${SCRIPT}
  <script>
    // Render embedded data immediately (no second request)
    document.addEventListener('DOMContentLoaded', () => {
      const data = ${jsonData};
      const results = document.getElementById('results');
      renderResults(data, results);
    });
  </script>
</body>
</html>`;
}

/** Terms of use page. */
export function renderTermsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>d0ma1n - Terms of use</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  ${STYLES}
  <style>.terms h2 { font-size:1.25rem; margin:2rem 0 0.75rem; } .terms p, .terms li { color:var(--text-dim); line-height:1.7; margin-bottom:0.75rem; } .terms ul { padding-left:1.5rem; } .terms a { color:var(--accent-bright); }</style>
</head>
<body>
  <div class="container">
    <header class="hero hero--compact">
      <a href="/" class="logo">d<span>0</span>ma<span>1</span>n</a>
    </header>
    <div class="terms" style="max-width:700px;margin:0 auto;padding-bottom:4rem">
      <h1 style="font-size:1.5rem;margin-bottom:2rem">Terms of use</h1>

      <h2>Purpose</h2>
      <p>d0ma1n is a brand protection and security research tool. It helps domain owners, security teams, and researchers identify visually confusable domain variants that could be used for phishing or impersonation.</p>

      <h2>Acceptable use</h2>
      <p>You may use this service for:</p>
      <ul>
        <li>Monitoring your own domains and brands for lookalike threats</li>
        <li>Security research and academic study of Unicode confusable attacks</li>
        <li>Gathering evidence for UDRP complaints, trademark enforcement, or abuse reports</li>
        <li>Defensive security assessments and penetration testing with proper authorisation</li>
      </ul>

      <h2>Prohibited use</h2>
      <p>You may <strong>not</strong> use this service to:</p>
      <ul>
        <li>Identify or register domains for phishing, impersonation, or fraud</li>
        <li>Facilitate cybersquatting or typosquatting</li>
        <li>Conduct any activity that infringes on the trademarks or intellectual property of others</li>
        <li>Circumvent rate limits or scrape results at scale without permission</li>
      </ul>

      <h2>No warranty</h2>
      <p>This service is provided as-is. Scan results reflect algorithmic analysis of visual similarity and DNS records. They do not constitute legal advice. Consult a qualified professional for trademark or legal matters.</p>

      <h2>Rate limiting</h2>
      <p>To prevent abuse, requests are rate-limited. Excessive or automated use may result in temporary or permanent blocking.</p>

      <h2>Data</h2>
      <p>Scan results may be cached for up to one hour to improve performance. No personal data is collected or stored beyond what is necessary to process requests (IP addresses for rate limiting, retained in memory only).</p>

      <h2>Contact</h2>
      <p>For questions, abuse reports, or takedown requests: <a href="https://github.com/paultendo/d0ma1n/issues">open an issue on GitHub</a>.</p>

      <p style="margin-top:2rem;font-size:0.85rem;color:var(--text-dim)">Last updated: February 2026.</p>
    </div>
    ${FOOTER}
  </div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Inline CSS ---

const STYLES = `<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0e0d0b;
    --bg-card: #171512;
    --bg-input: #1b1915;
    --border: #2f2b24;
    --text: #ece5d6;
    --text-dim: #9a9284;
    --paper: #efe8da;
    --ink: #16140f;
    --ink-dim: #6d665a;
    --accent: #ff5a36;
    --accent-bright: #ff8062;
    --danger-high: #ff5a36;
    --danger-mid: #e3a43b;
    --danger-low: #8fbf6a;
    --active-threat: #ff3b1f;
    --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
    --font-body: 'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif;
    --font-specimen: Arial, 'Helvetica Neue', sans-serif;
  }

  body {
    font-family: var(--font-body);
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  /* Hero */
  .hero {
    text-align: center;
    padding: 5rem 0 3rem;
  }
  .hero--compact { padding: 2rem 0 1.5rem; }

  .logo {
    font-family: var(--font-mono);
    font-size: 3.5rem;
    font-weight: 700;
    color: var(--text);
    text-decoration: none;
    letter-spacing: -0.02em;
    display: inline-block;
  }
  .logo span { color: var(--accent-bright); }

  .tagline {
    font-size: 1.25rem;
    color: var(--text-dim);
    margin: 0.75rem 0 2.5rem;
  }

  /* Scan form */
  .scan-form {
    display: flex;
    gap: 0;
    max-width: 520px;
    margin: 0 auto;
  }
  .scan-form input {
    flex: 1;
    padding: 0.875rem 1.25rem;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-right: none;
    border-radius: 8px 0 0 8px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .scan-form input:focus { border-color: var(--accent); }
  .scan-form input::placeholder { color: var(--text-dim); }

  .scan-form button {
    padding: 0.875rem 2rem;
    background: var(--accent);
    color: var(--ink);
    border: none;
    border-radius: 0 8px 8px 0;
    font-family: var(--font-body);
    font-size: 1.05rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  .scan-form button:hover { background: var(--accent-bright); }
  .scan-form button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Results */
  #results { margin: 2rem 0 4rem; scroll-margin-top: 1.5rem; }

  .results-meta {
    font-size: 0.875rem;
    color: var(--text-dim);
    margin-bottom: 1rem;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  .results-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-dim);
    font-weight: 500;
    font-size: 0.85rem;
  }
  .results-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    vertical-align: middle;
  }
  .results-table tr:hover td {
    background: color-mix(in srgb, var(--paper) 4%, transparent);
  }

  .domain-cell {
    font-family: var(--font-mono);
    font-size: 0.9rem;
  }
  .domain-original {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-top: 2px;
  }
  mark.diff {
    background: color-mix(in srgb, var(--danger-mid) 22%, transparent);
    color: inherit;
    border-bottom: 2px solid var(--danger-mid);
    border-radius: 2px;
  }
  .swaps {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .swap {
    font-family: var(--font-mono);
    font-variant-ligatures: none;
    font-size: 0.7rem;
    color: var(--text-dim);
    padding: 0 0.3rem;
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .swap-note {
    font-size: 0.7rem;
    color: var(--text-dim);
    opacity: 0.8;
    margin-top: 2px;
  }
  .swap-cp {
    opacity: 0.7;
  }

  .danger-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.85rem;
    font-family: var(--font-body);
    font-variant-numeric: tabular-nums;
  }
  .danger-high { background: color-mix(in srgb, var(--danger-high) 16%, transparent); color: var(--danger-high); }
  .danger-mid { background: color-mix(in srgb, var(--danger-mid) 16%, transparent); color: var(--danger-mid); }
  .danger-low { background: color-mix(in srgb, var(--danger-low) 16%, transparent); color: var(--danger-low); }

  .threat-active {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--active-threat);
    color: var(--ink);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .threat-parked {
    color: var(--danger-mid);
    font-size: 0.8rem;
  }
  .threat-open {
    color: var(--text);
    font-size: 0.8rem;
  }
  .explainer {
    margin-top: 0.75rem;
    max-width: 46rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-dim);
  }
  .legend {
    margin-top: 1.75rem;
    max-width: 46rem;
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--text-dim);
  }
  .legend strong { color: var(--text); font-weight: 600; }
  .results-table td > .punycode {
    margin-top: 4px;
    font-size: 0.7rem;
    opacity: 0.75;
  }
  .results-table .font-label {
    display: block;
    margin-top: 4px;
    font-size: 0.7rem;
  }
  .threat-none {
    color: var(--text-dim);
    font-size: 0.8rem;
  }

  /* Segmented pill: related facts in one square outline, divided by hairlines */
  .seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--border); border-radius: 3px; vertical-align: middle;
    overflow: hidden; }
  /* Hairlines on each segment's top and left edge: the outline clips them on the first row and column, so a pill that
     wraps still has a divider between every segment */
  .seg > * { flex: 1 1 auto; padding: 0.28rem 0.7rem; box-shadow: -1px 0 0 var(--border), 0 -1px 0 var(--border); }
  .seg b { font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .seg .hot, .seg .hot b { color: var(--danger-high); }
  .seg.tag > * { padding: 0.08rem 0.45rem; font-size: 0.8rem; color: var(--text); }
  .seg.tag > * + * { color: var(--text-dim); }

  .script-tag {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 0.7rem;
    color: var(--text);
    font-size: 0.8rem;
    margin-right: 0.25rem;
  }

  .punycode {
    font-family: var(--font-mono);
    font-variant-ligatures: none;
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  .font-label {
    font-size: 0.75rem;
    color: var(--text-dim);
  }


  .alert-banner {
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--danger-high) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger-high) 35%, transparent);
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: var(--danger-high);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-dim);
  }
  .loading .spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 0.5rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---------- Homepage: the evidence room ---------- */
  body.home {
    background:
      radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--paper) 7%, transparent), transparent 70%),
      var(--bg);
  }
  body.home::before {
    /* film grain, so the dark reads as a room rather than a void */
    content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 50; opacity: 0.06; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  .home .container { max-width: 1180px; }
  .mono { font-family: var(--font-mono); }

  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding-top: 1.5rem; padding-bottom: 1.5rem;
  }
  .topbar .logo { font-size: 1.35rem; font-weight: 600; }
  .topbar nav { display: flex; gap: 1.75rem; flex-wrap: wrap; }
  .topbar nav a {
    font-size: 1.05rem; color: var(--text-dim); text-decoration: none; transition: color 0.2s;
  }
  .topbar nav a:hover { color: var(--text); }
  .logo span { color: var(--accent); }

  .kicker { font-size: 1rem; color: var(--text-dim); }

  /* Hero: spot the fake */
  .specimen { padding: 3.5rem 0 2rem; }
  .headline {
    font-family: var(--font-body); font-weight: 600; font-size: clamp(2.4rem, 6vw, 5.2rem);
    line-height: 1; letter-spacing: -0.035em; margin: 1.1rem 0 2.6rem; text-wrap: balance;
  }
  .headline em { font-style: normal; color: var(--paper); }
  .plates { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  .plate {
    position: relative; text-align: left; cursor: pointer; border: 0; border-radius: 4px;
    background: var(--paper); color: var(--ink); padding: 2.4rem 2rem 2.1rem;
    box-shadow: 0 1px 0 rgba(255,255,255,0.4) inset, 0 30px 60px -30px rgba(0,0,0,0.8);
    transition: transform 0.35s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s;
    opacity: 0; transform: translateY(18px);
    animation: rise 0.8s cubic-bezier(.2,.8,.2,1) forwards;
  }
  .plate + .plate { animation-delay: 0.12s; }
  @keyframes rise { to { opacity: 1; transform: none; } }
  .plate:hover:not([disabled]) { transform: translateY(-4px); box-shadow: 0 1px 0 rgba(255,255,255,0.4) inset, 0 40px 70px -30px rgba(0,0,0,0.9); }
  .plate:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .plate[disabled] { cursor: default; }
  .plate-tag {
    position: absolute; top: 0.9rem; left: 1rem; font-size: 0.85rem; color: var(--ink-dim);
  }
  .plate-stamp {
    position: absolute; top: 0.8rem; right: 1rem; font-size: 0.8rem; font-weight: 600;
    letter-spacing: 0.08em; padding: 0.1rem 0.5rem; border: 1.5px solid currentColor; border-radius: 3px;
    transform: rotate(-4deg) scale(1.6); opacity: 0; transition: all 0.35s cubic-bezier(.2,1.6,.4,1);
  }
  .plate.is-fake .plate-stamp { color: var(--accent); }
  .plate.is-real .plate-stamp { color: var(--ink-dim); }
  .revealed .plate-stamp { opacity: 1; transform: rotate(-4deg) scale(1); }
  .plate-domain {
    display: block; font-family: var(--font-specimen); font-size: clamp(1.9rem, 4.4vw, 3.9rem);
    letter-spacing: -0.01em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .plate-domain .ch { position: relative; }
  .loupe {
    position: absolute; pointer-events: none; border-radius: 50%; border: 2px solid var(--accent);
    box-shadow: 0 0 0 9999px color-mix(in srgb, var(--paper) 0%, transparent), 0 0 30px color-mix(in srgb, var(--accent) 45%, transparent);
    transform: scale(0.2); opacity: 0; transition: transform 0.5s cubic-bezier(.2,1.4,.4,1), opacity 0.3s;
  }
  .revealed .loupe { transform: scale(1); opacity: 1; }
  .is-real .loupe { border-color: var(--ink-dim); box-shadow: none; border-style: dashed; }
  .verdict { min-height: 1.5rem; margin-top: 1.6rem; }
  .verdict-line { font-size: 1.2rem; color: var(--text-dim); }
  .verdict-line strong { color: var(--text); }
  .verdict-line strong { font-weight: 600; }
  .evidence {
    display: grid; grid-template-columns: auto 1fr auto; gap: 2rem; align-items: center; margin-top: 1.25rem;
    border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 1.25rem 0;
    opacity: 0; transform: translateY(8px); transition: all 0.5s 0.25s;
  }
  .revealed .evidence { opacity: 1; transform: none; }
  .glyph-pair { display: flex; gap: 1.1rem; align-items: flex-end; }
  .glyph-pair figure { text-align: center; }
  .glyph-pair .g {
    display: block; font-family: var(--font-specimen); font-size: 4.2rem; line-height: 1; width: 4.6rem; height: 4.8rem;
    background: var(--paper); color: var(--ink); border-radius: 3px; padding-top: 0.2rem;
  }
  .glyph-pair .g.fake { box-shadow: inset 0 0 0 2px var(--accent); }
  .glyph-pair figcaption { font-size: 0.85rem; color: var(--text-dim); margin-top: 0.4rem; }
  .facts { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1.2rem; font-size: 0.95rem; }
  .facts dt { color: var(--text-dim); }
  .facts dd { color: var(--text); }
  .facts dd .mono { font-size: 0.85rem; }
  .next {
    font-family: var(--font-body); font-size: 1rem; color: var(--text); background: none;
    border: 1px solid var(--border); padding: 0.7rem 1rem; border-radius: 3px; cursor: pointer; white-space: nowrap;
    transition: border-color 0.2s, color 0.2s;
  }
  .next:hover { border-color: var(--accent); color: var(--accent-bright); }
  .try { margin-top: 2.6rem; display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: center; }
  .try-label { font-size: 1.1rem; font-weight: 500; color: var(--text); }
  .home .scan-form { margin: 0; max-width: 560px; }
  .home .scan-form input { border-radius: 3px 0 0 3px; background: var(--bg-input); }
  .home .scan-form button { border-radius: 0 3px 3px 0; letter-spacing: 0.04em; }

  /* Sections */
  .sec { padding: 7rem 0 2rem; }
  .sec-head { margin-bottom: 3rem; }
  .sec-head h2 { font-weight: 600; font-size: clamp(1.8rem, 3.8vw, 3rem); line-height: 1.05; letter-spacing: -0.03em; text-wrap: balance; }
  .sec-head h2 em { color: var(--paper); }
  .lede + .lede { margin-top: 0.8rem; }
  .swapch { color: var(--accent-bright); box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--accent) 70%, transparent); }
  .lede a, .footnote a { color: var(--text); text-decoration: underline; text-decoration-color: var(--accent);
    text-underline-offset: 0.2em; text-decoration-thickness: 1px; }
  .lede a:hover, .footnote a:hover { color: var(--accent-bright); }
  .lede { text-wrap: pretty; margin-top: 1.1rem; font-size: 1.2rem; line-height: 1.55; color: var(--text-dim); max-width: 64ch; }
  .reveal-up { opacity: 0; transform: translateY(24px); transition: opacity 0.8s, transform 0.8s cubic-bezier(.2,.8,.2,1); }
  .reveal-up.in { opacity: 1; transform: none; }

  /* Ray lab */
  .raylab { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 1.5rem; align-items: center; }
  .raylab figure { background: var(--paper); border-radius: 4px; padding: 1rem; position: relative; }
  .raylab canvas { width: 100%; aspect-ratio: 1; display: block; }
  .raylab figcaption { display: flex; justify-content: space-between; font-size: 0.85rem;
    color: var(--ink-dim); margin-top: 0.6rem; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 42px; margin-top: 0.6rem; }
  .bars i { flex: 1; background: var(--ink); min-height: 2px; transition: height 0.12s; }
  .raylab-mid { text-align: center; min-width: 11rem; font-variant-numeric: tabular-nums; }
  .raylab-mid .big { font-family: var(--font-body); font-weight: 600; letter-spacing: -0.03em; font-size: 3rem; line-height: 1; color: var(--paper); }
  .raylab-mid .lbl { font-size: 0.95rem; color: var(--text-dim); margin-top: 0.3rem; }
  .raylab-mid .match { margin-top: 1.4rem; font-size: 0.95rem; padding: 0.3rem 0.6rem; border: 1px solid var(--border); display: inline-block; }
  .raylab-mid .match.same { color: var(--danger-low); border-color: currentColor; }
  .raylab-mid .match.diff { color: var(--accent); border-color: currentColor; }
  .chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.75rem; }
  .chip { font-family: var(--font-body); font-size: 0.95rem; background: none; color: var(--text-dim); border: 1px solid var(--border);
    padding: 0.45rem 0.8rem; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
  .chip[aria-pressed="true"] { color: var(--ink); background: var(--paper); border-color: var(--paper); }
  .footnote { margin-top: 1.25rem; font-size: 0.9rem; color: var(--text-dim); max-width: 70ch; }

  /* Font specimens */
  .specimens { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: auto auto auto auto; column-gap: 1px;
    background: var(--border); border: 1px solid var(--border); }
  .spec { background: var(--bg); padding: 1.4rem 1.5rem 1.5rem; display: grid; grid-row: span 4;
    grid-template-rows: subgrid; grid-template-columns: minmax(0, 1fr); row-gap: 0; align-items: start; justify-items: start;
    overflow: hidden; }
  .specimens .spec:nth-child(n+5) { border-top: 1px solid var(--border); }
  .spec-font { font-size: 0.95rem; color: var(--text-dim); }
  .spec-words { margin: 1rem 0 1.1rem; line-height: 1.05; align-self: end; }
  .spec-words span { display: block; font-size: 2.3rem; color: var(--text); }
  .spec-words span + span { margin-top: 0.15rem; }
  .spec-words mark { background: none; color: inherit; box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--accent) 70%, transparent); }
  .stamp > span { padding: 0.12rem 0.45rem; display: inline-block; }
  .stamp > span + span { border-left: 1.5px solid currentColor; }
  .stamp { display: inline-flex; white-space: nowrap; max-width: 100%; font-variant-numeric: tabular-nums; font-size: 0.85rem;
    font-weight: 600; padding: 0; border: 1.5px solid currentColor; border-radius: 3px; transform: rotate(-2deg); }
  .stamp.g4 { color: var(--accent); }
  .stamp.g3 { color: #f07a3a; }
  .stamp.g2 { color: var(--danger-mid); }
  .stamp.g1 { color: var(--danger-low); }
  .spec-note { margin-top: 0.7rem; font-size: 0.9rem; color: var(--text-dim); line-height: 1.35; }
  .reveal-up.in .stamp { animation: thump 0.45s cubic-bezier(.2,1.6,.4,1) backwards; }
  .spec:nth-child(2) .stamp { animation-delay: 0.08s; } .spec:nth-child(3) .stamp { animation-delay: 0.16s; }
  .spec:nth-child(4) .stamp { animation-delay: 0.24s; } .spec:nth-child(5) .stamp { animation-delay: 0.32s; }
  .spec:nth-child(6) .stamp { animation-delay: 0.4s; } .spec:nth-child(7) .stamp { animation-delay: 0.48s; }
  .spec:nth-child(8) .stamp { animation-delay: 0.56s; }
  @keyframes thump { from { opacity: 0; transform: rotate(-2deg) scale(1.8); } }

  /* Registry board */
  .board { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem; }
  .tile { border: 1px solid var(--border); border-radius: 3px; padding: 1rem 0.9rem; background: var(--bg-card); }
  .tile-tld { font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; color: var(--text); }
  .tile-v { margin-top: 0.4rem; font-size: 0.95rem; }
  .tile.yes { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .tile.yes .tile-v { color: var(--accent); }
  .tile.no .tile-v { color: var(--text-dim); }
  .tile.unknown .tile-v { color: var(--danger-mid); }
  .reveal-up .tile { opacity: 0; transform: translateY(10px); transition: all 0.5s; }
  .reveal-up.in .tile { opacity: 1; transform: none; }
  .board-note { margin-top: 1.5rem; display: flex; gap: 2.5rem; flex-wrap: wrap; font-size: 1rem; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  .board-note b { color: var(--text); font-weight: 500; }

  /* Report preview */
  .window { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--bg);
    box-shadow: 0 50px 100px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.02); }
  .window-bar { display: flex; align-items: center; gap: 0.45rem; padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border); background: var(--bg-card); }
  .window-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--border); }
  .window-url { margin-left: 0.8rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);
    background: var(--bg); border: 1px solid var(--border); padding: 0.25rem 0.8rem; border-radius: 999px; flex: 1; max-width: 26rem; }
  .window-body { padding: 1.5rem 1.75rem 2rem; max-height: 34rem; overflow: hidden; position: relative; }
  .window-body::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 6rem;
    background: linear-gradient(transparent, var(--bg)); }
  .window-body #preview { margin: 0; }
  .window-caption { margin-top: 1rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    font-size: 1rem; color: var(--text-dim); }
  .window-caption a { color: var(--accent-bright); text-decoration: none; }

  /* Where the numbers come from */
  .numbers { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: auto; border-top: 1px solid var(--border); }
  .num { padding: 2rem 2rem 2rem 0; border-right: 1px solid var(--border); display: grid; grid-row: span 3;
    grid-template-rows: subgrid; row-gap: 0; align-content: start; }
  .num-src { align-self: end; }
  .num + .num { padding-left: 2rem; }
  .num:last-child { border-right: 0; }
  .num-v { font-variant-numeric: tabular-nums lining-nums; font-weight: 600; font-size: clamp(2.8rem, 5.5vw, 4.4rem); line-height: 1; letter-spacing: -0.04em; color: var(--paper); }
  .num-k { text-wrap: pretty; margin-top: 0.8rem; font-size: 1.05rem; color: var(--text); }
  .num-src { margin-top: 1.2rem; font-size: 0.95rem; color: var(--text-dim); }
  .num-src a { color: var(--accent-bright); text-decoration: none; }

  .closing { padding: 8rem 0 6rem; text-align: left; }
  .closing h2 { text-wrap: balance; font-weight: 600; font-size: clamp(2.4rem, 6vw, 4.8rem); line-height: 1; letter-spacing: -0.035em; }
  .closing button { margin-top: 2rem; font-family: var(--font-body); font-size: 1.1rem;
    background: var(--accent); color: var(--ink); border: 0; padding: 0.95rem 1.4rem; border-radius: 3px; cursor: pointer; font-weight: 600; }
  .closing button:hover { background: var(--accent-bright); }

  @media (prefers-reduced-motion: reduce) {
    .plate, .reveal-up, .reveal-up .tile, .evidence, .loupe, .plate-stamp { animation: none !important; transition: none !important; opacity: 1; transform: none; }
  }

  /* Footer */
  footer {
    padding: 2rem 0;
    font-family: var(--font-body);
    border-top: 1px solid var(--border);
    text-align: center;
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  footer a { color: var(--accent-bright); text-decoration: none; }
  .footer-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.4rem 1.75rem; margin-bottom: 0.6rem; }
  footer a:hover { text-decoration: underline; }

  /* Responsive */
  @media (max-width: 768px) {
    .logo { font-size: 2.5rem; }
    .tagline { font-size: 1rem; }
    .scan-form { flex-direction: column; }
    .scan-form input {
      border-right: 1px solid var(--border);
      border-radius: 8px 8px 0 0;
    }
    .scan-form button { border-radius: 0 0 8px 8px; }
    .results-table { font-size: 0.8rem; }
    .results-table th:nth-child(3),
    .results-table td:nth-child(3) { display: none; }
    .topbar nav { display: none; }
    .plates { grid-template-columns: 1fr; gap: 0.9rem; }
    .plate { padding: 2rem 1.25rem 1.6rem; }
    .evidence { grid-template-columns: 1fr; gap: 1.25rem; }
    .try { grid-template-columns: 1fr; gap: 0.75rem; }
    .sec { padding-top: 4.5rem; }
    .sec-head { margin-bottom: 2rem; }
    .lede { font-size: 1.05rem; }
    .raylab { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
    .raylab figcaption { flex-direction: column; gap: 0.15rem; }
    .raylab-mid { grid-column: 1 / -1; order: 3; min-width: 0; }
    .specimens { grid-template-columns: repeat(2, 1fr); }
    .specimens .spec:nth-child(n+3) { border-top: 1px solid var(--border); }
    .spec { padding: 1.1rem 1rem 1.2rem; }
    .stamp { font-size: 0.78rem; }
    .spec-words span { font-size: 1.7rem; }
    .board { grid-template-columns: repeat(3, 1fr); }
    .numbers { grid-template-columns: 1fr; }
    .num { grid-row: auto; grid-template-rows: none; }
    .num, .num + .num { padding: 1.75rem 0; border-right: 0; border-bottom: 1px solid var(--border); }
    .window-body { padding: 1rem; }
  }
  @media (max-width: 520px) {
    .specimens { grid-template-columns: 1fr; }
    .specimens .spec:nth-child(n+2) { border-top: 1px solid var(--border); }
    .board { grid-template-columns: repeat(2, 1fr); }
    .results-table th, .results-table td { padding: 0.55rem 0.35rem; }
    .results-table td:first-child, .results-table th:first-child { padding-left: 0; }
    .results-table td:last-child, .results-table th:last-child { padding-right: 0; }
  }

</style>`;

// --- Page sections ---

const RESULTS_CONTAINER = `<div id="results"></div>`;

const FOOTER = `
<footer>
  <p class="footer-links"><span>Built by <a href="https://paultendo.github.io">Paul Wood FRSA</a> (<a href="https://github.com/paultendo">@paultendo</a>)</span><a href="https://github.com/paultendo/d0ma1n">Source</a><a href="/terms">Terms of use</a></p>
  <p style="font-size:0.75rem;color:var(--text-dim)">This tool is for defensive security, brand protection, and research. Using it to identify domains for malicious registration is prohibited.</p>
</footer>`;

// --- Inline JS ---

const SCRIPT = `<script>
async function doScan() {
  const input = document.getElementById('domain-input');
  const btn = document.getElementById('scan-btn');
  const results = document.getElementById('results');
  let domain = input.value.trim();
  if (!domain) return;

  // Handle pasted URLs
  domain = domain.replace(/^https?:\\/\\//, '').replace(/\\/.*$/, '').replace(/^www\\./, '');
  if (!domain.includes('.')) domain += '.com';

  btn.disabled = true;
  btn.textContent = 'Scanning...';
  results.innerHTML = '<div class="loading"><div class="spinner"></div><p>Scanning for lookalike threats and checking DNS...</p></div>';
  // On the homepage the results land below the specimen, out of view: take the reader there as the scan starts
  if (document.body.classList.contains('home')) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    results.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  history.pushState(null, '', '/scan/' + encodeURIComponent(domain));

  try {
    const res = await fetch('/api/scan?domain=' + encodeURIComponent(domain) + '&top=50');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Scan failed' }));
      throw new Error(err.error || 'Scan failed: ' + res.status);
    }
    const data = await res.json();
    renderResults(data, results);
  } catch (err) {
    results.innerHTML = '<div class="loading"><p style="color:var(--danger-high)">Error: ' + escHtml(err.message) + '</p></div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan';
  }
}

function renderResults(data, container) {
  const byDanger = (a, b) => b.dangerScore - a.dangerScore;
  const active = data.variants.filter(v => v.dns && v.dns.threatLevel === 'active');
  const registered = data.variants.filter(v => v.dns && v.dns.registered).sort(byDanger);
  const unregistered = data.variants.filter(v => !v.dns || !v.dns.registered);
  // The registry's own rules (IDN tables, single-script policy) decide whether an unregistered lookalike can be bought at all
  const available = unregistered.filter(v => !v.policy || v.policy.registrable).sort(byDanger);
  const blocked = unregistered.filter(v => v.policy && !v.policy.registrable).sort(byDanger);
  const tld = data.original.slice(data.original.indexOf('.'));

  let html = '';

  html += '<div style="margin-bottom:1.5rem">';
  html += '<h2 style="font-size:1.25rem;margin-bottom:0.5rem">Threat report for ' + escHtml(data.original) + '</h2>';
  const count = (n, label, hot) => '<span' + (hot ? ' class="hot"' : '') + '><b>' + n + '</b> ' + label + '</span>';
  const counts = [count(data.variants.length, data.variants.length === 1 ? 'lookalike' : 'lookalikes')];
  if (registered.length > 0) counts.push(count(registered.length, 'already registered', true));
  if (active.length > 0) counts.push(count(active.length, 'with mail servers', true));
  counts.push(count(available.length, 'could be registered'));
  if (blocked.length > 0) counts.push(count(blocked.length, 'blocked by registry rules'));
  html += '<div class="results-meta"><span class="seg">' + counts.join('') + '</span></div>';
  html += '<p class="explainer">Each lookalike swaps a letter of your domain for a different Unicode character that looks almost the same. ';
  html += 'The swapped letter is <mark class="diff">highlighted</mark>, with your real domain underneath for comparison.</p>';
  html += '</div>';

  if (active.length > 0) {
    html += '<div class="alert-banner">';
    html += '<strong>' + active.length + ' domain(s) with active mail servers.</strong> ';
    html += 'These can receive email and may be used for phishing. ';
    html += 'Consider <a href="https://www.icann.org/resources/pages/help/dndr/udrp-en" style="color:var(--danger-high);text-decoration:underline">filing a UDRP complaint</a> or reporting to the domain registrar.';
    html += '</div>';
  }

  if (registered.length > 0) {
    html += section('Already registered (' + registered.length + ')', 'var(--danger-high)',
      'Someone owns these. Check what they point to.');
    html += renderVariantTable(registered, data.original);
  }

  if (available.length > 0) {
    html += section('Could be registered (' + available.length + ')', 'var(--text)',
      'Nobody owns these yet, and the registry would accept them. Consider registering the most convincing ones yourself, or monitoring them.');
    html += renderVariantTable(available, data.original);
  } else if (data.variants.length > 0) {
    html += section('Could be registered (0)', 'var(--text)',
      'None of the lookalikes found can be registered under ' + escHtml(tld) + ' today.');
  }

  if (blocked.length > 0) {
    html += section('Can&rsquo;t be registered (' + blocked.length + ')', 'var(--text-dim)',
      'The ' + escHtml(tld) + ' registry does not accept these characters, so nobody can register them. Listed for completeness.');
    html += renderVariantTable(blocked, data.original);
  }

  html += '<p class="legend"><strong>Similarity</strong>: how alike the lookalike and the real domain look, in the font where they are closest (named under the percentage). ';
  html += '<strong>Swapped in</strong>: where the replacement character comes from in Unicode, as its script and block. None of them is the ordinary letter it imitates, even when the script is Latin. ';
  html += 'The <span class="punycode">xn--</span> form under each lookalike is how it is actually registered and how it appears in DNS, certificates and blocklists.</p>';

  html += '<div style="margin-top:1rem;display:flex;gap:0.75rem;align-items:center">';
  html += '<a href="/api/scan?domain=' + encodeURIComponent(data.original) + '&top=50" download="' + data.original + '-threat-report.json" style="color:var(--accent-bright);font-size:0.85rem">Download threat report (JSON)</a>';
  html += '</div>';

  container.innerHTML = html;
}

function section(title, color, blurb) {
  return '<h3 style="font-size:1rem;margin:1.75rem 0 0.25rem;color:' + color + '">' + title + '</h3>' +
    '<div class="results-meta" style="margin-bottom:0.75rem">' + blurb + '</div>';
}

// Script alone misleads ("Latin" reads as ordinary letters); the Unicode block says what kind of character it is
function charKind(s) {
  if (!s.block) return s.script;
  return s.block.startsWith(s.script) ? [s.block] : [s.script, s.block];
}

// Why the registry refuses a lookalike, from the policy engine's notes
function refusal(v) {
  return v.policy.notes.find(n => n.startsWith('Not in the') || n.endsWith('ASCII names only.') ||
    n.startsWith('Scripts outside') || n.startsWith('Profile assumes')) || '';
}

function renderVariantTable(variants, original) {
  let html = '<table class="results-table"><thead><tr>';
  html += '<th>Lookalike</th><th>Similarity</th><th>Swapped in</th><th>Status</th>';
  html += '</tr></thead><tbody>';

  for (const v of variants) {
    const dangerPct = Math.round(v.dangerScore * 100);
    const dangerClass = dangerPct >= 80 ? 'danger-high' : dangerPct >= 50 ? 'danger-mid' : 'danger-low';
    const kinds = [...new Map(v.substitutions.map((x) => [charKind(x).join('|'), charKind(x)])).values()];
    const fontStyle = v.bestFont ? ' style="font-family: \\'' + escHtml(v.bestFont) + '\\', var(--font-mono)"' : '';
    const isRegistered = v.dns && v.dns.registered;

    let status;
    if (v.dns && v.dns.threatLevel === 'active') {
      status = '<span class="threat-active">Active threat</span><div class="swap-note">Has mail servers' +
        (v.dns.rdap && v.dns.rdap.registrar ? ', registered through ' + escHtml(v.dns.rdap.registrar) : '') + '</div>';
    } else if (isRegistered) {
      status = '<span class="threat-parked">Registered</span>';
      const rd = v.dns.rdap;
      if (rd && (rd.since || rd.registrar)) {
        status += '<div class="swap-note">' + (rd.since ? 'Since ' + escHtml(rd.since) : 'Registered') +
          (rd.registrar ? ', through ' + escHtml(rd.registrar) : '') + '</div>';
      }
    } else if (v.policy && !v.policy.registrable) {
      status = '<span class="threat-none">Can&rsquo;t be registered</span><div class="swap-note">' + escHtml(refusal(v)) + '</div>';
    } else {
      status = '<span class="threat-open">' + (v.dns ? 'Available' : 'Not checked') + '</span>';
      if (v.policy && v.policy.registryRules === 'unknown') {
        status += '<div class="swap-note">This registry&rsquo;s character rules are unknown; judged by script only.</div>';
      }
    }

    const swaps = [...new Set(v.substitutions.map(s =>
      '<span class="swap" title="' + escHtml(charKind(s).join(', ')) + ' character ' + escHtml(s.codepoint) + '">' + escHtml(s.original) +
      ' &rarr; ' + escHtml(s.replacement) + ' <span class="swap-cp">' + escHtml(s.codepoint) + '</span></span>'
    ))];

    html += '<tr>';
    html += '<td><div class="domain-cell"' + fontStyle + '>' + markDiff(v.domain, original) + '</div>';
    html += '<div class="domain-original"' + fontStyle + '>' + markDiff(original, v.domain) + '</div>';
    html += '<div class="swaps">' + swaps.join('') + '</div>';
    html += '<div class="punycode">' + escHtml(v.punycode) + '</div></td>';
    html += '<td><span class="danger-badge ' + dangerClass + '">' + dangerPct + '%</span>';
    if (v.bestFont) html += '<div class="font-label">in ' + escHtml(v.bestFont) + '</div>';
    html += '</td>';
    html += '<td>' + kinds.map(k => '<span class="seg tag">' + k.map(p => '<span>' + escHtml(p) + '</span>').join('') + '</span>').join(' ') + '</td>';
    html += '<td>' + status + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// Wrap each character of a that differs from b at the same position, so swapped look-alikes are visible.
function markDiff(a, b) {
  const ac = Array.from(a);
  const bc = Array.from(b);
  if (ac.length !== bc.length) return escHtml(a);
  return ac.map((c, i) => c === bc[i] ? escHtml(c) : '<mark class="diff">' + escHtml(c) + '</mark>').join('');
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

window.addEventListener('popstate', () => {
  const path = location.pathname;
  if (path.startsWith('/scan/')) {
    const domain = decodeURIComponent(path.slice(6));
    document.getElementById('domain-input').value = domain;
    doScan();
  }
});
</script>`;

const HOME_SCRIPT = `<script>
(function () {
  var data = window.HOME;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Specimen: spot the fake ----------
  var examples = data.examples;
  var current = 0, fakeSide = 0;
  var platesEl = document.getElementById('plates');
  var stage = document.getElementById('specimen');
  var plates = platesEl.querySelectorAll('.plate');
  var verdict = document.getElementById('verdict');
  var pad = function (n) { return String(n); };
  var ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
  document.getElementById('spec-total').textContent = pad(examples.length);

  function spans(domain) {
    return Array.from(domain).map(function (c) { return '<span class="ch">' + escHtml(c) + '</span>'; }).join('');
  }

  function showSpecimen() {
    var ex = examples[current];
    fakeSide = Math.random() < 0.5 ? 0 : 1;
    document.getElementById('brand').textContent = ex.real;
    document.getElementById('spec-n').textContent = pad(current + 1);
    stage.classList.remove('revealed');
    verdict.innerHTML = '';
    plates.forEach(function (p, i) {
      p.disabled = false;
      p.classList.remove('is-fake', 'is-real');
      var dom = i === fakeSide ? ex.fake : ex.real;
      p.querySelector('.plate-domain').innerHTML = spans(dom);
      p.setAttribute('aria-label', 'Plate ' + (i ? 'B' : 'A') + ': ' + dom);
      var old = p.querySelector('.loupe'); if (old) old.remove();
      p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    });
  }

  function ring(plate, index) {
    var ch = plate.querySelectorAll('.plate-domain .ch')[index];
    if (!ch) return;
    var pr = plate.getBoundingClientRect(), cr = ch.getBoundingClientRect();
    var size = Math.max(cr.width * 1.9, cr.height * 1.05);
    var el = document.createElement('span');
    el.className = 'loupe';
    el.style.width = el.style.height = size + 'px';
    el.style.left = (cr.left - pr.left + cr.width / 2 - size / 2) + 'px';
    el.style.top = (cr.top - pr.top + cr.height / 2 - size / 2) + 'px';
    plate.appendChild(el);
  }

  function pick(side) {
    var ex = examples[current];
    plates.forEach(function (p, i) {
      p.disabled = true;
      p.classList.add(i === fakeSide ? 'is-fake' : 'is-real');
      p.querySelector('.plate-stamp').textContent = i === fakeSide ? 'Fake' : 'Real';
      ring(p, ex.index);
    });
    requestAnimationFrame(function () { stage.classList.add('revealed'); });
    var right = side !== fakeSide;
    var letter = fakeSide ? 'B' : 'A';
    verdict.innerHTML =
      '<p class="verdict-line"><strong>' + (right ? 'Correct: plate ' + letter + ' is the fake.' : 'Plate ' + letter + ' is the fake.') + '</strong> ' +
      'Its ' + ORDINALS[ex.index] + ' letter is not the letter ' + escHtml(ex.original) + ' but <span class="mono">' + escHtml(ex.codepoint) +
      '</span>, a ' + escHtml(ex.name.toLowerCase().replace(/^latin (small )?letter /, '')) + ', drawn the same way.</p>' +
      '<div class="evidence">' +
        '<div class="glyph-pair"><figure><span class="g">' + escHtml(ex.original) + '</span><figcaption>real</figcaption></figure>' +
        '<figure><span class="g fake">' + escHtml(ex.char) + '</span><figcaption>fake</figcaption></figure></div>' +
        '<dl class="facts">' +
          '<dt>Character</dt><dd><span class="mono">' + escHtml(ex.codepoint) + '</span> ' + escHtml(ex.name.charAt(0) + ex.name.slice(1).toLowerCase()) + '</dd>' +
          '<dt>Unicode block</dt><dd>' + escHtml(ex.block) + '</dd>' +
          '<dt>Looks alike</dt><dd>' + (ex.similarity >= 100 ? 'in every text font that includes it' : 'in ' + ex.similarity + '% of the text fonts that include it') + '</dd>' +
          '<dt>Registered</dt><dd>' + (ex.registration && ex.registration.registered
            ? 'Yes' + (ex.registration.since ? ', since ' + escHtml(ex.registration.since.slice(0, 4)) : '') +
              (ex.registration.registrar ? ', through ' + escHtml(ex.registration.registrar) : '')
            : ex.registrable ? 'No, and the .com registry would accept it' : 'No, and the .com registry refuses it') + '</dd>' +
          '<dt>Registered as</dt><dd><span class="mono">' + escHtml(ex.punycode) + '</span></dd>' +
        '</dl>' +
        '<button type="button" class="next" id="next">Next example</button>' +
      '</div>';
    document.getElementById('next').addEventListener('click', function () {
      current = (current + 1) % examples.length; showSpecimen(); plates[0].focus();
    });
  }

  plates.forEach(function (p, i) { p.addEventListener('click', function () { pick(i); }); });
  if (examples.length) showSpecimen(); else document.getElementById('specimen').querySelector('.plates').remove();

  window.scanFromTop = function () {
    document.getElementById('specimen').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(function () { document.getElementById('domain-input').focus(); }, reduced ? 0 : 500);
  };

  // ---------- Ray lab: the method, drawn live ----------
  var SIZE = 320, RAYS = 25, SPAN = 150, ANGLES = 36;
  var canvases = [document.getElementById('ray-a'), document.getElementById('ray-b')];
  var bars = [document.getElementById('bars-a'), document.getElementById('bars-b')];
  var glyphs = ['o', String.fromCodePoint(0x1D0F)];
  var font = 'Arial', masks = [], signatures = [], angle = 0, running = false;

  bars.forEach(function (b) { b.innerHTML = new Array(RAYS + 1).join('<i></i>'); });

  function mask(ch) {
    var c = document.createElement('canvas'); c.width = c.height = SIZE;
    var x = c.getContext('2d');
    x.font = '240px "' + font + '"';
    x.fillStyle = '#000';
    x.fillText(ch, (SIZE - x.measureText(ch).width) / 2, 225);
    var px = x.getImageData(0, 0, SIZE, SIZE).data, m = new Uint8Array(SIZE * SIZE);
    for (var i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 128 ? 1 : 0;
    return m;
  }

  // Crossings per ray at one angle: how many times each ray enters ink, and where
  function cast(m, deg, points) {
    var t = deg * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx, counts = [];
    for (var r = 0; r < RAYS; r++) {
      var off = -SPAN + (2 * SPAN * r) / (RAYS - 1), inside = 0, n = 0;
      for (var s = -230; s <= 230; s++) {
        var x = Math.round(SIZE / 2 + nx * off + dx * s), y = Math.round(SIZE / 2 + ny * off + dy * s);
        var ink = x >= 0 && y >= 0 && x < SIZE && y < SIZE ? m[y * SIZE + x] : 0;
        if (ink && !inside) { n++; if (points) points.push([x, y]); }
        inside = ink;
      }
      counts.push(n);
    }
    return counts;
  }

  function prepare() {
    masks = glyphs.map(mask);
    signatures = masks.map(function (m) {
      var sig = []; for (var a = 0; a < ANGLES; a++) sig.push(cast(m, a * 5)); return sig;
    });
    var differ = 0;
    for (var a = 0; a < ANGLES; a++) if (signatures[0][a].join() !== signatures[1][a].join()) differ++;
    var match = document.getElementById('ray-match');
    match.className = 'match ' + (differ ? 'diff' : 'same');
    match.textContent = differ ? 'differs at ' + differ + ' of 36 angles' : 'same at all 36 angles';
  }

  function frame() {
    var all = [];
    canvases.forEach(function (cv, i) {
      var x = cv.getContext('2d'), pts = [];
      var counts = cast(masks[i], angle, pts);
      all.push(counts);
      x.clearRect(0, 0, SIZE, SIZE);
      x.font = '240px "' + font + '"';
      x.fillStyle = '#16140f';
      x.fillText(glyphs[i], (SIZE - x.measureText(glyphs[i]).width) / 2, 225);
      var t = angle * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
      x.strokeStyle = 'rgba(22,20,15,0.16)'; x.lineWidth = 1;
      for (var r = 0; r < RAYS; r++) {
        var off = -SPAN + (2 * SPAN * r) / (RAYS - 1), cx = SIZE / 2 - dy * off, cy = SIZE / 2 + dx * off;
        x.beginPath(); x.moveTo(cx - dx * 230, cy - dy * 230); x.lineTo(cx + dx * 230, cy + dy * 230); x.stroke();
      }
      x.fillStyle = '#ff5a36';
      pts.forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 4, 0, 6.3); x.fill(); });
      var is = bars[i].children;
      counts.forEach(function (n, r) { is[r].style.height = Math.min(42, 2 + n * 12) + 'px'; });
    });
    var d = 0; for (var r = 0; r < RAYS; r++) if (all[0][r] !== all[1][r]) d++;
    document.getElementById('ray-angle').innerHTML = Math.round(angle) + '&deg;';
    document.getElementById('ray-diff').textContent = d;
  }

  function loop() {
    if (!running) return;
    angle = (angle + 0.5) % 180;
    frame();
    requestAnimationFrame(loop);
  }

  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.chip').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      font = b.getAttribute('data-font'); prepare(); frame();
    });
  });

  // ---------- Font specimens: grade what the visitor's browser actually draws ----------
  function inkMask(ch, family) {
    var c = document.createElement('canvas'); c.width = 240; c.height = 240;
    var x = c.getContext('2d'); x.font = '180px ' + family; x.fillStyle = '#000';
    x.fillText(ch, (240 - x.measureText(ch).width) / 2, 180);
    var px = x.getImageData(0, 0, 240, 240).data, m = new Uint8Array(240 * 240);
    for (var i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 128 ? 1 : 0;
    return m;
  }
  function overlap(a, b) {
    var both = 0, either = 0;
    for (var i = 0; i < a.length; i++) { if (a[i] && b[i]) both++; if (a[i] || b[i]) either++; }
    return either ? both / either : 0;
  }
  // A font lacks a character when its width changes with the font behind it. Arial and Times New Roman both draw the
  // characters used here at different widths, and generic fallbacks catch devices without them.
  function hasGlyph(font, ch) {
    var c = document.createElement('canvas').getContext('2d');
    var w = function (behind) { c.font = '100px "' + font + '", ' + behind; return c.measureText(ch).width; };
    return w('Arial') === w('"Times New Roman"') && w('monospace') === w('serif');
  }
  function gradeSpecimens() {
    var fake = String.fromCodePoint(0x1D0F);
    document.querySelectorAll('.spec').forEach(function (card) {
      var font = card.getAttribute('data-font'), family = '"' + font + '", Arial, sans-serif';
      var installed = hasGlyph(font, 'o');
      var own = installed && hasGlyph(font, fake);
      var score = overlap(inkMask('o', family), inkMask(fake, family));
      var pct = Math.round(score * 100);
      var grade = score >= 0.95 ? ['g4', 'Identical'] : score >= 0.85 ? ['g3', 'Nearly identical'] : score >= 0.7 ? ['g2', 'Close'] : ['g1', 'Told apart'];
      var stamp = card.querySelector('.stamp');
      stamp.className = 'stamp ' + grade[0];
      stamp.innerHTML = '<span>' + grade[1] + '</span><span>' + pct + '%</span>';
      var note = !installed ? font + ' is not on this device, so both are drawn in a fallback.'
        : own ? (card.getAttribute('data-measured') || 'Measured as different in ' + font + '.')
        : 'No \u1D0F in ' + font + ': borrowed from a fallback font.';
      card.querySelector('.spec-note').textContent = note;
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(gradeSpecimens); else gradeSpecimens();

  // ---------- Scroll: reveal sections, run the ray lab while visible, load the live report once ----------
  var previewLoaded = false;
  function loadPreview() {
    if (previewLoaded) return; previewLoaded = true;
    var el = document.getElementById('preview');
    fetch('/api/scan?domain=paypal.com&top=8').then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) { renderResults(d, el); })
      .catch(function () { el.innerHTML = '<p class="footnote">The live scan could not load just now. <a href="/scan/paypal.com" style="color:var(--accent-bright)">Open it directly</a>.</p>'; });
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) e.target.classList.add('in');
      if (e.target.id === 'method') {
        var was = running; running = e.isIntersecting && !reduced;
        if (running && !was) requestAnimationFrame(loop);
      }
      if (e.target.id === 'report' && e.isIntersecting) loadPreview();
    });
  }, { threshold: 0.15 }) : null;

  prepare(); angle = reduced ? 30 : 0; frame();
  document.querySelectorAll('.reveal-up').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });
  if (!io) loadPreview();
})();
</script>`;
