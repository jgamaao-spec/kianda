/**
 * ============================================================
 *  KIANDA — Loja online de bolsas femininas (Luanda, Angola)
 * ============================================================
 *  Servidor Node.js/Express, 100% gratuito, sem base de dados
 *  externa. Todos os dados vivem em ficheiros JSON dentro do
 *  projeto (data/*.json) e as fotos enviadas pelo admin ficam
 *  guardadas em public/img/products/.
 *
 *  Por isso, TODAS as alterações feitas no painel admin são
 *  PERMANENTES — fazem parte do próprio "código" do site.
 * ============================================================
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PRODUCTS_IMG = path.join(PUBLIC_DIR, 'img', 'products');
const DEFAULT_PASSWORD = 'kianda2026';

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(PUBLIC_DIR));

/* ---------------- utilidades ---------------- */
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const uid = (p) => (p || 'p') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, obj) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(obj, null, 2));
}

function getSettings() {
  const s = readJSON('settings.json', { site: {} });
  if (!s.adminPasswordHash) {
    s.adminPasswordHash = hash(DEFAULT_PASSWORD);
    writeJSON('settings.json', s);
  }
  return s;
}

/* ---------------- API pública ---------------- */
app.get('/api/health', (req, res) =>
  res.json({ ok: true, name: 'Kianda', time: new Date().toISOString() })
);

app.get('/api/products', (req, res) => res.json(readJSON('products.json', { products: [] })));

app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({ site: s.site || {} });
});

/* Pedido de cliente (formulário do site) */
app.post('/api/orders', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.phone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
  const items = Array.isArray(b.items)
    ? b.items
        .map((i) => ({
          name: String(i.name || ''),
          price: Number(i.price) || 0,
          qty: Math.max(1, Number(i.qty) || 1),
        }))
        .filter((i) => i.name)
    : [];
  if (!items.length) return res.status(400).json({ error: 'O pedido não tem produtos.' });

  const db = readJSON('orders.json', { orders: [] });
  const order = {
    id: 'KD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    name: String(b.name).slice(0, 120),
    phone: String(b.phone).slice(0, 40),
    address: String(b.address || '').slice(0, 240),
    payment: String(b.payment || 'WhatsApp').slice(0, 60),
    notes: String(b.notes || '').slice(0, 300),
    items,
    total: items.reduce((t, i) => t + i.price * i.qty, 0),
    status: 'Nova',
    createdAt: new Date().toISOString(),
  };
  db.orders.unshift(order);
  writeJSON('orders.json', db);
  res.json({ ok: true, order });
});

/* ---------------- API admin ---------------- */
function isAuthed(req) {
  const s = getSettings();
  const t = req.headers['x-admin-token'];
  return !!t && t === s.adminPasswordHash;
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Sessão expirada. Inicia sessão novamente.' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const s = getSettings();
  const pw = String((req.body || {}).password || '');
  if (hash(pw) === s.adminPasswordHash) return res.json({ token: s.adminPasswordHash });
  res.status(401).json({ error: 'Senha incorreta.' });
});

app.post('/api/admin/password', requireAuth, (req, res) => {
  const pw = String((req.body || {}).password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  const s = getSettings();
  s.adminPasswordHash = hash(pw);
  writeJSON('settings.json', s);
  res.json({ ok: true, token: s.adminPasswordHash });
});

/* ---- Produtos (CRUD completo + reordenar) ---- */
app.post('/api/admin/products', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.image) return res.status(400).json({ error: 'Nome e imagem são obrigatórios.' });
  const db = readJSON('products.json', { products: [] });
  const product = {
    id: uid(),
    name: String(b.name).slice(0, 120),
    category: String(b.category || 'Bolsas').slice(0, 60),
    price: Math.max(0, Number(b.price) || 0),
    oldPrice: b.oldPrice ? Math.max(0, Number(b.oldPrice) || 0) : null,
    description: String(b.description || '').slice(0, 2000),
    image: String(b.image),
    gallery: Array.isArray(b.gallery) ? b.gallery.map(String).filter(Boolean) : [],
    featured: !!b.featured,
    stock: b.stock !== false,
    badge: String(b.badge || '').slice(0, 40),
    createdAt: new Date().toISOString(),
  };
  db.products.unshift(product);
  writeJSON('products.json', db);
  res.json({ ok: true, product });
});

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const db = readJSON('products.json', { products: [] });
  const p = db.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const b = req.body || {};
  if (b.name !== undefined) p.name = String(b.name).slice(0, 120);
  if (b.category !== undefined) p.category = String(b.category || 'Bolsas').slice(0, 60);
  if (b.price !== undefined) p.price = Math.max(0, Number(b.price) || 0);
  if (b.oldPrice !== undefined) p.oldPrice = b.oldPrice ? Math.max(0, Number(b.oldPrice) || 0) : null;
  if (b.description !== undefined) p.description = String(b.description || '').slice(0, 2000);
  if (b.image !== undefined) p.image = String(b.image);
  if (b.gallery !== undefined) p.gallery = Array.isArray(b.gallery) ? b.gallery.map(String).filter(Boolean) : [];
  if (b.featured !== undefined) p.featured = !!b.featured;
  if (b.stock !== undefined) p.stock = b.stock !== false;
  if (b.badge !== undefined) p.badge = String(b.badge || '').slice(0, 40);
  writeJSON('products.json', db);
  res.json({ ok: true, product: p });
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  const db = readJSON('products.json', { products: [] });
  db.products = db.products.filter((x) => x.id !== req.params.id);
  writeJSON('products.json', db);
  res.json({ ok: true });
});

