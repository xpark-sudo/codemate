#!/usr/bin/env node
'use strict';

var commander = require('commander');
var chalk6 = require('chalk');
var path = require('path');
var fs = require('fs');
var ora = require('ora');
var readline = require('readline');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var chalk6__default = /*#__PURE__*/_interopDefault(chalk6);
var path__namespace = /*#__PURE__*/_interopNamespace(path);
var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var ora__default = /*#__PURE__*/_interopDefault(ora);
var readline__namespace = /*#__PURE__*/_interopNamespace(readline);

var CONFIG_DIR = ".agent";
var CONFIG_FILE = "config.json";
function getConfigPath(cwd) {
  return path__namespace.join(cwd, CONFIG_DIR, CONFIG_FILE);
}
function loadConfig(cwd) {
  const configPath = getConfigPath(cwd);
  if (!fs__namespace.existsSync(configPath)) return null;
  return JSON.parse(fs__namespace.readFileSync(configPath, "utf-8"));
}
function saveConfig(cwd, config) {
  const dir = path__namespace.join(cwd, CONFIG_DIR);
  if (!fs__namespace.existsSync(dir)) fs__namespace.mkdirSync(dir, { recursive: true });
  fs__namespace.writeFileSync(getConfigPath(cwd), JSON.stringify(config, null, 2));
}
function getServerUrl(cwd) {
  const config = loadConfig(cwd);
  return config?.serverUrl || process.env.AGENT_SERVER_URL || "http://localhost:8000";
}

