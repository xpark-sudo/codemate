# Plugin - VSCode Extension

## 概述

VSCode 插件，提供 Ask Agent 聊天面板和右键菜单交互。通过 SSE 流式接收服务端 Agent 的思考过程和答案。

## 功能清单

### Ask Agent 聊天面板
- 侧边栏 Webview，类似 GitHub Copilot Chat
- 实时展示 Agent 思考阶段：Plan → Search → Reflect → Answer
- 代码引用可点击跳转（`vscode://file/path:line`）
- 对话历史持久化（`.agent/chat_history.json`）

### 上下文感知
- **选中代码提问**：选中代码 → 右键 "Ask Agent about this code"
- **当前文件感知**：自动将当前文件路径和内容摘要作为上下文
- **光标位置感知**：在代码中光标处 → "What does this do here?"

### 代码库索引
- 命令面板：`Agent: Index Workspace`
- 状态栏实时索引进度
- 首次打开项目自动提示索引

### 其他命令
| 命令 | 说明 |
|------|------|
| `Agent: Ask Question` | 打开聊天面板，自由提问 |
| `Agent: Explain This Code` | 解释当前选中代码 |
| `Agent: Find Similar Code` | 查找与选中代码相似的其他代码 |
| `Agent: Index Workspace` | 索引当前工作区 |
| `Agent: Check Index Status` | 查看索引状态 |

## 技术栈

| 组件 | 选型 |
|------|------|
| 语言 | TypeScript |
| UI | Webview (HTML/CSS/JS) 或 TreeView |
| 通信 | fetch + SSE (EventSource) |
| 构建 | esbuild |
| 包管理 | npm / yarn |

## 目录结构

```
plugin/
├── src/
│   ├── extension.ts          # 插件入口，注册命令、Provider
│   ├── chat/
│   │   ├── chatPanel.ts      # Webview Panel 管理
│   │   ├── chatProvider.ts   # 聊天逻辑（发送/接收/历史）
│   │   └── webview/
│   │       ├── chat.html     # Webview HTML 模板
│   │       ├── chat.js       # Webview 前端逻辑
│   │       └── chat.css      # Webview 样式
│   ├── commands/
│   │   ├── index.ts          # 索引工作区命令
│   │   ├── explain.ts        # 解释代码命令
│   │   └── similar.ts        # 相似代码搜索命令
│   ├── client/
│   │   └── apiClient.ts      # 服务端 HTTP/SSE 客户端
│   └── utils/
│       ├── context.ts        # 编辑器上下文获取
│       └── config.ts         # 插件配置管理
├── package.json              # 插件清单 + 命令注册 + 快捷键
├── tsconfig.json
└── README.md
```

## 配置项（package.json contributes.configuration）

```json
{
  "agent.serverUrl": "http://localhost:8000",
  "agent.autoIndexOnOpen": true,
  "agent.maxHistoryLength": 50
}
```

## 关键 API 调用

### 索引工作区
```
POST {serverUrl}/api/projects
→ POST {serverUrl}/api/projects/{id}/index
→ 轮询 GET {serverUrl}/api/projects/{id}/status
```

### Agent 问答
```
POST {serverUrl}/api/projects/{id}/chat
  body: { question, history, context: { current_file, selected_code, cursor_line } }
→ SSE 流式接收 plan / search / reflect / answer / done 事件
```

## SSE 事件处理

```typescript
// 客户端解析 SSE 流
const response = await fetch(`${serverUrl}/api/projects/${id}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question, history, context })
});

const reader = response.body.getReader();
// 解析 event: plan / search / reflect / answer / done
// 不同阶段在 UI 上以不同样式展示
```
