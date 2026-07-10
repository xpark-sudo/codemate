import chalk from "chalk";
import { loadConfig, getServerUrl } from "../config/projectConfig";
import { getProjectStatus } from "../client/apiClient";

export async function statusCommand(cwd: string): Promise<void> {
  const config = loadConfig(cwd);
  if (!config) {
    console.error(chalk.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }

  const serverUrl = getServerUrl(cwd);

  try {
    const status = await getProjectStatus(serverUrl, config.projectId);
    console.log(chalk.cyan("\nProject Status"));
    console.log(chalk.dim("──────────────"));
    console.log(`  ID:     ${status.id}`);
    console.log(`  Name:   ${status.name}`);
    console.log(`  Status: ${statusIcon(status.status)}`);
    console.log(`  Chunks: ${status.chunk_count}`);
    if (config.lastIndexed) {
      console.log(chalk.dim(`  Last indexed: ${config.lastIndexed}`));
    }
    console.log();
  } catch (err: any) {
    console.error(chalk.red(`Status check failed: ${err.message}`));
    process.exit(1);
  }
}

function statusIcon(s: string): string {
  switch (s) {
    case "ready":
      return chalk.green("ready");
    case "indexing":
      return chalk.yellow("indexing...");
    case "error":
      return chalk.red("error");
    default:
      return chalk.dim(s);
  }
}
