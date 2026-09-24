import type { ScanResult, DomainVariant, ReverseScanResult } from "../src/types.js";

/** Generate the main landing page HTML. */
export function renderLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>d0ma1n - Brand protection from lookalike domains</title>
  <meta name="description" content="Protect your brand from lookalike domain attacks. Lookalike characters measured across fonts, checked against every TLD's registry rules.">
  <meta property="og:title" content="d0ma1n - Brand protection from lookalike domains">
  <meta property="og:description" content="Protect your brand from lookalike domain attacks. Measured lookalike characters, checked against every TLD's registry rules.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://d0ma1n.app">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${STYLES}
</head>
<body>
  <div class="container">
    ${HERO}
    ${RESULTS_CONTAINER}
    ${SCRIPTS_SECTION}
    ${FEATURES_SECTION}
    ${COMPARISON_SECTION}
    ${HOW_IT_WORKS}
    ${OPEN_SOURCE}
    ${FOOTER}
  </div>
  ${SCRIPT}
</body>
</html>`;
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
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
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
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
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
    --bg: #0a0a0f;
    --bg-card: #12121a;
    --bg-input: #1a1a26;
    --border: #2a2a3a;
    --text: #e0e0ea;
    --text-dim: #8888a0;
    --accent: #6366f1;
    --accent-bright: #818cf8;
    --danger-high: #ef4444;
    --danger-mid: #f59e0b;
    --danger-low: #22c55e;
    --active-threat: #dc2626;
    --font-mono: 'JetBrains Mono', 'Courier New', monospace;
    --font-body: 'Instrument Sans', system-ui, sans-serif;
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
    color: white;
    border: none;
    border-radius: 0 8px 8px 0;
    font-family: var(--font-body);
    font-size: 1rem;
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
  #results { margin: 2rem 0 4rem; }

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
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .results-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid rgba(42, 42, 58, 0.5);
    vertical-align: middle;
  }
  .results-table tr:hover td {
    background: rgba(99, 102, 241, 0.05);
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
    background: rgba(245, 158, 11, 0.18);
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
    font-size: 0.8rem;
    font-family: var(--font-mono);
  }
  .danger-high { background: rgba(239, 68, 68, 0.15); color: var(--danger-high); }
  .danger-mid { background: rgba(245, 158, 11, 0.15); color: var(--danger-mid); }
  .danger-low { background: rgba(34, 197, 94, 0.15); color: var(--danger-low); }

  .threat-active {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--active-threat);
    color: white;
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

  .script-tag {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 3px;
    font-size: 0.7rem;
    color: var(--accent-bright);
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
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid rgba(220, 38, 38, 0.3);
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

  /* Scripts section */
  .section {
    padding: 4rem 0;
    border-top: 1px solid var(--border);
  }
  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .section-subtitle {
    color: var(--text-dim);
    margin-bottom: 2rem;
  }

  .scripts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
  .script-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
  }
  .script-native {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }
  .script-name {
    font-size: 0.875rem;
    color: var(--text-dim);
  }

  /* Features */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }
  .feature-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
  }
  .feature-card h3 {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    color: var(--accent-bright);
    margin-bottom: 0.5rem;
  }
  .feature-card p {
    color: var(--text-dim);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* Comparison table */
  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    margin-top: 1.5rem;
  }
  .comparison-table th,
  .comparison-table td {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    text-align: left;
  }
  .comparison-table th {
    background: var(--bg-card);
    font-weight: 600;
  }
  .comparison-table td:first-child {
    color: var(--text-dim);
    font-weight: 500;
  }
  .check { color: var(--danger-low); }
  .cross { color: var(--text-dim); }

  /* How it works */
  .pipeline {
    display: flex;
    gap: 1rem;
    align-items: stretch;
    flex-wrap: wrap;
    margin-top: 1.5rem;
  }
  .pipeline-step {
    flex: 1;
    min-width: 200px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
    position: relative;
  }
  .pipeline-step h4 {
    font-family: var(--font-mono);
    color: var(--accent-bright);
    margin-bottom: 0.5rem;
  }
  .pipeline-step p {
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .pipeline-arrow {
    display: flex;
    align-items: center;
    color: var(--text-dim);
    font-size: 1.5rem;
  }

  /* Open source */
  .oss-links {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 1.5rem;
  }
  .oss-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.9rem;
    transition: border-color 0.2s;
  }
  .oss-link:hover { border-color: var(--accent); }

  /* Footer */
  footer {
    padding: 2rem 0;
    border-top: 1px solid var(--border);
    text-align: center;
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  footer a { color: var(--accent-bright); text-decoration: none; }
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
    .pipeline { flex-direction: column; }
    .pipeline-arrow { justify-content: center; transform: rotate(90deg); }
  }
</style>`;

