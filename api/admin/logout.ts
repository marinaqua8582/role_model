export default async function handler(req: any, res: any) {
  res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  return res.status(200).json({ success: true, message: '로그아웃되었습니다.' });
}
