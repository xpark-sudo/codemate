import chalk from "chalk";
import { loadConfig, getServerUrl } from "../config/projectConfig";
import { streamChat } from "../client/apiClient";
import { StreamRenderer } from "../ui/stream";

export async function askCommand(
  cwd: string,
  question: string,
  options: { json?: boolean }
): Promise<void> {
  const projectId = resolveProjectId(cwd);
  if (!projectId) {
    console.error(chalk.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }

  const serverUrl = getServerUrl(cwd);

  if (options.json) {
    // JSON mode: raw SSE events
    for await (const { event, data } of streamChat(serverUrl, projectId, question)) {
      process.stdout.write(JSON.stringify({ event, data }) + "\n");
    }
    return;
  }

  // Pretty mode: colored rendering
  console.log(chalk.cyan(`\n🤖 Agent > `) + chalk.white(question));
  const renderer = new StreamRenderer();

  try {
    for await (const { event, data } of streamChat(
      serverUrl,
      projectId,
      question
    )) {
      renderer.handle(event, data);
    }
  } catch (err: any) {
    console.error(chalk.red(`\nQuery failed: ${err.message}`));
    process.exit(1);
  }
}

function resolveProjectId(cwd: string): string | null {
  const config = loadConfig(cwd);
  if (config?.projectId) return config.projectId;

  // No local config — try AGENT_PROJECT_ID env
  const envId = process.env.AGENT_PROJECT_ID;
  if (envId) return envId;

  return null;
}
