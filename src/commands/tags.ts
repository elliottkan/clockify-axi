import { AxiError } from "axi-sdk-js";
import { usageError } from "../usage.js";
import { parseFlags } from "../flags.js";
import { callTool } from "../mcp.js";
import { getIdentity } from "../identity.js";

export const TAGS_HELP = `clockify-axi tags list [query]

Search tags by name to resolve tag IDs for \`timer start/stop --tag\` and \`log --tag\`.

Examples:
  clockify-axi tags list
  clockify-axi tags list bug-fix`;

async function listCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, {});
  const name = flags.positionals.join(" ").trim();
  const identity = await getIdentity();

  const { text, isError } = await callTool("list_tags", {
    workspaceId: identity.workspaceId,
    ...(name ? { name } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "could not list tags", "tags_list_failed");

  let tags: Array<{ id: string; name: string }>;
  try {
    tags = JSON.parse(text);
  } catch {
    return { count: 0, tags: "none", raw: text.trim() };
  }
  if (!Array.isArray(tags) || tags.length === 0) return { count: 0, tags: "none" };
  return { count: tags.length, tags };
}

export async function tagsCommand(args: string[]): Promise<Record<string, unknown>> {
  const [sub, ...rest] = args;
  if (sub === "list" || sub === undefined) return listCommand(sub === undefined ? args : rest);
  throw usageError(`Unknown tags target "${sub}"`, ["Valid targets: list", "Run `clockify-axi tags --help`"]);
}
