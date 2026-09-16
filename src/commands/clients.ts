import { AxiError } from "axi-sdk-js";
import { usageError } from "../usage.js";
import { one, parseFlags } from "../flags.js";
import { callTool } from "../mcp.js";
import { getIdentity } from "../identity.js";

export const CLIENTS_HELP = `clockify-axi clients list [query]

Search clients by name to resolve a client ID for \`projects list --client\`.

Examples:
  clockify-axi clients list
  clockify-axi clients list Acme`;

async function listCommand(args: string[]): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, {});
  const name = flags.positionals.join(" ").trim();
  const identity = await getIdentity();

  const { text, isError } = await callTool("list_clients", {
    workspaceId: identity.workspaceId,
    ...(name ? { name } : {}),
  });
  if (isError) throw new AxiError(text.trim() || "could not list clients", "clients_list_failed");

  let clients: Array<{ id: string; name: string }>;
  try {
    clients = JSON.parse(text);
  } catch {
    return { count: 0, clients: "none", raw: text.trim() };
  }
  if (!Array.isArray(clients) || clients.length === 0) return { count: 0, clients: "none" };
  return { count: clients.length, clients };
}

export async function clientsCommand(args: string[]): Promise<Record<string, unknown>> {
  const [sub, ...rest] = args;
  if (sub === "list" || sub === undefined) return listCommand(sub === undefined ? args : rest);
  throw usageError(`Unknown clients target "${sub}"`, ["Valid targets: list", "Run `clockify-axi clients --help`"]);
}
