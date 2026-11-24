// POST /api/paymob-webhook
// Paymob تنادي هذا الرابط بنتيجة الدفع. نتحقق من HMAC قبل الوثوق بأي بيانات.
const crypto = require('crypto');

// ترتيب الحقول المطلوب لحساب HMAC لإشعار المعاملة (Transaction processed callback)
const FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
  'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
  'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];

function pick(obj, path) {
  const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  return v === undefined || v === null ? '' : String(v);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.PAYMOB_HMAC_SECRET;
  const received = String((req.query && req.query.hmac) || '');
  const obj = req.body && req.body.obj;
  if (!secret || !received || !obj) return res.status(400).end();

  const str = FIELDS.map((f) => pick(obj, f)).join('');
  const calc = crypto.createHmac('sha512', secret).update(str).digest('hex');

  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(received, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn('Paymob webhook: HMAC mismatch');
    return res.status(401).end();
  }

  const paid = obj.success === true && obj.pending !== true;
  const ref = obj.order && obj.order.merchant_order_id;
  console.log('Paymob payment', { transaction: obj.id, paid, amount_cents: obj.amount_cents, ref });

  // TODO: هنا تفعّل الاشتراك للمستخدم عندما يكون عندك قاعدة بيانات وحسابات مستخدمين.
  // احفظ obj.id (رقم المعاملة) لتفادي معالجة نفس الإشعار مرتين.

  return res.status(200).json({ received: true });
};
