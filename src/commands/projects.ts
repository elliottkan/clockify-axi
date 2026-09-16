import { AxiError } from "axi-sdk-js";
import { usageError } from "../usage.js";
import { many, one, parseFlags } from "../flags.js";
import { callTool } from "../mcp.js";
import { getIdentity } from "../identity.js";

export const PROJECTS_HELP = `clockify-axi projects <list|create> [args] [flags]

  projects list [query] [--client <id>...]     Search projects by name/client
  projects create <name> [flags]               Add a new project
    --color <#rrggbb>    Project color
    --billable            Mark billable
    --public              Mark visible to all workspace members
    --note <text>         Project note

Examples:
  clockify-axi projects list
  clockify-axi projects list --client 671...d3f
  clockify-axi projects create "New Site Build" --billable --color "#3399ff"`;

async function listCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, { value: ["client"] });
  const name = flags.positionals.join(" ").trim();
  const identity = await getIdentity();
  const clients = many(flags, "client");

  const { text, isError } = await callTool("list_projects", {
    workspaceId: identity.workspaceId,
    ...(name ? { name } : {}),
    ...(clients ? { clients } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "could not list projects", "projects_list_failed");

  let projects: Array<{ id: string; name: string; clientName?: string }>;
  try {
    projects = JSON.parse(text);
  } catch {
    return { count: 0, projects: "none", raw: text.trim() };
  }
  if (!Array.isArray(projects) || projects.length === 0) return { count: 0, projects: "none" };
  return { count: projects.length, projects };
}

async function createCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, { value: ["color", "note"], boolean: ["billable", "public"] });
  const name = flags.positionals.join(" ").trim();
  if (!name) throw usageError("projects create requires a project name", ['clockify-axi projects create "New Site Build"']);
  const identity = await getIdentity();

  const { text, isError } = await callTool("create_project", {
    workspaceId: identity.workspaceId,
    name,
    ...(one(flags, "color") ? { color: one(flags, "color") } : {}),
    ...(one(flags, "note") ? { note: one(flags, "note") } : {}),
    ...(flags.booleans.has("billable") ? { billable: true } : {}),
    ...(flags.booleans.has("public") ? { isPublic: true } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "could not create the project", "project_create_failed");

  let created: unknown;
  try {
    created = JSON.parse(text);
  } catch {
    created = text.trim();
  }
  return { created, help: ["clockify-axi projects list " + name] };
}

export async function projectsCommand(args: string[]): Promise<Record<string, unknown>> {
  const [sub, ...rest] = args;
  if (sub === "list" || sub === undefined) return listCommand(sub === undefined ? args : rest);
  if (sub === "create") return createCommand(rest);
  throw usageError(`Unknown projects target "${sub}"`, ["Valid targets: list, create", "Run `clockify-axi projects --help`"]);
}
