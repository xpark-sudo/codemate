import chalk from "chalk";
import ora from "ora";
import { loadConfig, getServerUrl, saveConfig } from "../config/projectConfig";
import { indexProject } from "../client/apiClient";

export async function indexCommand(
  cwd: string,
  options: { watch?: boolean }
): Promise<void> {
  const config = loadConfig(cwd);
  if (!config) {
    console.error(chalk.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }

  const serverUrl = getServerUrl(cwd);

  const spinner = ora({
    text: "Indexing codebase...",
    color: "cyan",
  }).start();

  try {
    const result = await indexProject(serverUrl, config.projectId);

    spinner.succeed(
      chalk.green(
        `Indexed ${result.chunk_count} chunks`
      )
    );

    // Update last indexed time
    config.lastIndexed = new Date().toISOString();
    saveConfig(cwd, config);

    if (options.watch) {
      console.log(chalk.dim("Watch mode not yet implemented."));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Index failed: ${err.message}`));
    process.exit(1);
  }
}
