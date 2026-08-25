// api/summarize.js —— 资讯"今日要点"摘要（带按天缓存，控费）
// 入参: POST { text, date? }
// 出参: { summary, cached }

const cache = globalThis.__sumCache || (globalThis.__sumCache = new Map());
const CACHE_TTL = 24 * 60 * 60 * 1000;

const hash = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const text = body.text || '';
  const date = body.date || new Date().toISOString().slice(0, 10);
  if (!text) return res.status(400).json({ error: 'text 为空' });

  const key = `${date}:${hash(text)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return res.status(200).json({ summary: hit.v, cached: true });

  const apiKey = process.env.CHAT_API_KEY;
  const base = process.env.CHAT_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
  if (!apiKey) return res.status(500).json({ error: '未配置 CHAT_API_KEY' });

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, stream: false,
        messages: [
          { role: 'system', content: '你是资讯摘要助手。用简洁中文列出今日要点，3-5 条，每条一行，不要解释。' },
          { role: 'user', content: text },
        ],
      }),
    });
    const data = await upstream.json();
    const summary = data.choices?.[0]?.message?.content || '';
    cache.set(key, { t: Date.now(), v: summary });
    res.status(200).json({ summary, cached: false });
  } catch (e) {
    res.status(500).json({ error: '摘要失败', detail: String(e) });
  }
}
