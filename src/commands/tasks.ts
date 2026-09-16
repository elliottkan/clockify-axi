import { usageError } from "../usage.js";
import { one, parseFlags } from "../flags.js";
import { get } from "../rest.js";
import { getIdentity } from "../identity.js";

export const TASKS_HELP = `clockify-axi tasks list --project <id> [query]

List tasks within one project, optionally filtered by name.

Examples:
  clockify-axi tasks list --project 671...e56
  clockify-axi tasks list --project 671...e56 design`;

async function listCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, { value: ["project"] });
  const projectId = one(flags, "project");
  if (!projectId) throw usageError("tasks list requires --project <id>", ["clockify-axi projects list  # to find the ID"]);
  const name = flags.positionals.join(" ").trim();
  const identity = await getIdentity();

  const tasks = (await get(`/workspaces/${identity.workspaceId}/projects/${projectId}/tasks`, {
    ...(name ? { name } : {}),
  })) as Array<{ id: string; name: string }>;

  if (!Array.isArray(tasks) || tasks.length === 0) return { count: 0, tasks: "none" };
  return { count: tasks.length, tasks };
}

export async function tasksCommand(args: string[]): Promise<Record<string, unknown>> {
  const [sub, ...rest] = args;
  if (sub === "list" || sub === undefined) return listCommand(sub === undefined ? args : rest);
  throw usageError(`Unknown tasks target "${sub}"`, ["Valid targets: list", "Run `clockify-axi tasks --help`"]);
}
