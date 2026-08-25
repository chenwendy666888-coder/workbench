# 个人工作台 · 阶段 A 后端骨架（含天气 / 资讯 / AI 聊天 / 今日要点）

纯 Vercel Serverless Functions。前端 `index.html` 已内置四张卡片，调 `/api/*`，**天气与资讯无需任何密钥**即可用。

## 目录
```
stageA/
├─ index.html         # 你的工作台（已加 天气/资讯/AI聊天 卡片 + 资讯"今日要点"）
├─ api/
│  ├─ weather.js      # Open-Meteo 天气（免 key）✅ 已实测接通
│  ├─ feed.js         # RSS/Atom 聚合（rss-parser）✅ 已实测接通
│  ├─ chat.js         # AI 聊天 SSE 流式（需 CHAT_API_KEY）
│  └─ summarize.js    # 资讯"今日要点"摘要（按天缓存，需 CHAT_API_KEY）
├─ vercel.json        # 部署配置（api 走 @vercel/node）
├─ package.json       # type:module + 依赖 rss-parser
├─ .env.example
└─ README.md
```

## 本地运行（3 步）
1. `npm install`
2. `npx vercel dev`
3. 浏览器开 `http://localhost:3000` —— 主页即可看到天气 / 资讯 / 聊天卡片。

> 没装 vercel？先 `npm i -g vercel`。**天气 / 资讯免 key 直接能用**。
> 直接双击 `index.html` 也能看，只是卡片会提示"需要后端"，部署到 Vercel 后自动正常——这是预期行为，不是 bug。

## 部署
- 把本目录内容推到仓库根，连接 Vercel 即可（已自带 `vercel.json`）。
- 用 AI 聊天 / 资讯摘要时，在 Vercel 项目设置里填 `CHAT_API_KEY`（及可选 `CHAT_BASE_URL` / `CHAT_MODEL`）。天气和资讯不需要。

## 接口（均已本地冒烟通过）
- `GET  /api/weather?city=上海` 或 `?lat=&lon=`
- `POST /api/feed` `{ "sources": ["https://.../rss"] }`
- `POST /api/chat` `{ "messages": [{ "role":"user","content":"你好" }] }`（SSE 流式）
- `POST /api/summarize` `{ "text": "标题1\n标题2" }`

## 数据安全性
- 你的本地数据（`rh_state_v1`）**完全不动**：本阶段只在 localStorage 中"加法"新增字段（天气城市、RSS 源），不改结构、不迁移、不丢失。
- AI 聊天内容**不落盘**（仅当前页面临时存在），不会污染你的存储。

## 已验证
- ✅ `weather` / `feed` 真实联网返回（上海天气、少数派+36氪 RSS）
- ✅ `chat` / `summarize` 无 Key 时优雅报错，不白屏、不崩
- ✅ `index.html` 语法体检通过
- 🐛 修复：`weather.js` 原 `new URL(req.url)` 在 Vercel 相对路径下会抛 `Invalid URL`，已改为优先用 `req.query` + url 兜底
