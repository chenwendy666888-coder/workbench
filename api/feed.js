// api/feed.js —— 用户 RSS/Atom 源聚合（服务端抓取，避免跨域）
// 入参(两种): POST { sources:[url,...] }  或  GET ?sources=url1,url2
// 出参: { feeds:[{title,url,failed,items:[{title,link,pubDate,summary}]}], fetchedAt }

import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkbenchFeed/1.0)' },
});

const cache = globalThis.__feedCache || (globalThis.__feedCache = new Map());
const CACHE_TTL = 60 * 60 * 1000;

export default async function handler(req, res) {
  try {
    let sources = [];
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      sources = body.sources || [];
    } else {
      const url = new URL(req.url);
      const s = url.searchParams.get('sources');
      if (s) sources = s.split(',').map((x) => x.trim()).filter(Boolean);
    }
    if (!sources.length) {
      sources = (process.env.DEFAULT_FEEDS || '').split(',').map((x) => x.trim()).filter(Boolean);
    }
    if (!sources.length) return res.status(400).json({ error: '未提供 sources' });

    const key = sources.join('|');
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL) return res.status(200).json(hit.v);

    const feeds = await Promise.all(sources.map(async (src) => {
      try {
        const feed = await parser.parseURL(src);
        return {
          title: feed.title || src, url: src, failed: false,
          items: (feed.items || []).slice(0, 15).map((it) => ({
            title: it.title, link: it.link,
            pubDate: it.pubDate || it.isoDate,
            summary: (it.contentSnippet || it.summary || '').slice(0, 300),
          })),
        };
      } catch (e) {
        return { title: src, url: src, failed: true, error: String(e), items: [] };
      }
    }));

    const payload = { feeds, fetchedAt: Date.now() };
    cache.set(key, { t: Date.now(), v: payload });
    res.status(200).json(payload);
  } catch (e) {
    res.status(500).json({ error: '资讯获取失败', detail: String(e) });
  }
}
