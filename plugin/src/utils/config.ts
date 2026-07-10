import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

interface AgentConfig {
  serverUrl: string;
  projectId: string;
  projectPath: string;
}

const CONFIG_FILE = ".agent/config.json";

export function loadConfig(): AgentConfig {
  const wsFolders = vscode.workspace.workspaceFolders;
  const cwd = wsFolders?.[0]?.uri.fsPath || process.cwd();

  // Try reading .agent/config.json
  const configPath = path.join(cwd, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return {
      serverUrl: raw.serverUrl || vscode.workspace.getConfiguration("agent").get("serverUrl", "http://localhost:8000"),
      projectId: raw.projectId || vscode.workspace.getConfiguration("agent").get("projectId", ""),
      projectPath: raw.projectPath || cwd,
    };
  }

  // Fallback to VSCode settings
  return {
    serverUrl: vscode.workspace.getConfiguration("agent").get("serverUrl", "http://localhost:8000"),
    projectId: vscode.workspace.getConfiguration("agent").get("projectId", ""),
    projectPath: cwd,
  };
}

export function getEditorContext(): { currentFile?: string; selectedCode?: string } {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return {};

  const selection = editor.selection;
  const context: any = { currentFile: editor.document.uri.fsPath };

  if (!selection.isEmpty) {
    context.selectedCode = editor.document.getText(selection);
    context.cursorLine = selection.start.line + 1;
  }

  return context;
}
