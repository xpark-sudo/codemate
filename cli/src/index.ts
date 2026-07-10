#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { indexCommand } from "./commands/index-cmd";
import { statusCommand } from "./commands/status";
import { askCommand } from "./commands/ask";
import { chatCommand } from "./commands/chat";

const program = new Command();

program
  .name("agent")
  .description("Codebase Intelligence Agent — ask questions about your code")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize the current directory as an Agent project")
  .action(() => initCommand(process.cwd()));

program
  .command("index")
  .description("Index the current project for code search")
  .option("--watch", "Watch for file changes and re-index")
  .action((opts) => indexCommand(process.cwd(), opts));

program
  .command("status")
  .description("Show project indexing status")
  .action(() => statusCommand(process.cwd()));

program
  .command("ask <question...>")
  .description("Ask a question about your codebase")
  .option("--json", "Output raw JSON (SSE events)")
  .action((questionParts: string[], opts) => {
    const question = questionParts.join(" ");
    askCommand(process.cwd(), question, opts);
  });

program
  .command("chat")
  .description("Start interactive chat mode (REPL)")
  .action(() => chatCommand(process.cwd()));

program.parse();
