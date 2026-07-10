# Server - Codebase Intelligence Agent

## 概述

Python FastAPI 服务端，核心职责：
1. **代码库索引**：接收项目路径 → 分块 → Embedding → 存入向量库
2. **Agent 问答**：实现 Plan-Execute-Reflect 循环，协调 RAG 检索和 LLM 调用
3. **LLM 调用**：统一封装 OpenAI / Anthropic SDK，支持流式输出

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建项目，返回 project_id |
| POST | `/api/projects/:id/index` | 触发索引（异步） |
| GET | `/api/projects/:id/status` | 查询索引状态 |
| POST | `/api/projects/:id/chat` | Agent 问答（SSE 流式） |
| DELETE | `/api/projects/:id` | 删除项目及索引 |
| GET | `/api/health` | 健康检查 |

### SSE 事件协议（/chat 响应流）

```
event: plan       → {"queries": [...], "strategy": "..."}
event: search     → {"query": "...", "results_count": N, "files": [...]}
event: reflect    → {"sufficient": bool, "reasoning": "...", "new_queries": [...]}
event: answer     → {"delta": "流式文本片段", "references": [...]}
event: done       → {"total_tokens": N, "iterations": N}
event: error      → {"message": "..."}
```

### 请求体（/api/projects/:id/chat）

```json
{
  "question": "这个项目的认证流程是怎样的？",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "context": {
    "current_file": "src/auth/login.ts",
    "selected_code": "...",
    "cursor_line": 42
  }
}
```

## Agent 循环（核心学习点）

### Plan（规划）
LLM 分析用户问题 → 拆解为 2-3 个独立检索查询（query rewriting）。
```
输入：用户问题 + 对话历史 + 项目元信息
输出：[{"query": "authentication middleware", "priority": 1}, ...]
```

### Execute（执行）
1. 每个 query 执行向量检索（Top-K=10）
2. 合并 + 去重 + LLM 重排序 → Top-5
3. 可选：读取 Top-1 片段的完整文件补充上下文

### Reflect（反思）
LLM 评估检索结果是否足够回答问题。
- 信息不足 → 生成新的检索查询，回到 Plan（最多 3 轮）
- 信息足够 → 进入 Answer

### Answer（回答）
综合上下文 + 原始问题 → 流式生成结构化回答（总结 + 详细解释 + 代码引用）。

## 技术栈

| 组件 | 选型 |
|------|------|
| 框架 | FastAPI |
| LLM | OpenAI SDK + Anthropic SDK |
| 向量库 | Qdrant / Pinecone |
| Embedding | text-embedding-3-small |
| 分块 | tree-sitter (AST-aware) |
| 异步任务 | Celery + Redis |
| 数据校验 | Pydantic v2 |

## 目录结构

```
server/
├── src/
│   ├── main.py              # FastAPI 入口，挂载路由
│   ├── config.py            # 配置管理（环境变量 + .env）
│   ├── api/
│   │   ├── projects.py      # 项目管理路由
│   │   └── chat.py          # Agent 问答路由（SSE）
│   ├── agent/
│   │   ├── orchestrator.py  # Plan-Execute-Reflect 主循环
│   │   ├── planner.py       # Plan：查询规划
│   │   ├── executor.py      # Execute：RAG 检索执行
│   │   ├── reflector.py     # Reflect：检索质量评估
│   │   └── answerer.py      # Answer：流式答案合成
│   ├── rag/
│   │   ├── indexer.py       # 代码库索引编排
│   │   ├── chunker.py       # AST 感知分块
│   │   ├── embedder.py      # Embedding 服务封装
│   │   ├── retriever.py     # 向量检索 + 元数据过滤
│   │   └── reranker.py      # LLM 重排序
│   ├── llm/
│   │   ├── client.py        # LLM 统一客户端（OpenAI/Claude）
│   │   └── prompts.py       # Prompt 模板
│   └── models/
│       └── schemas.py       # Pydantic 数据模型
├── tests/
│   ├── test_agent_loop.py
│   ├── test_rag.py
│   └── test_api.py
├── requirements.txt
└── README.md
```

## 配置项（.env）

```
# LLM
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# Vector DB
QDRANT_URL=http://localhost:6333
# 或 PINECONE_API_KEY + PINECONE_INDEX

# Server
SERVER_PORT=8000
MAX_AGENT_ITERATIONS=3
```
