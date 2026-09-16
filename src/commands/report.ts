import { AxiError } from "axi-sdk-js";
import { usageError } from "../usage.js";
import { many, one, parseFlags } from "../flags.js";
import { callTool } from "../mcp.js";
import { getIdentity } from "../identity.js";
import { assertOneOf, DATE_RANGES, GROUPINGS } from "../reports.js";

export const REPORT_HELP = `clockify-axi report <summary|detail> --range <range> [flags]

Fetch aggregated (summary) or per-entry (detail) time tracking data.

  report summary --range <range> [--group <grouping>]
    --group <name>    ${GROUPINGS.join(" | ")} (default: PROJECT)

  report detail --range <range> [--project <id>...] [--client <id>...] [--tag <id>...] [--search <text>]

Flags (both):
  --range <range>       ${DATE_RANGES.join(" | ")}
  --from <iso-date>     Start date, required if --range CUSTOM
  --to <iso-date>       End date, required if --range CUSTOM

Examples:
  clockify-axi report summary --range THIS_WEEK
  clockify-axi report summary --range LAST_MONTH --group CLIENT
  clockify-axi report detail --range THIS_WEEK --project 671...e56`;

function dateRangeArgs(flags: ReturnType<typeof parseFlags>): Record<string, unknown> {
  const range = one(flags, "range");
  if (!range) throw usageError("report requires --range", [`Valid values: ${DATE_RANGES.join(", ")}`]);
  assertOneOf(range, DATE_RANGES, "--range");
  if (range === "CUSTOM") {
    const from = one(flags, "from");
    const to = one(flags, "to");
    if (!from || !to) throw usageError("--range CUSTOM requires --from and --to", ["clockify-axi report summary --range CUSTOM --from 2026-09-01 --to 2026-09-15"]);
    return { dateRange: range, customStart: from, customEnd: to };
  }
  return { dateRange: range };
}

async function summaryCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, { value: ["range", "from", "to", "group"] });
  const group = one(flags, "group") ?? "PROJECT";
  assertOneOf(group, GROUPINGS, "--group");
  const identity = await getIdentity();

  const { text, isError } = await callTool("get_summary_report", {
    workspaceId: identity.workspaceId,
    ...dateRangeArgs(flags),
    grouping: group,
  });
  if (isError) throw new AxiError(text.trim() || "summary report failed", "report_failed");

  let parsed: { totalTime?: string; groups?: Array<{ name: string; duration: string; percentage: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { report: "summary", raw: text.trim() };
  }
  return {
    report: "summary",
    group,
    totalTime: parsed.totalTime ?? "",
    count: parsed.groups?.length ?? 0,
    groups: parsed.groups ?? [],
  };
}

async function detailCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, { value: ["range", "from", "to", "project", "client", "tag", "search"] });
  const identity = await getIdentity();

  const { text, isError } = await callTool("get_detailed_report", {
    workspaceId: identity.workspaceId,
    ...dateRangeArgs(flags),
    ...(many(flags, "project") ? { projectIds: many(flags, "project") } : {}),
    ...(many(flags, "client") ? { clientIds: many(flags, "client") } : {}),
    ...(many(flags, "tag") ? { tagIds: many(flags, "tag") } : {}),
    ...(one(flags, "search") ? { description: one(flags, "search") } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "detailed report failed", "report_failed");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { report: "detail", raw: text.trim() };
  }
  const entries = Array.isArray(parsed) ? parsed : [];
  return { report: "detail", count: entries.length, entries };
}

export async function reportCommand(args: string[]): Promise<Record<string, unknown>> {
  const [kind, ...rest] = args;
  if (kind === "summary") return summaryCommand(rest);
  if (kind === "detail") return detailCommand(rest);
  throw usageError(`Unknown report target "${kind ?? ""}"`, ["Valid targets: summary, detail", "Run `clockify-axi report --help`"]);
}
