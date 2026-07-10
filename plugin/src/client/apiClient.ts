import { loadConfig } from "../utils/config";

export interface SSEEvent {
  event: string;
  data: any;
}

/**
 * Stream chat SSE events from the server.
 */
export async function* streamChat(
  question: string,
  context?: { currentFile?: string; selectedCode?: string }
): AsyncGenerator<SSEEvent> {
  const config = loadConfig();
  const projectId = config.projectId;
  if (!projectId) throw new Error("No project configured. Run Agent: Index Workspace first.");

  const serverUrl = config.serverUrl;

  const res = await fetch(`${serverUrl}/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${await res.text()}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      let event = "";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data = line.slice(6);
      }

      if (event && data) {
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          yield { event, data: { raw: data } };
        }
      }
    }
  }
}

export async function createProject(
  serverUrl: string,
  name: string,
  projectPath: string
): Promise<{ id: string }> {
  const res = await fetch(`${serverUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path: projectPath }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function indexProject(
  serverUrl: string,
  projectId: string
): Promise<{ status: string; chunk_count: number }> {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/index`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStatus(
  serverUrl: string,
  projectId: string
): Promise<{ status: string; chunk_count: number }> {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