// --- Page sections ---

const HERO = `
<header class="hero">
  <a href="/" class="logo">d<span>0</span>ma<span>1</span>n</a>
  <p class="tagline">Protect your brand from lookalike domain attacks.</p>
  <form class="scan-form" action="javascript:void(0)" onsubmit="doScan()">
    <input type="text" id="domain-input" placeholder="yourcompany.com" autocomplete="off" spellcheck="false" autofocus>
    <button type="submit" id="scan-btn">Scan</button>
  </form>
</header>`;

const RESULTS_CONTAINER = `<div id="results"></div>`;

const SCRIPTS_SECTION = `
<section class="section">
  <h2 class="section-title">Lookalikes from 12 scripts</h2>
  <p class="section-subtitle">The letter that fakes your domain doesn&rsquo;t have to be Latin. Lookalikes are measured across these twelve writing systems, and d0ma1n checks which of them a registry would actually accept.</p>
  <div class="scripts-grid">
    <div class="script-card"><div class="script-native">Latin</div><div class="script-name">Latin</div></div>
    <div class="script-card"><div class="script-native">&#x41a;&#x438;&#x440;&#x438;&#x43b;&#x43b;&#x438;&#x446;&#x430;</div><div class="script-name">Cyrillic</div></div>
    <div class="script-card"><div class="script-native">&#x395;&#x3bb;&#x3bb;&#x3b7;&#x3bd;&#x3b9;&#x3ba;&#x3ac;</div><div class="script-name">Greek</div></div>
    <div class="script-card"><div class="script-native">&#x627;&#x644;&#x639;&#x631;&#x628;&#x64a;&#x629;</div><div class="script-name">Arabic</div></div>
    <div class="script-card"><div class="script-native">&#x6f22;&#x5b57;</div><div class="script-name">Han</div></div>
    <div class="script-card"><div class="script-native">&#xd55c;&#xae00;</div><div class="script-name">Hangul</div></div>
    <div class="script-card"><div class="script-native">&#x30ab;&#x30bf;&#x30ab;&#x30ca;</div><div class="script-name">Katakana</div></div>
    <div class="script-card"><div class="script-native">&#x3072;&#x3089;&#x304c;&#x306a;</div><div class="script-name">Hiragana</div></div>
    <div class="script-card"><div class="script-native">&#x926;&#x947;&#x935;&#x928;&#x93e;&#x917;&#x930;&#x940;</div><div class="script-name">Devanagari</div></div>
    <div class="script-card"><div class="script-native">&#xe44;&#xe17;&#xe22;</div><div class="script-name">Thai</div></div>
    <div class="script-card"><div class="script-native">&#x10e5;&#x10d0;&#x10e0;&#x10d7;&#x10e3;&#x10da;&#x10d8;</div><div class="script-name">Georgian</div></div>
    <div class="script-card"><div class="script-native">&#x540;&#x561;&#x575;&#x565;&#x580;&#x565;&#x576;</div><div class="script-name">Armenian</div></div>
  </div>
</section>`;

const FEATURES_SECTION = `
<section class="section">
  <h2 class="section-title">What makes d0ma1n different</h2>
  <div class="features-grid">
    <div class="feature-card">
      <h3>Measured, not listed</h3>
      <p>Not a static homoglyph table. confusable-vision release 2 measures 857 lookalike pairs at the size and baseline glyphs have in running text, across every macOS system font and Roboto, calibrated against pairs with known answers. 78 are proposed as additions to Unicode&rsquo;s confusables list.</p>
    </div>
    <div class="feature-card">
      <h3>Registry-aware</h3>
      <p>A lookalike only matters if someone can register it. Each one is checked against what its TLD&rsquo;s registry accepts, for every delegated TLD, so you see which are real openings and which are blocked.</p>
    </div>
    <div class="feature-card">
      <h3>Font-aware</h3>
      <p>Visual similarity depends on the font. A substitution that is invisible in Arial may be obvious in Georgia. d0ma1n shows each lookalike in the font where it is most convincing.</p>
    </div>
  </div>
</section>`;

