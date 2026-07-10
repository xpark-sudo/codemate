"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode4 = __toESM(require("vscode"));

// src/chat/panel.ts
var vscode2 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));

// src/utils/config.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var CONFIG_FILE = ".agent/config.json";
function loadConfig() {
  const wsFolders = vscode.workspace.workspaceFolders;
  const cwd = wsFolders?.[0]?.uri.fsPath || process.cwd();
  const configPath = path.join(cwd, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return {
      serverUrl: raw.serverUrl || vscode.workspace.getConfiguration("agent").get("serverUrl", "http://localhost:8000"),
      projectId: raw.projectId || vscode.workspace.getConfiguration("agent").get("projectId", ""),
      projectPath: raw.projectPath || cwd
    };
  }
  return {
    serverUrl: vscode.workspace.getConfiguration("agent").get("serverUrl", "http://localhost:8000"),
    projectId: vscode.workspace.getConfiguration("agent").get("projectId", ""),
    projectPath: cwd
  };
}
function getEditorContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return {};
  const selection = editor.selection;
  const context = { currentFile: editor.document.uri.fsPath };
  if (!selection.isEmpty) {
    context.selectedCode = editor.document.getText(selection);
    context.cursorLine = selection.start.line + 1;
  }
  return context;
}

// src/client/apiClient.ts
async function* streamChat(question, context) {
  const config = loadConfig();
  const projectId = config.projectId;
  if (!projectId) throw new Error("No project configured. Run Agent: Index Workspace first.");
  const serverUrl = config.serverUrl;
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context })
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
async function createProject(serverUrl, name, projectPath) {
  const res = await fetch(`${serverUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path: projectPath })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function indexProject(serverUrl, projectId) {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/index`, {
    method: "POST"
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function getStatus(serverUrl, projectId) {
  const res = await fetch(`${serverUrl}/api/projects/${projectId}/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// src/chat/panel.ts
var ChatPanelProvider = class {
  _view;
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode2.Uri.file(path2.join(this._extensionPath, "media"))
      ]
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ask":
          await this._handleAsk(msg.question);
          break;
        case "explain":
          await this._handleExplain();
          break;
        case "status":
          await this._handleStatus();
          break;
        case "openFile":
          this._handleOpenFile(msg.file, msg.line);
          break;
      }
    });
  }
  _extensionPath = "";
  setExtensionPath(p) {
    this._extensionPath = p;
  }
  /** Ask a question from outside (e.g., from a command). */
  ask(question) {
    this._postMessage({ type: "askQuestion", question });
    this._handleAsk(question);
  }
  async _handleAsk(question) {
    if (!this._view) return;
    const config = loadConfig();
    if (!config.projectId) {
      this._postMessage({ type: "error", message: "No project indexed. Run Agent: Index Workspace first." });
      return;
    }
    const context = getEditorContext();
    try {
      for await (const { event, data } of streamChat(question, context)) {
        this._postMessage({ type: "sse", event, data });
      }
      this._postMessage({ type: "done" });
    } catch (err) {
      this._postMessage({ type: "error", message: err.message });
    }
  }
  async _handleExplain() {
    const editor = vscode2.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      this._postMessage({ type: "error", message: "Select some code first." });
      return;
    }
    const code = editor.document.getText(editor.selection);
    const file = editor.document.uri.fsPath.split("/").pop();
    const question = `Explain this code from ${file}:
\`\`\`
${code}
\`\`\``;
    await this._handleAsk(question);
  }
  async _handleStatus() {
    const config = loadConfig();
    this._postMessage({
      type: "status",
      projectId: config.projectId || "(none)",
      serverUrl: config.serverUrl
    });
  }
  async _handleOpenFile(file, line) {
    const uri = vscode2.Uri.file(file);
    const doc = await vscode2.workspace.openTextDocument(uri);
    const editor = await vscode2.window.showTextDocument(doc, {
      viewColumn: vscode2.ViewColumn.One,
      preserveFocus: false
    });
    const pos = new vscode2.Position(line - 1, 0);
    editor.selection = new vscode2.Selection(pos, pos);
    editor.revealRange(
      new vscode2.Range(pos, pos),
      vscode2.TextEditorRevealType.InCenter
    );
  }
  _postMessage(msg) {
    this._view?.webview.postMessage(msg);
  }
  _getHtml(webview) {
    const htmlPath = path2.join(this._extensionPath, "media", "chat.html");
    const fs3 = require("fs");
    return fs3.readFileSync(htmlPath, "utf-8");
  }
};

// src/commands/index.ts
var vscode3 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var _chatProvider = null;
function setChatProvider(p) {
  _chatProvider = p;
}
async function indexWorkspaceCommand() {
  const config = loadConfig();
  const serverUrl = config.serverUrl;
  const projectPath = config.projectPath;
  const projectName = projectPath.split("/").pop() || "workspace";
  await vscode3.window.withProgress(
    {
      location: vscode3.ProgressLocation.Notification,
      title: "Agent: Indexing workspace...",
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: "Creating project..." });
        const project = await createProject(serverUrl, projectName, projectPath);
        progress.report({ message: "Indexing files..." });
        const result = await indexProject(serverUrl, project.id);
        const dir = path3.join(projectPath, ".agent");
        if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
        fs2.writeFileSync(
          path3.join(dir, "config.json"),
          JSON.stringify({ ...config, projectId: project.id }, null, 2)
        );
        vscode3.window.showInformationMessage(
          `Agent: Indexed ${result.chunk_count} code chunks`
        );
      } catch (err) {
        vscode3.window.showErrorMessage(`Agent index failed: ${err.message}`);
      }
    }
  );
}
async function explainCodeCommand() {
  const editor = vscode3.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode3.window.showWarningMessage("Select some code first.");
    return;
  }
  const selectedCode = editor.document.getText(editor.selection);
  const file = editor.document.uri.fsPath.split("/").pop();
  const question = `Explain this code from ${file}:
\`\`\`
${selectedCode}
\`\`\``;
  await vscode3.commands.executeCommand("agent.chatView.focus");
  _chatProvider?.ask(question);
}
async function askQuestionCommand() {
  await vscode3.commands.executeCommand("agent.chatView.focus");
}
async function checkStatusCommand() {
  const config = loadConfig();
  if (!config.projectId) {
    vscode3.window.showInformationMessage(
      "Agent: No project indexed yet. Run 'Agent: Index Workspace' first."
    );
    return;
  }
  try {
    const status = await getStatus(config.serverUrl, config.projectId);
    vscode3.window.showInformationMessage(
      `Agent: ${status.status} | ${status.chunk_count} chunks indexed`
    );
  } catch (err) {
    vscode3.window.showErrorMessage(`Status check failed: ${err.message}`);
  }
}

