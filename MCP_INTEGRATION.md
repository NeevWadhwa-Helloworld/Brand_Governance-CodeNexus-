# MCP integration

Inkloom exposes a limited, read-only MCP server over Streamable HTTP:

```text
http://localhost:8000/mcp
```

For a deployed server, use its HTTPS origin and append `/mcp`. A compatible MCP
client must send an Inkloom application access token:

```http
Authorization: Bearer $INKLOOM_ACCESS_TOKEN
```

The token represents the signed-in user and carries their organization and
application role. Users should configure only MCP clients they trust, retrieve
tokens through Inkloom's authentication flow, and store them in the client's
secret storage. Do not put tokens in prompts, source control, or plain-text
configuration. The server currently uses user bearer tokens; it does not yet
provide OAuth client registration or a server-side client allowlist. Do not
expose a local endpoint to untrusted networks.

## Read-only tools

| Tool | Purpose | Access |
|---|---|---|
| `get_brand_rules` | Retrieve relevant active brand rules. | Creator, reviewer, admin |
| `list_drafts` | List limited draft metadata; optionally filter by status and limit. | Creator, reviewer, admin |
| `get_draft_findings` | Retrieve the latest saved scan findings and policy-coverage state for an organization-scoped draft. | Creator, reviewer, admin |

These tools do not return draft body text, create or change content, trigger a
scan, approve content, publish content, or access arbitrary database/filesystem
paths. Unknown or out-of-organization draft IDs return the same not-found error.
Successful calls and denied cross-organization lookups are audited. Request
bodies, tool inputs, and per-user request frequency are bounded. Each MCP HTTP
response includes a server-generated `X-Request-ID` for support correlation; the
same ID is available in MCP request log context. Do not treat it as an
authentication credential.

By default, the rate limiter is process-local, suitable for local development
and single-process use. For multi-instance deployments, set
`MCP_RATE_LIMIT_REDIS_URL` to a protected `redis://` or `rediss://` endpoint.
The shared Redis limiter is atomic across instances and applies the configured
`MCP_REQUESTS_PER_MINUTE` per authenticated user. Redis is checked at startup;
the service fails startup if the configured Redis endpoint cannot be reached,
and returns HTTP 503 rather than silently dropping back to local limits if
Redis becomes unavailable. Store the URL (including any password) as a hosting
provider secret, not in source control. Redis hosting and credentials are not
included with this repository.

Optionally set `MCP_ALLOWED_USER_IDS` to a comma-separated list of Inkloom user
IDs. This is an additional allowlist applied only after bearer JWT validation;
it does not register MCP client identities or replace/relax JWT authentication.
An unset or empty list allows any otherwise-valid user JWT, preserving the
default behavior. This is a principal allowlist, not a client allowlist; MCP
client registration is not implemented.

Use the web application to create and scan drafts. Then use `list_drafts` to
identify a draft and `get_draft_findings` to retrieve its latest saved scan.

## Client configuration

For the deployed Inkloom app, a compatible agent connects directly to the
backend—not the Vercel website:

- Transport: Streamable HTTP
- Local endpoint: `http://localhost:8000/mcp`
- Deployed endpoint: `https://brand-governance-codenexus.onrender.com/mcp`
- Authorization header: `Bearer $INKLOOM_ACCESS_TOKEN`

Hosted clients cannot reach a user's `localhost`; they require a securely
deployed HTTPS endpoint. The web test bench uses `VITE_API_BASE_URL` to reach
the backend in deployed environments; for local development, Vite proxies
`/mcp` to the local backend. The test bench performs the MCP initialization
handshake before calling a tool. `MCP-Session-Id` must be exposed by CORS when
the frontend and backend have different origins.

The **Copy VS Code MCP JSON** button produces VS Code's Streamable HTTP
configuration with a secure token prompt. The **Copy Access Token** button
copies the current signed-in user's token directly from the browser without
displaying it in the page. Use it only when VS Code prompts for the token, and
do not share it.

### Connect from VS Code

1. Sign in to Inkloom with the account whose organization the agent should use.
2. In Inkloom's **MCP Server** tab, click **Copy VS Code MCP JSON**.
3. In VS Code, open the MCP configuration file using the Command Palette's
   **MCP: Open User Configuration** command and paste the copied JSON.
4. Save the file. When VS Code asks for an Inkloom access token, return to
   Inkloom, click **Copy Access Token**, and paste it into VS Code's prompt.
   Keep it private; it gives the agent that user's read-only access to
   organization-scoped rules, draft metadata, and saved findings.
5. Start or restart the Inkloom MCP server in VS Code. In Agent mode, the
   Inkloom tools should then be available to the assistant.

The current app authenticates MCP clients with Inkloom user access tokens; it
does not yet offer OAuth-based agent sign-in or administrator-managed client
registration. Only connect agents you trust, and do not paste the token into
prompts, source control, or shared configuration.
