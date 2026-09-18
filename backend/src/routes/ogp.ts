import { Router, Request, Response } from 'express';
import dns from 'dns/promises';
import net from 'net';
import { parse as parseHtml } from 'node-html-parser';
import type { OgpMetadata } from '../types';

/** fetch が返す Response（express の Response と名前が衝突するため別名にする） */
type FetchResponse = globalThis.Response;

const router = Router();

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;   // HTML の <head> を読むには十分な上限
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; MakeHUB/1.1; +https://github.com/saltea-Giraffe/Make_hub)';

// ─── SSRF 対策 ────────────────────────────────────────────────────

/** プライベート／ループバック／リンクローカル等、外部公開されていないアドレスか */
function isBlockedAddress(ip: string): boolean {
  const version = net.isIP(ip);

  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0)   return true;                       // 0.0.0.0/8
    if (a === 10)  return true;                       // 10.0.0.0/8
    if (a === 127) return true;                       // ループバック
    if (a === 169 && b === 254) return true;          // リンクローカル (169.254.0.0/16)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;// CGNAT (100.64.0.0/10)
    if (a === 192 && b === 0) return true;            // 192.0.0.0/24 等
    if (a === 198 && (b === 18 || b === 19)) return true; // ベンチマーク用
    if (a >= 224) return true;                        // マルチキャスト／予約
    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    // IPv4 射影アドレス (::ffff:192.168.0.1) は IPv4 として再判定する
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    if (/^f[cd]/.test(lower)) return true;            // ユニークローカル fc00::/7
    if (/^fe[89ab]/.test(lower)) return true;         // リンクローカル fe80::/10
    if (lower.startsWith('ff')) return true;          // マルチキャスト
    return false;
  }

  // IP として解釈できないものは通さない
  return true;
}

/**
 * URL の接続先が外部の公開ホストであることを確認する。
 *
 * 注意: 名前解決してから fetch するまでの間に DNS の応答が変わる
 * （DNS リバインディング）可能性までは防げない。この API は管理者専用であり、
 * 管理者はもともと任意のURLを登録できるため、ここでは到達先の事前検証に留める。
 */
async function assertPublicUrl(target: URL): Promise<void> {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('http / https のURLのみ取得できます');
  }

  const host = target.hostname;

  // ホスト名がそのままIPの場合は解決せず判定する
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new Error('内部ネットワーク宛のURLは取得できません');
    return;
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('ホスト名を解決できませんでした');
  }

  if (records.length === 0) throw new Error('ホスト名を解決できませんでした');
  // 1つでも内部アドレスに解決されるホストは拒否する
  if (records.some(r => isBlockedAddress(r.address))) {
    throw new Error('内部ネットワーク宛のURLは取得できません');
  }
}

// ─── HTML 取得 ────────────────────────────────────────────────────

/** リダイレクトを自前で辿りつつ、各ホップで接続先を検証する */
async function fetchHtml(startUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: FetchResponse;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.8',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('取得がタイムアウトしました');
      }
      throw new Error('ページを取得できませんでした');
    }

    try {
      // ─── リダイレクト ───────────────────────────────────────
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('リダイレクト先が不正です');
        if (hop === MAX_REDIRECTS) throw new Error('リダイレクトが多すぎます');
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        throw new Error(`ページを取得できませんでした (HTTP ${response.status})`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        throw new Error('HTML ページではないため情報を取得できません');
      }

      const html = await readCapped(response);
      return { html, finalUrl: current };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('リダイレクトが多すぎます');
}

/** 上限バイト数まで読んだら打ち切る（巨大ページ対策） */
async function readCapped(response: FetchResponse): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => { /* 打ち切りによるエラーは無視 */ });

  const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)), Math.min(total, MAX_BYTES));
  return buffer.toString('utf-8');
}

// ─── メタデータ抽出 ────────────────────────────────────────────────

function extractMetadata(html: string, finalUrl: URL): OgpMetadata {
  const root = parseHtml(html);

  /** property= と name= の両方を見る（サイトによって書き方が違うため） */
  const meta = (key: string): string | null => {
    const el =
      root.querySelector(`meta[property="${key}"]`) ??
      root.querySelector(`meta[name="${key}"]`);
    const content = el?.getAttribute('content')?.trim();
    return content ? content : null;
  };

  const title =
    meta('og:title') ??
    meta('twitter:title') ??
    root.querySelector('title')?.text?.trim() ??
    null;

  const description =
    meta('og:description') ??
    meta('twitter:description') ??
    meta('description') ??
    null;

  const rawImage =
    meta('og:image') ??
    meta('og:image:url') ??
    meta('twitter:image') ??
    root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ??
    root.querySelector('link[rel="icon"]')?.getAttribute('href') ??
    null;

  // 相対URLを絶対URLに直す
  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(rawImage, finalUrl).toString();
    } catch {
      image = null;
    }
  }

  const clip = (s: string | null, max: number) =>
    s ? (s.length > max ? `${s.slice(0, max - 1)}…` : s) : null;

  return {
    url: finalUrl.toString(),
    // アプリ名は100文字、説明文は500文字までしか保存できないため合わせて切り詰める
    title: clip(title, 100),
    description: clip(description, 500),
    image,
    site_name: clip(meta('og:site_name'), 100),
  };
}

// ─── GET /api/ogp?url=... ─────────────────────────────────────────
// リンク登録時にタイトル・説明・アイコンを自動入力するために使う。
// 任意のURLへサーバーから接続するため、管理者のみに開放している（index.ts で制御）。
router.get('/', async (req: Request, res: Response) => {
  const raw = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!raw) {
    res.status(422).json({ success: false, error: 'url パラメータは必須です' });
    return;
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    res.status(422).json({ success: false, error: '有効なURLを入力してください' });
    return;
  }

  try {
    const { html, finalUrl } = await fetchHtml(target);
    res.json({ success: true, data: extractMetadata(html, finalUrl) });
  } catch (err) {
    const message = err instanceof Error ? err.message : '情報を取得できませんでした';
    res.status(502).json({ success: false, error: message });
  }
});

export default router;
