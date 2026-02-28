import { scan } from "./scan.js";
import { reverseScan } from "./reverse-scan.js";
import {
  formatScanResult,
  formatReverseTable,
  formatReverseJson,
} from "./format.js";
import { readFileSync } from "node:fs";
import type { OutputFormat, ScanOptions } from "./types.js";

const HELP = `
d0ma1n - Domain & brand name spoofing scanner

Usage:
  d0ma1n scan <domain> [options]      Generate confusable variants
  d0ma1n reverse <domain> [options]   What does this domain impersonate?
  d0ma1n batch <file> [options]       Scan multiple domains from file

Options:
  --resolve              Perform DNS resolution (A, AAAA, MX, NS)
  --json                 Output as JSON
  --csv                  Output as CSV
  --top <n>              Show top N results (default: 20)
  --threshold <n>        Min danger score 0-1 (default: 0.0)
  --max-edits <n>        Max simultaneous substitutions (default: 2)
  --max-per-char <n>     Max substitutes per position (default: 10)
  --max-variants <n>     Hard cap on generated variants (default: 5000)
  --font <name>          Use font-specific weights
  --use-max-danger       Score with max SSIM instead of p95
  --include-non-pvalid   Include non-IDNA chars
  --tlds <list>          TLDs to check, comma-separated (default: com)
  --tld-variants         Also generate confusable TLD substitutions
  --concurrency <n>      Max parallel DNS lookups (default: 10)
  --timeout <n>          DNS timeout in ms (default: 3000)
  -h, --help             Show this help

Examples:
  d0ma1n scan paypal.com
  d0ma1n scan paypal.com --resolve --top 50
  d0ma1n scan google.com --json --font Arial
  d0ma1n reverse xn--pypal-4ve.com
  d0ma1n batch domains.txt --resolve --csv
`;

function parseArgs(args: string[]): {
  command: string;
  target: string;
  options: Record<string, string | boolean>;
} {
  const command = args[0] ?? "help";
  const target = args[1] ?? "";
  const options: Record<string, string | boolean> = {};

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--resolve") {
      options.resolve = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--csv") {
      options.csv = true;
    } else if (arg === "--use-max-danger") {
      options.useMaxDanger = true;
    } else if (arg === "--include-non-pvalid") {
      options.includeNonPvalid = true;
    } else if (arg === "--tld-variants") {
      options.tldVariants = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg.startsWith("--") && i + 1 < args.length) {
      // Key-value flags
      const key = arg.slice(2);
      options[key] = args[++i];
    }
  }

  return { command, target, options };
}

function buildScanOptions(
  options: Record<string, string | boolean>
): ScanOptions {
  const scanOpts: ScanOptions = {};

  if (options.resolve) scanOpts.resolve = true;
  if (options.top) scanOpts.top = Number(options.top);
  if (options.threshold) scanOpts.threshold = Number(options.threshold);
  if (options["max-edits"]) scanOpts.maxEdits = Number(options["max-edits"]);
  if (options["max-per-char"])
    scanOpts.maxPerChar = Number(options["max-per-char"]);
  if (options["max-variants"])
    scanOpts.maxVariants = Number(options["max-variants"]);
  if (options.font) scanOpts.font = String(options.font);
  if (options.useMaxDanger) scanOpts.useMaxDanger = true;
  if (options.includeNonPvalid) scanOpts.includeNonPvalid = true;
  if (options.tlds) scanOpts.tlds = String(options.tlds).split(",");
  if (options.tldVariants) scanOpts.tldVariants = true;
  if (options.concurrency)
    scanOpts.concurrency = Number(options.concurrency);
  if (options.timeout) scanOpts.timeout = Number(options.timeout);

  return scanOpts;
}

function getFormat(options: Record<string, string | boolean>): OutputFormat {
  if (options.json) return "json";
  if (options.csv) return "csv";
  return "table";
}

async function runScan(
  target: string,
  options: Record<string, string | boolean>
): Promise<void> {
  if (!target) {
    console.error("Error: domain argument required");
    console.error("Usage: d0ma1n scan <domain>");
    process.exit(1);
  }

  const scanOpts = buildScanOptions(options);
  const format = getFormat(options);

  const result = await scan(target, scanOpts);
  console.log(formatScanResult(result, format));
}

async function runReverse(
  target: string,
  options: Record<string, string | boolean>
): Promise<void> {
  if (!target) {
    console.error("Error: domain argument required");
    console.error("Usage: d0ma1n reverse <domain>");
    process.exit(1);
  }

  const format = getFormat(options);
  const result = reverseScan(target);

  if (format === "json") {
    console.log(formatReverseJson(result));
  } else {
    console.log(formatReverseTable(result));
  }
}

async function runBatch(
  target: string,
  options: Record<string, string | boolean>
): Promise<void> {
  if (!target) {
    console.error("Error: file argument required");
    console.error("Usage: d0ma1n batch <file>");
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(target, "utf-8");
  } catch {
    console.error(`Error: cannot read file "${target}"`);
    process.exit(1);
  }

  const domains = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const scanOpts = buildScanOptions(options);
  const format = getFormat(options);

  for (const domain of domains) {
    const result = await scan(domain, scanOpts);
    console.log(formatScanResult(result, format));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    process.exit(0);
  }

  const { command, target, options } = parseArgs(args);

  if (options.help) {
    console.log(HELP);
    process.exit(0);
  }

  switch (command) {
    case "scan":
      await runScan(target, options);
      break;
    case "reverse":
      await runReverse(target, options);
      break;
    case "batch":
      await runBatch(target, options);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
