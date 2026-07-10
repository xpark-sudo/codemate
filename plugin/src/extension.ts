import * as vscode from "vscode";
import { ChatPanelProvider } from "./chat/panel";
import {
  indexWorkspaceCommand,
  explainCodeCommand,
  askQuestionCommand,
  checkStatusCommand,
  setChatProvider,
} from "./commands/index";

export function activate(context: vscode.ExtensionContext) {
  // ── Chat Panel (Sidebar) ──
  const chatProvider = new ChatPanelProvider();
  chatProvider.setExtensionPath(context.extensionPath);
  setChatProvider(chatProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("agent.chatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Handle openFile from webview
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer("agent.chatView", {
      async deserializeWebviewPanel(_webviewPanel: vscode.WebviewPanel, _state: any) {},
    })
  );

  // ── Commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand("agent.indexWorkspace", indexWorkspaceCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("agent.explainCode", explainCodeCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("agent.askQuestion", askQuestionCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("agent.checkStatus", checkStatusCommand)
  );

  // ── Status bar ──
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = "$(hubot) Agent";
  statusBar.tooltip = "Codebase Intelligence Agent";
  statusBar.command = "agent.askQuestion";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

export function deactivate() {}
