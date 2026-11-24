// POST /api/create-payment
// ينشئ عملية دفع (Intention) عند Paymob ويرجّع رابط صفحة الدفع.
// الأسعار هنا على السيرفر فقط، فلا يستطيع أحد تغيير المبلغ من المتصفح.

const PLANS = {
  'الشهرية': { price: 299, label: 'اشتراك شهري - منصة إتقان' },
  'السنوية': { price: 2499, label: 'اشتراك سنوي - منصة إتقان' },
};

function integrationId(method) {
  const map = {
    card: process.env.PAYMOB_INTEGRATION_CARD,
    wallet: process.env.PAYMOB_INTEGRATION_WALLET,
    fawry: process.env.PAYMOB_INTEGRATION_FAWRY,
  };
  const id = Number(map[method]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cors(req, res) {
  // الصفحات المسموح لها بالاتصال بهذا السيرفر
  const allowed = ['https://mohameda3bdo-dev.github.io']
    .concat((process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean));
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { plan, name, email, phone, method } = req.body || {};
  const p = PLANS[plan];
  const intId = integrationId(method);
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (!p || !intId || !cleanName || !cleanEmail || !cleanPhone) {
    return res.status(400).json({ error: 'بيانات الطلب غير صحيحة' });
  }

  const SECRET = process.env.PAYMOB_SECRET_KEY;
  const PUBLIC = process.env.PAYMOB_PUBLIC_KEY;
  // SITE_URL: الموقع الأساسي اللي يرجع له العميل بعد الدفع (GitHub Pages)
  // API_URL: رابط Vercel اللي عليه الـ Webhook
  const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
  const API = (process.env.API_URL || SITE).replace(/\/$/, '');
  const BASE = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com';
  if (!SECRET || !PUBLIC || !SITE) {
    return res.status(500).json({ error: 'إعدادات الدفع غير مكتملة على السيرفر' });
  }

  const parts = cleanName.split(/\s+/);
  const first = parts[0];
  const last = parts.slice(1).join(' ') || 'NA';
  const ref = 'itqan-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  const body = {
    amount: p.price * 100, // بالقروش
    currency: 'EGP',
    payment_methods: [intId],
    items: [{ name: p.label, amount: p.price * 100, description: p.label, quantity: 1 }],
    billing_data: {
      first_name: first,
      last_name: last,
      email: cleanEmail,
      phone_number: cleanPhone,
      apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
      shipping_method: 'NA', postal_code: 'NA', city: 'Alexandria',
      country: 'EG', state: 'NA',
    },
    special_reference: ref,
    notification_url: API + '/api/paymob-webhook',
    redirection_url: SITE + '/',
  };

  try {
    const r = await fetch(BASE + '/v1/intention/', {
      method: 'POST',
      headers: { Authorization: 'Token ' + SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.client_secret) {
      console.error('Paymob intention failed', r.status, JSON.stringify(data));
      return res.status(502).json({ error: 'تعذر بدء عملية الدفع، حاول مرة أخرى' });
    }
    const url = BASE + '/unifiedcheckout/?publicKey=' + encodeURIComponent(PUBLIC) +
      '&clientSecret=' + encodeURIComponent(data.client_secret);
    return res.status(200).json({ url });
  } catch (e) {
    console.error('Paymob request error', e);
    return res.status(502).json({ error: 'تعذر الاتصال ببوابة الدفع' });
  }
};
