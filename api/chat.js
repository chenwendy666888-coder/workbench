// api/chat.js —— 贴边 AI 聊天窗（SSE 流式，OpenAI 兼容端点）
// 入参: POST { messages:[{role,content}] }
// 出参: text/event-stream，逐 token 透传上游 data: {...}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.CHAT_API_KEY;
  const base = process.env.CHAT_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
  if (!apiKey) return res.status(500).json({ error: '未配置 CHAT_API_KEY' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const messages = body.messages || [];
  if (!messages.length) return res.status(400).json({ error: 'messages 为空' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!upstream.ok) {
      const txt = await upstream.text();
      res.write(`data: ${JSON.stringify({ error: upstream.statusText, detail: txt })}\n\n`);
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: String(e) })}\n\n`);
    res.end();
  }
}
