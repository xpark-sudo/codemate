import chalk from "chalk";
import * as readline from "readline";
import { getServerUrl, loadConfig } from "../config/projectConfig";
import { streamChat } from "../client/apiClient";
import { StreamRenderer } from "../ui/stream";

export async function chatCommand(cwd: string): Promise<void> {
  const config = loadConfig(cwd);
  if (!config?.projectId) {
    console.error(chalk.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }

  const serverUrl = getServerUrl(cwd);

  console.log(chalk.cyan("\n╭─────────────────────────────────────╮"));
  console.log(
    chalk.cyan("│") +
      chalk.white("  Codebase Intelligence Agent         ") +
      chalk.cyan("│")
  );
  console.log(
    chalk.dim(
      `│  Project: ${config.projectName.padEnd(28)} │`
    )
  );
  console.log(chalk.dim("│  Type /help  /quit  /clear          │"));
  console.log(chalk.cyan("╰─────────────────────────────────────╯\n"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("You › "),
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      continue;
    }

    if (input === "/quit" || input === "/exit") {
      console.log(chalk.dim("\nBye!\n"));
      rl.close();
      break;
    }

    if (input === "/clear") {
      console.clear();
      rl.prompt();
      continue;
    }

    if (input === "/help") {
      console.log(chalk.dim("\n  /quit    Exit"));
      console.log(chalk.dim("  /clear   Clear screen"));
      console.log(chalk.dim("  /help    Show this help\n"));
      rl.prompt();
      continue;
    }

    const renderer = new StreamRenderer();

    try {
      for await (const { event, data } of streamChat(
        serverUrl,
        config.projectId,
        input
      )) {
        renderer.handle(event, data);
      }
      console.log(""); // blank line after answer
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message}`));
    }

    rl.prompt();
  }
}