app.post('/api/admin/products/:id/move', requireAuth, (req, res) => {
  const db = readJSON('products.json', { products: [] });
  const idx = db.products.findIndex((x) => x.id === req.params.id);
  const dir = Number((req.body || {}).dir) === -1 ? -1 : 1;
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= db.products.length) return res.json({ ok: true });
  [db.products[idx], db.products[to]] = [db.products[to], db.products[idx]];
  writeJSON('products.json', db);
  res.json({ ok: true });
});

/* ---- Upload de fotos (fica gravado em public/img/products/) ---- */
app.post('/api/admin/upload', requireAuth, (req, res) => {
  const dataUrl = String((req.body || {}).dataUrl || '');
  const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Imagem inválida. Usa PNG, JPG ou WEBP.' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  fs.mkdirSync(PRODUCTS_IMG, { recursive: true });
  fs.writeFileSync(path.join(PRODUCTS_IMG, name), Buffer.from(m[2], 'base64'));
  res.json({ ok: true, url: '/img/products/' + name });
});

/* ---- Pedidos (admin) ---- */
app.get('/api/orders', requireAuth, (req, res) => res.json(readJSON('orders.json', { orders: [] })));

app.put('/api/admin/orders/:id/status', requireAuth, (req, res) => {
  const db = readJSON('orders.json', { orders: [] });
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado.' });
  o.status = String((req.body || {}).status || 'Nova').slice(0, 40);
  writeJSON('orders.json', db);
  res.json({ ok: true, order: o });
});

app.delete('/api/admin/orders/:id', requireAuth, (req, res) => {
  const db = readJSON('orders.json', { orders: [] });
  db.orders = db.orders.filter((x) => x.id !== req.params.id);
  writeJSON('orders.json', db);
  res.json({ ok: true });
});

/* ---- Backup & Restauro (nunca perdes os dados!) ---- */
app.get('/api/admin/backup', requireAuth, (req, res) => {
  const bundle = {
    app: 'kianda',
    date: new Date().toISOString(),
    products: readJSON('products.json', { products: [] }),
    orders: readJSON('orders.json', { orders: [] }),
    settings: readJSON('settings.json', {}),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="kianda-backup.json"');
  res.json(bundle);
});

app.post('/api/admin/restore', requireAuth, (req, res) => {
  const b = (req.body || {}).backup;
  if (!b || typeof b !== 'object' || b.app !== 'kianda')
    return res.status(400).json({ error: 'Ficheiro de backup inválido.' });
  const restored = [];
  if (Array.isArray(b.products && b.products.products)) {
    writeJSON('products.json', b.products);
    restored.push('produtos');
  }
  if (Array.isArray(b.orders && b.orders.orders)) {
    writeJSON('orders.json', b.orders);
    restored.push('pedidos');
  }
  if (b.settings && typeof b.settings === 'object') {
    writeJSON('settings.json', b.settings);
    restored.push('definições');
  }
  res.json({ ok: true, restored });
});

/* ---- Definições do site (hero, WhatsApp, redes sociais...) ---- */
app.put('/api/admin/settings', requireAuth, (req, res) => {
  const s = getSettings();
  s.site = { ...(s.site || {}), ...(req.body || {}) };
  writeJSON('settings.json', s);
  res.json({ ok: true, site: s.site });
});

/* ---------------- arranque ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('✨ KIANDA a correr em http://0.0.0.0:' + PORT);
  console.log('   Loja:    /');
  console.log('   Admin:   /admin.html  (senha padrão: ' + DEFAULT_PASSWORD + ')');
});
