import type { ScanResult, DomainVariant, ReverseScanResult } from "../src/types.js";

/** Facts the homepage shows, computed by the worker from the scanner's own data. */
export type LandingData = {
  examples: Array<{
    real: string; fake: string; index: number; original: string; char: string; codepoint: string; name: string;
    block: string; similarity: number; fallback: boolean; registrable: boolean; punycode: string;
    registration: { registered: boolean; since?: string; registrar?: string } | null;
  }>;
  fontStrip: Array<{ font: string; danger: number | null }>;
  heroPairs: Array<{ real: string; fake: string; codepoint: string; alike: number; fallback: boolean }>;
  strip: { real: string; fake: string };
  registries: Array<{ tld: string; accepts: boolean | null; rule: string; assumed: boolean }>;
  stats: { tlds: number; assumed: number; fonts: number };
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
  <meta name="description" content="Lookalike domains, measured glyph by glyph and checked against the registry rules of 1,400 TLDs. Find the fakes of your domain before someone registers them.">
  <meta property="og:title" content="d0ma1n - Lookalike domains you can't see">
  <meta property="og:description" content="Find the lookalikes of your domain that someone could register, measured glyph by glyph.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://d0ma1n.app">
  <meta property="og:image" content="https://d0ma1n.app/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="The d0ma1n logo and the question: which one is the real google.com? Beside it, the letter o and the small capital ᴏ, drawn identically.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://d0ma1n.app/og.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  ${STYLES}
</head>
<body class="home">
  <div class="container">
    <header class="topbar topbar-float"><div class="bar" data-glass="9">
      <a href="/" class="logo">d<span>0</span>ma<span>1</span>n</a>
      <nav aria-label="Sections">
        <a href="#method">Method</a><a href="#fonts">Fonts</a><a href="#registries">Registries</a><a href="#report">Report</a>
        <a href="https://github.com/paultendo/d0ma1n">GitHub</a>
        <a href="#specimen" class="pill" data-glass="8" onclick="scanFromTop(); return false;">Scan a domain</a>
      </nav>
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="mnav" aria-label="Menu"><span></span><span></span></button>
    </div>
    <nav class="mnav" id="mnav" aria-label="Sections" data-glass="10">
      <a href="#browsers">Browsers</a><a href="#method">Method</a><a href="#fonts">Fonts</a><a href="#registries">Registries</a><a href="#report">Report</a>
      <a href="https://github.com/paultendo/d0ma1n">GitHub</a>
    </nav></header>
    <svg class="lg-defs" width="0" height="0" aria-hidden="true" focusable="false"></svg>
    ${homeSpecimen()}
    ${RESULTS_CONTAINER}
    ${homeBrowsers()}
    ${homeMethod()}
    ${homeFonts(data)}
    ${homeRegistries(data)}
    ${homeReport()}
    ${homeNumbers(data)}
    <section class="closing">
      <h2>Check your own domain</h2>
      <button type="button" onclick="scanFromTop()" data-glass="10">Scan a domain</button>
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
  <canvas class="hero-rays" aria-hidden="true"></canvas>
  <h1 class="headline">Which one is the real <em id="brand">google.com</em>?</h1>
  <div class="plates" id="plates">
    <button type="button" class="plate" data-side="0" data-glass="12"><span class="plate-tag">A</span><span class="plate-stamp"></span><span class="plate-domain" id="plate-0"></span></button>
    <button type="button" class="plate" data-side="1" data-glass="12"><span class="plate-tag">B</span><span class="plate-stamp"></span><span class="plate-domain" id="plate-1"></span></button>
  </div>
  <div class="verdict" id="verdict" aria-live="polite"></div>
  <div class="try">
    <p class="try-label">Try a domain</p>
    <form class="scan-form" action="javascript:void(0)" onsubmit="doScan()">
      <input type="text" id="domain-input" placeholder="yourcompany.com" autocomplete="off" spellcheck="false" aria-label="Domain to scan">
      <button type="submit" id="scan-btn" data-glass="9">Scan</button>
    </form>
    <div class="hero-pair" aria-hidden="true"></div>
  </div>
</section>`;
}

/** The first objection anyone raises: browsers show the xn-- form. Where that holds, and where it doesn't. */
function homeBrowsers(): string {
  return `
<section class="sec reveal-up" id="browsers">
  <div class="sec-head"><div>
    <h2>Doesn&rsquo;t the browser catch these?</h2>
    <p class="lede">Chrome catches this one. Its address bar shows g<span class="swapch">&#x1D0F;</span>ogle.com as <span class="mono nowrap">xn--gogle-m29a.com</span>, because <span class="swapch">&#x1D0F;</span> is outside the characters Unicode recommends for identifiers, and it also flags names that look like a site on its list of popular ones.</p>
    <p class="lede">But the address bar only comes into it after the click. In an email or a chat message, a link reads however the sender typed it.</p>
    <p class="lede">We&rsquo;ve also found other places where lookalikes are shown as written. They&rsquo;ve been reported to the companies responsible and fixes are under way, so we&rsquo;ll describe them once they have shipped.</p>
  </div></div>
  <div class="surfaces">
    <figure class="surface">
      <figcaption class="surface-k">Chrome&rsquo;s address bar, after the click</figcaption>
      <div class="mock-bar"><span class="mono">xn--gogle-m29a.com</span></div>
      <p class="surface-v caught">Shown in its xn-- form</p>
    </figure>
    <figure class="surface">
      <figcaption class="surface-k">An email</figcaption>
      <div class="mock-mail"><p class="mock-from">Account security</p><p>We stopped a sign-in attempt. Review it at <span class="mock-link">g&#x1D0F;ogle.com/security</span></p></div>
      <p class="surface-v">Shown as the sender wrote it</p>
    </figure>
    <figure class="surface">
      <figcaption class="surface-k">A chat message</figcaption>
      <div class="mock-chat"><p class="mock-bubble">Can you approve this before 5? <span class="mock-link">g&#x1D0F;ogle.com/docs/q3-budget</span></p></div>
      <p class="surface-v">Shown as the sender wrote it</p>
    </figure>
  </div>
</section>`;
}

function homeMethod(): string {
  return `
<section class="sec slab slab-dark reveal-up" id="method">
  <div class="sec-head"><div>
    <h2>How d0ma1n measures a lookalike</h2>
    <p class="lede">The lookalike data comes from <a href="https://github.com/paultendo/confusable-vision">confusable-vision</a>, an open-source project by <a href="https://paultendo.github.io">Paul Wood FRSA</a> that measures how alike two characters look.</p>
    <p class="lede">It casts parallel rays through each character&rsquo;s outline at 36 angles and records where each ray crosses ink. When two characters cross in the same places at every angle, at the same size and on the same baseline, they are drawn alike. The thresholds were set against 31 pairs whose answer is known, from Unicode&rsquo;s own confusables list; there has been no study with readers yet. <a href="https://github.com/paultendo/confusable-vision/blob/main/docs/metric-calibration.md">How the method was tested</a></p>
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
  <p class="footnote">The grade is the share of ink the two glyphs have in common when drawn at the same size on the same baseline. Where the font includes <span class="swapch">&#x1D0F;</span>, the card also gives the published measurement for that font. 448 of the 857 measured pairs are alike only when one character is drawn in a substitute font, as here.</p>
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
    <p class="lede"><span class="swapch">&#x1D0F;</span> is a Latin letter, so g<span class="swapch">&#x1D0F;</span>ogle is written in a single script. Most registries refuse labels that mix scripts, such as google with a Cyrillic &#x43E;, and d0ma1n applies the same rule.</p>
  </div></div>
  <div class="board">${tiles}</div>
  <div class="board-note"><span class="seg"><span><b>${data.stats.tlds.toLocaleString("en-GB")}</b> TLDs, ${(data.stats.tlds - data.stats.assumed).toLocaleString("en-GB")} from published rules</span><span>IANA IDN tables</span><span>ICANN registry agreement</span><span>Country-code registry policies</span></span></div>
</section>`;
}

function homeReport(): string {
  return `
<section class="sec reveal-up" id="report">
  <div class="sec-head"><div>
    <h2>The report</h2>
    <p class="lede">A scan lists registered lookalikes first, starting with any set up to receive email, since replies to a phishing message would reach whoever holds them. Next come the ones still available to register, then the ones no registry would accept. Each result names the swapped character and, where it was measured, the font in which it is hardest to spot.</p>
    <p class="lede">Open tools such as <a href="https://github.com/elceef/dnstwist">dnstwist</a> can already list lookalikes of any domain. What d0ma1n adds is which of them a reader would fall for, which a registry would sell, and who holds the ones already taken.</p>
  </div></div>
  <div class="window">
    <div class="window-bar" data-glass="8"><i></i><i></i><i></i><span class="window-url">d0ma1n.app/scan/paypal.com</span></div>
    <div class="window-body" data-glass="14" data-glass-mode="content"><div id="preview"><div class="loading" role="status"><div class="wordmark-loader" aria-hidden="true"><svg width="0" height="0" style="position:absolute"><filter id="wl-goo"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 28 -12"/></filter></svg><span class="wl-fold wl-1ch">d</span><span class="wl-swap"><i>o</i><b>0</b></span><span class="wl-fold wl-2ch">ma</span><span class="wl-swap"><i>i</i><b>1</b></span><span class="wl-fold wl-1ch">n</span></div><p>Loading a live scan&hellip;</p></div></div></div>
  </div>
  <div class="window-caption"><span>Live scan of paypal.com</span><a href="/scan/paypal.com">Open the full report</a></div>
</section>`;
}

function homeNumbers(data: LandingData): string {
  return `
<section class="sec reveal-up" id="data">
  <div class="sec-head"><div>
    <h2>Where the data comes from</h2>
    <p class="lede">d0ma1n and its data are open source, built by <a href="https://paultendo.github.io">Paul Wood FRSA</a> (<a href="https://github.com/paultendo">@paultendo</a>). confusable-vision measures which characters look alike, namespace-guard packages those measurements as a library, and d0ma1n adds registry rules and DNS checks.</p>
  </div></div>
  <div class="numbers">
    <div class="num"><div class="num-v">857</div><div class="num-k">lookalike pairs, measured at the size characters appear in text, with thresholds set against 31 pairs of known answer from Unicode&rsquo;s confusables list. The 322 that pass the release&rsquo;s thresholds score every result.</div>
      <div class="num-src"><span class="seg"><a href="https://github.com/paultendo/confusable-vision">confusable-vision</a><span>CC-BY-4.0</span></span></div></div>
    <div class="num"><div class="num-v">${data.stats.fonts}</div><div class="num-k">fonts with their own scores, so a report can name the font in which a lookalike is hardest to spot</div>
      <div class="num-src"><span class="seg"><a href="https://www.npmjs.com/package/namespace-guard">namespace-guard</a><span>MIT</span></span></div></div>
    <div class="num"><div class="num-v">${data.stats.tlds.toLocaleString("en-GB")}</div><div class="num-k">TLDs whose registry rules are checked for every result, ${(data.stats.tlds - data.stats.assumed).toLocaleString("en-GB")} of them from published tables and policies. The other ${data.stats.assumed}, country codes with no policy we could find, are judged by script alone, and say so.</div>
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
  <meta property="og:image" content="https://d0ma1n.app/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://d0ma1n.app/og.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  ${STYLES}
</head>
<body>
  <div class="container">
    <header class="topbar">
      <a href="/" class="logo">d<span>0</span>ma<span>1</span>n</a>
      <nav aria-label="Site"><a href="/">Home</a><a href="https://github.com/paultendo/d0ma1n">GitHub</a></nav>
    </header>
    <header class="scan-head">
      <form class="scan-form" action="javascript:void(0)" onsubmit="doScan()">
        <input type="text" id="domain-input" value="${escHtml(result.original)}" placeholder="yourcompany.com" autocomplete="off" spellcheck="false">
        <button type="submit" id="scan-btn" data-glass="9">Scan</button>
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
    --bg: #ffffff;
    --bg-soft: #f6f8fb;
    --bg-card: #ffffff;
    --bg-input: #ffffff;
    --border: #e3e8ef;
    --border-strong: #cdd5e0;
    --text: #0b1b33;
    --text-dim: #5a6b82;
    --paper: #f6f8fb;
    --ink: #0b1b33;
    --ink-dim: #5a6b82;
    --accent: #1f5af0;
    --accent-bright: #1848c9;
    --accent-soft: #eaf0ff;
    --danger-high: #d92d20;
    --danger-mid: #b54708;
    --danger-low: #067647;
    --active-threat: #d92d20;
    --shadow-sm: 0 1px 2px rgba(11, 27, 51, 0.06), 0 1px 1px rgba(11, 27, 51, 0.04);
    --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
    --font-body: 'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif;
    --font-specimen: Arial, 'Helvetica Neue', sans-serif;
  }

  /* The hero's canvas is a tilted, full-width plane: clip what overhangs rather than let it scroll sideways */
  html, body { overflow-x: clip; }
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
  .scan-head { padding: 1.5rem 0 0.5rem; }
  .scan-head .scan-form { margin: 0; max-width: 560px; }

  .logo {
    font-family: var(--font-mono);
    font-size: 3.5rem;
    font-weight: 700;
    color: var(--text);
    text-decoration: none;
    letter-spacing: -0.02em;
    display: inline-block;
  }
  .logo span { color: var(--accent); }

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
    border-radius: 10px 0 0 10px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .scan-form input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .scan-form input::placeholder { color: var(--text-dim); }

  .scan-form button {
    padding: 0.875rem 2rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 0 10px 10px 0;
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
  /* On the homepage the docked glass bar covers the top of the window: land the results just below it */
  .home #results { scroll-margin-top: calc(var(--bar-h, 80px) + 1.25rem); }

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
  .nowrap { white-space: nowrap; }
  .swap-note .recent { color: var(--danger-high); font-weight: 600; }
  .swap-note a { color: var(--accent); }
  .swap-note .report-btn { display: inline-block; margin-top: 0.3rem; padding: 0.2rem 0.65rem; border-radius: 9999px; text-decoration: none;
    font-weight: 500; background: rgba(233, 240, 255, 0.7); box-shadow: inset 0 1px 0 #fff, inset 0 0 0 1px rgba(31, 90, 240, 0.22); }
  .swap-note .report-btn:hover { background: rgba(214, 226, 255, 0.9); }
  .danger-badge.unmeasured { background: var(--bg-soft); color: var(--text-dim); font-weight: 500; white-space: nowrap; }

  .threat-active {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--active-threat);
    color: #fff;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
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
  /* The key to a report's columns: three short definitions side by side, under a hairline */
  .legend-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem 2rem; margin: 2.25rem 0 0;
    padding-top: 1.5rem; border-top: 1px solid var(--border); }
  .legend-grid dt { font-size: 0.85rem; font-weight: 600; color: var(--text); margin-bottom: 0.35rem; }
  .legend-grid dd { margin: 0; font-size: 0.85rem; line-height: 1.55; color: var(--text-dim); text-wrap: pretty; }
  .legend-grid em { font-style: normal; color: var(--text); }
  .report-actions { margin-top: 1.5rem; }
  .report-actions .next { display: inline-block; text-decoration: none; font-size: 0.9rem; }
  @media (max-width: 768px) { .legend-grid { grid-template-columns: 1fr; gap: 1.1rem; } }
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
  /* Loading, one seamless 4s loop: domain; its o and i morph into the 0 and 1 of d0ma1n; d, ma and n fold away to
     leave 01; they open again as the 0 and 1 morph back, and it is domain once more. */
  .wordmark-loader { display: inline-flex; align-items: baseline; margin-bottom: 0.9rem; font-family: var(--font-mono); font-weight: 600;
    font-size: 2.1rem; line-height: 1; color: var(--text); }
  /* o becomes 0 and i becomes 1 by shape, not by fade: both glyphs blur as one gives way to the other, and an alpha
     threshold (#wl-goo) snaps the blend back to a hard edge, so the outline flows from one letter into the next */
  .wl-swap { display: inline-grid; filter: url(#wl-goo); }
  .wl-swap > * { grid-area: 1 / 1; font-style: normal; font-weight: inherit; text-align: center; }
  .wl-swap > i { animation: wl-out 4s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
  .wl-swap > b { color: var(--accent); animation: wl-in 4s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
  .wl-fold { display: inline-block; overflow: hidden; white-space: nowrap; animation: 4s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
  .wl-1ch { animation-name: wl-fold-1; }
  .wl-2ch { animation-name: wl-fold-2; }
  @keyframes wl-out { 0%, 16% { opacity: 1; filter: blur(0); } 32%, 78% { opacity: 0; filter: blur(6px); } 92%, 100% { opacity: 1; filter: blur(0); } }
  @keyframes wl-in { 0%, 16% { opacity: 0; filter: blur(6px); } 32%, 78% { opacity: 1; filter: blur(0); } 92%, 100% { opacity: 0; filter: blur(6px); } }
  /* Letters fade before their space closes, and their space opens before they fade in, so none is seen half-cut */
  @keyframes wl-fold-1 { 0%, 44% { max-width: 1ch; opacity: 1; } 50% { opacity: 0; } 58%, 74% { max-width: 0; opacity: 0; } 84% { max-width: 1ch; opacity: 0; } 92%, 100% { max-width: 1ch; opacity: 1; } }
  @keyframes wl-fold-2 { 0%, 44% { max-width: 2ch; opacity: 1; } 50% { opacity: 0; } 58%, 74% { max-width: 0; opacity: 0; } 84% { max-width: 2ch; opacity: 0; } 92%, 100% { max-width: 2ch; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .wordmark-loader { animation: wl-pulse 1.6s ease-in-out infinite alternate; }
    .wl-swap > i { display: none; }
    .wl-swap > b, .wl-fold { animation: none; opacity: 1; filter: none; }
    @keyframes wl-pulse { from { opacity: 1; } to { opacity: 0.45; } }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---------- Homepage ---------- */
  /* Stripe-style product panels (borderless, navy-tinted layered shadows) inside 1Password-style rounded slabs */
  body.home { background: var(--bg); }
  .home .container { max-width: 1232px; }
  .mono { font-family: var(--font-mono); }
  .slab-shadow { box-shadow: 0 30px 60px -12px rgba(50, 50, 93, 0.25), 0 18px 36px -18px rgba(0, 0, 0, 0.3); }

  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding-top: 1.25rem; padding-bottom: 1.25rem;
  }
  .topbar .logo { font-size: 1.3rem; font-weight: 600; }
  .topbar nav { display: flex; gap: 1.75rem; align-items: center; flex-wrap: wrap; }
  .topbar nav a { font-size: 0.95rem; color: var(--text); text-decoration: none; transition: color 0.15s; }
  .topbar nav a:hover { color: var(--accent); }
  .topbar nav a.pill {
    background: var(--accent); color: #fff; padding: 0.5rem 1.1rem; border-radius: 9999px; font-weight: 500;
  }
  .topbar nav a.pill:hover { background: var(--accent-bright); color: #fff; }

  /* On the homepage the bar docks as a floating pill of glass once the page scrolls. Chromium refracts what passes
     under its rim through an SVG displacement filter (flat in the middle, bending in a thin band at the edge); other
     browsers get frosted glass. */
  .topbar-float { position: sticky; top: 0; z-index: 50; display: block; padding: 0.75rem 0; }
  .topbar-float .bar {
    position: relative; isolation: isolate;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.5rem 0; margin: 0; border-radius: 9999px; background: rgba(255, 255, 255, 0);
    transition: background 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1),
      margin 0.5s cubic-bezier(0.22, 1, 0.36, 1), padding 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .topbar-float.docked .bar {
    margin: 0 -0.9rem; padding: 0.5rem 0.5rem 0.5rem 0.9rem; background: rgba(255, 255, 255, 0.72);
    -webkit-backdrop-filter: blur(12px) saturate(1.6); backdrop-filter: blur(12px) saturate(1.6);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.6),
      inset 0 7px 10px -9px rgba(11, 27, 51, 0.12), inset 0 -1px 0 rgba(11, 27, 51, 0.05),
      0 12px 32px -12px rgba(50, 50, 93, 0.28), 0 2px 6px -2px rgba(0, 0, 0, 0.08);
  }
  .lg-ok .topbar-float.docked .bar { background: rgba(255, 255, 255, 0.42); }
  .lg-ok .topbar-float:not(.docked) .bar { backdrop-filter: none; }

  /* Glass surfaces: each [data-glass] element gets its own displacement map (built in HOME_SCRIPT, sized to it), so
     what passes under its rim bends, with a faint prism fringe. Chromium only; elsewhere they keep their own look. */
  .lg-ok [data-glass] { backdrop-filter: var(--lg) saturate(1.5); }
  .lg-ok [data-glass][data-glass-mode="content"] { backdrop-filter: none; filter: var(--lg); }
  .lg-ok .plate {
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.55),
      0 30px 60px -12px rgba(50, 50, 93, 0.22), 0 18px 36px -18px rgba(0, 0, 0, 0.25);
  }
  .lg-ok .plate:hover:not([disabled]) {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.55),
      0 40px 70px -14px rgba(50, 50, 93, 0.3), 0 20px 40px -20px rgba(0, 0, 0, 0.3);
  }
  .lg-ok .hero-pair .seg { background: rgba(255, 255, 255, 0.5); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 18px -8px rgba(50, 50, 93, 0.25); }
  .lg-ok .closing button {
    background: rgba(255, 255, 255, 0.14); color: #fff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.25), 0 12px 28px -12px rgba(11, 27, 51, 0.5);
    transition: background 0.2s;
  }
  .lg-ok .closing button:hover { background: rgba(255, 255, 255, 0.24); }

  /* Buttons are glass. Actions are blue glass: a translucent blue body lit from above, a bright top edge and a darker
     lower one. Secondary controls are clear glass. The look holds in every browser; Chromium also bends what passes
     under the rim. */
  .topbar nav a.pill, .scan-form button, .closing button {
    backdrop-filter: blur(8px) saturate(1.6); -webkit-backdrop-filter: blur(8px) saturate(1.6);
  }
  .topbar nav a.pill, .scan-form button {
    background: linear-gradient(180deg, rgba(42, 102, 250, 0.94), rgba(24, 78, 226, 0.97));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.16), inset 0 -1px 0 rgba(11, 27, 90, 0.28),
      0 8px 20px -8px rgba(31, 90, 240, 0.6), 0 2px 4px -1px rgba(11, 27, 51, 0.12);
    transition: background 0.2s, box-shadow 0.2s, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .topbar nav a.pill:hover, .scan-form button:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(58, 116, 255, 0.95), rgba(31, 90, 240, 0.97));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(11, 27, 90, 0.28),
      0 12px 26px -8px rgba(31, 90, 240, 0.65), 0 2px 4px -1px rgba(11, 27, 51, 0.12);
  }
  .topbar nav a.pill:active, .scan-form button:active:not(:disabled), .next:active, .closing button:active { transform: translateY(1px); }
  .lg-ok .topbar nav a.pill, .lg-ok .scan-form button { background: linear-gradient(180deg, rgba(42, 102, 250, 0.88), rgba(24, 78, 226, 0.93)); }
  .lg-ok .topbar nav a.pill:hover, .lg-ok .scan-form button:hover:not(:disabled) { background: linear-gradient(180deg, rgba(58, 116, 255, 0.9), rgba(31, 90, 240, 0.94)); }
  .next {
    background: rgba(255, 255, 255, 0.55); border-color: transparent;
    backdrop-filter: blur(8px) saturate(1.6); -webkit-backdrop-filter: blur(8px) saturate(1.6);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(11, 27, 51, 0.08), inset 0 -1px 0 rgba(11, 27, 51, 0.06),
      0 6px 16px -8px rgba(50, 50, 93, 0.3);
    transition: background 0.15s, box-shadow 0.15s, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .next:hover { border-color: transparent; background: rgba(233, 240, 255, 0.7);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(31, 90, 240, 0.28), 0 8px 20px -8px rgba(31, 90, 240, 0.35); }
  /* A soft white core keeps the links legible over anything, and leaves the rim clear so the bending shows */
  .topbar-float .bar::before {
    content: ""; position: absolute; inset: 7px 12px; z-index: -1; border-radius: inherit; background: rgba(255, 255, 255, 0.88);
    filter: blur(6px); opacity: 0; transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lg-ok .topbar-float.docked .bar::before { opacity: 1; }
  .lg-defs { position: absolute; width: 0; height: 0; overflow: hidden; }

  /* Phone menu: a button in the bar opens a glass panel of the section links below it */
  .menu-btn { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 40px; height: 40px; margin-left: 0.4rem;
    border: 0; border-radius: 9999px; background: transparent; cursor: pointer; align-items: center; }
  .menu-btn span { display: block; width: 18px; height: 1.75px; border-radius: 2px; background: var(--text);
    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
  .topbar-float.menu-open .menu-btn span:first-child { transform: translateY(3.4px) rotate(45deg); }
  .topbar-float.menu-open .menu-btn span:last-child { transform: translateY(-3.4px) rotate(-45deg); }
  .topbar-float .bar nav { margin-left: auto; }
  .topbar .mnav { position: absolute; left: 0; right: 0; top: calc(100% - 0.25rem); display: grid; gap: 0; padding: 0.4rem; border-radius: 20px;
    background: rgba(255, 255, 255, 0.82); -webkit-backdrop-filter: blur(16px) saturate(1.6); backdrop-filter: blur(16px) saturate(1.6);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.6), 0 24px 48px -16px rgba(50, 50, 93, 0.35), 0 4px 10px -4px rgba(0, 0, 0, 0.1);
    opacity: 0; transform: translateY(-6px) scale(0.98); transform-origin: top right; visibility: hidden; pointer-events: none;
    transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s 0.4s; }
  /* Text sits on it, so it is mostly frost: the rim still bends what passes under */
  .lg-ok .topbar .mnav { background: rgba(255, 255, 255, 0.9); }
  .topbar-float.menu-open .mnav { opacity: 1; transform: none; visibility: visible; pointer-events: auto; transition-delay: 0s; }
  /* Link text lines up with the logo in the bar above: 0.4rem of panel plus 0.5rem of link, as the bar's 0.9rem */
  .topbar .mnav a { padding: 0.75rem 0.5rem; border-radius: 12px; font-size: 1.05rem; color: var(--text); text-decoration: none; }
  .topbar-float.docked .mnav { left: -0.9rem; right: -0.9rem; }
  .topbar .mnav a:hover, .topbar .mnav a:focus-visible { background: rgba(31, 90, 240, 0.08); color: var(--accent); outline: none; }
  @media (min-width: 769px) { .topbar .mnav { display: none; } }

  /* Hero: spot the fake */
  .specimen { padding: 5.5rem 0 2rem; position: relative; }
  @media (min-width: 769px) { .specimen .headline { max-width: 11.5ch; margin-bottom: 3.2rem; } }
  .specimen > *:not(.hero-rays) { position: relative; z-index: 1; }
  /* The pair's label ends the domain row, so the row shares out the width and the two never collide */
  .specimen .hero-pair {
    justify-self: end; width: max-content; font-size: 0.85rem; color: var(--text-dim);
    opacity: 0; transform: translateY(4px); transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .hero-pair.on { opacity: 1; transform: none; }

  .hero-pair .seg { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); border-radius: 9999px; }
  .hero-pair b { color: #1f5af0; font-family: var(--font-specimen); font-weight: 400; font-size: 1.05rem; line-height: 1; }
  /* The glyphs are set larger than the text beside them: centre each part so both sit on the same line */
  .hero-pair .seg { align-items: stretch; }
  .hero-pair .seg > * { display: inline-flex; align-items: center; gap: 0.3em; }
  .hero-pair b.fk { color: #d92d20; }
  @media (max-width: 1024px) { .hero-pair { display: none; } }
  .specimen::before {
    content: ""; position: absolute; z-index: 0; pointer-events: none; top: -6rem; bottom: 0; left: 50%; width: 100vw;
    transform: translateX(-50%);
    background:
      radial-gradient(38rem 26rem at 70% 28%, rgba(31, 90, 240, 0.07), transparent 70%),
      radial-gradient(30rem 22rem at 88% 40%, rgba(255, 122, 69, 0.06), transparent 70%),
      radial-gradient(34rem 24rem at 80% 12%, rgba(122, 76, 255, 0.05), transparent 70%);
  }
  /* Rays sweep across o and ᴏ, which are never drawn: they show only where the rays cross ink, as in the measurement */
  .hero-rays {
    position: absolute; z-index: 0; pointer-events: none; top: -6rem; height: calc(100% + 6rem);
    left: 50%; width: 100vw; --tilt-x: 5deg; --tilt-y: -9deg;
    transform: translateX(-50%) perspective(1600px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
    transform-origin: 75% 45%; transition: transform 1.4s cubic-bezier(0.22, 1, 0.36, 1);
    /* No CSS mask: the canvas fades itself (see draw), which is far cheaper than re-masking every frame */
  }
  @media (max-width: 768px) {
    .hero-rays { transform: translateX(-50%); opacity: 0.85; }
    .specimen { padding-top: 8.5rem; }
  }
  .headline {
    font-family: var(--font-body); font-weight: 400; font-size: clamp(2.4rem, 5.6vw, 4.6rem);
    line-height: 1.06; letter-spacing: -0.035em; margin: 0.9rem 0 2.6rem; text-wrap: balance; color: var(--text);
  }
  .headline em { font-style: normal; color: var(--accent); }
  .plates { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .plate {
    position: relative; text-align: left; cursor: pointer; border: 0; border-radius: 8px;
    background: #fff; color: var(--ink); padding: 2.6rem 2.2rem 2.2rem;
    box-shadow: 0 30px 60px -12px rgba(50, 50, 93, 0.22), 0 18px 36px -18px rgba(0, 0, 0, 0.25);
    transition: transform 0.25s cubic-bezier(.2,.8,.2,1), box-shadow 0.25s;
    opacity: 0; transform: translateY(14px);
    animation: rise 0.6s cubic-bezier(.2,.8,.2,1) forwards;
  }
  .plate + .plate { animation-delay: 0.08s; }
  @keyframes rise { to { opacity: 1; transform: none; } }
  .plate:hover:not([disabled]) { transform: translateY(-3px); box-shadow: 0 40px 70px -14px rgba(50, 50, 93, 0.3), 0 20px 40px -20px rgba(0, 0, 0, 0.3); }
  .plate:focus-visible { outline: 3px solid var(--accent-soft); outline-offset: 3px; }
  .plate[disabled] { cursor: default; }
  .plate-tag { position: absolute; top: 1rem; left: 1.2rem; font-size: 0.85rem; font-weight: 500; color: var(--text-dim); }
  .plate-stamp {
    position: absolute; top: 0.9rem; right: 1rem; font-size: 0.8rem; font-weight: 600;
    padding: 0.2rem 0.7rem; border-radius: 9999px; opacity: 0; transform: translateY(-4px);
    transition: opacity 0.25s, transform 0.25s;
  }
  .plate.is-fake .plate-stamp { background: #fee4e2; color: var(--danger-high); }
  .plate.is-real .plate-stamp { background: var(--bg-soft); color: var(--text-dim); }
  .revealed .plate-stamp { opacity: 1; transform: none; }
  .plate-domain {
    display: block; font-family: var(--font-specimen); font-size: clamp(1.9rem, 4.2vw, 3.7rem);
    letter-spacing: -0.01em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .plate-domain .ch { position: relative; }
  .loupe {
    position: absolute; pointer-events: none; border-radius: 50%; border: 2px solid var(--danger-high);
    background: rgba(217, 45, 32, 0.06);
    transform: scale(0.3); opacity: 0; transition: transform 0.4s cubic-bezier(.2,1.3,.4,1), opacity 0.25s;
  }
  .revealed .loupe { transform: scale(1); opacity: 1; }
  .is-real .loupe { border-color: var(--border-strong); background: none; border-style: dashed; }
  /* The verdict opens its own space on an ease-out, then its parts arrive one after another */
  .verdict { display: grid; grid-template-rows: 0fr; margin-top: 1.8rem; transition: grid-template-rows 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
  .revealed .verdict { grid-template-rows: 1fr; }
  /* Room around the content for shadows, taken back with negative margins so the layout is unchanged */
  .verdict-inner { min-height: 0; overflow: hidden; padding: 6px 24px 32px; margin: -6px -24px -32px; }
  /* In order of weight: the answer, the one-line reason, the evidence, then the way on */
  .verdict-head { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .verdict-tag { font-size: 0.85rem; font-weight: 500; padding: 0.22rem 0.75rem; border-radius: 9999px; background: var(--accent-soft); color: var(--accent); }
  .verdict-tag.wrong { background: var(--bg-soft); color: var(--text-dim); }
  .verdict-title { margin: 0; font-size: clamp(1.6rem, 3vw, 2.1rem); font-weight: 400; line-height: 1.15; letter-spacing: -0.025em; color: var(--text); }
  .verdict-line { margin-top: 0.55rem; max-width: 62ch; font-size: 1.1rem; line-height: 1.55; color: var(--text-dim); text-wrap: pretty; }
  .verdict-actions { margin-top: 1.25rem; }
  .verdict-head, .verdict-line, .verdict-actions { opacity: 0; transform: translateY(10px);
    transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
  .revealed .verdict-head, .revealed .verdict-line, .revealed .verdict-actions { opacity: 1; transform: none; }
  .revealed .verdict-head { transition-delay: 0.08s; }
  .revealed .verdict-line { transition-delay: 0.16s; }
  .revealed .verdict-actions { transition-delay: 0.5s; }
  .evidence {
    display: grid; grid-template-columns: auto 1fr; gap: 2.75rem; align-items: center; margin-top: 1.5rem;
    background: var(--bg-soft); border-radius: 12px; padding: 1.5rem 1.75rem;
    opacity: 0; transform: translateY(16px);
    transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .revealed .evidence { opacity: 1; transform: none; transition-delay: 0.2s; }
  .specimen .evidence > * { opacity: 0; transform: translateY(8px);
    transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
  .revealed .evidence > * { opacity: 1; transform: none; }
  .revealed .evidence > :nth-child(1) { transition-delay: 0.32s; }
  .revealed .evidence > :nth-child(2) { transition-delay: 0.4s; }

  .specimen .evidence .g { transform: scale(0.9); transition: transform 0.7s cubic-bezier(0.34, 1.4, 0.64, 1); }
  .revealed .evidence .g { transform: none; transition-delay: 0.36s; }
  .revealed .evidence figure + figure .g { transition-delay: 0.46s; }
  .glyph-pair { display: flex; gap: 1rem; align-items: flex-end; }
  .glyph-pair figure { text-align: center; }
  .glyph-pair .g {
    display: block; font-family: var(--font-specimen); font-size: 4rem; line-height: 1; width: 4.6rem; height: 4.8rem;
    background: #fff; color: var(--ink); border-radius: 8px; padding-top: 0.25rem; box-shadow: var(--shadow-sm);
  }
  .glyph-pair .g.fake { box-shadow: 0 0 0 2px var(--danger-high); }
  .glyph-pair figcaption { font-size: 0.85rem; color: var(--text-dim); margin-top: 0.45rem; }
  .facts { display: grid; grid-template-columns: 9rem 1fr; gap: 0.45rem 1.4rem; font-size: 0.98rem; }
  .facts dt { color: var(--text-dim); }
  .facts dd { color: var(--text); }
  .facts dd .mono { font-size: 0.88rem; }
  .next {
    font-family: var(--font-body); font-size: 0.98rem; font-weight: 500; color: var(--accent); background: #fff;
    border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: 9999px; cursor: pointer; white-space: nowrap;
    transition: border-color 0.15s, background 0.15s;
  }
  .next:hover { border-color: var(--accent); background: var(--accent-soft); }
  .try { margin-top: 2.8rem; display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: center; }
  /* On desktop the row also holds the pair's label at its right end */
  @media (min-width: 1025px) { .try { grid-template-columns: auto minmax(0, 30rem) 1fr; } }
  .try-label { font-size: 1.1rem; font-weight: 500; color: var(--text); }
  .home .scan-form { margin: 0; max-width: 560px; }
  .home .scan-form input { border-radius: 9999px 0 0 9999px; padding-left: 1.4rem; }
  /* Rounded on the right only, so the text sits a touch left of centre to look centred */
  .home .scan-form button { border-radius: 0 9999px 9999px 0; padding-left: 1.2rem; padding-right: 1.55rem; }

  /* Sections */
  .sec { padding: 6.5rem 0 1rem; }

  /* Where a lookalike is caught, and where it reads as written */
  .surfaces { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; align-items: stretch; }
  .surface { margin: 0; display: grid; grid-template-rows: auto 1fr auto; gap: 0.9rem; background: #fff; border-radius: 12px; padding: 1.2rem 1.3rem 1.3rem;
    box-shadow: 0 16px 32px -12px rgba(50, 50, 93, 0.16), 0 4px 10px -4px rgba(0, 0, 0, 0.08); }
  .surface-k { font-size: 0.9rem; font-weight: 500; color: var(--text-dim); }
  .surface-v { font-size: 0.92rem; font-weight: 500; color: var(--danger-high); }
  .surface-v.caught { color: var(--text-dim); }
  .mock-bar { align-self: center; padding: 0.6rem 1rem; border-radius: 9999px; background: var(--bg-soft); font-size: 0.95rem; color: var(--text); }
  .mock-mail, .mock-chat { align-self: center; font-size: 0.98rem; line-height: 1.5; color: var(--text); }
  .mock-from { font-weight: 600; margin-bottom: 0.25rem; }
  .mock-bubble { display: inline-block; padding: 0.65rem 0.9rem; border-radius: 16px 16px 16px 4px; background: var(--bg-soft); }
  .mock-link { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; font-family: var(--font-specimen); }
  @media (max-width: 768px) { .surfaces { grid-template-columns: 1fr; } }
  .sec-head { margin-bottom: 2.75rem; max-width: 52rem; }
  .sec-head h2 { font-weight: 400; font-size: clamp(1.9rem, 3.6vw, 3rem); line-height: 1.1; letter-spacing: -0.03em; text-wrap: balance; color: var(--text); }
  .sec-head h2 em { font-style: normal; color: var(--accent); }
  .lede { text-wrap: pretty; margin-top: 1rem; font-size: 1.2rem; line-height: 1.55; color: var(--text-dim); max-width: 64ch; }
  .lede + .lede { margin-top: 0.8rem; }
  .lede a, .footnote a { color: var(--accent); text-decoration: none; }
  .lede a:hover, .footnote a:hover { text-decoration: underline; }
  .swapch { color: var(--danger-high); box-shadow: inset 0 -2px 0 rgba(217, 45, 32, 0.45); }
  .reveal-up { opacity: 0; transform: translateY(20px); transition: opacity 0.6s, transform 0.6s cubic-bezier(.2,.8,.2,1); }
  .reveal-up.in { opacity: 1; transform: none; }

  /* The method, on a dark slab */
  .slab { border-radius: 24px; padding: 4.5rem 3.5rem; margin-top: 6.5rem; }
  .slab.sec { padding-top: 4.5rem; padding-bottom: 4.5rem; }
  .slab-dark { background: #0b1b33; color: #fff; }
  .slab-dark .sec-head h2 { color: #fff; }
  .slab-dark .lede { color: #b6c2d4; }
  .slab-dark .lede a { color: #8fb0ff; }
  .slab-dark .swapch { color: #ff8a80; box-shadow: inset 0 -2px 0 rgba(255, 138, 128, 0.5); }
  .slab-dark .footnote { color: #8e9cb2; }
  .raylab { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 1.75rem; align-items: center; }
  .raylab figure { background: #fff; border-radius: 12px; padding: 1rem; position: relative; }
  .raylab canvas { width: 100%; aspect-ratio: 1; display: block; }
  .raylab figcaption { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; font-size: 0.85rem; color: var(--text-dim); margin-top: 0.6rem; }
  .raylab figcaption span:last-child { text-align: right; text-wrap: balance; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 42px; margin-top: 0.6rem; }
  .bars i { flex: 1; background: var(--ink); min-height: 2px; border-radius: 1px; transition: height 0.12s; }
  .raylab-mid { text-align: center; min-width: 11rem; font-variant-numeric: tabular-nums; }
  .raylab-mid .big { font-weight: 400; letter-spacing: -0.03em; font-size: 3rem; line-height: 1; color: #fff; }
  .raylab-mid .lbl { font-size: 0.95rem; color: #b6c2d4; margin-top: 0.3rem; }
  .raylab-mid .match { margin-top: 1.4rem; font-size: 0.9rem; font-weight: 500; padding: 0.3rem 0.8rem; border-radius: 9999px; display: inline-block; }
  .raylab-mid .match.same { background: rgba(255, 138, 128, 0.16); color: #ffb3ab; }
  .raylab-mid .match.diff { background: rgba(110, 231, 183, 0.14); color: #86efac; }
  .chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.75rem; }
  /* Clear glass on the dark slab: a fixed sheen over a tint, lit edges. Only the tint, the edges and the text colour
     change between states, so hovering fades smoothly rather than swapping one gradient for another. */
  .chip { font-family: var(--font-body); font-size: 0.95rem; color: #d5deea; border: 0; padding: 0.45rem 1rem; border-radius: 9999px; cursor: pointer;
    background-color: rgba(255, 255, 255, 0.05); background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 6px 14px -8px rgba(0, 0, 0, 0.5);
    transition: background-color 0.2s, box-shadow 0.2s, color 0.2s; }
  .chip:hover { background-color: rgba(255, 255, 255, 0.11); color: #fff; }
  .chip[aria-pressed="true"] { color: #0b1b33; background-color: #fff;
    box-shadow: inset 0 1px 0 #fff, inset 0 -1px 0 rgba(11, 27, 51, 0.12), 0 8px 18px -8px rgba(0, 0, 0, 0.55); }
  .footnote { margin-top: 1.25rem; font-size: 0.92rem; color: var(--text-dim); max-width: 72ch; }

  /* Font specimens: product cards */
  .specimens { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: auto; gap: 1.25rem; }
  @media (max-width: 1100px) { .specimens { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .spec { background: #fff; border-radius: 10px; padding: 1.4rem 1.4rem 1.5rem; display: grid; grid-row: span 4;
    grid-template-rows: subgrid; grid-template-columns: minmax(0, 1fr); row-gap: 0; align-items: start; justify-items: start;
    box-shadow: 0 16px 32px -12px rgba(50, 50, 93, 0.16), 0 4px 10px -4px rgba(0, 0, 0, 0.08); overflow: hidden; }
  .spec-font { font-size: 0.9rem; font-weight: 500; color: var(--text-dim); }
  .spec-words { margin: 1rem 0 1.1rem; line-height: 1.05; align-self: end; }
  .spec-words span { display: block; font-size: 2.3rem; color: var(--ink); }
  .spec-words span + span { margin-top: 0.15rem; }
  .spec-words mark { background: none; color: inherit; box-shadow: inset 0 -3px 0 rgba(217, 45, 32, 0.55); }
  /* The grade and its percentage stay on one line where they fit; in a narrow card they wrap rather than clip,
     with a hairline on each part's top and left edge so the divider shows either way */
  .stamp { display: inline-flex; flex-wrap: wrap; max-width: 100%; font-variant-numeric: tabular-nums; font-size: 0.82rem;
    font-weight: 600; border-radius: 12px; overflow: hidden; }
  .stamp > span { padding: 0.18rem 0.65rem; display: inline-block; white-space: nowrap; flex: 1 0 auto;
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.6); }
  .stamp.g4 { background: #fee4e2; color: #b42318; }
  .stamp.g3 { background: #fef0c7; color: #93370d; }
  .stamp.g2 { background: #fef7e6; color: #93370d; }
  .stamp.g1 { background: #dcfae6; color: #067647; }
  .spec-note { margin-top: 0.7rem; font-size: 0.9rem; color: var(--text-dim); line-height: 1.4; }
  .reveal-up.in .stamp { animation: pop 0.35s cubic-bezier(.2,1.4,.4,1) backwards; }
  .spec:nth-child(2) .stamp { animation-delay: 0.06s; } .spec:nth-child(3) .stamp { animation-delay: 0.12s; }
  .spec:nth-child(4) .stamp { animation-delay: 0.18s; } .spec:nth-child(5) .stamp { animation-delay: 0.24s; }
  .spec:nth-child(6) .stamp { animation-delay: 0.3s; } .spec:nth-child(7) .stamp { animation-delay: 0.36s; }
  .spec:nth-child(8) .stamp { animation-delay: 0.42s; }
  @keyframes pop { from { opacity: 0; transform: scale(0.85); } }

  /* Registry board */
  .board { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.9rem; }
  .tile { border-radius: 10px; padding: 1rem 1rem 1.05rem; background: #fff;
    box-shadow: 0 8px 20px -10px rgba(50, 50, 93, 0.18), 0 2px 6px -2px rgba(0, 0, 0, 0.06); }
  .tile-tld { font-size: 1.35rem; font-weight: 500; letter-spacing: -0.02em; color: var(--text); }
  .tile-v { margin-top: 0.35rem; font-size: 0.92rem; }
  .tile.yes { box-shadow: 0 0 0 1.5px var(--danger-high), 0 8px 20px -10px rgba(217, 45, 32, 0.35); }
  .tile.yes .tile-v { color: var(--danger-high); font-weight: 500; }
  .tile.no .tile-v { color: var(--text-dim); }
  .tile.unknown .tile-v { color: var(--danger-mid); }
  .reveal-up .tile { opacity: 0; transform: translateY(8px); transition: all 0.4s; }
  .reveal-up.in .tile { opacity: 1; transform: none; }
  .board-note { margin-top: 1.5rem; font-size: 0.98rem; color: var(--text-dim); }

  /* Report preview: a product window */
  /* A glass rim (a bright inner edge over a hairline) with a soft, short shadow, rather than a heavy drop */
  .window { border-radius: 12px; overflow: hidden; background: #fff; position: relative;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.6),
      0 0 0 1px rgba(11, 27, 51, 0.07), 0 18px 36px -18px rgba(50, 50, 93, 0.22), 0 4px 10px -4px rgba(0, 0, 0, 0.06); }
  /* The toolbar floats over the report, which scrolls slowly underneath it */
  .window-bar { position: absolute; z-index: 2; top: 10px; left: 10px; right: 10px; display: flex; align-items: center; gap: 0.45rem;
    padding: 0.6rem 0.9rem; border-radius: 14px; background: rgba(246, 248, 251, 0.94); border: 1px solid var(--border); }
  .lg-ok .window-bar { background: rgba(255, 255, 255, 0.64); border-color: transparent;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.6), 0 10px 26px -12px rgba(50, 50, 93, 0.3), 0 2px 5px -2px rgba(0, 0, 0, 0.08); }
  .lg-ok .window-url { background: rgba(255, 255, 255, 0.6); border-color: rgba(11, 27, 51, 0.06); }
  .window-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--border-strong); }
  .window-url { margin-left: 0.8rem; font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-dim);
    background: #fff; border: 1px solid var(--border); padding: 0.25rem 0.9rem; border-radius: 9999px; flex: 1; max-width: 26rem; }
  .window-body { padding: 0 2rem; height: 34rem; overflow: hidden; position: relative; border-radius: inherit; background: #fff; }
  .window-body #preview { padding: 5rem 0 3rem; will-change: transform; }
  .result-window { margin-top: 0.5rem; }
  .result-body { padding: 5rem 2rem 2rem; background: #fff; border-radius: inherit; }
  @media (max-width: 768px) { .result-body { padding: 4.5rem 1rem 1.25rem; } }
  .window-body::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 6rem; background: linear-gradient(rgba(255,255,255,0), #fff); }
  .window-body #preview { margin: 0; }
  .window-caption { margin-top: 1.1rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: 1rem; color: var(--text-dim); }
  .window-caption a { color: var(--accent); text-decoration: none; font-weight: 500; }

  /* Where the data comes from */
  .numbers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: auto; gap: 1.25rem; }
  .num { padding: 1.75rem; background: var(--bg-soft); border-radius: 12px; display: grid; grid-row: span 3;
    grid-template-rows: subgrid; row-gap: 0; align-content: start; }
  .num-v { font-variant-numeric: lining-nums; font-weight: 400; font-size: clamp(2.8rem, 5vw, 4rem); line-height: 1; letter-spacing: -0.04em; color: var(--text); }
  .num-k { text-wrap: pretty; margin-top: 0.8rem; font-size: 1.02rem; color: var(--text); }
  .num-src { margin-top: 1.2rem; font-size: 0.95rem; color: var(--text-dim); align-self: end; }
  .num-src a { color: var(--accent); text-decoration: none; }

  /* Closing: a blue slab */
  .closing { margin: 6.5rem 0 4rem; padding: 4.5rem 3.5rem; border-radius: 24px; background: var(--accent); color: #fff; position: relative; overflow: hidden; }
  /* Faint parallel rays behind the panel, strongest near the button, for its glass to bend */
  .closing::before {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(118deg, rgba(255, 255, 255, 0.16) 0 1px, transparent 1px 13px);
    -webkit-mask-image: radial-gradient(ellipse 60% 90% at 20% 85%, #000, transparent 75%); mask-image: radial-gradient(ellipse 60% 90% at 20% 85%, #000, transparent 75%);
  }
  .closing > * { position: relative; }
  .closing h2 { text-wrap: balance; font-weight: 400; font-size: clamp(2.2rem, 5vw, 3.8rem); line-height: 1.05; letter-spacing: -0.035em; }
  .closing button { margin-top: 1.75rem; font-family: var(--font-body); font-size: 1.05rem; font-weight: 500;
    background: #fff; color: var(--accent); border: 0; padding: 0.85rem 1.6rem; border-radius: 9999px; cursor: pointer; }
  .closing button:hover { background: var(--accent-soft); }

  @media (prefers-reduced-motion: reduce) {
    .hero-rays { transition: none; }
    .plate, .reveal-up, .reveal-up .tile, .evidence, .loupe, .plate-stamp, .stamp { animation: none !important; transition: none !important; opacity: 1; transform: none; }
    .verdict, .verdict-head, .verdict-line, .verdict-actions, .specimen .evidence > *, .specimen .evidence .g { transition: none !important; opacity: 1; transform: none; }
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
    /* On a phone the bar keeps its one action, and the section links move into the menu */
    .topbar-float .bar nav a:not(.pill) { display: none; }
    .topbar nav a.pill { padding: 0.45rem 0.95rem; font-size: 0.9rem; }
    .topbar-float .menu-btn { display: inline-flex; }
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
    .spec { padding: 1.1rem 1rem 1.2rem; }
    .stamp { font-size: 0.78rem; }
    .spec-words span { font-size: 1.7rem; }
    .board { grid-template-columns: repeat(3, 1fr); }
    .numbers { grid-template-columns: 1fr; }
    .num { grid-row: auto; grid-template-rows: none; }
    .slab, .slab.sec, .closing { padding: 2.75rem 1.4rem; border-radius: 18px; margin-top: 4rem; }
    .home .scan-form, .scan-head .scan-form { gap: 0.6rem; }
    .home .scan-form input, .scan-head .scan-form input { border-radius: 9999px; border-right: 1px solid var(--border); }
    .home .scan-form button, .scan-head .scan-form button { border-radius: 9999px; }
    .window-body { padding: 1rem; }
  }
  @media (max-width: 520px) {
    .specimens { grid-template-columns: 1fr; }
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
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ---------- Glass ----------
  (function () {
    var top = document.querySelector('.topbar-float');
    if (top) {
      var onScroll = function () { top.classList.toggle('docked', window.scrollY > 24); };
      // Anything scrolled to lands below the bar
      document.documentElement.style.setProperty('--bar-h', Math.round(top.offsetHeight) + 'px');
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      // Phone menu: the button toggles it; a link, Escape or a tap outside closes it
      var menuBtn = top.querySelector('.menu-btn'), mnav = top.querySelector('.mnav');
      if (menuBtn && mnav) {
        var setMenu = function (open) {
          top.classList.toggle('menu-open', open);
          menuBtn.setAttribute('aria-expanded', String(open));
          if (open) { var first = mnav.querySelector('a'); if (first) first.focus({ preventScroll: true }); }
        };
        menuBtn.addEventListener('click', function () { setMenu(!top.classList.contains('menu-open')); });
        mnav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && top.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); }
        });
        document.addEventListener('click', function (e) { if (!top.contains(e.target)) setMenu(false); });
      }
    }
    var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    var chromium = brands.some(function (b) { return /Chromium/.test(b.brand); });
    if (!chromium || !window.ResizeObserver) return;
    var NS0 = 'http://www.w3.org/2000/svg', defs = document.querySelector('.lg-defs');
    if (!defs) {
      defs = document.createElementNS(NS0, 'svg'); defs.setAttribute('class', 'lg-defs'); defs.setAttribute('aria-hidden', 'true');
      document.body.appendChild(defs);
    }
    document.documentElement.classList.add('lg-ok');
    var NS = 'http://www.w3.org/2000/svg', count = 0;
    function el(tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      parent.appendChild(e);
      return e;
    }
    // Glass bends blue a little more than red. Each channel is displaced by its own amount, and half of that split is
    // mixed back over the unsplit image, so the fringe is a hint at the rim rather than a coloured outline.
    var SCALE = 16, SPREAD = 0.1, PRISM = 0.5;
    function channel(f, from, row, name) {
      el('feColorMatrix', { 'in': from, type: 'matrix', values: row + ' 0 0 0 1 0', result: name }, f);
    }
    function glass(node) {
      // A surface that is re-rendered keeps one filter under a fixed id rather than adding another each time
      var id = node.getAttribute('data-glass-id') || 'lg-' + (count++), band = +node.getAttribute('data-glass') || 9;
      var old = document.getElementById(id);
      if (old) old.remove();
      var f = el('filter', { id: id, x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' }, defs);
      var map = el('feImage', { x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none', result: 'map' }, f);
      // A curved cover glass over the element's own content (the report window): its edges bend what is inside them,
      // with the same faint fringe but no frost, so the content stays sharp
      var content = node.getAttribute('data-glass-mode') === 'content', bend = content ? 1.6 : 1;
      if (content) el('feOffset', { 'in': 'SourceGraphic', dx: 0, dy: 0, result: 'frost' }, f);
      else el('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: 1, result: 'frost' }, f);
      [['mid', 1], ['dr', 1 - SPREAD], ['db', 1 + SPREAD]].forEach(function (d) {
        el('feDisplacementMap', { 'in': 'frost', in2: 'map', scale: SCALE * bend * d[1], xChannelSelector: 'R', yChannelSelector: 'G', result: d[0] }, f);
      });
      channel(f, 'dr', '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0', 'r');
      channel(f, 'mid', '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0', 'g');
      channel(f, 'db', '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0', 'b');
      el('feBlend', { 'in': 'r', in2: 'g', mode: 'screen', result: 'rg' }, f);
      el('feBlend', { 'in': 'rg', in2: 'b', mode: 'screen', result: 'split' }, f);
      el('feComposite', { 'in': 'split', in2: 'mid', operator: 'arithmetic', k1: 0, k2: PRISM, k3: 1 - PRISM, k4: 0 }, f);
      // A displacement map the size of the surface: neutral grey in the middle; in a band along the rim each pixel
      // points inwards along the rim's normal, so what lies under the edge is drawn in from further in and bends
      // round it. The outermost pixel is left unbent, so the edge itself stays clean.
      var built = '', queued = false;
      function build() {
        queued = false;
        var w = Math.round(node.offsetWidth), h = Math.round(node.offsetHeight);
        // Each corner keeps its own radius: a button joined to a field is only rounded on its outer side
        var cs = getComputedStyle(node), rad = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
          .map(function (k) { return Math.min(parseFloat(cs[k]) || 0, w / 2, h / 2); });
        if (!w || !h || built === w + 'x' + h + 'x' + rad.join()) return;
        built = w + 'x' + h + 'x' + rad.join();
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'), img = g.createImageData(w, h), px = img.data;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          var p0 = x + 0.5 - w / 2, p1 = y + 0.5 - h / 2;
          var r = p0 < 0 ? (p1 < 0 ? rad[0] : rad[3]) : (p1 < 0 ? rad[1] : rad[2]);
          var qx = Math.abs(p0) - (w / 2 - r), qy = Math.abs(p1) - (h / 2 - r);
          var ox = Math.max(qx, 0), oy = Math.max(qy, 0), ol = Math.hypot(ox, oy);
          var d = ol + Math.min(Math.max(qx, qy), 0) - r, nx, ny;
          if (qx > 0 && qy > 0) { nx = ox / ol * Math.sign(p0); ny = oy / ol * Math.sign(p1); }
          else if (qx > qy) { nx = Math.sign(p0); ny = 0; } else { nx = 0; ny = Math.sign(p1); }
          var k, i = (y * w + x) * 4;
          if (content) {
            // A curved edge compresses what is under it: a pixel at depth x shows the content at x + h(x), where
            // h = c.x.(1 - x/rim)^2 is zero at the edge and at the rim's inner side, so the content squeezes into the
            // edge and eases back to flat, and every sample comes from inside the window
            var rim = band * 1.3, t = Math.min(1, Math.max(0, -d) / rim);
            k = Math.min(1, (2 * 0.9 * Math.max(0, -d) * (1 - t) * (1 - t)) / (SCALE * bend));
          } else {
            k = Math.exp(Math.min(0, d) / band * 2.2) * Math.min(1, Math.max(0, -d - 0.5));
          }
          px[i] = 128 - 127 * nx * k; px[i + 1] = 128 - 127 * ny * k; px[i + 2] = 128; px[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        map.setAttribute('width', w); map.setAttribute('height', h);
        map.setAttribute('href', c.toDataURL());
        node.style.setProperty('--lg', 'url(#' + id + ')');
      }
      build();
      new ResizeObserver(function () { if (!queued) { queued = true; requestAnimationFrame(build); } }).observe(node);
    }
    window.glassify = function (root) {
      (root || document).querySelectorAll('[data-glass]:not([data-glassed])').forEach(function (n) { n.setAttribute('data-glassed', ''); glass(n); });
    };
    window.glassify();
  })();

})();

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
  // On the homepage the report arrives in the same product window as the preview, so it reads as the tool's output
  // rather than more of the page; on its own page the report is the page
  let target = results;
  if (document.body.classList.contains('home')) {
    results.innerHTML = '<div class="window result-window"><div class="window-bar" data-glass="8"><i></i><i></i><i></i>' +
      '<span class="window-url">d0ma1n.app/scan/' + escHtml(domain) + '</span></div><div class="result-body" data-glass="14" data-glass-mode="content"></div></div>';
    target = results.querySelector('.result-body');
    if (window.glassify) window.glassify(results);
  }
  target.innerHTML = '<div class="loading" role="status"><div class="wordmark-loader" aria-hidden="true"><svg width="0" height="0" style="position:absolute"><filter id="wl-goo"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 28 -12"/></filter></svg><span class="wl-fold wl-1ch">d</span><span class="wl-swap"><i>o</i><b>0</b></span><span class="wl-fold wl-2ch">ma</span><span class="wl-swap"><i>i</i><b>1</b></span><span class="wl-fold wl-1ch">n</span></div><p>Scanning for lookalikes and checking who holds them&hellip;</p></div>';
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
    renderResults(data, target);
  } catch (err) {
    target.innerHTML = '<div class="loading"><p style="color:var(--danger-high)">Error: ' + escHtml(err.message) + '</p></div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan';
  }
}

// The domain the rendered report is about, for the reports it helps write
let scanOriginal = '';

function renderResults(data, container) {
  scanOriginal = data.original;
  const byDanger = (a, b) => b.dangerScore - a.dangerScore;
  const active = data.variants.filter(v => v.dns && v.dns.threatLevel === 'active');
  const registered = data.variants.filter(v => v.dns && v.dns.registered).sort(byDanger);
  const unregistered = data.variants.filter(v => !v.dns || !v.dns.registered);
  // The registry's own rules (IDN tables, single-script policy) decide whether an unregistered lookalike can be bought at all
  // Only names that were looked up can be called available; the rest are listed apart, as not checked
  const lookedUp = v => v.dns && v.dns.checked !== false;
  const available = unregistered.filter(v => (!v.policy || v.policy.registrable) && lookedUp(v)).sort(byDanger);
  const unchecked = unregistered.filter(v => (!v.policy || v.policy.registrable) && !lookedUp(v)).sort(byDanger);
  const blocked = unregistered.filter(v => v.policy && !v.policy.registrable).sort(byDanger);
  const tld = data.original.slice(data.original.indexOf('.'));

  let html = '';

  html += '<div style="margin-bottom:1.5rem">';
  html += '<h2 style="font-size:1.25rem;margin-bottom:0.5rem">Threat report for ' + escHtml(data.original) + '</h2>';
  const count = (n, label, hot) => '<span' + (hot ? ' class="hot"' : '') + '><b>' + n + '</b> ' + label + '</span>';
  const counts = [count(data.variants.length, data.variants.length === 1 ? 'lookalike' : 'lookalikes')];
  const heldByBrand = registered.filter(v => v.dns.holder && v.dns.holder !== 'other-registrar').length;
  if (registered.length - heldByBrand > 0) counts.push(count(registered.length - heldByBrand, 'probably held by someone else', true));
  if (heldByBrand > 0) counts.push(count(heldByBrand, 'probably held by the brand'));
  if (active.length > 0) counts.push(count(active.length, 'set up for email', true));
  counts.push(count(available.length, 'could be registered'));
  if (unchecked.length) counts.push(count(unchecked.length, 'not checked'));
  if (blocked.length > 0) counts.push(count(blocked.length, 'blocked by registry rules'));
  html += '<div class="results-meta"><span class="seg">' + counts.join('') + '</span></div>';
  html += '<p class="explainer">Each lookalike swaps a letter of your domain for one that looks almost the same: a different Unicode character, or ordinary letters that pass for it, like rn for m. ';
  html += 'The swapped letter is <mark class="diff">highlighted</mark>, with your real domain underneath for comparison.</p>';
  // Chrome catches some lookalikes in its address bar, by rules this report does not model in full, so it makes no count
  if (data.variants.length) html += '<p class="explainer">Browsers show some lookalikes in their xn-- form in the address bar, after the click. In an email or a chat message, a link reads however the sender typed it.</p>';
  html += '</div>';

  if (active.length > 0) {
    html += '<div class="alert-banner">';
    const sending = active.filter(v => sendNote(v.dns.spf)).length, receiving = active.filter(v => v.dns.hasMx).length;
    const many = (n, one, more) => n === 1 ? one : more.replace('#', n);
    html += '<strong>' + many(active.length, '1 lookalike is', '# lookalikes are') + ' set up for email.</strong> ';
    if (sending) html += many(sending, '1 is authorised to send it. ', '# are authorised to send it. ');
    if (receiving) html += many(receiving, '1 has mail servers, so replies to a phishing message would reach whoever holds it. ', '# have mail servers, so replies to a phishing message would reach whoever holds them. ');
    html += 'If the brand is yours, you can <a href="https://www.icann.org/resources/pages/help/dndr/udrp-en" style="color:var(--danger-high);text-decoration:underline">file a UDRP complaint</a> or report it to the registrar.';
    html += '</div>';
  }

  // A lookalike held through the brand's own registrar, or a brand-protection registrar, is most likely the brand's
  const isBrands = v => v.dns.holder && v.dns.holder !== 'other-registrar';
  const elsewhere = registered.filter(v => !isBrands(v));
  const brands = registered.filter(isBrands);
  // Registrar names often end in a full stop ("MarkMonitor Inc."); drop it so sentences don't end in two
  const own = data.originalRegistration && data.originalRegistration.registrar && data.originalRegistration.registrar.replace(/\.$/, '');
  if (elsewhere.length > 0) {
    // What the data shows, not a claim about everything it might have missed
    html += section('Probably held by someone else (' + elsewhere.length + ')', 'var(--danger-high)',
      'Their registrars, name servers and email records differ from ' + escHtml(data.original) + '&rsquo;s' +
      (own ? ' (registered through ' + escHtml(own) + ')' : '') + ', which suggests someone other than the brand holds them. Check what they point to.');
    html += renderVariantTable(elsewhere, data.original);
  }
  if (brands.length > 0) {
    html += section('Probably held by the brand (' + brands.length + ')', 'var(--text-dim)',
      'Each shows why: a registrar that only serves brands, name servers only the brand could have set, or the same registrar as ' + escHtml(data.original) +
      ' along with something only its holder could share. The brand most likely registered them to keep them out of other hands. The same registrar alone is not enough: attackers use popular registrars too.');
    html += renderVariantTable(brands, data.original);
  }

  if (available.length > 0) {
    html += section('Could be registered (' + available.length + ')', 'var(--text)',
      'The registry would accept these and nobody appears to hold them: the registry says so where it was asked, and none has DNS records. If ' + escHtml(data.original) + ' is yours, the most convincing are worth registering defensively, or watching for anyone who registers them.');
    html += renderVariantTable(available, data.original);
  } else if (data.variants.length > 0 && !unchecked.length) {
    html += section('Could be registered (0)', 'var(--text)',
      'None of the lookalikes found can be registered under ' + escHtml(tld) + ' today.');
  }
  if (unchecked.length > 0) {
    html += section('Not checked (' + unchecked.length + ')', 'var(--text-dim)',
      'The registry would accept these, but a scan only looks up so many names, so whether anyone holds them is unknown.');
    html += renderVariantTable(unchecked, data.original);
  }

  if (blocked.length > 0) {
    html += section('Can&rsquo;t be registered (' + blocked.length + ')', 'var(--text-dim)',
      'The ' + escHtml(tld) + ' registry does not accept these characters, so nobody can register them. Listed for completeness.');
    html += renderVariantTable(blocked, data.original);
  }

  // A key to the columns, one short definition each, and the report as data
  html += '<dl class="legend-grid">' +
    '<div><dt>Similarity</dt><dd>The share of text fonts where the swapped character passes for the original (confusable-vision, on macOS fonts and Roboto). Under it, the closest font, or <em>via a fallback font</em> when the browser borrows the character. With several swaps, the weakest counts.</dd></div>' +
    '<div><dt>Swapped in</dt><dd>Where the replacement comes from in Unicode: its script and block. Outside ASCII it is never the ordinary letter it imitates, even when the script is Latin. ASCII lookalikes are ordinary letters and digits, like rn for m.</dd></div>' +
    '<div><dt><span class="punycode">xn--</span> form</dt><dd>How the lookalike is actually registered, and how it appears in DNS, certificates and blocklists.</dd></div>' +
    '</dl>';
  html += '<div class="report-actions"><a class="next" data-glass="8" href="/api/scan?domain=' + encodeURIComponent(data.original) + '&top=50" download="' + escHtml(data.original) + '-lookalikes.json">Download as JSON</a></div>';

  container.innerHTML = html;
}

function section(title, color, blurb) {
  return '<h3 style="font-size:1rem;margin:1.75rem 0 0.25rem;color:' + color + '">' + title + '</h3>' +
    '<div class="results-meta" style="margin-bottom:0.75rem">' + blurb + '</div>';
}

// Script alone misleads ("Latin" reads as ordinary letters); the Unicode block says what kind of character it is
function charKind(s) {
  // Ordinary letters and digits (rn for m, 1 for l) are just that
  if (s.block === 'Basic Latin') return ['ASCII'];
  if (!s.block) return [s.script];
  return s.block.startsWith(s.script) ? [s.block] : [s.script, s.block];
}

// Who handles a lookalike's mail, from its MX records. A known service is named, with what kind of service it is where
// that is certain: "forwarded" only for services that do nothing else. Otherwise the mail server's domain is shown,
// or that the lookalike runs its own.
const MAIL_SERVICES = [
  // Mailboxes
  ['box', /(^|\\.)(google|googlemail)\\.com$/, 'Google Workspace'], ['box', /(^|\\.)outlook\\.com$/, 'Microsoft 365'],
  ['box', /(^|\\.)icloud\\.com$/, 'iCloud Mail'], ['box', /(^|\\.)yahoodns\\.net$/, 'Yahoo Mail'],
  ['box', /(^|\\.)protonmail\\.ch$/, 'Proton Mail'], ['box', /(^|\\.)(messagingengine|fastmail)\\.com$/, 'Fastmail'],
  ['box', /(^|\\.)zoho\\.(com|eu|in|jp|com\\.au)$/, 'Zoho Mail'], ['box', /(^|\\.)gmx\\.(net|com|de)$/, 'GMX'],
  ['box', /(^|\\.)web\\.de$/, 'WEB.DE'], ['box', /(^|\\.)mail\\.com$/, 'mail.com'], ['box', /(^|\\.)mailbox\\.org$/, 'mailbox.org'],
  ['box', /(^|\\.)posteo\\.de$/, 'Posteo'], ['box', /(^|\\.)runbox\\.com$/, 'Runbox'], ['box', /(^|\\.)tutanota\\.de$/, 'Tuta'],
  ['box', /(^|\\.)migadu\\.com$/, 'Migadu'], ['box', /(^|\\.)titan\\.email$/, 'Titan'], ['box', /(^|\\.)privateemail\\.com$/, 'Namecheap Private Email'],
  ['box', /(^|\\.)emailsrvr\\.com$/, 'Rackspace Email'], ['box', /(^|\\.)hostedemail\\.com$/, 'Tucows Email'],
  ['box', /(^|\\.)yandex\\.(net|ru)$/, 'Yandex'], ['box', /(^|\\.)mail\\.ru$/, 'Mail.ru'], ['box', /(^|\\.)seznam\\.cz$/, 'Seznam'],
  ['box', /(^|\\.)naver\\.com$/, 'Naver'], ['box', /(^|\\.)hanmail\\.net$/, 'Daum'], ['box', /(^|\\.)qq\\.com$/, 'Tencent'],
  ['box', /(^|\\.)mxhichina\\.com$/, 'Alibaba Mail'], ['box', /(^|\\.)163\\.com$/, 'NetEase'],
  ['box', /(^|\\.)orange\\.fr$/, 'Orange'], ['box', /(^|\\.)free\\.fr$/, 'Free'],
  // Hosting companies and registrars (mailboxes or forwarding, not always telling which)
  ['host', /(^|\\.)secureserver\\.net$/, 'GoDaddy'], ['host', /(^|\\.)hostinger\\.com$/, 'Hostinger'],
  ['host', /(^|\\.)(ionos\\.[a-z.]+|kundenserver\\.de)$/, 'IONOS'], ['host', /(^|\\.)ovh\\.net$/, 'OVH'],
  ['host', /(^|\\.)gandi\\.net$/, 'Gandi'], ['host', /(^|\\.)dreamhost\\.com$/, 'DreamHost'],
  ['host', /(^|\\.)your-server\\.de$/, 'Hetzner'], ['host', /(^|\\.)rzone\\.de$/, 'Strato'], ['host', /(^|\\.)one\\.com$/, 'one.com'],
  ['host', /(^|\\.)infomaniak\\.ch$/, 'Infomaniak'], ['host', /(^|\\.)hostpoint\\.ch$/, 'Hostpoint'], ['host', /(^|\\.)aruba\\.it$/, 'Aruba'],
  ['host', /(^|\\.)register\\.it$/, 'Register.it'], ['host', /(^|\\.)mailspamprotection\\.com$/, 'SiteGround'],
  // Forwarding only: mail is passed on to an inbox somewhere else
  ['fwd', /(^|\\.)mx\\.cloudflare\\.net$/, 'Cloudflare Email Routing'], ['fwd', /(^|\\.)improvmx\\.com$/, 'ImprovMX'],
  ['fwd', /(^|\\.)forwardemail\\.net$/, 'Forward Email'], ['fwd', /(^|\\.)eforward\\d*\\.registrar-servers\\.com$/, 'Namecheap'],
  ['fwd', /(^|\\.)fwd\\d*\\.porkbun\\.com$/, 'Porkbun'],
  // Services built for sending and receiving mail at volume
  ['bulk', /(^|\\.)mailgun\\.org$/, 'Mailgun'], ['bulk', /(^|\\.)sendgrid\\.net$/, 'SendGrid'],
  ['bulk', /(^|\\.)sparkpostmail\\.com$/, 'SparkPost'], ['bulk', /(^|\\.)postmarkapp\\.com$/, 'Postmark'],
  ['bulk', /(^|\\.)mailersend\\.net$/, 'MailerSend'], ['bulk', /(^|\\.)mandrillapp\\.com$/, 'Mandrill'],
  ['bulk', /(^|\\.)(amazonses\\.com|inbound-smtp\\.[a-z0-9-]+\\.amazonaws\\.com)$/, 'Amazon SES'],
  // Mail filtering, which sits in front of a company's own mail
  ['filter', /(^|\\.)mimecast\\.com$/, 'Mimecast'], ['filter', /(^|\\.)(pphosted|ppe-hosted)\\.com$/, 'Proofpoint'],
  ['filter', /(^|\\.)barracudanetworks\\.com$/, 'Barracuda'], ['filter', /(^|\\.)iphmx\\.com$/, 'Cisco Secure Email'],
  ['filter', /(^|\\.)trendmicro\\.(com|eu)$/, 'Trend Micro'], ['filter', /(^|\\.)sophos\\.com$/, 'Sophos'],
  ['filter', /(^|\\.)messagelabs\\.com$/, 'Symantec Email Security'], ['filter', /(^|\\.)mailcontrol\\.com$/, 'Forcepoint'],
  ['filter', /(^|\\.)hornetsecurity\\.com$/, 'Hornetsecurity'], ['filter', /(^|\\.)spamexperts\\.(com|net|eu)$/, 'N-able Mail Assure'],
  ['filter', /(^|\\.)mailchannels\\.net$/, 'MailChannels'],
];
const MAIL_KIND = {
  box: n => 'Mail through ' + n, host: n => 'Mail through ' + n, fwd: n => 'Mail forwarded by ' + n,
  bulk: n => 'Mail through ' + n + ', a bulk email service', filter: n => 'Mail filtered by ' + n,
};
function mailNote(mx, domain) {
  const hosts = (mx || []).filter(m => m.exchange && m.exchange !== '.').sort((a, b) => a.priority - b.priority).map(m => m.exchange.toLowerCase());
  if (!hosts.length) return 'Mail servers set up';
  const known = MAIL_SERVICES.find(([, re]) => hosts.some(h => re.test(h)));
  if (known) return escHtml(MAIL_KIND[known[0]](known[2]));
  // The lookalike's own mail server (mail.<the lookalike>): someone set up mail on purpose
  const ascii = (domain || '').toLowerCase();
  if (hosts.some(h => h === ascii || h.endsWith('.' + ascii))) return 'Runs its own mail server';
  return 'Mail through ' + escHtml(hosts[0].split('.').slice(-2).join('.'));
}

// A registered lookalike's status: a label, then one short fact per line, from DNS and the registry's record
function registeredStatus(v) {
  const d = v.dns, rd = d.rdap || {}, st = rd.status || [];
  const onHold = st.some(x => /^(client|server)Hold$/.test(x));
  const leaving = st.some(x => /^(pendingDelete|redemptionPeriod)$/.test(x));
  const label = onHold ? ['threat-none', 'Suspended']
    : leaving ? ['threat-none', 'Expiring']
    : d.threatLevel === 'active' ? ['threat-active', 'Registered, set up for email']
    : d.parking ? ['threat-parked', 'Parked']
    : ['threat-parked', 'Registered'];
  const facts = [];
  if (onHold) facts.push('On hold at the registry, usually after an abuse report');
  if (leaving) facts.push('Being deleted, so it may soon be free to register');
  if (d.parking) facts.push('Parked with ' + escHtml(d.parking) + ', often for sale');
  if (rd.since) {
    const days = Math.floor((Date.now() - Date.parse(rd.since)) / 864e5);
    // A lookalike registered in the last two months is one of the strongest signs of a campaign
    facts.push(days >= 0 && days < 60 ? '<span class="recent">Registered ' + (days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago') + '</span>'
      : 'Since ' + escHtml(rd.since));
  }
  // When the registrar is itself the reason, say so on its line rather than twice
  const byRegistrar = d.holderReason && /^Registered through a registrar/.test(d.holderReason);
  if (rd.registrar) facts.push('Through ' + escHtml(rd.registrar) + (byRegistrar ? ', which only serves brands' : ''));
  if (d.holderReason && !(byRegistrar && rd.registrar)) facts.push(escHtml(d.holderReason));
  if (d.hasMx) facts.push(mailNote(d.mx, v.punycode));
  const sends = sendNote(d.spf);
  if (sends) facts.push(sends + (d.dmarc ? ', with DMARC' : ''));
  // "v=spf1 -all": the holder declares the domain sends no mail, the usual defensive set-up
  else if (d.spf) facts.push('Declares it sends no email');
  if (!d.parking) facts.push(d.a && d.a.length ? 'Has a website' : 'No website');
  if (rd.abuse && d.holder === 'other-registrar' && !onHold) facts.push(reportLink(v, rd));
  return '<span class="' + label[0] + '">' + label[1] + '</span>' + facts.map(f => '<div class="swap-note">' + f + '</div>').join('');
}

// A report to the registrar's abuse desk, written for them: the lookalike, what it imitates, and the evidence. The
// address is public (the registry's RDAP record publishes it); the button saves writing the report.
function reportLink(v, rd) {
  const d = v.dns, original = scanOriginal || '';
  const who = (rd.registrar || 'the registrar').replace(/,? *(Inc|LLC|Ltd|Limited|UAB|GmbH)\\.?$/i, '').replace(/\\.$/, '');
  const evidence = [];
  if (d.hasMx) evidence.push('It has mail servers (' + mailNote(d.mx, v.punycode).replace(/<[^>]+>/g, '') + ').');
  if (sendNote(d.spf)) evidence.push('Its SPF record authorises it to send email.');
  if (d.a && d.a.length) evidence.push('It resolves to a website.');
  if (rd.since) evidence.push('It was registered on ' + rd.since + '.');
  const swaps = [...new Set(v.substitutions.map(x => x.original + ' \\u2192 ' + x.replacement + ' (' + x.codepoint + ')'))].join(', ');
  const body = 'Hello,\\n\\nI would like to report a domain that imitates ' + original + ':\\n\\n  ' + v.domain + '  (' + v.punycode + ')\\n\\n' +
    'It swaps letters of ' + original + ' for characters that look almost the same: ' + swaps + '.\\n' +
    (evidence.length ? evidence.join('\\n') + '\\n' : '') + '\\nThe full report: https://d0ma1n.app/scan/' + encodeURIComponent(original) + '\\n\\nThank you.';
  const href = 'mailto:' + rd.abuse + '?subject=' + encodeURIComponent('Lookalike of ' + original + ': ' + v.punycode) + '&body=' + encodeURIComponent(body);
  return 'Concerned? <a class="report-btn" href="' + escHtml(href) + '" title="' + escHtml(rd.abuse) + '">Report it to ' + escHtml(who) + '</a>';
}

// Whether an SPF record authorises anyone to send, and through which service: "v=spf1 -all" alone sends nothing
function sendNote(spf) {
  if (!spf || !/\\s(\\+?(include:|a\\b|a:|mx\\b|mx:|ip4:|ip6:|exists:)|redirect=)/i.test(' ' + spf)) return '';
  const includes = [...spf.matchAll(/(?:include:|redirect=)([^\\s]+)/gi)].map(m => m[1].toLowerCase());
  const known = MAIL_SERVICES.find(([, re]) => includes.some(h => re.test(h)));
  return 'Authorised to send email' + (known ? ' through ' + escHtml(known[2]) : '');
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
    if (isRegistered) status = registeredStatus(v);
    else if (v.policy && !v.policy.registrable) {
      status = '<span class="threat-none">Can&rsquo;t be registered</span><div class="swap-note">' + escHtml(refusal(v)) + '</div>';
    } else {
      const checked = v.dns && v.dns.checked !== false;
      // Available only when the registry itself says so; no DNS records alone could be a name held but not in use
      const confirmed = checked && v.dns.rdap && v.dns.rdap.registered === false;
      status = '<span class="threat-open">' + (!checked ? 'Not checked' : confirmed ? 'Available' : 'No DNS records') + '</span>';
      if (v.dns && !checked) status += '<div class="swap-note">Only the most alike names are looked up.</div>';
      else if (checked && !confirmed) status += '<div class="swap-note">The registry wasn&rsquo;t asked, so it could be held but unused.</div>';
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
    // A pair only in Unicode's confusables list was never measured: say so rather than show its default score
    if (v.substitutions.some(s => s.measured === false)) html += '<td><span class="danger-badge unmeasured">Not measured</span><div class="font-label">Unicode lists it</div>';
    else {
      html += '<td><span class="danger-badge ' + dangerClass + '">' + dangerPct + '%</span>';
      html += '<div class="font-label">' + (v.bestFont ? 'closest in ' + escHtml(v.bestFont) : 'via a fallback font') + '</div>';
    }
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
  if (ac.length === bc.length) return ac.map((c, i) => c === bc[i] ? escHtml(c) : '<mark class="diff">' + escHtml(c) + '</mark>').join('');
  // Different lengths (rn for m): mark what lies between the shared start and the shared end
  let p = 0;
  while (p < ac.length && p < bc.length && ac[p] === bc[p]) p++;
  let q = 0;
  while (q < ac.length - p && q < bc.length - p && ac[ac.length - 1 - q] === bc[bc.length - 1 - q]) q++;
  return escHtml(ac.slice(0, p).join('')) + '<mark class="diff">' + escHtml(ac.slice(p, ac.length - q).join('')) + '</mark>' + escHtml(ac.slice(ac.length - q).join(''));
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
  var ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

  function spans(domain) {
    return Array.from(domain).map(function (c) { return '<span class="ch">' + escHtml(c) + '</span>'; }).join('');
  }

  function showSpecimen() {
    var ex = examples[current];
    fakeSide = Math.random() < 0.5 ? 0 : 1;
    if (window.heroPair) window.heroPair(ex.original, ex.char);
    document.getElementById('brand').textContent = ex.real;
    // The verdict folds away before its content goes, so the page closes up smoothly
    stage.classList.remove('revealed');
    var shown = verdict.innerHTML;
    clearTimeout(verdict.clearing);
    if (shown) verdict.clearing = setTimeout(function () { if (!stage.classList.contains('revealed')) verdict.innerHTML = ''; }, reduced ? 0 : 700);
    plates.forEach(function (p, i) {
      p.disabled = false;
      p.classList.remove('is-fake', 'is-real');
      var dom = i === fakeSide ? ex.fake : ex.real;
      p.querySelector('.plate-domain').innerHTML = spans(dom);
      p.setAttribute('aria-label', (i ? 'B' : 'A') + ': ' + dom);
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
    clearTimeout(verdict.clearing);
    verdict.innerHTML = '<div class="verdict-inner">' +
'<div class="verdict-head"><span class="verdict-tag' + (right ? '' : ' wrong') + '">' + (right ? 'Correct' : 'Not quite') + '</span>' +
        '<h3 class="verdict-title">' + letter + ' is the fake.</h3></div>' +
      '<p class="verdict-line">Its ' + ORDINALS[ex.index] + ' letter is not the letter ' + escHtml(ex.original) + ' but <span class="mono">' + escHtml(ex.codepoint) +
      '</span>, a ' + escHtml(ex.name.toLowerCase().replace(/^latin (small )?letter /, '')) + ', drawn the same way.</p>' +
      '<div class="evidence">' +
        '<div class="glyph-pair"><figure><span class="g">' + escHtml(ex.original) + '</span><figcaption>real</figcaption></figure>' +
        '<figure><span class="g fake">' + escHtml(ex.char) + '</span><figcaption>fake</figcaption></figure></div>' +
        '<dl class="facts">' +
          '<dt>Character</dt><dd><span class="mono">' + escHtml(ex.codepoint) + '</span> ' + escHtml(ex.name.charAt(0) + ex.name.slice(1).toLowerCase()) + '</dd>' +
          '<dt>Unicode block</dt><dd>' + escHtml(ex.block) + '</dd>' +
          '<dt>Looks alike</dt><dd>' + (ex.fallback ? 'when a fallback font draws it, in ' + ex.similarity + '% of pairings'
            : ex.similarity >= 100 ? 'in every text font that includes it' : 'in ' + ex.similarity + '% of the text fonts that include it') + '</dd>' +
          '<dt>Registered</dt><dd>' + (ex.registration && ex.registration.registered
            ? 'Yes' + (ex.registration.since ? ', since ' + escHtml(ex.registration.since.slice(0, 4)) : '') +
              (ex.registration.registrar ? ', through ' + escHtml(ex.registration.registrar) : '')
            : ex.registrable ? 'No, and the .com registry would accept it' : 'No, and the .com registry refuses it') + '</dd>' +
          '<dt>Registered as</dt><dd><span class="mono">' + escHtml(ex.punycode) + '</span></dd>' +
        '</dl>' +
      '</div>' +
      '<div class="verdict-actions"><button type="button" class="next" id="next" data-glass="8">Next example (' + ((current + 1) % examples.length + 1) + ' of ' + examples.length + ')</button></div>' +
      '</div>';
    if (window.glassify) window.glassify(verdict);
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

  // ---------- Hero: rays reveal o and ᴏ only where they cross ink ----------
  (function heroRays() {
    var cv = document.querySelector('.hero-rays');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, MW = 0, MH = 0, S = 2; // glyph coverage is sampled at half resolution, then interpolated
    // Real confusable pairs from the release data: near-identical ones alternating with near misses
    var INFO = (data.heroPairs && data.heroPairs.length ? data.heroPairs : [{ real: 'o', fake: '\u1D0F', codepoint: 'U+1D0F', alike: 100 }]);
    var PAIRS = INFO.map(function (p) { return [p.real, p.fake]; });
    var label = document.querySelector('.hero-pair');
    function showLabel(p) {
      var info = INFO.find(function (x) { return x.real === p[0] && x.fake === p[1]; });
      if (!label) return;
      if (!info) { label.classList.remove('on'); return; }
      label.innerHTML = '<span class="seg" data-glass="6" data-glass-id="lg-pair"><span><b>' + escHtml(info.real) + '</b> and <b class="fk">' + escHtml(info.fake) + '</b> <span class="mono">' + escHtml(info.codepoint) + '</span></span>' +
        '<span>' + (info.fallback ? 'alike when a fallback font draws it, in ' + info.alike + '% of pairings'
          : info.alike >= 95 ? 'alike in every font that has both' : 'alike in ' + info.alike + '% of fonts that have both') + '</span></span>';
      label.classList.add('on');
      if (window.glassify) window.glassify(label);
    }
    var pair = PAIRS[0], cur = null, tween = null, TWEEN = 1.6; // seconds for one glyph to become the next
    var start = performance.now(), visible = true, raf = 0, geo = null, under = null, feather = null, layer = null;

    // Canvas size and where the glyphs go: they fill the band between the top of the canvas and the answer cards
    function measure() {
      // The canvas covers the glyphs and the cards and ends just below them. Its height is set here rather than
      // following the section, so the verdict opening below the cards can neither stretch it nor put rays behind text.
      var secTop = document.getElementById('specimen').getBoundingClientRect().top;
      cv.style.height = Math.round(document.getElementById('plates').getBoundingClientRect().bottom - secTop + 96 + 56) + 'px';
      var r = cv.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = W * dpr; cv.height = H * dpr;
      MW = Math.ceil(W / S); MH = Math.ceil(H / S);
      var narrow = W < 768;
      var cards = document.getElementById('plates').getBoundingClientRect().top;
      // The area behind both cards gets one even field of rays, so A and B sit on the same thing
      var pr = document.getElementById('plates').getBoundingClientRect();
      under = { x0: pr.left - r.left - 8, y0: pr.top - r.top - 4, x1: pr.right - r.left + 8, y1: pr.bottom - r.top + 8 };
      // A soft-edged stencil of that area: the glyphs' rays fade out across its edge and the even field fades in
      feather = document.createElement('canvas'); feather.width = cv.width; feather.height = cv.height;
      var fx = feather.getContext('2d');
      fx.scale(dpr, dpr); fx.filter = 'blur(16px)'; fx.fillStyle = '#000';
      fx.fillRect(under.x0, under.y0, under.x1 - under.x0, under.y1 - under.y0);
      layer = document.createElement('canvas'); layer.width = cv.width; layer.height = cv.height;
      var band = Math.max(80, (cards - r.top) / S);
      geo = { narrow: narrow, size: Math.round(band * 1.05), base: band - 6, right: Math.min(MW * 0.93, (W / 2 + 616) / S) };
      if (narrow) {
        // On a phone the headline fills the width, so the pair sits in the space above it rather than behind it
        var above = Math.max(60, (document.querySelector('.headline').getBoundingClientRect().top - r.top) / S);
        geo.size = Math.round(Math.min(above * 0.95, MW * 0.42)); geo.base = above - 12; geo.right = MW * 0.92;
      }
    }

    // The pair's label sits beside the domain field, right-aligned under the glyphs
    // Distance to the nearest pixel that is set in 'on': a two-pass chamfer transform
    function distanceTo(on) {
      var d = new Float32Array(MW * MH), INF = 1e9, D = 1.4142;
      for (var i = 0; i < d.length; i++) d[i] = on[i] ? 0 : INF;
      for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
        var k = y * MW + x, v = d[k];
        if (x > 0) v = Math.min(v, d[k - 1] + 1);
        if (y > 0) { v = Math.min(v, d[k - MW] + 1); if (x > 0) v = Math.min(v, d[k - MW - 1] + D); if (x < MW - 1) v = Math.min(v, d[k - MW + 1] + D); }
        d[k] = v;
      }
      for (var y2 = MH - 1; y2 >= 0; y2--) for (var x2 = MW - 1; x2 >= 0; x2--) {
        var k2 = y2 * MW + x2, v2 = d[k2];
        if (x2 < MW - 1) v2 = Math.min(v2, d[k2 + 1] + 1);
        if (y2 < MH - 1) { v2 = Math.min(v2, d[k2 + MW] + 1); if (x2 < MW - 1) v2 = Math.min(v2, d[k2 + MW + 1] + D); if (x2 > 0) v2 = Math.min(v2, d[k2 + MW - 1] + D); }
        d[k2] = v2;
      }
      return d;
    }

    // Signed distance fields for a pair (negative inside the ink), and the box the glyphs occupy.
    // Blending two fields morphs one outline into the other, which is what the tween between pairs does.
    function fieldsFor(chars) {
      var m = document.createElement('canvas'); m.width = MW; m.height = MH;
      var mx = m.getContext('2d', { willReadFrequently: true });
      mx.font = geo.size + 'px Arial, sans-serif';
      var gap = geo.size * 0.12, wA = mx.measureText(chars[0]).width, wB = mx.measureText(chars[1]).width;
      var xB = geo.right - wB, xA = xB - gap - wA;
      var fields = chars.map(function (ch, gi) {
        mx.clearRect(0, 0, MW, MH);
        mx.fillStyle = '#000';
        mx.fillText(ch, gi ? xB : xA, geo.base);
        var px = mx.getImageData(0, 0, MW, MH).data, n = MW * MH;
        var inside = new Uint8Array(n), outside = new Uint8Array(n), cov = new Float32Array(n);
        for (var i = 0; i < n; i++) { cov[i] = px[i * 4 + 3] / 255; inside[i] = cov[i] >= 0.5 ? 1 : 0; outside[i] = 1 - inside[i]; }
        var toIn = distanceTo(inside), toOut = distanceTo(outside), f = new Float32Array(n);
        for (var j = 0; j < n; j++) {
          // Along the anti-aliased edge, coverage places the outline between pixels
          f[j] = cov[j] > 0 && cov[j] < 1 ? 0.5 - cov[j] : inside[j] ? -(toOut[j] - 0.5) : toIn[j] - 0.5;
        }
        return f;
      });
      return { f: fields, box: { x0: (xA - 6) * S, x1: (geo.right + 6) * S, y0: (geo.base - geo.size) * S, y1: (geo.base + geo.size * 0.12) * S } };
    }

    function layout() { measure(); cur = fieldsFor(pair); if (tween) tween.to = fieldsFor(tween.pair); }

    // Bilinear signed distance at canvas point (x, y); outside the canvas counts as far from any ink
    function field(f, x, y) {
      var fx = x / S - 0.5, fy = y / S - 0.5, ix = Math.floor(fx), iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix >= MW - 1 || iy >= MH - 1) return 1e3;
      var tx = fx - ix, ty = fy - iy, i = iy * MW + ix;
      return (f[i] * (1 - tx) + f[i + 1] * tx) * (1 - ty) + (f[i + MW] * (1 - tx) + f[i + MW + 1] * tx) * ty;
    }

    // The stretch of a ray (origin o, direction d) inside box b, as [tMin, tMax], or null
    function clip(b, ox, oy, dx, dy) {
      var t0 = -Infinity, t1 = Infinity;
      var ax = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1]];
      for (var k = 0; k < 2; k++) {
        var o = ax[k][0], d = ax[k][1], lo = ax[k][2], hi = ax[k][3];
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return null; continue; }
        var a = (lo - o) / d, c = (hi - o) / d;
        t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c));
      }
      return t0 < t1 ? [t0, t1] : null;
    }

    var INK = ['rgba(31, 90, 240, ', 'rgba(217, 45, 32, '];
    var DEPTH = ['rgba(11, 27, 90, ', 'rgba(110, 20, 14, '];
    var SHIFT = ['rgba(122, 76, 255, ', 'rgba(255, 122, 69, '];
    function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

    // Everything is batched: each frame collects its slices of ink first, then draws them in a few passes (the soft
    // extrusion, a halo, a glow, the line, the dots), one stroke per pass rather than one per slice. Short slices, where
    // a ray only grazes a curve, go in fainter buckets so they fade in rather than flicker.
    var BUCKETS = [1, 0.6, 0.3];
    function bucketOf(w) { return w > 0.75 ? 0 : w > 0.4 ? 1 : 2; }

    function drawGlyph(g, segs, dots, fade, box) {
      var lineGrad = ctx.createLinearGradient(box.x0, 0, box.x1, 0);
      lineGrad.addColorStop(0, INK[g] + (0.46 * fade) + ')');
      lineGrad.addColorStop(1, SHIFT[g] + (0.4 * fade) + ')');
      for (var bi = 0; bi < 3; bi++) {
        var list = segs[bi];
        if (!list.length) continue;
        var a = fade * BUCKETS[bi], path = new Path2D();
        for (var i = 0; i < list.length; i += 4) { path.moveTo(list[i], list[i + 1]); path.lineTo(list[i + 2], list[i + 3]); }
        // A soft extrusion behind the line, so the glyph reads as a solid slab
        ctx.lineWidth = 3;
        for (var k = 16; k >= 1; k -= 1.5) {
          ctx.setTransform(dpr, 0, 0, dpr, k * 1.3 * dpr, k * 1.8 * dpr);
          ctx.strokeStyle = DEPTH[g] + (0.03 * a * (17 - k) / 16) + ')';
          ctx.stroke(path);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // A light halo, then a soft glow in the ink's colour, separate the line from its shadow
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.7 * a) + ')'; ctx.lineWidth = 7; ctx.stroke(path);
        ctx.strokeStyle = INK[g] + (0.07 * a) + ')'; ctx.lineWidth = 5; ctx.stroke(path);
        ctx.globalAlpha = BUCKETS[bi]; ctx.strokeStyle = lineGrad; ctx.lineWidth = 2; ctx.stroke(path); ctx.globalAlpha = 1;
        var pts = dots[bi], glow = new Path2D(), core = new Path2D();
        for (var d = 0; d < pts.length; d += 2) {
          glow.moveTo(pts[d] + 5, pts[d + 1]); glow.arc(pts[d], pts[d + 1], 5, 0, 6.2832);
          core.moveTo(pts[d] + 2, pts[d + 1]); core.arc(pts[d], pts[d + 1], 2, 0, 6.2832);
        }
        ctx.fillStyle = INK[g] + (0.09 * a) + ')'; ctx.fill(glow);
        ctx.fillStyle = INK[g] + (0.68 * a) + ')'; ctx.fill(core);
      }
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      var secs = (now - start) / 1000;
      // Always forward: turn a fifth of a half-turn on a cubic ease-in-out, settle, turn again. Rays repeat every
      // half-turn, so they can keep going round without ever reversing.
      var STEP = Math.PI / 5, MOVE = 3.4, REST = 1.1, per = MOVE + REST;
      var n = Math.floor(secs / per), p = secs - n * per;
      var angle = 0.55 + n * STEP + STEP * easeInOutCubic(Math.min(1, p / MOVE));
      var fade = Math.min(1, secs / 1.2);
      // Mid-tween, each glyph's field is a blend of the old pair's and the new one's
      var mix = 0, from = cur, to = null;
      if (tween) {
        var q = (now - tween.at) / 1000 / TWEEN;
        if (q >= 1) { cur = tween.to; pair = tween.pair; tween = null; from = cur; showLabel(pair); }
        else { mix = easeInOutCubic(Math.max(0, q)); to = tween.to; }
      }
      var b = to ? { x0: Math.min(from.box.x0, to.box.x0), x1: Math.max(from.box.x1, to.box.x1),
        y0: Math.min(from.box.y0, to.box.y0), y1: Math.max(from.box.y1, to.box.y1) } : from.box;
      var dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
      var diag = Math.hypot(W, H), cx = W / 2, cy = H / 2, spacing = W < 768 ? 15 : 12, step = 1.5;
      var gx = (b.x0 + b.x1) / 2, gy = (b.y0 + b.y1) / 2;
      ctx.lineCap = 'round';
      // The background rays: one path, lit from the glyphs outwards by a single radial gradient
      var bg = ctx.createRadialGradient(gx, gy, 0, gx, gy, diag * 0.55);
      bg.addColorStop(0, 'rgba(31, 90, 240, ' + (0.09 * fade).toFixed(3) + ')');
      bg.addColorStop(0.45, 'rgba(90, 80, 250, ' + (0.04 * fade).toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(122, 76, 255, 0)');
      var rays = new Path2D(), segs = [[[], [], []], [[], [], []]], dots = [[[], [], []], [[], [], []]];
      for (var off = -diag / 2; off <= diag / 2; off += spacing) {
        var ox = cx + nx * off, oy = cy + ny * off;
        rays.moveTo(ox - dx * diag, oy - dy * diag); rays.lineTo(ox + dx * diag, oy + dy * diag);
        var span = clip(b, ox, oy, dx, dy);
        if (!span) continue;
        for (var g = 0; g < 2; g++) {
          var fa = from.f[g], fb = to ? to.f[g] : null;
          var prev = null, tIn = null;
          for (var t = span[0]; t <= span[1]; t += step) {
            var x = ox + dx * t, y = oy + dy * t, v = field(fa, x, y);
            if (fb) v += (field(fb, x, y) - v) * mix;
            if (prev !== null && (prev < 0) !== (v < 0)) {
              // The outline is where the signed distance passes zero, between the two samples
              var tc = t - step + step * prev / (prev - v);
              if (v < 0) tIn = tc;
              else if (tIn !== null) {
                var len = tc - tIn, w = Math.min(1, Math.max(0, (len - 1.5) / 12));
                w = w * w * (3 - 2 * w);
                if (w > 0.01) {
                  var bk = bucketOf(w), x0 = ox + dx * tIn, y0 = oy + dy * tIn, x1 = ox + dx * tc, y1 = oy + dy * tc;
                  segs[g][bk].push(x0, y0, x1, y1); dots[g][bk].push(x0, y0, x1, y1);
                }
                tIn = null;
              }
            }
            prev = v;
          }
        }
      }
      ctx.strokeStyle = bg; ctx.lineWidth = 1; ctx.stroke(rays);
      drawGlyph(0, segs[0], dots[0], fade, b);
      drawGlyph(1, segs[1], dots[1], fade, b);
      // Fades that keep the rays off the text: in the canvas, not a CSS mask, which is costly to redo every frame
      ctx.globalCompositeOperation = 'destination-out';
      if (W < 768) {
        var vf = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.46);
        vf.addColorStop(0, 'rgba(0, 0, 0, 0)'); vf.addColorStop(1, '#000');
        ctx.fillStyle = vf; ctx.fillRect(0, H * 0.3, W, H * 0.7);
      } else {
        var hf = ctx.createLinearGradient(W * 0.25, 0, W * 0.55, 0);
        hf.addColorStop(0, '#000'); hf.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = hf; ctx.fillRect(0, 0, W * 0.55, H);
        var bf = ctx.createLinearGradient(0, H * 0.75, 0, H);
        bf.addColorStop(0, 'rgba(0, 0, 0, 0)'); bf.addColorStop(1, '#000');
        ctx.fillStyle = bf; ctx.fillRect(0, H * 0.75, W, H * 0.25);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (under && feather && W >= 768) {
        // Only the cards' area is touched: the stencil and the even field are composited there and nowhere else
        var R = underRect();
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(feather, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h); ctx.restore();
        underRays(under, R, dx, dy, nx, ny, diag, cx, cy, spacing, fade);
      }
    }

    // The cards' area in device pixels, with room for the stencil's soft edge
    function underRect() {
      var m = 48, x = Math.max(0, Math.floor((under.x0 - m) * dpr)), y = Math.max(0, Math.floor((under.y0 - m) * dpr));
      return { x: x, y: y, w: Math.min(cv.width, Math.ceil((under.x1 + m) * dpr)) - x, h: Math.min(cv.height, Math.ceil((under.y1 + m) * dpr)) - y };
    }

    // Behind the cards: the same rays at the same angle, evenly lit across both, fading out at either end
    function underRays(U, R, dx, dy, nx, ny, diag, cx, cy, spacing, fade) {
      var lx = layer.getContext('2d');
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(R.x, R.y, R.w, R.h);
      lx.save(); lx.beginPath(); lx.rect(R.x, R.y, R.w, R.h); lx.clip();
      lx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var a = 0.17 * fade, lg = lx.createLinearGradient(U.x0, 0, U.x1, 0);
      lg.addColorStop(0, 'rgba(31, 90, 240, 0)');
      lg.addColorStop(0.14, 'rgba(31, 90, 240, ' + a + ')');
      lg.addColorStop(0.5, 'rgba(122, 76, 255, ' + (a * 0.8) + ')');
      lg.addColorStop(0.86, 'rgba(31, 90, 240, ' + a + ')');
      lg.addColorStop(1, 'rgba(31, 90, 240, 0)');
      lx.strokeStyle = lg; lx.lineWidth = 1;
      lx.beginPath();
      for (var off = -diag / 2; off <= diag / 2; off += spacing) {
        var ox = cx + nx * off, oy = cy + ny * off;
        lx.moveTo(ox - dx * diag, oy - dy * diag); lx.lineTo(ox + dx * diag, oy + dy * diag);
      }
      lx.stroke();
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'destination-in';
      lx.drawImage(feather, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h);
      lx.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h); ctx.restore();
    }

    function tick(now) {
      if (!visible) { raf = 0; return; }
      draw(now);
      raf = requestAnimationFrame(tick);
    }

    function swapTo(next) {
      var target = tween ? tween.pair : pair;
      if (!next || (next[0] === target[0] && next[1] === target[1])) return;
      if (reduced) { pair = next; cur = fieldsFor(pair); draw(start + 60000); return; }
      if (tween) { cur = tween.to; pair = tween.pair; }
      tween = { pair: next, to: fieldsFor(next), at: performance.now() };
      if (label) label.classList.remove('on');
    }
    // The game shows its own swap; otherwise the pairs change every other sweep
    window.heroPair = function (a, b) { swapTo([a, b]); };
    if (!reduced) setInterval(function () {
      if (!visible || tween) return;
      var i = PAIRS.findIndex(function (x) { return x[0] === pair[0] && x[1] === pair[1]; });
      swapTo(PAIRS[(i + 1) % PAIRS.length]);
    }, 22000);

    layout();
    draw(reduced ? start + 60000 : start + 1);
    showLabel(pair);
    // A few degrees of tilt that follows the pointer, eased by the CSS transition
    if (!reduced && window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', function (e) {
        var x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
        cv.style.setProperty('--tilt-y', (-9 + x * 6).toFixed(2) + 'deg');
        cv.style.setProperty('--tilt-x', (5 - y * 4).toFixed(2) + 'deg');
      }, { passive: true });
    }
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { layout(); draw(performance.now()); }, 150);
    });
    if (reduced || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting && !document.hidden;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }).observe(cv);
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
  })();

  // ---------- Ray lab: the method, drawn live ----------
  var SIZE = 320, RAYS = 25, SPAN = 150, ANGLES = 36;
  var canvases = [document.getElementById('ray-a'), document.getElementById('ray-b')];
  var bars = [document.getElementById('bars-a'), document.getElementById('bars-b')];
  var glyphs = ['o', String.fromCodePoint(0x1D0F)];
  var font = 'Arial', masks = [], signatures = [], angle = 0, running = false;

  bars.forEach(function (b) { b.innerHTML = new Array(RAYS + 1).join('<i></i>'); });

  function mask(ch) {
    var c = document.createElement('canvas'); c.width = c.height = SIZE;
    var x = c.getContext('2d', { willReadFrequently: true });
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
      x.fillStyle = '#0b1b33';
      x.fillText(glyphs[i], (SIZE - x.measureText(glyphs[i]).width) / 2, 225);
      var t = angle * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
      x.strokeStyle = 'rgba(31,90,240,0.2)'; x.lineWidth = 1;
      for (var r = 0; r < RAYS; r++) {
        var off = -SPAN + (2 * SPAN * r) / (RAYS - 1), cx = SIZE / 2 - dy * off, cy = SIZE / 2 + dx * off;
        x.beginPath(); x.moveTo(cx - dx * 230, cy - dy * 230); x.lineTo(cx + dx * 230, cy + dy * 230); x.stroke();
      }
      x.fillStyle = '#d92d20';
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
    var x = c.getContext('2d', { willReadFrequently: true }); x.font = '180px ' + family; x.fillStyle = '#000';
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
    fetch('/api/scan?domain=paypal.com&top=50').then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) { renderResults(d, el); drift(el); })
      .catch(function () { el.innerHTML = '<p class="footnote">The live scan could not load just now. <a href="/scan/paypal.com" style="color:var(--accent-bright)">Open it directly</a>.</p>'; });
  }

  // The live report scrolls slowly under the window's glass toolbar, rests, and scrolls back; hovering holds it
  function drift(el) {
    if (reduced || !el.animate) return;
    var body = el.parentNode, d = el.scrollHeight - body.clientHeight;
    if (d < 40) return;
    // About 25px a second on average; sine easing keeps the fastest moment under 40px a second
    var ease = 'cubic-bezier(0.37, 0, 0.63, 1)', rest = 3000, travel = Math.max(8000, d * 40), total = 2 * (rest + travel);
    var down = rest / total, back = (2 * rest + travel) / total;
    var anim = el.animate([
      { transform: 'translateY(0)', offset: 0, easing: ease }, { transform: 'translateY(0)', offset: down, easing: ease },
      { transform: 'translateY(' + -d + 'px)', offset: (rest + travel) / total, easing: ease }, { transform: 'translateY(' + -d + 'px)', offset: back, easing: ease },
      { transform: 'translateY(0)', offset: 1 }
    ], { duration: total, iterations: Infinity });
    body.addEventListener('mouseenter', function () { anim.pause(); });
    body.addEventListener('mouseleave', function () { anim.play(); });
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
