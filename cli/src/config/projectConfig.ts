import * as fs from "fs";
import * as path from "path";

export interface ProjectConfig {
  serverUrl: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  lastIndexed: string;
}

const CONFIG_DIR = ".agent";
const CONFIG_FILE = "config.json";

export function getConfigPath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, CONFIG_FILE);
}

export function loadConfig(cwd: string): ProjectConfig | null {
  const configPath = getConfigPath(cwd);
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export function saveConfig(cwd: string, config: ProjectConfig): void {
  const dir = path.join(cwd, CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(cwd), JSON.stringify(config, null, 2));
}

export function getServerUrl(cwd: string): string {
  const config = loadConfig(cwd);
  return config?.serverUrl || process.env.AGENT_SERVER_URL || "http://localhost:8000";
}

export function getProjectId(cwd: string): string | null {
  const config = loadConfig(cwd);
  return config?.projectId || null;
}
