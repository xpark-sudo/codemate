import { getServerUrl } from "../config/projectConfig";

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  status: string;
  chunk_count: number;
}

export async function createProject(
  serverUrl: string,
  name: string,
  projectPath: string
): Promise<ProjectInfo> {
  const res = await fetch(`${serverUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path: projectPath }),
  });
  if (!res.ok) throw new Error(`Create project failed: ${await res.text()}`);
  return res.json();
}

export async function indexProject(
  serverUrl: string,
  projectId: string
): Promise<{ status: string; chunk_count: number }> {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/index`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Index failed: ${await res.text()}`);
  return res.json();
}

export async function getProjectStatus(
  serverUrl: string,
  projectId: string
): Promise<ProjectInfo> {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/status`);
  if (!res.ok) throw new Error(`Status failed: ${await res.text()}`);
  return res.json();
}

export async function* streamChat(
  serverUrl: string,
  projectId: string,
  question: string
): AsyncGenerator<{ event: string; data: any }> {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat failed: ${err}`);
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
      if (!part.trim()) continue;
      const lines = part.split("\n");
      let event = "";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          event = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
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
