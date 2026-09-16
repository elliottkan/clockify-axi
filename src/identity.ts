import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { callTool } from "./mcp.js";
import { AxiError } from "axi-sdk-js";

export interface Identity {
  userId: string;
  workspaceId: string;
  timeZone?: string;
  workspaces?: Array<{ id: string; name: string }>;
  updatedAt: string;
}

function identityPath(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(base, "clockify-axi", "identity.json");
}

function readCache(): Identity | undefined {
  try {
    const parsed = JSON.parse(readFileSync(identityPath(), "utf8")) as Partial<Identity>;
    if (typeof parsed.userId === "string" && typeof parsed.workspaceId === "string") {
      return parsed as Identity;
    }
  } catch {
    // no cache yet, or an unreadable one - both mean "fetch fresh"
  }
  return undefined;
}

function writeCache(identity: Identity): void {
  try {
    const path = identityPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(identity, null, 2)}\n`, "utf8");
  } catch {
    // A read-only cache dir is not worth failing a call over.
  }
}

/**
 * `get_current_user_profile` is the only Clockify tool that needs no IDs, and
 * every other tool requires `workspaceId` (most also require `userId`). We
 * fetch it once and cache it, so commands never make an agent pass the same
 * two IDs on every invocation.
 */
export async function getIdentity(refresh = false): Promise<Identity> {
  if (!refresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const { text, isError } = await callTool("get_current_user_profile", {});
  if (isError) throw new AxiError(text.trim() || "could not load the Clockify user profile", "profile_failed");

  let parsed: { userId?: string; activeWorkspace?: string; defaultWorkspace?: string; timeZone?: string; workspaces?: Array<{ id: string; name: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AxiError(`Unexpected profile response: ${text.slice(0, 200)}`, "profile_unparseable");
  }

  const workspaceId = parsed.activeWorkspace ?? parsed.defaultWorkspace;
  if (!parsed.userId || !workspaceId) {
    throw new AxiError("Clockify profile response is missing userId or workspace", "profile_incomplete");
  }

  const identity: Identity = {
    userId: parsed.userId,
    workspaceId,
    timeZone: parsed.timeZone,
    workspaces: parsed.workspaces,
    updatedAt: new Date().toISOString(),
  };
  writeCache(identity);
  return identity;
}
