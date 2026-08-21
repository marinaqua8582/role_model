import { extractAdminToken, verifyAdminSessionToken, callServerGas } from '../_lib.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
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
    const { students, mode } = req.body || {};
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, message: '학생 명단(students) 배열이 필요합니다.' });
    }

    const gasData = await callServerGas({
      action: 'updateRoster',
      students,
      mode: mode || 'replace',
    });

    if (gasData && gasData.success) {
      return res.status(200).json(gasData);
    }

    return res.status(502).json({
      success: false,
      message: gasData?.message || 'Google Apps Script 학생 명단 수정에 실패했습니다.',
    });
  } catch (err: any) {
    console.error('Admin update-roster error:', err);
    return res.status(500).json({
      success: false,
      message: '학생 명단 저장 실패: ' + (err?.message || 'Server error'),
    });
  }
}
