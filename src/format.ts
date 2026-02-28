import type {
  ScanResult,
  DomainVariant,
  ReverseScanResult,
  OutputFormat,
} from "./types.js";

/** ANSI color codes. */
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const BG_RED = "\x1b[41m";
const WHITE = "\x1b[37m";

/** Color a danger score. */
function colorDanger(score: number): string {
  const pct = (score * 100).toFixed(0);
  if (score >= 0.8) return `${RED}${pct}%${RESET}`;
  if (score >= 0.5) return `${YELLOW}${pct}%${RESET}`;
  return `${GREEN}${pct}%${RESET}`;
}

/** Color a threat level. */
function colorThreat(level: string): string {
  if (level === "active") return `${BG_RED}${WHITE} ACTIVE ${RESET}`;
  if (level === "parked") return `${YELLOW}parked${RESET}`;
  return `${DIM}---${RESET}`;
}

/** Pad a string to a fixed display width. */
function pad(s: string, width: number): string {
  // Strip ANSI codes for length calculation
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
  const padding = Math.max(0, width - stripped.length);
  return s + " ".repeat(padding);
}

/**
 * Format scan results as a table for terminal display.
 */
export function formatTable(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    `${BOLD}d0ma1n${RESET} scan: ${CYAN}${result.original}${RESET}`
  );
  lines.push(
    `${DIM}${result.totalGenerated} variants generated, showing top ${result.variants.length}${RESET}`
  );
  lines.push("");

  // Header
  const hasResolve = result.variants.some((v) => v.dns);
  let header = `  ${pad("Domain", 35)} ${pad("Danger", 8)} ${pad("Edits", 6)} ${pad("Script(s)", 15)} ${pad("Punycode", 30)}`;
  if (hasResolve) {
    header += ` ${pad("Status", 12)} ${pad("IP", 18)}`;
  }
  if (result.variants.some((v) => v.bestFont)) {
    header += ` ${pad("Best Font", 20)}`;
  }
  lines.push(`${DIM}${header}${RESET}`);
  lines.push(`${DIM}${"─".repeat(header.length)}${RESET}`);

  for (const v of result.variants) {
    const scripts = [
      ...new Set(v.substitutions.map((s) => s.script)),
    ].join("+");

    let line = `  ${pad(v.domain, 35)} ${pad(colorDanger(v.dangerScore), 8 + 9)} ${pad(String(v.editCount), 6)} ${pad(scripts, 15)} ${pad(v.punycode, 30)}`;

    if (hasResolve) {
      const status = v.dns
        ? colorThreat(v.dns.threatLevel)
        : `${DIM}---${RESET}`;
      const ip =
        v.dns && v.dns.a.length > 0 ? v.dns.a[0] : "";
      line += ` ${pad(status, 12 + 11)} ${pad(ip, 18)}`;
    }

    if (v.bestFont) {
      line += ` ${pad(v.bestFont, 20)}`;
    }

    lines.push(line);
  }

  lines.push("");

  // Summary
  if (hasResolve) {
    const registered = result.variants.filter(
      (v) => v.dns?.registered
    ).length;
    const active = result.variants.filter(
      (v) => v.dns?.threatLevel === "active"
    ).length;
    if (active > 0) {
      lines.push(
        `${BG_RED}${WHITE} ! ${RESET} ${active} variant(s) with MX records (potential phishing)`
      );
    }
    if (registered > 0) {
      lines.push(
        `${YELLOW}${registered} registered${RESET} of ${result.variants.length} checked`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format scan results as JSON.
 */
export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format scan results as CSV.
 */
export function formatCsv(result: ScanResult): string {
  const headers = [
    "domain",
    "danger_score",
    "edit_count",
    "scripts",
    "punycode",
    "best_font",
    "best_font_ssim",
    "registered",
    "threat_level",
    "a_records",
    "mx_records",
  ];

  const rows = result.variants.map((v) => {
    const scripts = [
      ...new Set(v.substitutions.map((s) => s.script)),
    ].join("+");

    return [
      v.domain,
      v.dangerScore.toFixed(4),
      v.editCount,
      scripts,
      v.punycode,
      v.bestFont ?? "",
      v.bestFontSsim?.toFixed(4) ?? "",
      v.dns?.registered ? "true" : "false",
      v.dns?.threatLevel ?? "",
      v.dns?.a?.join(";") ?? "",
      v.dns?.mx?.map((m) => `${m.priority}:${m.exchange}`).join(";") ?? "",
    ]
      .map((field) => `"${String(field).replace(/"/g, '""')}"`)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Format reverse scan results as a table.
 */
export function formatReverseTable(result: ReverseScanResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    `${BOLD}d0ma1n${RESET} reverse: ${CYAN}${result.domain}${RESET}`
  );
  if (result.punycode !== result.domain) {
    lines.push(`${DIM}Punycode: ${result.punycode}${RESET}`);
  }
  lines.push("");

  if (result.impersonates.length === 0) {
    lines.push("  No confusable substitutions detected.");
    lines.push("");
    return lines.join("\n");
  }

  for (const target of result.impersonates) {
    lines.push(
      `  Impersonates: ${BOLD}${target.domain}${RESET} (similarity: ${colorDanger(target.similarity)})`
    );
    lines.push("");
    lines.push(
      `  ${pad("Pos", 5)} ${pad("Original", 10)} ${pad("Replacement", 14)} ${pad("Codepoint", 12)} ${pad("Script", 12)} ${pad("Danger", 8)}`
    );
    lines.push(`  ${DIM}${"─".repeat(65)}${RESET}`);

    for (const sub of target.substitutions) {
      lines.push(
        `  ${pad(String(sub.position), 5)} ${pad(sub.original, 10)} ${pad(sub.replacement, 14)} ${pad(sub.codepoint, 12)} ${pad(sub.script, 12)} ${colorDanger(sub.stableDanger)}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format reverse scan results as JSON.
 */
export function formatReverseJson(result: ReverseScanResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Select and apply the right formatter.
 */
export function formatScanResult(
  result: ScanResult,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
      return formatJson(result);
    case "csv":
      return formatCsv(result);
    case "table":
    default:
      return formatTable(result);
  }
}
