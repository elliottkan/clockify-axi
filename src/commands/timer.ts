import { AxiError } from "axi-sdk-js";
import { usageError } from "../usage.js";
import { many, one, parseFlags } from "../flags.js";
import { callTool } from "../mcp.js";
import { getIdentity } from "../identity.js";

export const TIMER_HELP = `clockify-axi timer <status|start|stop> [flags]

Manage the running timer for the active user.

  timer status                     What's running right now, if anything
  timer start [description]        Start a new timer
  timer stop [flags]               Stop the running timer

Flags (start, stop):
  --project <id>       Project ID (see \`clockify-axi projects list\`)
  --task <id>          Task ID, requires --project
  --tag <id>           Tag ID, repeatable (see \`clockify-axi tags list\`)
  --billable           Mark the entry billable
  --start <iso>        ISO 8601 start time (start only, default: now)
  --end <iso>          ISO 8601 end time (stop only, default: now)
  --description <text> Time entry description (stop only; start takes it positionally)

Examples:
  clockify-axi timer status
  clockify-axi timer start "Client call" --project 671...e56 --billable
  clockify-axi timer stop --description "Client call" --tag 671...abc`;

function tagIds(flags: ReturnType<typeof parseFlags>): string[] | undefined {
  return many(flags, "tag");
}

async function statusCommand(): Promise<Record<string, unknown>> {
  const identity = await getIdentity();
  const { text, isError } = await callTool("get_current_timer", {
    workspaceId: identity.workspaceId,
    userId: identity.userId,
  });
  if (isError) throw new AxiError(text.trim() || "could not read the current timer", "timer_status_failed");
  try {
    return { timer: JSON.parse(text) };
  } catch {
    return { timer: text.trim() };
  }
}

async function startCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, {
    value: ["project", "task", "tag", "start", "end"],
    boolean: ["billable"],
  });
  const description = flags.positionals.join(" ").trim();
  const identity = await getIdentity();

  const { text, isError } = await callTool("start_timer", {
    workspaceId: identity.workspaceId,
    userId: identity.userId,
    ...(description ? { description } : {}),
    ...(one(flags, "start") ? { start: one(flags, "start") } : {}),
    ...(one(flags, "end") ? { end: one(flags, "end") } : {}),
    ...(one(flags, "project") ? { projectId: one(flags, "project") } : {}),
    ...(one(flags, "task") ? { taskId: one(flags, "task") } : {}),
    ...(tagIds(flags) ? { tagIds: tagIds(flags) } : {}),
    ...(flags.booleans.has("billable") ? { billable: true } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "could not start the timer", "timer_start_failed");
  return { started: description || "(no description)", help: ["clockify-axi timer status", "clockify-axi timer stop"] };
}

async function stopCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, {
    value: ["project", "task", "tag", "start", "end", "description"],
    boolean: ["billable"],
  });
  const identity = await getIdentity();

  const { text, isError } = await callTool("stop_timer", {
    workspaceId: identity.workspaceId,
    userId: identity.userId,
    ...(one(flags, "start") ? { start: one(flags, "start") } : {}),
    ...(one(flags, "end") ? { end: one(flags, "end") } : {}),
    ...(one(flags, "description") ? { description: one(flags, "description") } : {}),
    ...(one(flags, "project") ? { projectId: one(flags, "project") } : {}),
    ...(one(flags, "task") ? { taskId: one(flags, "task") } : {}),
    ...(tagIds(flags) ? { tagIds: tagIds(flags) } : {}),
    ...(flags.booleans.has("billable") ? { billable: true } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "could not stop the timer", "timer_stop_failed");
  try {
    return { stopped: JSON.parse(text) };
  } catch {
    return { stopped: text.trim() };
  }
}

export async function timerCommand(args: string[]): Promise<Record<string, unknown>> {
  const [sub, ...rest] = args;
  if (sub === "status" || sub === undefined) return statusCommand();
  if (sub === "start") return startCommand(rest);
  if (sub === "stop") return stopCommand(rest);
  throw usageError(`Unknown timer target "${sub}"`, ["Valid targets: status, start, stop", "Run `clockify-axi timer --help`"]);
}
