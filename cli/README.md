# CLI - Agent Command Line Tool

## 概述

Node.js TypeScript CLI 工具，提供终端环境下的 Agent 交互。支持单次问答和 REPL 对话模式，实时流式展示 Agent 思考过程。

## 命令清单

### 项目管理

```bash
# 初始化当前目录为 Agent 项目
agent init

# 索引当前项目
agent index

# 持续监听文件变更，增量索引
agent index --watch

# 查看索引状态
agent status
```

### 问答

```bash
# 单次问答（流式输出答案）
agent ask "这个项目的认证流程是怎样的？"

# 单次问答 + 指定文件作为上下文
agent ask "这个函数做了什么？" --file src/auth/login.ts

# 进入 REPL 对话模式
agent chat

# 输出原始 JSON（用于脚本集成）
agent ask "..." --json

# 显示 Agent 完整思考链
agent ask "..." --verbose
```

### 全局配置

```bash
# 设置服务端地址
agent config set serverUrl http://localhost:8000

# 查看当前配置
agent config list
```

## REPL 模式

```
$ agent chat
╭─────────────────────────────────────────╮
│  Codebase Intelligence Agent            │
│  Project: my-app  |  Files indexed: 342 │
│  Type /help for commands, /quit to exit │
╰─────────────────────────────────────────╯

You › 认证流程是怎样的？

🧠 Plan     → 拆解为 3 个检索查询...
🔍 Search   → 找到 10 个相关代码片段
🤔 Reflect  → 信息充分，开始合成答案

📝 Answer:
这个项目使用 JWT + 中间件的认证方案...

References:
  • src/middleware/auth.ts:12-45
  • src/routes/login.ts:28-67
  • src/utils/jwt.ts:5-32

You › /quit
Bye!
```

## 流式输出设计

不同阶段用不同颜色/图标区分：

| 阶段 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Plan | 🧠 | 蓝色 | 查询规划阶段 |
| Search | 🔍 | 黄色 | 向量检索中 |
| Reflect | 🤔 | 紫色 | 评估检索质量 |
| Answer | 📝 | 绿色 | 流式答案输出 |
| Done | ✅ | 灰色 | 完成统计 |
| Error | ❌ | 红色 | 错误信息 |

## 技术栈

| 组件 | 选型 |
|------|------|
| 语言 | TypeScript |
| 运行时 | Node.js >= 18 |
| CLI 框架 | Commander.js |
| SSE 解析 | fetch + 自定义 SSE parser |
| 终端样式 | chalk + ora（spinner） |
| 构建 | tsup |
| 发布 | npm |

## 目录结构

```
cli/
├── src/
│   ├── index.ts              # CLI 入口，注册所有命令
│   ├── commands/
│   │   ├── ask.ts             # agent ask 命令
│   │   ├── chat.ts            # agent chat REPL 模式
│   │   ├── index-cmd.ts       # agent index 命令
│   │   ├── status.ts          # agent status 命令
│   │   ├── init.ts            # agent init 命令
│   │   └── config.ts          # agent config 命令
│   ├── client/
│   │   └── apiClient.ts       # 服务端 HTTP/SSE 客户端
│   ├── ui/
│   │   ├── sse-parser.ts      # SSE 流解析器
│   │   ├── stream-handler.ts  # 事件分发 + 终端渲染
│   │   └── format.ts          # 输出格式化
│   └── config/
│       └── projectConfig.ts   # .agent/config.json 读写
├── package.json
├── tsconfig.json
└── README.md
```

## .agent/config.json 格式

```json
{
  "serverUrl": "http://localhost:8000",
  "projectId": "proj_abc123",
  "projectName": "my-app",
  "projectPath": "/Users/xxx/work/my-app",
  "lastIndexed": "2026-07-09T10:30:00Z"
}
```

## SSE 流式解析实现要点

```typescript
// 核心：基于 fetch ReadableStream 的 SSE 解析
async function* parseSSE(response: Response): AsyncGenerator<SSEEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按 \n\n 分割事件
    const events = buffer.split('\n\n');
    buffer = events.pop()!; // 保留不完整的事件

    for (const event of events) {
      const parsed = parseSSEEvent(event);
      if (parsed) yield parsed;
    }
  }
}
```
