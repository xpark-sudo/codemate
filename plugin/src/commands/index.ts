import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { createProject, indexProject, getStatus } from "../client/apiClient";
import { loadConfig } from "../utils/config";
import { ChatPanelProvider } from "../chat/panel";

let _chatProvider: ChatPanelProvider | null = null;

export function setChatProvider(p: ChatPanelProvider): void {
  _chatProvider = p;
}

export async function indexWorkspaceCommand(): Promise<void> {
  const config = loadConfig();
  const serverUrl = config.serverUrl;
  const projectPath = config.projectPath;
  const projectName = projectPath.split("/").pop() || "workspace";

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Agent: Indexing workspace...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Creating project..." });
        const project = await createProject(serverUrl, projectName, projectPath);

        progress.report({ message: "Indexing files..." });
        const result = await indexProject(serverUrl, project.id);

        // Save to .agent/config.json
        const dir = path.join(projectPath, ".agent");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, "config.json"),
          JSON.stringify({ ...config, projectId: project.id }, null, 2)
        );

        vscode.window.showInformationMessage(
          `Agent: Indexed ${result.chunk_count} code chunks`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Agent index failed: ${err.message}`);
      }
    }
  );
}

export async function explainCodeCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showWarningMessage("Select some code first.");
    return;
  }

  const selectedCode = editor.document.getText(editor.selection);
  const file = editor.document.uri.fsPath.split("/").pop();
  const question = `Explain this code from ${file}:\n\`\`\`\n${selectedCode}\n\`\`\``;

  await vscode.commands.executeCommand("agent.chatView.focus");
  _chatProvider?.ask(question);
}

export async function askQuestionCommand(): Promise<void> {
  await vscode.commands.executeCommand("agent.chatView.focus");
}

export async function checkStatusCommand(): Promise<void> {
  const config = loadConfig();
  if (!config.projectId) {
    vscode.window.showInformationMessage(
      "Agent: No project indexed yet. Run 'Agent: Index Workspace' first."
    );
    return;
  }

  try {
    const status = await getStatus(config.serverUrl, config.projectId);
    vscode.window.showInformationMessage(
      `Agent: ${status.status} | ${status.chunk_count} chunks indexed`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Status check failed: ${err.message}`);
  }
}