// src/extension.ts
function activate(context) {
  const chatProvider = new ChatPanelProvider();
  chatProvider.setExtensionPath(context.extensionPath);
  setChatProvider(chatProvider);
  context.subscriptions.push(
    vscode4.window.registerWebviewViewProvider("agent.chatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode4.window.registerWebviewPanelSerializer("agent.chatView", {
      async deserializeWebviewPanel(_webviewPanel, _state) {
      }
    })
  );
  context.subscriptions.push(
    vscode4.commands.registerCommand("agent.indexWorkspace", indexWorkspaceCommand)
  );
  context.subscriptions.push(
    vscode4.commands.registerCommand("agent.explainCode", explainCodeCommand)
  );
  context.subscriptions.push(
    vscode4.commands.registerCommand("agent.askQuestion", askQuestionCommand)
  );
  context.subscriptions.push(
    vscode4.commands.registerCommand("agent.checkStatus", checkStatusCommand)
  );
  const statusBar = vscode4.window.createStatusBarItem(
    vscode4.StatusBarAlignment.Right,
    100
  );
  statusBar.text = "$(hubot) Agent";
  statusBar.tooltip = "Codebase Intelligence Agent";
  statusBar.command = "agent.askQuestion";
  statusBar.show();
  context.subscriptions.push(statusBar);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
