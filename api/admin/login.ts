import { generateAdminSessionToken } from '../_lib';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword || typeof configuredPassword !== 'string' || configuredPassword.trim() === '') {
    return res.status(500).json({
      success: false,
      message: '서버에 관리자 비밀번호(ADMIN_PASSWORD) 설정이 필요합니다. Vercel 환경변수를 설정해 주세요.',
    });
  }

  const { password } = req.body || {};
  if (!password || String(password) !== String(configuredPassword)) {
    return res.status(401).json({
      success: false,
      message: '관리자 비밀번호가 올바르지 않습니다.',
    });
  }

  const sessionToken = generateAdminSessionToken();
  const maxAge = 8 * 60 * 60; // 8 hours in seconds
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  const cookieOptions = [
    `admin_session=${sessionToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isProd) {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));

  return res.status(200).json({
    success: true,
    token: sessionToken,
    message: '관리자 로그인이 완료되었습니다.',
  });
}
