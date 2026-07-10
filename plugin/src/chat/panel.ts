import * as vscode from "vscode";
import * as path from "path";
import { streamChat } from "../client/apiClient";
import { getEditorContext, loadConfig } from "../utils/config";

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._extensionPath, "media")),
      ],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Handle messages from webview
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

  private _extensionPath: string = "";

  setExtensionPath(p: string): void {
    this._extensionPath = p;
  }

  /** Ask a question from outside (e.g., from a command). */
  ask(question: string): void {
    this._postMessage({ type: "askQuestion", question });
    this._handleAsk(question);
  }

  private async _handleAsk(question: string): Promise<void> {
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
    } catch (err: any) {
      this._postMessage({ type: "error", message: err.message });
    }
  }

  private async _handleExplain(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      this._postMessage({ type: "error", message: "Select some code first." });
      return;
    }
    const code = editor.document.getText(editor.selection);
    const file = editor.document.uri.fsPath.split("/").pop();
    const question = `Explain this code from ${file}:\n\`\`\`\n${code}\n\`\`\``;
    await this._handleAsk(question);
  }

  private async _handleStatus(): Promise<void> {
    const config = loadConfig();
    this._postMessage({
      type: "status",
      projectId: config.projectId || "(none)",
      serverUrl: config.serverUrl,
    });
  }

  private async _handleOpenFile(file: string, line: number): Promise<void> {
    const uri = vscode.Uri.file(file);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    const pos = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter
    );
  }

  private _postMessage(msg: any): void {
    this._view?.webview.postMessage(msg);
  }

  private _getHtml(webview: vscode.Webview): string {
    const htmlPath = path.join(this._extensionPath, "media", "chat.html");
    const fs = require("fs");
    return fs.readFileSync(htmlPath, "utf-8");
  }
}
