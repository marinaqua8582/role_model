import { extractAdminToken, verifyAdminSessionToken, callServerGas } from '../_lib.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const token = extractAdminToken(req);
  const auth = verifyAdminSessionToken(token);

  if (!auth.valid) {
    return res.status(401).json({
      success: false,
      message: auth.message || '관리자 인증이 필요합니다. 다시 로그인해 주세요.',
    });
  }

  try {
    const studentKey = String(req.query.studentKey || '').trim();
    if (!studentKey) {
      return res.status(400).json({ success: false, message: 'studentKey 파라미터가 필요합니다.' });
    }

    const gasData = await callServerGas({
      action: 'getStudentDetail',
      studentKey,
    });

    if (gasData && gasData.success) {
      return res.status(200).json(gasData);
    }
    return res.status(502).json({
      success: false,
      message: gasData?.message || 'Google Apps Script에서 학생 상세 정보를 가져오지 못했습니다.',
    });
  } catch (err: any) {
    console.error('Admin student-detail fetch error:', err);
    return res.status(500).json({
      success: false,
      message: '학생 상세 조회 실패: ' + (err?.message || 'Server error'),
    });
  }
}