// src/client/apiClient.ts
async function createProject(serverUrl, name, projectPath) {
  const res = await fetch(`${serverUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path: projectPath })
  });
  if (!res.ok) throw new Error(`Create project failed: ${await res.text()}`);
  return res.json();
}
async function indexProject(serverUrl, projectId) {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/index`, {
    method: "POST"
  });
  if (!res.ok) throw new Error(`Index failed: ${await res.text()}`);
  return res.json();
}
async function getProjectStatus(serverUrl, projectId) {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/status`);
  if (!res.ok) throw new Error(`Status failed: ${await res.text()}`);
  return res.json();
}
async function* streamChat(serverUrl, projectId, question) {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
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

// src/commands/init.ts
async function initCommand(cwd) {
  const existing = loadConfig(cwd);
  if (existing) {
    console.log(
      chalk6__default.default.yellow("Already initialized."),
      chalk6__default.default.dim(`Project: ${existing.projectName} (${existing.projectId})`)
    );
    return;
  }
  const serverUrl = getServerUrl(cwd);
  const projectPath = path__namespace.resolve(cwd);
  const projectName = path__namespace.basename(projectPath);
  console.log(chalk6__default.default.cyan(`
Initializing project "${projectName}"...`));
  console.log(chalk6__default.default.dim(`  Path: ${projectPath}`));
  console.log(chalk6__default.default.dim(`  Server: ${serverUrl}`));
  try {
    const project = await createProject(serverUrl, projectName, projectPath);
    const config = {
      serverUrl,
      projectId: project.id,
      projectName,
      projectPath,
      lastIndexed: ""
    };
    saveConfig(cwd, config);
    console.log(
      chalk6__default.default.green(`Project created: ${project.id}`) + chalk6__default.default.dim(` (config saved to .agent/config.json)`)
    );
    console.log(chalk6__default.default.dim("\nNext: agent index"));
  } catch (err) {
    console.error(
      chalk6__default.default.red(`Failed to init project: ${err.message}`)
    );
    console.error(
      chalk6__default.default.dim("Make sure the server is running and accessible.")
    );
    process.exit(1);
  }
}
async function indexCommand(cwd, options) {
  const config = loadConfig(cwd);
  if (!config) {
    console.error(chalk6__default.default.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }
  const serverUrl = getServerUrl(cwd);
  const spinner = ora__default.default({
    text: "Indexing codebase...",
    color: "cyan"
  }).start();
  try {
    const result = await indexProject(serverUrl, config.projectId);
    spinner.succeed(
      chalk6__default.default.green(
        `Indexed ${result.chunk_count} chunks`
      )
    );
    config.lastIndexed = (/* @__PURE__ */ new Date()).toISOString();
    saveConfig(cwd, config);
    if (options.watch) {
      console.log(chalk6__default.default.dim("Watch mode not yet implemented."));
    }
  } catch (err) {
    spinner.fail(chalk6__default.default.red(`Index failed: ${err.message}`));
    process.exit(1);
  }
}
async function statusCommand(cwd) {
  const config = loadConfig(cwd);
  if (!config) {
    console.error(chalk6__default.default.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }
  const serverUrl = getServerUrl(cwd);
  try {
    const status = await getProjectStatus(serverUrl, config.projectId);
    console.log(chalk6__default.default.cyan("\nProject Status"));
    console.log(chalk6__default.default.dim("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    console.log(`  ID:     ${status.id}`);
    console.log(`  Name:   ${status.name}`);
    console.log(`  Status: ${statusIcon(status.status)}`);
    console.log(`  Chunks: ${status.chunk_count}`);
    if (config.lastIndexed) {
      console.log(chalk6__default.default.dim(`  Last indexed: ${config.lastIndexed}`));
    }
    console.log();
  } catch (err) {
    console.error(chalk6__default.default.red(`Status check failed: ${err.message}`));
    process.exit(1);
  }
}
function statusIcon(s) {
  switch (s) {
    case "ready":
      return chalk6__default.default.green("ready");
    case "indexing":
      return chalk6__default.default.yellow("indexing...");
    case "error":
      return chalk6__default.default.red("error");
    default:
      return chalk6__default.default.dim(s);
  }
}
var StreamRenderer = class {
  shownReferences = false;
  handle(event, data) {
    switch (event) {
      case "plan":
        this.onPlan(data);
        break;
      case "search":
        this.onSearch(data);
        break;
      case "reflect":
        this.onReflect(data);
        break;
      case "answer":
        this.onAnswer(data);
        break;
      case "done":
        this.onDone(data);
        break;
      case "error":
        console.log(chalk6__default.default.red(`
  Error: ${data.message}`));
        break;
    }
  }
  reset() {
    this.shownReferences = false;
  }
  onPlan(data) {
    const iter = data.iteration || 1;
    console.log(
      chalk6__default.default.blue(`
${"\u25B8".repeat(iter)} Plan [round ${iter}]`) + chalk6__default.default.dim(` \u2014 ${data.reasoning || ""}`)
    );
    if (data.queries) {
      for (const q of data.queries) {
        console.log(chalk6__default.default.dim(`    query: "${q}"`));
      }
    }
  }
  onSearch(data) {
    const count = data.results_count || 0;
    const files = (data.files || []).join(", ");
    console.log(
      chalk6__default.default.yellow(`  \u{1F50D} Search`) + chalk6__default.default.dim(` \u2192 ${count} results`) + (files ? chalk6__default.default.dim(` (${files})`) : "")
    );
  }
  onReflect(data) {
    const icon = data.sufficient ? chalk6__default.default.green("\u2713 Sufficient") : chalk6__default.default.red("\u2717 Need more");
    console.log(`  ${icon}` + (data.missing ? chalk6__default.default.dim(` \u2014 ${data.missing}`) : ""));
  }
  onAnswer(data) {
    if (!this.shownReferences) {
      this.shownReferences = true;
      console.log(chalk6__default.default.green("\n\u2500\u2500 Answer \u2500\u2500\n"));
      if (data.references) {
        const files = [
          ...new Set(data.references.map((r) => r.file))
        ];
        console.log(chalk6__default.default.dim(`  Source: ${files.join(", ")}
`));
      }
    }
    process.stdout.write(data.delta || "");
  }
  onDone(data) {
    const iters = data.iterations || 1;
    const chunks = data.chunks_found || 0;
    console.log(
      chalk6__default.default.dim(`

\u2500\u2500 ${iters} round(s), ${chunks} chunks \u2500\u2500`)
    );
  }
};

// src/commands/ask.ts
async function askCommand(cwd, question, options) {
  const projectId = resolveProjectId(cwd);
  if (!projectId) {
    console.error(chalk6__default.default.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }
  const serverUrl = getServerUrl(cwd);
  if (options.json) {
    for await (const { event, data } of streamChat(serverUrl, projectId, question)) {
      process.stdout.write(JSON.stringify({ event, data }) + "\n");
    }
    return;
  }
  console.log(chalk6__default.default.cyan(`
\u{1F916} Agent > `) + chalk6__default.default.white(question));
  const renderer = new StreamRenderer();
  try {
    for await (const { event, data } of streamChat(
      serverUrl,
      projectId,
      question
    )) {
      renderer.handle(event, data);
    }
  } catch (err) {
    console.error(chalk6__default.default.red(`
Query failed: ${err.message}`));
    process.exit(1);
  }
}
function resolveProjectId(cwd) {
  const config = loadConfig(cwd);
  if (config?.projectId) return config.projectId;
  const envId = process.env.AGENT_PROJECT_ID;
  if (envId) return envId;
  return null;
}
async function chatCommand(cwd) {
  const config = loadConfig(cwd);
  if (!config?.projectId) {
    console.error(chalk6__default.default.red("No project found. Run 'agent init' first."));
    process.exit(1);
  }
  const serverUrl = getServerUrl(cwd);
  console.log(chalk6__default.default.cyan("\n\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E"));
  console.log(
    chalk6__default.default.cyan("\u2502") + chalk6__default.default.white("  Codebase Intelligence Agent         ") + chalk6__default.default.cyan("\u2502")
  );
  console.log(
    chalk6__default.default.dim(
      `\u2502  Project: ${config.projectName.padEnd(28)} \u2502`
    )
  );
  console.log(chalk6__default.default.dim("\u2502  Type /help  /quit  /clear          \u2502"));
  console.log(chalk6__default.default.cyan("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\n"));
  const rl = readline__namespace.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk6__default.default.green("You \u203A ")
  });
  rl.prompt();
  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      continue;
    }
    if (input === "/quit" || input === "/exit") {
      console.log(chalk6__default.default.dim("\nBye!\n"));
      rl.close();
      break;
    }
    if (input === "/clear") {
      console.clear();
      rl.prompt();
      continue;
    }
    if (input === "/help") {
      console.log(chalk6__default.default.dim("\n  /quit    Exit"));
      console.log(chalk6__default.default.dim("  /clear   Clear screen"));
      console.log(chalk6__default.default.dim("  /help    Show this help\n"));
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
      console.log("");
    } catch (err) {
      console.error(chalk6__default.default.red(`
Error: ${err.message}`));
    }
    rl.prompt();
  }
}

// src/index.ts
var program = new commander.Command();
program.name("agent").description("Codebase Intelligence Agent \u2014 ask questions about your code").version("0.1.0");
program.command("init").description("Initialize the current directory as an Agent project").action(() => initCommand(process.cwd()));
program.command("index").description("Index the current project for code search").option("--watch", "Watch for file changes and re-index").action((opts) => indexCommand(process.cwd(), opts));
program.command("status").description("Show project indexing status").action(() => statusCommand(process.cwd()));
program.command("ask <question...>").description("Ask a question about your codebase").option("--json", "Output raw JSON (SSE events)").action((questionParts, opts) => {
  const question = questionParts.join(" ");
  askCommand(process.cwd(), question, opts);
});
program.command("chat").description("Start interactive chat mode (REPL)").action(() => chatCommand(process.cwd()));
program.parse();
