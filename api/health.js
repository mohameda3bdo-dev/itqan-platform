// GET /api/health — صفحة فحص: تعرض النسخة المنشورة وهل المتغيرات موجودة (بدون أي قيم سرية)
module.exports = function handler(req, res) {
  const has = (k) => Boolean(process.env[k] && String(process.env[k]).trim());
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    version: 'cors-v2',
    env: {
      PAYMOB_SECRET_KEY: has('PAYMOB_SECRET_KEY'),
      PAYMOB_PUBLIC_KEY: has('PAYMOB_PUBLIC_KEY'),
      PAYMOB_HMAC_SECRET: has('PAYMOB_HMAC_SECRET'),
      PAYMOB_INTEGRATION_CARD: has('PAYMOB_INTEGRATION_CARD'),
      PAYMOB_INTEGRATION_WALLET: has('PAYMOB_INTEGRATION_WALLET'),
      PAYMOB_INTEGRATION_FAWRY: has('PAYMOB_INTEGRATION_FAWRY'),
      SITE_URL: has('SITE_URL'),
      API_URL: has('API_URL'),
      ALLOWED_ORIGINS: has('ALLOWED_ORIGINS'),
    },
  });
};
