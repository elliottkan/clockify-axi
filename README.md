# clockify-axi

Clockify MCP for agents, built to the [AXI](https://axi.md) conventions.

Wraps the [Clockify MCP server](https://clockify.me/help/integrations-and-add-ons/use-clockify-mcp-server-to-connect-to-ai-agent) with TOON output, a cached workspace/user identity, and exit codes you can gate on.

## Why

The Clockify MCP server is built for a chat client, not a shell.
`clockify-axi` closes the gaps:

| Clockify MCP as shipped | clockify-axi |
| --- | --- |
| Almost every tool requires `workspaceId` and `userId`, resolved by calling `get_current_user_profile` first | Resolves them once and caches them, so every other command just works |
| Tool results are raw JSON strings inside an MCP content block | Parsed into TOON rows and objects |
| No exit codes - everything is prose for a chat client | Exit `0` success, `1` error, `2` usage error |
| `--api-key` header repeated on every call | Read once from `CLOCKIFY_API_KEY` |

## Install

```sh
npm install -g clockify-axi
```

Or run it with no install at all: `npx -y clockify-axi`.

Install the skill so agents reach for it on their own:

```sh
npx skills add ./skills/clockify-axi -g
```

Optional ambient context in every agent session:

```sh
clockify-axi setup hooks
```

## Usage

```sh
export CLOCKIFY_API_KEY=<key>          # Clockify -> Preferences -> Advanced -> Manage API keys
clockify-axi                           # home: cached identity, next steps
clockify-axi whoami                    # resolve and cache workspaceId/userId
clockify-axi now                       # current server time
clockify-axi timer status              # what's running right now
clockify-axi timer start "Client call" --project <id> --billable
clockify-axi timer stop --description "Client call"
clockify-axi log 2026-09-15T09:00:00Z 2026-09-15T10:30:00Z Client call --project <id>
clockify-axi report summary --range THIS_WEEK
clockify-axi report summary --range LAST_MONTH --group CLIENT
clockify-axi report detail --range THIS_WEEK --project <id>
clockify-axi clients list
clockify-axi projects list --client <id>
clockify-axi projects create "New Site Build" --billable
clockify-axi tasks list --project <id>
clockify-axi tags list
clockify-axi update --check
```

## AXI compliance

Exit codes follow the spec: `0` success, `1` error, `2` usage error.

## Environment

| Variable | Effect |
| --- | --- |
| `CLOCKIFY_API_KEY` | Required. API key from Clockify's Advanced preferences |
| `CLOCKIFY_MCP_URL` | Override the MCP endpoint (default `https://api.clockify.me/mcp-server/mcp`) |
| `XDG_CACHE_HOME` | Where the cached identity is stored (default `~/.cache/clockify-axi`) |

## Development

```sh
npm install
npm test
npm run build
npm run dev -- timer status
```

## License

MIT
