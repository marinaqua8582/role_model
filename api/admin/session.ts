import { extractAdminToken, verifyAdminSessionToken } from '../_lib';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ authenticated: false, message: 'Method Not Allowed' });
  }

  const token = extractAdminToken(req);
  const result = verifyAdminSessionToken(token);

  if (!result.valid) {
    return res.status(401).json({
      authenticated: false,
      message: result.message || '인증되지 않았습니다.',
    });
  }

  return res.status(200).json({
    authenticated: true,
  });
}
