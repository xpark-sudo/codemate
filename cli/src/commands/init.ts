import chalk from "chalk";
import * as path from "path";
import { loadConfig, saveConfig, getServerUrl, ProjectConfig } from "../config/projectConfig";
import { createProject } from "../client/apiClient";

export async function initCommand(cwd: string): Promise<void> {
  const existing = loadConfig(cwd);
  if (existing) {
    console.log(
      chalk.yellow("Already initialized."),
      chalk.dim(`Project: ${existing.projectName} (${existing.projectId})`)
    );
    return;
  }

  const serverUrl = getServerUrl(cwd);
  const projectPath = path.resolve(cwd);
  const projectName = path.basename(projectPath);

  console.log(chalk.cyan(`\nInitializing project "${projectName}"...`));
  console.log(chalk.dim(`  Path: ${projectPath}`));
  console.log(chalk.dim(`  Server: ${serverUrl}`));

  try {
    const project = await createProject(serverUrl, projectName, projectPath);

    const config: ProjectConfig = {
      serverUrl,
      projectId: project.id,
      projectName,
      projectPath,
      lastIndexed: "",
    };

    saveConfig(cwd, config);
    console.log(
      chalk.green(`Project created: ${project.id}`) +
        chalk.dim(` (config saved to .agent/config.json)`)
    );
    console.log(chalk.dim("\nNext: agent index"));
  } catch (err: any) {
    console.error(
      chalk.red(`Failed to init project: ${err.message}`)
    );
    console.error(
      chalk.dim("Make sure the server is running and accessible.")
    );
    process.exit(1);
  }
}
