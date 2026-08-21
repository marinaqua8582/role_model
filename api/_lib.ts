import crypto from 'crypto';

export interface AdminSessionPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Returns the secret key for HMAC signature based on server environment
 */
function getSigningSecret(): string {
  const adminPass = process.env.ADMIN_PASSWORD || '';
  const apiSecret = process.env.ADMIN_API_SECRET || '';
  // Combines ADMIN_PASSWORD and ADMIN_API_SECRET
  return `${adminPass}::${apiSecret}::rolemodel_session_salt_2026`;
}

/**
 * Generate a cryptographically signed HMAC-SHA256 stateless session token
 */
export function generateAdminSessionToken(): string {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    role: 'admin',
    iat: now,
    exp: now + SESSION_TTL_MS,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = getSigningSecret();
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Validate a cryptographically signed session token
 */
export function verifyAdminSessionToken(token?: string): { valid: boolean; message?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: '인증 토큰이 없습니다.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, message: '유효하지 않은 토큰 형식입니다.' };
  }

  const [payloadStr, signature] = parts;
  const secret = getSigningSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, message: '토큰 서명이 유효하지 않습니다.' };
  }

  try {
    const payloadJson = Buffer.from(payloadStr, 'base64url').toString('utf8');
    const payload: AdminSessionPayload = JSON.parse(payloadJson);

    if (payload.role !== 'admin') {
      return { valid: false, message: '권한이 없습니다.' };
    }

    if (!payload.exp || payload.exp < Date.now()) {
      return { valid: false, message: '관리자 인증이 만료되었습니다. 다시 로그인해 주세요.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, message: '토큰 디코딩 실패' };
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

export function extractAdminToken(req: any): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies['admin_session']) {
    return cookies['admin_session'];
  }

  const auth = req.headers.authorization;
  if (auth && typeof auth === 'string') {
    const parts = auth.split(' ');
    if (parts[0] === 'Bearer' && parts[1]) {
      return parts[1];
    }
  }

  return undefined;
}

/**
 * Call Google Apps Script securely from server with ADMIN_API_SECRET
 */
export async function callServerGas(payload: Record<string, any>): Promise<any> {
  const targetUrl =
    process.env.GAS_URL ||
    process.env.VITE_GAS_URL ||
    'https://script.google.com/macros/s/AKfycbzmtB28cj27SglDkQepd1DGlRRrv57LIRLipACLXRS1rSSiT0fPVtdrcNebKFg9X3nl/exec';

  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
    throw new Error('GAS_URL 환경변수가 설정되지 않았습니다.');
  }

  const adminSecret = process.env.ADMIN_API_SECRET || '';
  const bodyPayload = {
    ...payload,
    ...(adminSecret ? { adminSecret } : {}),
  };

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(bodyPayload),
    redirect: 'follow',
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Google Apps Script non-JSON response: ${text.slice(0, 200)}`);
  }
}
