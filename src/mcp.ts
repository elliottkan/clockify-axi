import { AxiError } from "axi-sdk-js";

// ponytail: the Clockify MCP server is stateless HTTP JSON-RPC (one POST per
// call, no initialize handshake, no session) - unlike a stdio server there is
// no child process to manage, so this is a single `fetch` wrapper instead of
// the newline-delimited JSON-RPC client a stdio transport would need.

interface JsonRpcResponse {
  id?: number;
  result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  error?: { code: number; message: string };
}

function endpoint(): string {
  return process.env.CLOCKIFY_MCP_URL ?? "https://api.clockify.me/mcp-server/mcp";
}

function apiKey(): string {
  const key = process.env.CLOCKIFY_API_KEY;
  if (!key) {
    throw new AxiError("CLOCKIFY_API_KEY is not set", "missing_api_key", [
      "Generate a key: Clockify → Preferences → Advanced → Manage API keys",
      "Export it: export CLOCKIFY_API_KEY=<key>",
    ]);
  }
  return key;
}

/** The server responds as SSE (`event: message\ndata: {...}`) or plain JSON depending on client headers. */
function parseBody(body: string): JsonRpcResponse {
  const dataLine = body.split("\n").find((line) => line.startsWith("data:"));
  const json = dataLine ? dataLine.slice(5).trim() : body.trim();
  try {
    return JSON.parse(json) as JsonRpcResponse;
  } catch {
    throw new AxiError(`Clockify MCP server returned an unparseable response: ${body.slice(0, 200)}`, "mcp_bad_response");
  }
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const key = apiKey();
  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-api-key": key,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    });
  } catch (error) {
    throw new AxiError(`Could not reach the Clockify MCP server: ${(error as Error).message}`, "mcp_unavailable", [
      "Check your network connection",
      "Set CLOCKIFY_MCP_URL to override the endpoint",
    ]);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new AxiError(`Clockify MCP server returned HTTP ${response.status}: ${body.slice(0, 300)}`, "mcp_http_error");
  }

  const message = parseBody(body);
  if (message.error) {
    if (message.error.code === -32001 || /api.?key/i.test(message.error.message)) {
      throw new AxiError(`Clockify authentication failed: ${message.error.message}`, "auth_failed", [
        "Check CLOCKIFY_API_KEY is a valid, non-expired key",
      ]);
    }
    throw new AxiError(`${name} failed: ${message.error.message}`, "mcp_call_failed");
  }

  const text = (message.result?.content ?? []).map((part) => part.text ?? "").join("\n");
  return { text, isError: message.result?.isError === true };
}
