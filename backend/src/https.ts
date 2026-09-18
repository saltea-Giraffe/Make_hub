import fs from 'fs';
import os from 'os';
import path from 'path';
import selfsigned from 'selfsigned';
import { HTTPS } from './config';
import { DATA_DIR } from './db/connection';

export interface TlsMaterial {
  key: string;
  cert: string;
  ca?: string;
  /** 自己署名証明書を自動生成した（ブラウザに警告が出る）場合 true */
  selfSigned: boolean;
  /** 証明書の保存先（自動生成した場合のみ） */
  directory?: string;
}

const CERT_DIR  = path.join(DATA_DIR, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE  = path.join(CERT_DIR, 'key.pem');

/** このマシンが持つ LAN の IPv4 アドレス一覧（リンクローカルは除く） */
function localIPv4Addresses(): string[] {
  const result: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      // 169.254.0.0/16 はDHCP失敗時の自動設定アドレスで、アクセス用途には使えない
      if (entry.address.startsWith('169.254.')) continue;
      result.push(entry.address);
    }
  }
  return result;
}

/**
 * 自己署名証明書を作成して data/certs に保存する。
 *
 * SAN には localhost と、このマシンの LAN IP を入れる。
 * これにより `https://192.168.x.x:3443` でスマートフォンから開いたときにも
 * 「証明書のホスト名が違う」エラーにはならない（ただし発行元が信頼されていない
 * ことによる警告は出る）。
 */
function generateSelfSigned(): { key: string; cert: string } {
  const hosts = ['localhost', os.hostname(), ...HTTPS.extraHosts].filter(Boolean);
  const ips   = ['127.0.0.1', ...localIPv4Addresses()];

  const altNames = [
    ...Array.from(new Set(hosts)).map(value => ({ type: 2, value })),  // type 2 = DNS
    ...Array.from(new Set(ips)).map(ip => ({ type: 7, ip })),          // type 7 = IP
  ];

  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames },
      ],
    }
  );

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(CERT_FILE, pems.cert, { mode: 0o600 });
  fs.writeFileSync(KEY_FILE, pems.private, { mode: 0o600 });

  console.log(`🔐 自己署名証明書を生成しました: ${CERT_DIR}`);
  console.log(`   対象ホスト: ${[...hosts, ...ips].join(', ')}`);

  return { key: pems.private, cert: pems.cert };
}

/**
 * HTTPS 用の鍵と証明書を用意する。
 *
 * 1. HTTPS_CERT_FILE / HTTPS_KEY_FILE が指定されていればそれを読む（正規の証明書向け）
 * 2. 指定が無ければ data/certs の自己署名証明書を使う
 * 3. それも無ければ新規に自己署名証明書を作る
 */
export function loadTlsMaterial(): TlsMaterial {
  // ─── 1. 明示指定された証明書 ────────────────────────────────
  if (HTTPS.certFile || HTTPS.keyFile) {
    if (!HTTPS.certFile || !HTTPS.keyFile) {
      throw new Error('HTTPS_CERT_FILE と HTTPS_KEY_FILE は両方とも指定してください');
    }
    for (const file of [HTTPS.certFile, HTTPS.keyFile]) {
      if (!fs.existsSync(file)) throw new Error(`証明書ファイルが見つかりません: ${file}`);
    }
    return {
      cert: fs.readFileSync(HTTPS.certFile, 'utf-8'),
      key:  fs.readFileSync(HTTPS.keyFile, 'utf-8'),
      ca:   HTTPS.caFile ? fs.readFileSync(HTTPS.caFile, 'utf-8') : undefined,
      selfSigned: false,
    };
  }

  // ─── 2. 生成済みの自己署名証明書 ────────────────────────────
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    return {
      cert: fs.readFileSync(CERT_FILE, 'utf-8'),
      key:  fs.readFileSync(KEY_FILE, 'utf-8'),
      selfSigned: true,
      directory: CERT_DIR,
    };
  }

  // ─── 3. 新規生成 ────────────────────────────────────────────
  const generated = generateSelfSigned();
  return { ...generated, selfSigned: true, directory: CERT_DIR };
}