const COMPARISON_SECTION = `
<section class="section">
  <h2 class="section-title">At a glance</h2>
  <p class="section-subtitle">Inspired by <a href="https://github.com/elceef/dnstwist" style="color:var(--accent-bright)">dnstwist</a>. Built on measured visual similarity instead of static tables.</p>
  <table class="comparison-table">
    <thead>
      <tr><th>Capability</th><th></th></tr>
    </thead>
    <tbody>
      <tr><td>Lookalike pairs</td><td>857 measured (confusable-vision release 2), 78 proposed to Unicode</td></tr>
      <tr><td>Scripts</td><td>Lookalikes of Latin-letter domains, drawn from 12 measured scripts</td></tr>
      <tr><td>Scoring</td><td>0 to 1: the share of text fonts where the lookalike holds</td></tr>
      <tr><td>Font awareness</td><td>Most convincing font for each lookalike</td></tr>
      <tr><td>DNS resolution</td><td>A, AAAA, MX, NS with threat classification</td></tr>
      <tr><td>IDNA filtering</td><td>Only PVALID characters (registrable domains)</td></tr>
      <tr><td>Registry rules</td><td>Every delegated TLD: IANA tables, ICANN rules and country-code registry policies</td></tr>
      <tr><td>Reverse lookup</td><td>Identify what a suspicious domain impersonates</td></tr>
      <tr><td>Runtime dependencies</td><td>1 (namespace-guard)</td></tr>
    </tbody>
  </table>
</section>`;

const HOW_IT_WORKS = `
<section class="section">
  <h2 class="section-title">How it works</h2>
  <p class="section-subtitle">Three open-source projects in a pipeline.</p>
  <div class="pipeline">
    <div class="pipeline-step">
      <h4>confusable-vision</h4>
      <p>Casts rays through glyph outlines in every macOS system font and Roboto, and measures which characters look alike at the size they have in running text.</p>
    </div>
    <div class="pipeline-arrow">&rarr;</div>
    <div class="pipeline-step">
      <h4>namespace-guard</h4>
      <p>Ships the maps as runtime data. Provides skeleton(), areConfusable(), and cross-script detection.</p>
    </div>
    <div class="pipeline-arrow">&rarr;</div>
    <div class="pipeline-step">
      <h4>d0ma1n</h4>
      <p>Generates lookalikes of your domain, checks each against its registry&rsquo;s rules, scores them and resolves DNS.</p>
    </div>
  </div>
</section>`;

const OPEN_SOURCE = `
<section class="section">
  <h2 class="section-title">Open source</h2>
  <p class="section-subtitle">Built in the open. Code MIT licensed; lookalike data CC-BY-4.0.</p>
  <div class="oss-links">
    <a href="https://github.com/paultendo/d0ma1n" class="oss-link">d0ma1n on GitHub</a>
    <a href="https://www.npmjs.com/package/namespace-guard" class="oss-link">namespace-guard on npm</a>
    <a href="https://github.com/paultendo/confusable-vision" class="oss-link">confusable-vision on GitHub</a>
  </div>
</section>`;

const FOOTER = `
<footer>
  <p style="margin-bottom:0.5rem">Built by <a href="https://paultendo.github.io">Paul Wood FRSA</a> (<a href="https://github.com/paultendo">@paultendo</a>) &middot; <a href="https://github.com/paultendo/d0ma1n">Source</a> &middot; <a href="/terms">Terms of use</a></p>
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
  const counts = [data.variants.length + ' lookalike' + (data.variants.length === 1 ? '' : 's') + ' found'];
  if (registered.length > 0) counts.push('<strong style="color:var(--danger-high)">' + registered.length + ' already registered</strong>');
  if (active.length > 0) counts.push('<strong style="color:var(--active-threat)">' + active.length + ' with mail servers</strong>');
  counts.push(available.length + ' could be registered');
  if (blocked.length > 0) counts.push(blocked.length + ' blocked by registry rules');
  html += '<div class="results-meta">' + counts.join(' &middot; ') + '</div>';
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
  return s.block.startsWith(s.script) ? s.block : s.script + ' · ' + s.block;
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
    const kinds = [...new Set(v.substitutions.map(charKind))];
    const fontStyle = v.bestFont ? ' style="font-family: \\'' + escHtml(v.bestFont) + '\\', var(--font-mono)"' : '';
    const isRegistered = v.dns && v.dns.registered;

    let status;
    if (v.dns && v.dns.threatLevel === 'active') {
      status = '<span class="threat-active">Active threat</span><div class="swap-note">Has mail servers</div>';
    } else if (isRegistered) {
      status = '<span class="threat-parked">Registered</span>';
    } else if (v.policy && !v.policy.registrable) {
      status = '<span class="threat-none">Can&rsquo;t be registered</span><div class="swap-note">' + escHtml(refusal(v)) + '</div>';
    } else {
      status = '<span class="threat-open">' + (v.dns ? 'Available' : 'Not checked') + '</span>';
      if (v.policy && v.policy.registryRules === 'unknown') {
        status += '<div class="swap-note">This registry&rsquo;s character rules are unknown; judged by script only.</div>';
      }
    }

    const swaps = [...new Set(v.substitutions.map(s =>
      '<span class="swap" title="' + escHtml(charKind(s)) + ' character ' + escHtml(s.codepoint) + '">' + escHtml(s.original) +
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
    html += '<td>' + kinds.map(k => '<span class="script-tag">' + escHtml(k) + '</span>').join('') + '</td>';
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
