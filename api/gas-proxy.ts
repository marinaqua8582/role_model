export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    const action = payload.action;

    // Block client attempts to run admin actions through public proxy
    if (action === 'getAdminDashboard' || action === 'getStudentDetail' || action === 'updateRoster' || action === 'getAllProgress') {
      return res.status(403).json({
        success: false,
        message: '관리자 전용 기능은 클라이언트에서 직접 호출할 수 없습니다.',
      });
    }

    const targetUrl = process.env.GAS_URL || process.env.VITE_GAS_URL;

    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
      return res.status(500).json({
        success: false,
        message: 'GAS_URL 환경변수가 설정되지 않았습니다.',
      });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      return res.status(response.status).send(text);
    }
  } catch (err: any) {
    console.error('GAS proxy error:', err);
    return res.status(500).json({
      success: false,
      message: 'Google Apps Script 연결 중 오류가 발생했습니다: ' + (err?.message || 'Server error'),
    });
  }
}
