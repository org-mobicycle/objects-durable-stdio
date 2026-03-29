import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!token || !accountId) {
  console.error(
    "Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars are required"
  );
  process.exit(1);
}

const server = new McpServer({
  name: "cloudflare-durable-objects",
  version: "1.0.0",
});

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}


function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}


async function cfFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `https://api.cloudflare.com/client/v4${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const data = (await res.json()) as {
    success?: boolean;
    errors?: Array<{ message: string }>;
  };

  if (!res.ok || !data.success) {
    const errorMsg =
      data.errors?.[0]?.message || `API error: ${res.statusText}`;
    throw new Error(errorMsg);
  }

  return data;
}

server.tool(
  "do_list_namespaces",
  "List all Durable Object namespaces",
  {},
  async () => {
    try {
      const path = `/accounts/${accountId}/workers/durable_objects/namespaces`;
      const data = await cfFetch("GET", path);
      return json(data);
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "do_get_namespace",
  "Get Durable Object namespace details",
  {
    namespace_id: z.string(),
  },
  async (params) => {
    try {
      const path = `/accounts/${accountId}/workers/durable_objects/namespaces/${params.namespace_id}`;
      const data = await cfFetch("GET", path);
      return json(data);
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "do_list_objects",
  "List Durable Objects in a namespace",
  {
    namespace_id: z.string(),
    limit: z.number().optional(),
    cursor: z.string().optional(),
  },
  async (params) => {
    try {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.cursor) searchParams.append("cursor", params.cursor);

      const query = searchParams.toString();
      const path = `/accounts/${accountId}/workers/durable_objects/namespaces/${params.namespace_id}/objects${query ? `?${query}` : ""}`;
      const data = await cfFetch("GET", path);
      return json(data);
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "do_delete_namespace",
  "Delete a Durable Object namespace",
  {
    namespace_id: z.string(),
  },
  async (params) => {
    try {
      const path = `/accounts/${accountId}/workers/durable_objects/namespaces/${params.namespace_id}`;
      const data = await cfFetch("DELETE", path);
      return json(data);
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "do_get_alarm",
  "Get alarm info for a Durable Object",
  {
    namespace_id: z.string(),
    object_id: z.string(),
  },
  async (params) => {
    try {
      const path = `/accounts/${accountId}/workers/durable_objects/namespaces/${params.namespace_id}/objects/${params.object_id}/alarm`;
      const data = await cfFetch("GET", path);
      return json(data);
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "do_status",
  "Show server config and connection info",
  {},
  async () => {
    try {
      return json({
        server: "cloudflare-durable-objects",
        version: "1.0.0",
        accountId,
        tokenStatus: "configured",
      });
    } catch (e) {
      return err(e);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cloudflare Durable Objects MCP server running on stdio");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
