# 📋 KIT KIANDA — copiar & colar no GitHub

> Como usar: GitHub → **Add file** → **Create new file** → no campo do NOME do ficheiro cola o caminho exato indicado → cola o CONTEÚDO → **Commit changes**.

> O GitHub cria as pastas sozinho quando o nome tem `/` (ex: `public/js/app.js`).

> São **12 ficheiros de texto** para colar + **41 fotos** para carregar (ver fim do documento).

---


## 📄 FICHEIRO 1/12 — `server.js`

**Onde:** na RAIZ (nome: server.js)

**Passos:** Add file → Create new file → cola `server.js` como nome → cola isto abaixo → Commit changes

````text
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
````

---


## 📄 FICHEIRO 2/12 — `package.json`

**Onde:** na RAIZ (nome: package.json)

**Passos:** Add file → Create new file → cola `package.json` como nome → cola isto abaixo → Commit changes

````text
{
  "name": "kianda",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "Kianda \u2014 loja online de bolsas femininas (Luanda, Angola)",
  "dependencies": {
    "express": "^5.2.1"
  },
  "engines": {
    "node": ">=18"
  }
}
````

---


## 📄 FICHEIRO 3/12 — `data/products.json`

**Onde:** em data/ (nome: data/products.json)

**Passos:** Add file → Create new file → cola `data/products.json` como nome → cola isto abaixo → Commit changes

````text
{
  "products": [
    {
      "id": "kd-01",
      "name": "Bolsa Kianda Vinho Clássica",
      "category": "Cores Vibrantes",
      "price": 26400,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha clássica. Esta bolsa em vinho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-01.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "NOVO",
      "createdAt": "2026-09-01T20:01:00.000Z"
    },
    {
      "id": "kd-02",
      "name": "Bolsa Kianda Rosa Urbana",
      "category": "Cores Vibrantes",
      "price": 27800,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha urbana. Esta bolsa em rosa junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-02.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "Tendência",
      "createdAt": "2026-09-01T20:02:00.000Z"
    },
    {
      "id": "kd-03",
      "name": "Bolsa Kianda Cinza Essencial",
      "category": "Tons Neutros",
      "price": 29100,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha essencial. Esta bolsa em cinza junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-03.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "Mais Vendida",
      "createdAt": "2026-09-01T20:03:00.000Z"
    },
    {
      "id": "kd-04",
      "name": "Bolsa Kianda Castanho Chic",
      "category": "Tons Quentes",
      "price": 30500,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha chic. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-04.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:04:00.000Z"
    },
    {
      "id": "kd-05",
      "name": "Bolsa Kianda Caramelo Glam",
      "category": "Tons Quentes",
      "price": 31900,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha glam. Esta bolsa em caramelo junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-05.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:05:00.000Z"
    },
    {
      "id": "kd-06",
      "name": "Bolsa Kianda Bege Trendy",
      "category": "Tons Neutros",
      "price": 33300,
      "oldPrice": 38300,
      "description": "Da coleção Kianda — linha trendy. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-06.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:06:00.000Z"
    },
    {
      "id": "kd-07",
      "name": "Bolsa Kianda Castanho Escuro Minimal",
      "category": "Tons Quentes",
      "price": 25200,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha minimal. Esta bolsa em castanho escuro junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-07.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:07:00.000Z"
    },
    {
      "id": "kd-08",
      "name": "Bolsa Kianda Caramelo Executiva",
      "category": "Tons Quentes",
      "price": 26500,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha executiva. Esta bolsa em caramelo junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-08.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:08:00.000Z"
    },
    {
      "id": "kd-09",
      "name": "Bolsa Kianda Castanho Dourado Breeze",
      "category": "Tons Quentes",
      "price": 27900,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha breeze. Esta bolsa em castanho dourado junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-09.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "NOVO",
      "createdAt": "2026-09-01T20:09:00.000Z"
    },
    {
      "id": "kd-10",
      "name": "Bolsa Kianda Castanho Elegance",
      "category": "Tons Quentes",
      "price": 29300,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha elegance. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-10.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "Mais Vendida",
      "createdAt": "2026-09-01T20:00:00.000Z"
    },
    {
      "id": "kd-11",
      "name": "Bolsa Kianda Castanho Claro Studio",
      "category": "Tons Quentes",
      "price": 30700,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha studio. Esta bolsa em castanho claro junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-11.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "Tendência",
      "createdAt": "2026-09-01T20:01:00.000Z"
    },
    {
      "id": "kd-12",
      "name": "Bolsa Kianda Vermelho Nativa",
      "category": "Cores Vibrantes",
      "price": 32000,
      "oldPrice": 37000,
      "description": "Da coleção Kianda — linha nativa. Esta bolsa em vermelho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-12.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:02:00.000Z"
    },
    {
      "id": "kd-13",
      "name": "Bolsa Kianda Vermelho Tijolo Clássica",
      "category": "Cores Vibrantes",
      "price": 33400,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha clássica. Esta bolsa em vermelho tijolo junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-13.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:03:00.000Z"
    },
    {
      "id": "kd-14",
      "name": "Bolsa Kianda Bordô Urbana",
      "category": "Cores Vibrantes",
      "price": 25300,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha urbana. Esta bolsa em bordô junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-14.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:04:00.000Z"
    },
    {
      "id": "kd-15",
      "name": "Bolsa Kianda Café Essencial",
      "category": "Tons Quentes",
      "price": 26700,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha essencial. Esta bolsa em café junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-15.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:05:00.000Z"
    },
    {
      "id": "kd-16",
      "name": "Bolsa Kianda Castanho Chic",
      "category": "Tons Quentes",
      "price": 28100,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha chic. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-16.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:06:00.000Z"
    },
    {
      "id": "kd-17",
      "name": "Bolsa Kianda Café Glam",
      "category": "Tons Quentes",
      "price": 29400,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha glam. Esta bolsa em café junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-17.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "NOVO",
      "createdAt": "2026-09-01T20:07:00.000Z"
    },
    {
      "id": "kd-18",
      "name": "Bolsa Kianda Terracota Trendy",
      "category": "Tons Quentes",
      "price": 30800,
      "oldPrice": 35800,
      "description": "Da coleção Kianda — linha trendy. Esta bolsa em terracota junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-18.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:08:00.000Z"
    },
    {
      "id": "kd-19",
      "name": "Bolsa Kianda Terracota Minimal",
      "category": "Tons Quentes",
      "price": 32200,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha minimal. Esta bolsa em terracota junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-19.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:09:00.000Z"
    },
    {
      "id": "kd-20",
      "name": "Bolsa Kianda Terracota Claro Executiva",
      "category": "Tons Quentes",
      "price": 33600,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha executiva. Esta bolsa em terracota claro junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-20.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "Tendência",
      "createdAt": "2026-09-01T20:00:00.000Z"
    },
    {
      "id": "kd-21",
      "name": "Bolsa Kianda Caramelo Breeze",
      "category": "Tons Quentes",
      "price": 25500,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha breeze. Esta bolsa em caramelo junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-21.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:01:00.000Z"
    },
    {
      "id": "kd-22",
      "name": "Bolsa Kianda Castanho Elegance",
      "category": "Tons Quentes",
      "price": 26800,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha elegance. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-22.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:02:00.000Z"
    },
    {
      "id": "kd-23",
      "name": "Bolsa Kianda Castanho Claro Studio",
      "category": "Tons Quentes",
      "price": 28200,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha studio. Esta bolsa em castanho claro junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-23.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:03:00.000Z"
    },
    {
      "id": "kd-24",
      "name": "Bolsa Kianda Cinza Quente Nativa",
      "category": "Tons Neutros",
      "price": 29600,
      "oldPrice": 34600,
      "description": "Da coleção Kianda — linha nativa. Esta bolsa em cinza quente junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-24.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "Mais Vendida",
      "createdAt": "2026-09-01T20:04:00.000Z"
    },
    {
      "id": "kd-25",
      "name": "Bolsa Kianda Bege Clássica",
      "category": "Tons Neutros",
      "price": 31000,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha clássica. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-25.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "NOVO",
      "createdAt": "2026-09-01T20:05:00.000Z"
    },
    {
      "id": "kd-26",
      "name": "Bolsa Kianda Bege Dourado Urbana",
      "category": "Tons Neutros",
      "price": 32400,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha urbana. Esta bolsa em bege dourado junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-26.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:06:00.000Z"
    },
    {
      "id": "kd-27",
      "name": "Bolsa Kianda Cinza Essencial",
      "category": "Tons Neutros",
      "price": 33700,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha essencial. Esta bolsa em cinza junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-27.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:07:00.000Z"
    },
    {
      "id": "kd-28",
      "name": "Bolsa Kianda Bege Chic",
      "category": "Tons Neutros",
      "price": 25600,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha chic. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-28.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:08:00.000Z"
    },
    {
      "id": "kd-29",
      "name": "Bolsa Kianda Cinza Glam",
      "category": "Tons Neutros",
      "price": 27000,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha glam. Esta bolsa em cinza junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-29.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "Tendência",
      "createdAt": "2026-09-01T20:09:00.000Z"
    },
    {
      "id": "kd-30",
      "name": "Bolsa Kianda Bege Trendy",
      "category": "Tons Neutros",
      "price": 28400,
      "oldPrice": 33400,
      "description": "Da coleção Kianda — linha trendy. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-30.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:00:00.000Z"
    },
    {
      "id": "kd-31",
      "name": "Bolsa Kianda Bege Minimal",
      "category": "Tons Neutros",
      "price": 29700,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha minimal. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-31.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "Mais Vendida",
      "createdAt": "2026-09-01T20:01:00.000Z"
    },
    {
      "id": "kd-32",
      "name": "Bolsa Kianda Bege Executiva",
      "category": "Tons Neutros",
      "price": 31100,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha executiva. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-32.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:02:00.000Z"
    },
    {
      "id": "kd-33",
      "name": "Bolsa Kianda Creme Breeze",
      "category": "Tons Neutros",
      "price": 32500,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha breeze. Esta bolsa em creme junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-33.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "NOVO",
      "createdAt": "2026-09-01T20:03:00.000Z"
    },
    {
      "id": "kd-34",
      "name": "Bolsa Kianda Bege Elegance",
      "category": "Tons Neutros",
      "price": 33900,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha elegance. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-34.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:04:00.000Z"
    },
    {
      "id": "kd-35",
      "name": "Bolsa Kianda Creme Studio",
      "category": "Tons Neutros",
      "price": 25800,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha studio. Esta bolsa em creme junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-35.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:05:00.000Z"
    },
    {
      "id": "kd-36",
      "name": "Bolsa Kianda Bege Nativa",
      "category": "Tons Neutros",
      "price": 27100,
      "oldPrice": 32100,
      "description": "Da coleção Kianda — linha nativa. Esta bolsa em bege junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-36.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:06:00.000Z"
    },
    {
      "id": "kd-37",
      "name": "Bolsa Kianda Creme Clássica",
      "category": "Tons Neutros",
      "price": 28500,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha clássica. Esta bolsa em creme junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-37.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:07:00.000Z"
    },
    {
      "id": "kd-38",
      "name": "Bolsa Kianda Castanho Urbana",
      "category": "Tons Quentes",
      "price": 29900,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha urbana. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-38.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "Tendência",
      "createdAt": "2026-09-01T20:08:00.000Z"
    },
    {
      "id": "kd-39",
      "name": "Bolsa Kianda Castanho Essencial",
      "category": "Tons Quentes",
      "price": 31300,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha essencial. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-39.jpg",
      "gallery": [],
      "featured": false,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:09:00.000Z"
    },
    {
      "id": "kd-40",
      "name": "Bolsa Kianda Castanho Chic",
      "category": "Tons Quentes",
      "price": 32700,
      "oldPrice": null,
      "description": "Da coleção Kianda — linha chic. Esta bolsa em castanho junta elegância, qualidade premium e espaço inteligente para o teu dia a dia em Luanda. Ferragens douradas, acabamento impecável e um design que combina com tudo: do trabalho ao fim de semana. Entrega 24–48h em Luanda.",
      "image": "/img/products/kd-40.jpg",
      "gallery": [],
      "featured": true,
      "stock": true,
      "badge": "",
      "createdAt": "2026-09-01T20:00:00.000Z"
    }
  ]
}
````

---


## 📄 FICHEIRO 4/12 — `data/settings.json`

**Onde:** em data/ (nome: data/settings.json)

**Passos:** Add file → Create new file → cola `data/settings.json` como nome → cola isto abaixo → Commit changes

````text
{
  "adminPasswordHash": "f4acbdabcfbf7d5b2c70c0660e96dbc2dab69a29d9c226ed1b3d10c361543981",
  "site": {
    "brand": "Kianda",
    "tagline": "Bolsas com alma de Luanda",
    "announcement": "✨ Entrega grátis em Luanda em compras acima de 40.000 Kz • Pagamento na entrega disponível",
    "heroTitle": "Bolsas com alma de Luanda",
    "heroSubtitle": "A Kianda nasceu da lenda angolana da deusa das águas. Cada bolsa é desenhada para a jovem angolana que carrega o mundo — com estilo.",
    "whatsapp": "244930706741",
    "email": "ola@kianda.co.ao",
    "instagram": "kianda.bolsas",
    "tiktok": "kiandabags",
    "facebook": "kiandabags.ao",
    "deliveryInfo": "Entrega em Luanda em 24–48h. Envios para todo o país via transportadora expressa.",
    "freeShippingFrom": 40000,
    "paymentInfo": "Multicaixa Express, transferência bancária ou pagamento na entrega (Luanda)."
  }
}
````

---


## 📄 FICHEIRO 5/12 — `data/orders.json`

**Onde:** em data/ (nome: data/orders.json)

**Passos:** Add file → Create new file → cola `data/orders.json` como nome → cola isto abaixo → Commit changes

````text
{
  "orders": []
}
````

---


## 📄 FICHEIRO 6/12 — `public/index.html`

**Onde:** em public/ (nome: public/index.html)

**Passos:** Add file → Create new file → cola `public/index.html` como nome → cola isto abaixo → Commit changes

````text
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kianda • Bolsas Femininas em Luanda</title>
<meta name="description" content="Kianda — bolsas femininas com alma de Luanda. Entrega rápida em Luanda, pagamento na entrega, Multicaixa Express. Bolsas elegantes para a jovem angolana.">
<meta property="og:title" content="Kianda • Bolsas com alma de Luanda">
<meta property="og:description" content="Bolsas femininas elegantes, feitas para a jovem angolana. Entrega em Luanda 24–48h.">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='22' fill='%23B4552D'/%3E%3Cpath d='M10 25c4-6 8-6 12 0s8 6 12 0' stroke='%23FBF6EF' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>

<!-- barra de anúncio -->
<div class="topbar" id="topbar">
  <div class="topbar-track" id="topbar-text">✨ Entrega grátis em Luanda em compras acima de 40.000 Kz • Pagamento na entrega disponível</div>
</div>

<!-- cabeçalho -->
<header class="site-header" id="site-header">
  <div class="container header-inner">
    <a class="logo" href="#inicio" aria-label="Kianda — início">
      <svg class="logo-mark" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#C9A227"/><stop offset="1" stop-color="#B4552D"/>
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#lg)"/>
        <path d="M10 25c4-6 8-6 12 0s8 6 12 0" stroke="#FBF6EF" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <path d="M10 33c4-6 8-6 12 0s8 6 12 0" stroke="#FBF6EF" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".6"/>
      </svg>
      <span class="logo-text">KIANDA<em>bolsas · luanda</em></span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="Navegação principal">
      <a href="#inicio">Início</a>
      <a href="#coleccao">Colecção</a>
      <a href="#lenda">A Lenda</a>
      <a href="#depoimentos">Depoimentos</a>
      <a href="#contactos">Contactos</a>
      <a class="nav-cta" id="nav-wa" href="#" target="_blank" rel="noopener">Encomendar ✨</a>
    </nav>
    <button class="burger" id="burger" aria-label="Abrir menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<main>
  <!-- HERO -->
  <section class="hero" id="inicio">
    <div class="container hero-inner">
      <div class="hero-copy">
        <p class="eyebrow reveal">✦ Feito em Luanda · Para mulheres que brilham</p>
        <h1 class="reveal" id="hero-title">Bolsas com <em>alma</em> de Luanda</h1>
        <p class="hero-sub reveal" id="hero-subtitle">A Kianda nasceu da lenda angolana da deusa das águas. Cada bolsa é desenhada para a jovem angolana que carrega o mundo — com estilo.</p>
        <div class="hero-actions reveal">
          <a class="btn btn-primary" href="#coleccao">Ver Colecção</a>
          <a class="btn btn-ghost" id="hero-wa" href="#" target="_blank" rel="noopener">Falar no WhatsApp</a>
        </div>
        <ul class="hero-proof reveal">
          <li><strong>+300</strong> clientes felizes</li>
          <li><strong>24–48h</strong> entrega em Luanda</li>
          <li><strong>7 dias</strong> para trocas</li>
        </ul>
      </div>
      <div class="hero-media reveal">
        <div class="hero-frame">
          <img src="/img/hero.jpg" alt="Jovem angolana elegante com bolsa Kianda" width="720" height="900">
          <div class="hero-badge">
            <span class="hb-icon">🌊</span>
            <span><strong>A proteção da Kianda</strong><br>está em cada bolsa</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- faixa de vantagens -->
  <div class="usps" aria-label="Vantagens">
    <div class="container usps-inner">
      <div class="usp"><span>🚚</span><div><strong>Entrega em Luanda</strong><small>24–48h, grátis acima de 40.000 Kz</small></div></div>
      <div class="usp"><span>💳</span><div><strong>Pagamento fácil</strong><small>Multicaixa Express, transferência ou na entrega</small></div></div>
      <div class="usp"><span>🔄</span><div><strong>Troca em 7 dias</strong><small>Sem stresses, garantia de amor</small></div></div>
      <div class="usp"><span>🇦🇴</span><div><strong>Feito p/ Angola</strong><small>Desenhado para o ritmo de Luanda</small></div></div>
    </div>
  </div>

  <!-- COLEÇÃO -->
  <section class="collection" id="coleccao">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">✦ A Colecção</p>
        <h2>Escolhe a tua <em>Kianda</em></h2>
        <p>Cada modelo tem uma história. Encontra a bolsa que combina com o teu dia — e com as tuas noites.</p>
      </div>
      <div class="filters reveal" id="filters" role="tablist" aria-label="Filtrar por categoria"></div>
      <div class="grid" id="product-grid"></div>
      <p class="grid-empty hidden" id="grid-empty">Não encontrámos bolsas nesta categoria. 😔 Fala connosco no WhatsApp — temos novidades todas as semanas!</p>
    </div>
  </section>

  <!-- A LENDA -->
  <section class="legend" id="lenda">
    <svg class="wave-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,45 C240,90 480,0 720,45 C960,90 1200,0 1440,45 L1440,90 L0,90 Z" fill="#2F4A3C"/></svg>
    <div class="container legend-inner">
      <div class="legend-media reveal">
        <div class="legend-frame">
          <img src="/img/products/kd-01.jpg" alt="Bolsa Kianda Signature" loading="lazy">
        </div>
        <div class="legend-ornament" aria-hidden="true">🌊</div>
      </div>
      <div class="legend-copy reveal">
        <p class="eyebrow light">✦ A nossa história</p>
        <h2>A lenda da <em>Kianda</em></h2>
        <p class="legend-verse">"Nas águas do nosso Atlântico, a Kianda — a deusa que protege os pescadores — guarda as histórias de quem navega."</p>
        <p>A Kianda é a protectora das águas na nossa cultura angolana. Inspiradas nela, criámos bolsas para mulheres que navegam a cidade todos os dias: que atravessam o congestionamento do Talatona, que brilham nas festas do Mussulo, que constroem o futuro do nosso país.</p>
        <p>Como a deusa que guarda quem está no mar, cada bolsa Kianda guarda o que é essencial para ti.</p>
        <div class="legend-points">
          <div><span>1</span><p><strong>Design angolano</strong><br>Pensado cá, para nós</p></div>
          <div><span>2</span><p><strong>Qualidade premium</strong><br>Que dura anos</p></div>
          <div><span>3</span><p><strong>Preço justo</strong><br>Sem intermediários</p></div>
        </div>
      </div>
    </div>
  </section>

  <!-- DEPOIMENTOS -->
  <section class="testimonials" id="depoimentos">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">✦ Elas amam</p>
        <h2>O que dizem as nossas <em>kiandas</em></h2>
      </div>
      <div class="t-grid">
        <article class="t-card reveal">
          <div class="t-stars">★★★★★</div>
          <p>"A Bolsa Signature é ainda mais bonita ao vivo. Chegou em menos de 24h ao Talatona e toda a gente pergunta onde comprei!"</p>
          <footer><span class="avatar" style="--a:#B4552D">AM</span><div><strong>Amélia M.</strong><small>Talatona · Luanda</small></div></footer>
        </article>
        <article class="t-card reveal">
          <div class="t-stars">★★★★★</div>
          <p>"Comprei a Tote Luanda para levar o portátil para o trabalho. Elegante e espaçosa — recebi logo elogios na reunião."</p>
          <footer><span class="avatar" style="--a:#2F4A3C">NF</span><div><strong>Nádia F.</strong><small>Maianga · Luanda</small></div></footer>
        </article>
        <article class="t-card reveal">
          <div class="t-stars">★★★★★</div>
          <p>"O atendimento no WhatsApp é 5 estrelas! A Clutch Kixi chegou a tempo do aniversário da minha mana. Ela chorou de alegria."</p>
          <footer><span class="avatar" style="--a:#C9A227">CD</span><div><strong>Cristina D.</strong><small>Kilamba · Luanda</small></div></footer>
        </article>
      </div>
    </div>
  </section>

  <!-- INSTAGRAM -->
  <section class="insta" id="instagram">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">✦ @<span id="insta-handle">kianda.bolsas</span></p>
        <h2>Seguem-nos no <em>Instagram</em></h2>
        <p>Bastidores, novidades e inspiração todos os dias.</p>
      </div>
      <div class="insta-grid reveal">
        <a href="#" id="insta-link-1" target="_blank" rel="noopener"><img src="/img/products/kd-05.jpg" alt="Bolsa Kianda" loading="lazy"></a>
        <a href="#" id="insta-link-2" target="_blank" rel="noopener"><img src="/img/products/kd-12.jpg" alt="Bolsa Kianda" loading="lazy"></a>
        <a href="#" id="insta-link-3" target="_blank" rel="noopener"><img src="/img/products/kd-18.jpg" alt="Bolsa Kianda" loading="lazy"></a>
        <a href="#" id="insta-link-4" target="_blank" rel="noopener"><img src="/img/products/kd-33.jpg" alt="Bolsa Kianda" loading="lazy"></a>
      </div>
      <div class="insta-cta reveal">
        <a class="btn btn-primary" id="insta-follow" href="#" target="_blank" rel="noopener">Seguir @<span>kianda.bolsas</span></a>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="faq" id="faq">
    <div class="container faq-inner">
      <div class="section-head reveal">
        <p class="eyebrow">✦ Dúvidas</p>
        <h2>Perguntas <em>frequentes</em></h2>
      </div>
      <div class="faq-list reveal">
        <details>
          <summary>Como funciona a entrega? <span class="faq-icon">+</span></summary>
          <p id="faq-delivery">Entregamos em Luanda em 24–48h. A entrega é grátis para compras acima de 40.000 Kz; abaixo disso, o valor é combinado no WhatsApp conforme a zona.</p>
        </details>
        <details>
          <summary>Que formas de pagamento aceitam?</summary>
          <p id="faq-payment">Aceitamos Multicaixa Express, transferência bancária e pagamento na entrega (em Luanda). O pagamento é combinado directamente com a nossa equipa.</p>
        </details>
        <details>
          <summary>Posso trocar ou devolver?</summary>
          <p>Tens 7 dias para trocar qualquer bolsa, desde que esteja em perfeito estado com a etiqueta original. Escreve-nos no WhatsApp e tratamos de tudo.</p>
        </details>
        <details>
          <summary>Enviam para outras províncias?</summary>
          <p>Sim! Enviamos para todo o país (Benguela, Huambo, Cabinda, Huíla…) através de transportadora expressa. O prazo varia entre 3 a 7 dias úteis.</p>
        </details>
        <details>
          <summary>Como posso saber o meu tamanho ideal de bolsa?</summary>
          <p>Manda-nos mensagem no WhatsApp com o que costumas levar (portátil, caderno, essenciais…) e ajudamos-te a escolher o modelo perfeito para a tua rotina.</p>
        </details>
      </div>
    </div>
  </section>

  <!-- NEWSLETTER -->
  <section class="newsletter" id="newsletter">
    <div class="container newsletter-box reveal">
      <h2>Entra para a <em>família Kianda</em> 🌊</h2>
      <p>Recebe novidades, lançamentos e descontos secretos antes de toda a gente. Sem spam — prometido.</p>
      <form class="newsletter-form" id="newsletter-form">
        <input type="email" id="newsletter-email" placeholder="O teu e-mail" required>
        <button class="btn btn-primary" type="submit">Quero novidades</button>
      </form>
    </div>
  </section>
</main>

<!-- RODAPÉ -->
<footer class="site-footer" id="contactos">
  <div class="container footer-grid">
    <div class="f-brand">
      <a class="logo" href="#inicio">
        <svg class="logo-mark" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="#C9A227"/>
          <path d="M10 25c4-6 8-6 12 0s8 6 12 0" stroke="#FBF6EF" stroke-width="2.8" fill="none" stroke-linecap="round"/>
          <path d="M10 33c4-6 8-6 12 0s8 6 12 0" stroke="#FBF6EF" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".6"/>
        </svg>
        <span class="logo-text">KIANDA<em>bolsas · luanda</em></span>
      </a>
      <p>Bolsas femininas com alma de Luanda. Inspiradas na lenda da Kianda, a deusa das águas que protege quem navega.</p>
      <div class="f-social">
        <a id="soc-ig" href="#" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
        <a id="soc-tt" href="#" target="_blank" rel="noopener" aria-label="TikTok">TK</a>
        <a id="soc-fb" href="#" target="_blank" rel="noopener" aria-label="Facebook">FB</a>
        <a id="soc-wa" href="#" target="_blank" rel="noopener" aria-label="WhatsApp">WA</a>
      </div>
    </div>
    <div class="f-col">
      <h4>Loja</h4>
      <a href="#coleccao">Colecção</a>
      <a href="#lenda">A nossa história</a>
      <a href="#depoimentos">Depoimentos</a>
      <a href="#faq">Perguntas frequentes</a>
    </div>
    <div class="f-col">
      <h4>Ajuda</h4>
      <a href="#faq">Entregas & pagamentos</a>
      <a href="#faq">Trocas e devoluções</a>
      <a href="#newsletter">Newsletter</a>
      <a href="/admin.html" rel="nofollow">Área reservada</a>
    </div>
    <div class="f-col">
      <h4>Contactos</h4>
      <a id="foot-wa" href="#" target="_blank" rel="noopener">WhatsApp: <span id="foot-wa-num">+244 923 000 000</span></a>
      <a id="foot-mail" href="#">Email: <span id="foot-mail-addr">ola@kianda.co.ao</span></a>
      <p class="f-addr">Luanda · Angola<br>Seg–Sáb, 9h–19h</p>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>© <span id="foot-year">2026</span> Kianda Bolsas. Feito com 💛 em Luanda. Todos os direitos reservados.</p>
    <p class="footer-admin">Gestão da loja: <a href="/admin.html" rel="nofollow">Painel Admin</a></p>
  </div>
</footer>

<!-- botão flutuante WhatsApp -->
<a class="wa-float" id="wa-float" href="#" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">
  <svg viewBox="0 0 32 32" width="26" height="26" fill="#fff" aria-hidden="true"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.6.8 5 2.3 7L4.6 27l5.2-1.7c1.9 1 4 1.6 6.2 1.6 6.6 0 12-5.4 12-12S22.6 3 16 3zm5.7 16.9c-.3.8-1.5 1.4-2.1 1.5-.6.1-1.1.3-3.7-.8-3.2-1.3-5.2-4.6-5.4-4.8-.1-.2-1.3-1.7-1.3-3.3s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5.2.6.8 2 .9 2.1.1.2.1.3 0 .5-.2.3-.3.5-.5.7l-.5.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.1 1.4 2.4 1.6.3.2.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2.1 1c.3.2.5.3.6.4 0 .1 0 .8-.2 1.5z"/></svg>
</a>

<!-- modal do produto -->
<div class="modal" id="product-modal" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-card modal-product">
    <button class="modal-close" data-close aria-label="Fechar">✕</button>
    <div class="mp-media">
      <img id="mp-img" src="" alt="">
      <div class="mp-gallery hidden" id="mp-gallery"></div>
    </div>
    <div class="mp-body">
      <p class="mp-cat" id="mp-cat"></p>
      <h3 id="mp-name"></h3>
      <div class="mp-price">
        <strong id="mp-price"></strong>
        <s id="mp-old" class="hidden"></s>
        <span class="badge" id="mp-badge"></span>
      </div>
      <p class="mp-desc" id="mp-desc"></p>

      <div class="mp-order" id="mp-order">
        <div class="qty">
          <button id="qty-minus" aria-label="Diminuir">−</button>
          <span id="qty-val">1</span>
          <button id="qty-plus" aria-label="Aumentar">+</button>
        </div>
        <div class="mp-total"><small>Total</small><strong id="mp-total"></strong></div>
      </div>

      <button class="btn btn-primary btn-block" id="mp-wa">Encomendar no WhatsApp</button>
      <button class="btn btn-ghost btn-block" id="mp-form">Fazer pedido pelo site</button>

      <div class="mp-form hidden" id="mp-form-wrap">
        <p class="mp-form-title">Faz o teu pedido 💛</p>
        <form id="order-form">
          <input type="text" id="of-name" placeholder="O teu nome" required>
          <input type="tel" id="of-phone" placeholder="Telemóvel (ex: 923 456 789)" required>
          <input type="text" id="of-address" placeholder="Bairro / zona de entrega (ex: Talatona, Condomínio X)">
          <select id="of-payment">
            <option value="Multicaixa Express">Multicaixa Express</option>
            <option value="Transferência bancária">Transferência bancária</option>
            <option value="Pagamento na entrega">Pagamento na entrega</option>
          </select>
          <textarea id="of-notes" rows="2" placeholder="Alguma observação? (opcional)"></textarea>
          <button class="btn btn-primary btn-block" type="submit" id="of-submit">Confirmar pedido</button>
        </form>
        <p class="mp-form-note" id="of-note"></p>
      </div>

      <div class="mp-success hidden" id="mp-success">
        <div class="mp-success-icon">💌</div>
        <h4>Pedido recebido!</h4>
        <p>O teu número de pedido é <strong id="mp-order-id"></strong>.</p>
        <p>Vamos confirmar num instante. Se preferires, confirma já pelo WhatsApp:</p>
        <button class="btn btn-primary btn-block" id="mp-success-wa">Confirmar no WhatsApp</button>
      </div>

      <p class="mp-info" id="mp-info">🚚 Entrega em Luanda 24–48h · 💳 Multicaixa Express · Pagamento na entrega</p>
    </div>
  </div>
</div>

<!-- toast -->
<div class="toast" id="toast" role="status"></div>

<script src="/js/app.js"></script>
</body>
</html>
````

---


## 📄 FICHEIRO 7/12 — `public/admin.html`

**Onde:** em public/ (nome: public/admin.html)

**Passos:** Add file → Create new file → cola `public/admin.html` como nome → cola isto abaixo → Commit changes

````text
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel Admin • Kianda</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='22' fill='%232E211A'/%3E%3Cpath d='M10 25c4-6 8-6 12 0s8 6 12 0' stroke='%23C9A227' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/admin.css">
</head>
<body>

<!-- ====== LOGIN ====== -->
<div class="login" id="login-view">
  <form class="login-card" id="login-form">
    <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#C9A227"/>
      <path d="M10 25c4-6 8-6 12 0s8 6 12 0" stroke="#FBF6EF" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M10 33c4-6 8-6 12 0s8 6 12 0" stroke="#FBF6EF" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".6"/>
    </svg>
    <h1>KIANDA <em>Admin</em></h1>
    <p>Área reservada à gestão da loja</p>
    <input type="password" id="login-pass" placeholder="Senha de administrador" autocomplete="current-password" required>
    <button class="btn" type="submit">Entrar</button>
    <p class="login-err" id="login-err"></p>
    <a class="login-back" href="/">← Voltar à loja</a>
  </form>
</div>

<!-- ====== PAINEL ====== -->
<div class="admin hidden" id="admin-view">
  <aside class="sidebar">
    <div class="sb-brand">
      <span class="sb-dot"></span>
      <div><strong>KIANDA</strong><small>Painel Admin</small></div>
    </div>
    <nav class="sb-nav">
      <button class="active" data-tab="dashboard">📊 Visão Geral</button>
      <button data-tab="products">👜 Produtos</button>
      <button data-tab="orders">📦 Pedidos <span class="pill" id="orders-pill">0</span></button>
      <button data-tab="settings">⚙️ Definições</button>
    </nav>
    <div class="sb-foot">
      <a href="/" target="_blank">🌐 Ver loja</a>
      <button id="logout">Sair</button>
    </div>
  </aside>

  <main class="content">
    <!-- DASHBOARD -->
    <section class="tab active" id="tab-dashboard">
      <h2>Visão Geral</h2>
      <p class="muted">O estado da tua loja Kianda. Todas as alterações ficam gravadas permanentemente no site.</p>
      <div class="stats">
        <div class="stat"><span class="stat-icon">👜</span><div><strong id="st-products">0</strong><small>Produtos no catálogo</small></div></div>
        <div class="stat"><span class="stat-icon">⚡</span><div><strong id="st-stock">0</strong><small>Em stock</small></div></div>
        <div class="stat"><span class="stat-icon">🔥</span><div><strong id="st-featured">0</strong><small>Em destaque</small></div></div>
        <div class="stat"><span class="stat-icon">📦</span><div><strong id="st-orders">0</strong><small>Pedidos recebidos</small></div></div>
      </div>
      <div class="panel">
        <h3>⚡ Acções rápidas</h3>
        <div class="quick-actions">
          <button class="btn" data-go="products" data-action="new">+ Adicionar produto</button>
          <button class="btn ghost" data-go="orders">Ver pedidos</button>
          <button class="btn ghost" data-go="settings">Editar contactos</button>
          <a class="btn ghost" href="/" target="_blank">Visitar loja</a>
        </div>
        <div class="hint-box">💡 <strong>Dica:</strong> quando marcares um produto como <em>esgotado</em>, ele continua visível na loja com a etiqueta “ESGOTADO” — assim as clientes pedem para serem avisadas quando voltar.</div>
      </div>
    </section>

    <!-- PRODUTOS -->
    <section class="tab" id="tab-products">
      <div class="tab-head">
        <div>
          <h2>Produtos</h2>
          <p class="muted">Adiciona, edita, marca como esgotado, muda preços e fotos. As alterações são permanentes.</p>
        </div>
        <button class="btn" id="btn-new-product">+ Novo produto</button>
      </div>
      <div class="panel">
        <div class="prod-list" id="prod-list"></div>
      </div>
    </section>

    <!-- PEDIDOS -->
    <section class="tab" id="tab-orders">
      <h2>Pedidos</h2>
      <p class="muted">Pedidos feitos através do formulário do site. Cada pedido tem o telefone da cliente para confirmares no WhatsApp.</p>
      <div class="panel" id="orders-list"></div>
    </section>

    <!-- DEFINIÇÕES -->
    <section class="tab" id="tab-settings">
      <h2>Definições do site</h2>
      <p class="muted">Altera textos, contactos e redes sociais. Tudo o que mudares aqui aparece automaticamente na loja.</p>
      <div class="panel">
        <form id="settings-form" class="form-grid">
          <label>Nome da marca <input name="brand" type="text"></label>
          <label>Frase curta <input name="tagline" type="text"></label>
          <label>WhatsApp (com indicativo, ex: 244923000000) <input name="whatsapp" type="text"></label>
          <label>E-mail <input name="email" type="email"></label>
          <label>Instagram (sem @) <input name="instagram" type="text"></label>
          <label>TikTok (sem @) <input name="tiktok" type="text"></label>
          <label>Facebook <input name="facebook" type="text"></label>
          <label>Entrega grátis a partir de (Kz) <input name="freeShippingFrom" type="number"></label>
          <label class="full">Frase da barra superior (anúncio) <input name="announcement" type="text"></label>
          <label class="full">Título do hero <input name="heroTitle" type="text"></label>
          <label class="full">Subtítulo do hero <textarea name="heroSubtitle" rows="2"></textarea></label>
          <label class="full">Informação de entrega <textarea name="deliveryInfo" rows="2"></textarea></label>
          <label class="full">Formas de pagamento <textarea name="paymentInfo" rows="2"></textarea></label>
          <div class="full"><button class="btn" type="submit">Guardar definições</button> <span class="save-note" id="settings-note"></span></div>
        </form>
      </div>
      <div class="panel">
        <h3>🔑 Segurança</h3>
        <form id="pass-form" class="inline-form">
          <input type="password" id="new-pass" placeholder="Nova senha (mín. 6 caracteres)" required>
          <button class="btn ghost" type="submit">Alterar senha</button>
        </form>
        <p class="muted small">A senha atual está no ficheiro <code>server.js</code> (linha ~25) — padrão <strong>kianda2026</strong>.</p>
      </div>
      <div class="panel">
        <h3>💾 Backup & restauro</h3>
        <p class="muted">Guarda uma cópia de tudo (produtos, preços, pedidos, definições) no teu telemóvel/computador. Se um dia o site for recriado, restaura tudo num clique.</p>
        <div class="quick-actions">
          <button class="btn" id="btn-backup">⬇️ Fazer backup agora</button>
          <label class="btn ghost" for="restore-file">⬆️ Restaurar backup</label>
          <input type="file" id="restore-file" accept=".json,application/json" hidden>
        </div>
        <p class="muted small" id="backup-note"></p>
      </div>
    </section>
  </main>
</div>

<!-- modal de produto -->
<div class="modal" id="pmodal" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-card pm-card">
    <button class="modal-close" data-close aria-label="Fechar">✕</button>
    <h3 id="pm-title">Novo produto</h3>
    <form id="product-form" class="form-grid">
      <input type="hidden" id="pf-id">
      <label class="full">Nome do produto *<input id="pf-name" type="text" required></label>
      <label>Categoria <input id="pf-category" type="text" placeholder="ex: Totes"></label>
      <label>Preço (Kz) *<input id="pf-price" type="number" min="0" required></label>
      <label>Preço antigo (p/ promoção) <input id="pf-old" type="number" min="0" placeholder="vazio = sem promoção"></label>
      <label class="full">Etiqueta <input id="pf-badge" type="text" placeholder="ex: NOVO, Mais Vendida, Tendência"></label>
      <label class="full">Descrição <textarea id="pf-desc" rows="3"></textarea></label>

      <div class="full">
        <p class="label">Foto principal</p>
        <div class="img-row">
          <img id="pf-img-preview" class="img-preview" alt="">
          <div class="img-actions">
            <label class="btn small ghost" for="pf-img-file">📁 Escolher ficheiro</label>
            <input type="file" id="pf-img-file" accept="image/*" hidden>
            <label class="btn small ghost" for="pf-img-url">🔗 Ou colar URL</label>
            <input type="text" id="pf-img-url" placeholder="https://... (URL da imagem)">
            <p class="muted small" id="pf-img-status"></p>
          </div>
        </div>
      </div>

      <label class="full">Fotos extra (galeria — um URL por linha, opcional) <textarea id="pf-gallery" rows="3" placeholder="https://...&#10;https://..."></textarea></label>

      <label class="check"><input type="checkbox" id="pf-featured"> Destaque na loja (aparece primeiro)</label>
      <label class="check"><input type="checkbox" id="pf-stock" checked> Em stock (desmarca para marcar como esgotado)</label>

      <div class="full pm-actions">
        <button class="btn" type="submit" id="pf-save">Guardar produto</button>
        <button class="btn ghost danger" type="button" id="pf-delete" hidden>Eliminar</button>
      </div>
    </form>
  </div>
</div>

<!-- toast -->
<div class="toast" id="toast" role="status"></div>

<script src="/js/admin.js"></script>
</body>
</html>
````

---


## 📄 FICHEIRO 8/12 — `public/css/style.css`

**Onde:** em public/css/ (nome: public/css/style.css)

**Passos:** Add file → Create new file → cola `public/css/style.css` como nome → cola isto abaixo → Commit changes

````text
/* ============================================================
   KIANDA — Design System
   Paleta: terracota, dourado, creme, verde profundo
   ============================================================ */
:root {
  --terracotta: #B4552D;
  --terracotta-dark: #93431F;
  --gold: #C9A227;
  --gold-soft: #E4C877;
  --cream: #FBF6EF;
  --cream-2: #F4ECDF;
  --ink: #2E211A;
  --ink-soft: #6E5A4E;
  --green: #2F4A3C;
  --white: #FFFFFF;
  --danger: #C0392B;
  --ok: #1E7B4F;
  --radius: 18px;
  --radius-sm: 12px;
  --shadow: 0 18px 50px rgba(46, 33, 26, .10);
  --shadow-sm: 0 6px 18px rgba(46, 33, 26, .08);
  --serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --sans: 'Jost', 'Segoe UI', Arial, sans-serif;
  --ease: cubic-bezier(.22, .61, .36, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 90px; }
body {
  font-family: var(--sans);
  background: var(--cream);
  color: var(--ink);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; }
input, select, textarea { font-family: inherit; font-size: 1rem; }
.container { width: min(1180px, 92%); margin-inline: auto; }
.hidden { display: none !important; }

h1, h2, h3 { font-family: var(--serif); font-weight: 600; line-height: 1.15; }
h2 { font-size: clamp(1.9rem, 3.6vw, 2.7rem); }
h2 em { font-style: italic; color: var(--terracotta); }
.eyebrow {
  font-size: .8rem; letter-spacing: .32em; text-transform: uppercase;
  color: var(--terracotta); font-weight: 500; margin-bottom: .8rem;
}
.eyebrow.light { color: var(--gold-soft); }

/* ---------- top bar ---------- */
.topbar {
  background: linear-gradient(90deg, var(--terracotta-dark), var(--terracotta));
  color: #FFF6EC; text-align: center;
  font-size: .86rem; padding: .45rem 1rem; overflow: hidden; white-space: nowrap;
}
.topbar-track { animation: marquee 26s linear infinite; }

/* ---------- header ---------- */
.site-header {
  position: sticky; top: 0; z-index: 60;
  background: rgba(251, 246, 239, .92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(180, 85, 45, .12);
  transition: box-shadow .3s;
}
.site-header.scrolled { box-shadow: 0 8px 30px rgba(46,33,26,.08); }
.header-inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-block: .8rem; }
.logo { display: flex; align-items: center; gap: .65rem; }
.logo-mark { flex: none; }
.logo-text { font-family: var(--serif); font-weight: 700; font-size: 1.35rem; letter-spacing: .14em; color: var(--ink); display: flex; flex-direction: column; line-height: 1.05; }
.logo-text em { font-family: var(--sans); font-style: normal; font-size: .62rem; letter-spacing: .42em; text-transform: uppercase; color: var(--terracotta); font-weight: 500; }
.site-nav { display: flex; align-items: center; gap: 1.6rem; }
.site-nav a { font-size: .95rem; font-weight: 500; color: var(--ink-soft); position: relative; padding-block: .3rem; transition: color .25s; }
.site-nav a::after { content: ''; position: absolute; left: 0; bottom: 0; width: 0; height: 2px; background: var(--terracotta); transition: width .3s var(--ease); }
.site-nav a:hover { color: var(--terracotta); }
.site-nav a:hover::after { width: 100%; }
.site-nav .nav-cta {
  background: var(--terracotta); color: #fff; padding: .55rem 1.2rem; border-radius: 999px; font-weight: 500;
}
.site-nav .nav-cta::after { display: none; }
.site-nav .nav-cta:hover { background: var(--terracotta-dark); color: #fff; transform: translateY(-1px); }
.burger { display: none; flex-direction: column; gap: 5px; background: none; border: 0; padding: 8px; }
.burger span { width: 24px; height: 2px; background: var(--ink); border-radius: 2px; transition: .3s; }
.burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.burger.open span:nth-child(2) { opacity: 0; }
.burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ---------- hero ---------- */
.hero { padding: clamp(2.5rem, 6vw, 5rem) 0 0; overflow: hidden; }
.hero-inner { display: grid; grid-template-columns: 1.05fr .95fr; gap: clamp(2rem, 5vw, 4.5rem); align-items: center; }
.hero h1 { font-size: clamp(2.6rem, 5.4vw, 4.2rem); margin-bottom: 1.1rem; }
.hero h1 em { font-style: italic; color: var(--terracotta); position: relative; white-space: nowrap; }
.hero h1 em::after { content: ''; position: absolute; left: 0; right: 0; bottom: .05em; height: .35em; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12' preserveAspectRatio='none'%3E%3Cpath d='M2 9 C 50 2, 150 2, 198 9' stroke='%23C9A227' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat bottom/100% 100%; }
.hero-sub { font-size: 1.12rem; color: var(--ink-soft); max-width: 34rem; margin-bottom: 1.8rem; }
.hero-actions { display: flex; gap: .9rem; flex-wrap: wrap; margin-bottom: 2rem; }
.hero-proof { list-style: none; display: flex; gap: 2.2rem; flex-wrap: wrap; border-top: 1px solid rgba(180,85,45,.18); padding-top: 1.4rem; }
.hero-proof strong { display: block; font-family: var(--serif); font-size: 1.35rem; color: var(--terracotta); }
.hero-proof li { font-size: .9rem; color: var(--ink-soft); }
.hero-media { position: relative; }
.hero-frame { position: relative; border-radius: 26px 26px 26px 26px; overflow: hidden; box-shadow: var(--shadow); }
.hero-frame img { width: 100%; height: clamp(380px, 52vw, 620px); object-fit: cover; }
.hero-frame::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(46,33,26,.25)); }
.hero-badge {
  position: absolute; left: 1.2rem; bottom: 1.2rem; z-index: 2;
  background: rgba(251,246,239,.94); backdrop-filter: blur(6px);
  border-radius: 14px; padding: .8rem 1.1rem; display: flex; gap: .7rem; align-items: center;
  box-shadow: var(--shadow-sm); animation: float 5s ease-in-out infinite;
}
.hero-badge .hb-icon { font-size: 1.6rem; }
.hero-badge strong { font-family: var(--serif); font-size: .95rem; }
.hero-badge small, .hero-badge span { font-size: .78rem; color: var(--ink-soft); }

/* ---------- botões ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  padding: .85rem 1.7rem; border-radius: 999px; font-weight: 600; font-size: .98rem;
  border: 2px solid transparent; transition: all .3s var(--ease); text-align: center;
}
.btn-primary { background: var(--terracotta); color: #fff; box-shadow: 0 10px 24px rgba(180,85,45,.32); }
.btn-primary:hover { background: var(--terracotta-dark); transform: translateY(-2px); box-shadow: 0 14px 30px rgba(180,85,45,.4); }
.btn-ghost { border-color: var(--terracotta); color: var(--terracotta); background: transparent; }
.btn-ghost:hover { background: var(--terracotta); color: #fff; }
.btn-block { width: 100%; }
.btn:disabled { opacity: .55; cursor: not-allowed; transform: none !important; }

/* ---------- USPs ---------- */
.usps { background: var(--cream-2); border-block: 1px solid rgba(180,85,45,.1); }
.usps-inner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding-block: 1.6rem; }
.usp { display: flex; gap: .85rem; align-items: center; }
.usp > span { font-size: 1.6rem; }
.usp strong { display: block; font-size: .93rem; }
.usp small { color: var(--ink-soft); font-size: .8rem; }

/* ---------- secções ---------- */
section { padding-block: clamp(3.2rem, 7vw, 5.5rem); }
.section-head { text-align: center; max-width: 44rem; margin: 0 auto clamp(1.8rem, 4vw, 3rem); }
.section-head p:not(.eyebrow) { color: var(--ink-soft); margin-top: .6rem; }

/* ---------- grid de produtos ---------- */
.filters { display: flex; gap: .6rem; justify-content: center; flex-wrap: wrap; margin-bottom: 2.2rem; }
.filters button {
  border: 1.5px solid rgba(180,85,45,.3); background: transparent; color: var(--ink-soft);
  border-radius: 999px; padding: .5rem 1.25rem; font-weight: 500; font-size: .9rem; transition: all .25s;
}
.filters button:hover { border-color: var(--terracotta); color: var(--terracotta); }
.filters button.active { background: var(--terracotta); border-color: var(--terracotta); color: #fff; }

.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6rem; }
.card {
  background: var(--white); border-radius: var(--radius); overflow: hidden;
  box-shadow: var(--shadow-sm); transition: transform .35s var(--ease), box-shadow .35s var(--ease);
  display: flex; flex-direction: column; cursor: pointer;
}
.card:hover { transform: translateY(-6px); box-shadow: var(--shadow); }
.card-media { position: relative; aspect-ratio: 1/1.05; overflow: hidden; background: var(--cream-2); }
.card-media img { width: 100%; height: 100%; object-fit: cover; transition: transform .6s var(--ease); }
.card:hover .card-media img { transform: scale(1.06); }
.badge {
  position: absolute; top: .8rem; left: .8rem; z-index: 2;
  background: var(--terracotta); color: #fff; font-size: .68rem; font-weight: 600;
  letter-spacing: .12em; text-transform: uppercase; padding: .34rem .7rem; border-radius: 999px;
}
.badge.gold { background: var(--gold); }
.stock-chip {
  position: absolute; top: .8rem; right: .8rem; z-index: 2;
  background: rgba(251,246,239,.95); color: var(--danger); font-size: .7rem; font-weight: 600;
  padding: .34rem .7rem; border-radius: 999px; letter-spacing: .04em;
}
.card-body { padding: 1.1rem 1.2rem 1.3rem; display: flex; flex-direction: column; gap: .3rem; flex: 1; }
.card-cat { font-size: .72rem; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); font-weight: 600; }
.card-name { font-family: var(--serif); font-size: 1.15rem; font-weight: 600; }
.card-desc { font-size: .85rem; color: var(--ink-soft); flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: .6rem; }
.card-price { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap; }
.card-price strong { font-family: var(--serif); font-size: 1.25rem; color: var(--terracotta-dark); }
.card-price s { color: var(--ink-soft); font-size: .85rem; }
.card-price .off { color: var(--ok); font-size: .75rem; font-weight: 700; }
.card-wa {
  width: 38px; height: 38px; border-radius: 50%; border: 0; flex: none;
  background: var(--green); color: #fff; font-size: 1rem; display: grid; place-items: center;
  transition: transform .25s, background .25s;
}
.card-wa:hover { transform: scale(1.12); background: var(--terracotta); }
.card.sold-out { pointer-events: none; }
.card.sold-out .card-media img { filter: grayscale(.85) brightness(.92); }
.grid-empty { text-align: center; color: var(--ink-soft); padding: 2.5rem 0; font-size: 1.05rem; }

/* ---------- lenda ---------- */
.legend { background: var(--green); color: #EFE7DA; padding-top: 0; position: relative; }
.wave-divider { display: block; width: 100%; height: 60px; transform: translateY(-1px); }
.legend-inner { display: grid; grid-template-columns: .9fr 1.1fr; gap: clamp(2rem, 5vw, 4rem); align-items: center; padding-block: 1.5rem 3rem; }
.legend-media { position: relative; }
.legend-frame { border-radius: 22px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.35); }
.legend-frame img { width: 100%; height: clamp(320px, 40vw, 480px); object-fit: cover; }
.legend-ornament {
  position: absolute; top: -1.4rem; right: -1.2rem; font-size: 4.4rem; opacity: .9;
  filter: drop-shadow(0 10px 20px rgba(0,0,0,.4)); animation: float 6s ease-in-out infinite;
}
.legend-copy h2 { margin-bottom: 1rem; }
.legend-copy h2 em { color: var(--gold-soft); font-style: italic; }
.legend-verse { font-family: var(--serif); font-style: italic; font-size: 1.12rem; color: var(--gold-soft); margin-bottom: 1rem; }
.legend-copy > p { color: #D8CDBC; margin-bottom: .9rem; }
.legend-points { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.6rem; }
.legend-points > div { display: flex; gap: .7rem; align-items: flex-start; }
.legend-points > div > span {
  width: 30px; height: 30px; flex: none; border-radius: 50%;
  background: var(--gold); color: var(--green); font-weight: 700; font-size: .85rem;
  display: grid; place-items: center; margin-top: .2rem;
}
.legend-points strong { color: #fff; }
.legend-points p { font-size: .82rem; color: #D8CDBC; }

/* ---------- depoimentos ---------- */
.t-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6rem; }
.t-card {
  background: var(--white); border-radius: var(--radius); padding: 1.7rem;
  box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 1rem;
  border-top: 4px solid var(--gold); transition: transform .3s var(--ease);
}
.t-card:hover { transform: translateY(-5px); }
.t-stars { color: var(--gold); letter-spacing: .2em; }
.t-card p { font-size: .95rem; color: var(--ink-soft); flex: 1; }
.t-card footer { display: flex; gap: .75rem; align-items: center; }
.avatar {
  width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
  background: var(--a, var(--terracotta)); color: #fff; font-weight: 700; font-size: .85rem; letter-spacing: .05em;
}
.t-card footer strong { display: block; font-size: .92rem; }
.t-card footer small { color: var(--ink-soft); font-size: .8rem; }

/* ---------- instagram ---------- */
.insta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
.insta-grid a { border-radius: var(--radius-sm); overflow: hidden; position: relative; aspect-ratio: 1; }
.insta-grid img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s var(--ease); }
.insta-grid a::after {
  content: '✦'; position: absolute; inset: 0; display: grid; place-items: center;
  background: rgba(180,85,45,.35); color: #fff; font-size: 1.8rem; opacity: 0; transition: opacity .3s;
}
.insta-grid a:hover::after { opacity: 1; }
.insta-grid a:hover img { transform: scale(1.07); }
.insta-cta { text-align: center; }

/* ---------- FAQ ---------- */
.faq { background: var(--cream-2); }
.faq-list { max-width: 46rem; margin-inline: auto; display: grid; gap: .8rem; }
.faq-list details {
  background: var(--white); border-radius: var(--radius-sm); overflow: hidden;
  box-shadow: var(--shadow-sm); border: 1px solid rgba(180,85,45,.08);
}
.faq-list summary {
  list-style: none; display: flex; justify-content: space-between; align-items: center;
  padding: 1.1rem 1.3rem; font-weight: 600; cursor: pointer; transition: color .2s;
}
.faq-list summary::-webkit-details-marker { display: none; }
.faq-list summary:hover { color: var(--terracotta); }
.faq-icon { font-size: 1.3rem; color: var(--terracotta); transition: transform .3s var(--ease); font-weight: 400; }
.faq-list details[open] .faq-icon { transform: rotate(45deg); }
.faq-list details p { padding: 0 1.3rem 1.2rem; color: var(--ink-soft); font-size: .95rem; }

/* ---------- newsletter ---------- */
.newsletter-box {
  background: linear-gradient(135deg, var(--terracotta) 0%, #C4723F 55%, var(--gold) 130%);
  border-radius: 26px; padding: clamp(2.2rem, 5vw, 3.5rem); text-align: center; color: #fff;
  box-shadow: 0 24px 60px rgba(180,85,45,.35);
}
.newsletter-box h2 { margin-bottom: .5rem; }
.newsletter-box h2 em { color: #FFE9B8; }
.newsletter-box p { color: rgba(255,255,255,.9); margin-bottom: 1.5rem; }
.newsletter-form { display: flex; gap: .7rem; max-width: 30rem; margin-inline: auto; }
.newsletter-form input {
  flex: 1; border: 0; border-radius: 999px; padding: .9rem 1.4rem; outline: none; background: #fff; color: var(--ink);
}
.newsletter-form .btn { background: var(--ink); box-shadow: none; }
.newsletter-form .btn:hover { background: #000; }

/* ---------- rodapé ---------- */
.site-footer { background: var(--ink); color: #D8CDBC; padding-top: clamp(2.5rem, 5vw, 4rem); }
.footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 2rem; padding-bottom: 2.5rem; }
.f-brand .logo-text { color: #fff; }
.f-brand .logo-text em { color: var(--gold-soft); }
.f-brand p { font-size: .92rem; margin-block: 1.1rem; max-width: 20rem; }
.f-social { display: flex; gap: .6rem; }
.f-social a {
  width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
  border: 1.5px solid rgba(255,255,255,.25); font-size: .72rem; font-weight: 700; letter-spacing: .04em;
  transition: all .25s;
}
.f-social a:hover { background: var(--gold); border-color: var(--gold); color: var(--ink); transform: translateY(-3px); }
.f-col h4 { color: #fff; font-family: var(--serif); margin-bottom: 1rem; font-size: 1.05rem; }
.f-col a { display: block; padding-block: .28rem; font-size: .92rem; transition: color .2s, padding-left .2s; }
.f-col a:hover { color: var(--gold-soft); padding-left: 4px; }
.f-addr { font-size: .88rem; margin-top: .5rem; }
.footer-bottom {
  border-top: 1px solid rgba(255,255,255,.1); padding-block: 1.2rem;
  display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: .82rem;
}
.footer-admin a { color: var(--gold-soft); text-decoration: underline; }

/* ---------- WhatsApp float ---------- */
.wa-float {
  position: fixed; right: 1.2rem; bottom: 1.2rem; z-index: 70;
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #25D366, #128C7E);
  display: grid; place-items: center; box-shadow: 0 12px 30px rgba(18,140,126,.45);
  transition: transform .3s var(--ease);
}
.wa-float:hover { transform: scale(1.12) rotate(6deg); }
.wa-float::after {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid #25D366; animation: pulse 2.2s ease-out infinite;
}

/* ---------- modal ---------- */
.modal { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 1rem; }
.modal[aria-hidden="true"] { display: none; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(46,33,26,.55); backdrop-filter: blur(4px); animation: fadeIn .25s; }
.modal-card {
  position: relative; z-index: 2; background: var(--cream); border-radius: 22px;
  max-height: 92vh; overflow: auto; box-shadow: var(--shadow); animation: pop .35s var(--ease);
}
.modal-product { display: grid; grid-template-columns: 1fr 1.15fr; width: min(880px, 96vw); }
.modal-close {
  position: absolute; top: .7rem; right: .7rem; z-index: 5; width: 38px; height: 38px;
  border-radius: 50%; border: 0; background: rgba(251,246,239,.92); font-size: 1rem;
  display: grid; place-items: center; transition: transform .25s, background .25s;
}
.modal-close:hover { transform: rotate(90deg); background: var(--terracotta); color: #fff; }
.mp-media { background: var(--cream-2); }
.mp-media img { width: 100%; height: 100%; min-height: 320px; object-fit: cover; }
.mp-gallery { display: flex; gap: .55rem; padding: .8rem 1rem 1rem; flex-wrap: wrap; }
.mp-gallery.hidden { display: none; }
.mp-thumb {
  width: 62px; height: 62px; border-radius: 10px; overflow: hidden; padding: 0;
  border: 2px solid transparent; background: #fff; transition: border-color .2s, transform .2s;
}
.mp-thumb img { width: 100%; height: 100%; min-height: 0; object-fit: cover; }
.mp-thumb:hover { transform: translateY(-2px); }
.mp-thumb.active { border-color: var(--terracotta); }
.mp-body { padding: 1.8rem 1.9rem; display: flex; flex-direction: column; gap: .8rem; }
.mp-cat { font-size: .72rem; letter-spacing: .24em; text-transform: uppercase; color: var(--gold); font-weight: 700; }
.mp-body h3 { font-size: 1.65rem; }
.mp-price { display: flex; align-items: center; gap: .7rem; flex-wrap: wrap; }
.mp-price strong { font-family: var(--serif); font-size: 1.6rem; color: var(--terracotta-dark); }
.mp-price s { color: var(--ink-soft); }
.mp-desc { color: var(--ink-soft); font-size: .95rem; }
.mp-order { display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: var(--cream-2); border-radius: var(--radius-sm); padding: .7rem 1rem; margin-top: .2rem; }
.qty { display: flex; align-items: center; gap: .9rem; }
.qty button {
  width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--terracotta);
  background: transparent; color: var(--terracotta); font-size: 1.1rem; display: grid; place-items: center; transition: all .2s;
}
.qty button:hover { background: var(--terracotta); color: #fff; }
.qty span { font-weight: 700; font-size: 1.05rem; min-width: 1.4rem; text-align: center; }
.mp-total { text-align: right; }
.mp-total small { display: block; font-size: .72rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .1em; }
.mp-total strong { font-family: var(--serif); font-size: 1.35rem; color: var(--terracotta-dark); }
.mp-info { font-size: .8rem; color: var(--ink-soft); text-align: center; }
.mp-form { background: var(--cream-2); border-radius: var(--radius-sm); padding: 1rem 1.1rem; }
.mp-form-title { font-weight: 700; margin-bottom: .6rem; font-size: .95rem; }
.mp-form input, .mp-form select, .mp-form textarea {
  width: 100%; border: 1.5px solid rgba(180,85,45,.22); background: #fff; border-radius: 10px;
  padding: .68rem .9rem; margin-bottom: .55rem; outline: none; transition: border-color .2s; font-size: .93rem;
}
.mp-form input:focus, .mp-form select:focus, .mp-form textarea:focus { border-color: var(--terracotta); }
.mp-form-note { font-size: .85rem; text-align: center; color: var(--ok); font-weight: 600; }
.mp-success { text-align: center; padding: 1.2rem 0; }
.mp-success-icon { font-size: 2.8rem; margin-bottom: .5rem; animation: float 3s ease-in-out infinite; }
.mp-success h4 { font-family: var(--serif); font-size: 1.4rem; margin-bottom: .5rem; }
.mp-success p { color: var(--ink-soft); font-size: .95rem; margin-bottom: .6rem; }

/* ---------- toast ---------- */
.toast {
  position: fixed; bottom: 1.6rem; left: 50%; transform: translateX(-50%) translateY(80px);
  background: var(--ink); color: #fff; padding: .85rem 1.5rem; border-radius: 999px;
  font-size: .93rem; z-index: 120; opacity: 0; transition: all .4s var(--ease);
  box-shadow: var(--shadow); max-width: 90vw; text-align: center;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.ok { background: var(--ok); }
.toast.err { background: var(--danger); }

/* ---------- animações ---------- */
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
@keyframes pulse { from { transform: scale(1); opacity: .9; } to { transform: scale(1.45); opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: scale(.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s var(--ease), transform .8s var(--ease); }
.reveal.visible { opacity: 1; transform: translateY(0); }

/* ---------- responsivo ---------- */
@media (max-width: 1020px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
  .hero-inner { grid-template-columns: 1fr; }
  .hero-media { max-width: 540px; margin-inline: auto; }
  .legend-inner { grid-template-columns: 1fr; }
  .legend-media { max-width: 460px; margin-inline: auto; }
  .usps-inner { grid-template-columns: repeat(2, 1fr); }
  .t-grid { grid-template-columns: 1fr; }
  .insta-grid { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .modal-product { grid-template-columns: 1fr; }
  .mp-media img { min-height: 260px; max-height: 46vh; }
}
@media (max-width: 640px) {
  .site-nav {
    position: fixed; top: 0; right: -78vw; width: 74vw; height: 100dvh; z-index: 80;
    background: var(--cream); flex-direction: column; align-items: flex-start; gap: 0;
    padding: 6rem 2rem 2rem; box-shadow: -20px 0 60px rgba(46,33,26,.2);
    transition: right .4s var(--ease);
  }
  .site-nav.open { right: 0; }
  .site-nav a { font-size: 1.15rem; padding-block: .8rem; width: 100%; border-bottom: 1px solid rgba(180,85,45,.12); }
  .site-nav .nav-cta { margin-top: 1.2rem; text-align: center; }
  .burger { display: flex; z-index: 90; }
  .grid { grid-template-columns: 1fr; max-width: 400px; margin-inline: auto; }
  .hero-proof { gap: 1.2rem; }
  .newsletter-form { flex-direction: column; }
  .footer-grid { grid-template-columns: 1fr; }
  .legend-points { grid-template-columns: 1fr; }
  .hero h1 em { white-space: normal; }
}
````

---


## 📄 FICHEIRO 9/12 — `public/css/admin.css`

**Onde:** em public/css/ (nome: public/css/admin.css)

**Passos:** Add file → Create new file → cola `public/css/admin.css` como nome → cola isto abaixo → Commit changes

````text
/* ============================================================
   KIANDA — Painel Admin (design)
   ============================================================ */
:root {
  --terracotta: #B4552D;
  --terracotta-dark: #93431F;
  --gold: #C9A227;
  --cream: #FBF6EF;
  --ink: #2E211A;
  --ink-soft: #6E5A4E;
  --green: #2F4A3C;
  --danger: #C0392B;
  --ok: #1E7B4F;
  --radius: 16px;
  --shadow: 0 14px 40px rgba(46,33,26,.10);
  --serif: 'Playfair Display', Georgia, serif;
  --sans: 'Jost', 'Segoe UI', Arial, sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--sans); background: var(--cream); color: var(--ink); line-height: 1.55; }
button { font-family: inherit; cursor: pointer; }
input, select, textarea { font-family: inherit; font-size: .95rem; }
code { background: #EFE6D6; padding: .1rem .4rem; border-radius: 6px; font-size: .85em; }
.hidden { display: none !important; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
  background: var(--terracotta); color: #fff; border: 0; border-radius: 999px;
  padding: .7rem 1.4rem; font-weight: 600; font-size: .93rem; transition: all .25s;
  box-shadow: 0 8px 20px rgba(180,85,45,.25);
}
.btn:hover { background: var(--terracotta-dark); transform: translateY(-1px); }
.btn.ghost { background: transparent; color: var(--terracotta); border: 1.5px solid var(--terracotta); box-shadow: none; }
.btn.ghost:hover { background: var(--terracotta); color: #fff; }
.btn.danger { color: var(--danger); border-color: var(--danger); }
.btn.danger:hover { background: var(--danger); color: #fff; }
.btn.small { padding: .45rem 1rem; font-size: .85rem; }
.btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }

/* ---------- login ---------- */
.login {
  min-height: 100dvh; display: grid; place-items: center; padding: 1rem;
  background:
    radial-gradient(60rem 30rem at 110% -10%, rgba(201,162,39,.25), transparent 60%),
    radial-gradient(50rem 28rem at -10% 110%, rgba(180,85,45,.2), transparent 60%),
    var(--cream);
}
.login-card {
  background: #fff; border-radius: 22px; padding: 2.6rem 2.4rem; width: min(400px, 100%);
  box-shadow: var(--shadow); text-align: center; animation: pop .4s ease;
}
.login-card h1 { font-family: var(--serif); font-size: 1.8rem; margin: .8rem 0 .2rem; letter-spacing: .06em; }
.login-card h1 em { color: var(--terracotta); font-style: italic; }
.login-card p { color: var(--ink-soft); font-size: .92rem; margin-bottom: 1.3rem; }
.login-card input {
  width: 100%; border: 1.5px solid rgba(180,85,45,.25); border-radius: 12px;
  padding: .85rem 1rem; margin-bottom: .9rem; outline: none; transition: border-color .2s;
}
.login-card input:focus { border-color: var(--terracotta); }
.login-card .btn { width: 100%; }
.login-err { color: var(--danger); font-weight: 600; min-height: 1.2rem; font-size: .88rem; }
.login-back { display: inline-block; margin-top: .8rem; color: var(--ink-soft); font-size: .85rem; text-decoration: underline; }

/* ---------- layout admin ---------- */
.admin { display: grid; grid-template-columns: 240px 1fr; min-height: 100dvh; }
.sidebar {
  background: var(--ink); color: #D8CDBC; display: flex; flex-direction: column;
  padding: 1.4rem 1rem; position: sticky; top: 0; height: 100dvh;
}
.sb-brand { display: flex; gap: .7rem; align-items: center; padding: .4rem .6rem 1.4rem; border-bottom: 1px solid rgba(255,255,255,.12); margin-bottom: 1.2rem; }
.sb-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 5px rgba(201,162,39,.2); }
.sb-brand strong { display: block; font-family: var(--serif); letter-spacing: .12em; color: #fff; }
.sb-brand small { font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; color: var(--gold); }
.sb-nav { display: grid; gap: .35rem; flex: 1; }
.sb-nav button {
  display: flex; align-items: center; gap: .7rem; width: 100%; text-align: left;
  background: none; border: 0; color: #D8CDBC; padding: .75rem .8rem; border-radius: 12px;
  font-size: .95rem; font-weight: 500; transition: all .2s;
}
.sb-nav button:hover { background: rgba(255,255,255,.07); color: #fff; }
.sb-nav button.active { background: var(--terracotta); color: #fff; }
.pill {
  background: var(--gold); color: var(--ink); font-size: .7rem; font-weight: 700;
  border-radius: 999px; padding: .05rem .5rem; margin-left: auto;
}
.sb-foot { border-top: 1px solid rgba(255,255,255,.12); padding-top: 1rem; display: grid; gap: .5rem; }
.sb-foot a, .sb-foot button {
  background: none; border: 0; color: #D8CDBC; text-align: left; font-size: .9rem; padding: .4rem .8rem; border-radius: 10px; transition: all .2s;
}
.sb-foot a:hover, .sb-foot button:hover { background: rgba(255,255,255,.07); color: #fff; }

.content { padding: 2rem 2.2rem 3rem; max-width: 1100px; }
.tab { display: none; animation: fade .3s ease; }
.tab.active { display: block; }
.tab h2 { font-family: var(--serif); font-size: 1.7rem; margin-bottom: .2rem; }
.tab-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.2rem; }
.muted { color: var(--ink-soft); font-size: .93rem; margin-bottom: 1.4rem; }
.muted.small { font-size: .82rem; margin-top: .6rem; }

/* ---------- dashboard ---------- */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat {
  background: #fff; border-radius: var(--radius); padding: 1.2rem; display: flex; gap: .9rem; align-items: center;
  box-shadow: 0 8px 24px rgba(46,33,26,.07); border-top: 4px solid var(--gold);
}
.stat-icon { font-size: 1.8rem; }
.stat strong { display: block; font-family: var(--serif); font-size: 1.6rem; line-height: 1.1; }
.stat small { color: var(--ink-soft); font-size: .8rem; }
.panel {
  background: #fff; border-radius: var(--radius); padding: 1.5rem; box-shadow: 0 8px 24px rgba(46,33,26,.07); margin-bottom: 1.5rem;
}
.panel h3 { font-family: var(--serif); margin-bottom: 1rem; }
.quick-actions { display: flex; gap: .7rem; flex-wrap: wrap; margin-bottom: 1rem; }
.hint-box {
  background: #FBF3E0; border: 1px dashed var(--gold); border-radius: 12px;
  padding: .9rem 1.1rem; font-size: .9rem; color: var(--ink);
}

/* ---------- lista de produtos ---------- */
.prod-row {
  display: grid; grid-template-columns: 64px 1.4fr 1fr .8fr auto; gap: 1rem; align-items: center;
  padding: .8rem; border-radius: 14px; transition: background .2s; border-bottom: 1px solid rgba(46,33,26,.06);
}
.prod-row:hover { background: var(--cream); }
.prod-row img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
.prod-name { font-weight: 600; }
.prod-cat { font-size: .78rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .12em; }
.prod-price { font-weight: 700; color: var(--terracotta-dark); }
.prod-price s { color: var(--ink-soft); font-weight: 400; font-size: .82rem; margin-left: .3rem; }
.prod-actions { display: flex; gap: .35rem; align-items: center; }
.icon-btn {
  width: 34px; height: 34px; border-radius: 10px; border: 1.5px solid rgba(46,33,26,.15);
  background: #fff; font-size: .95rem; display: grid; place-items: center; transition: all .2s;
}
.icon-btn:hover { border-color: var(--terracotta); background: var(--terracotta); color: #fff; }
.icon-btn.danger:hover { border-color: var(--danger); background: var(--danger); }
.icon-btn:disabled { opacity: .3; cursor: not-allowed; }

/* ---------- pedidos ---------- */
.order-card {
  border: 1px solid rgba(46,33,26,.1); border-radius: 14px; padding: 1.1rem 1.3rem; margin-bottom: .9rem; background: #fff;
}
.order-head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: center; margin-bottom: .5rem; }
.order-id { font-weight: 700; color: var(--terracotta); font-size: .95rem; }
.order-date { color: var(--ink-soft); font-size: .8rem; }
.order-items { font-size: .9rem; color: var(--ink-soft); margin-bottom: .4rem; }
.order-items strong { color: var(--ink); }
.order-total { font-family: var(--serif); font-size: 1.15rem; color: var(--terracotta-dark); }
.order-meta { display: flex; gap: 1.4rem; flex-wrap: wrap; font-size: .87rem; margin-bottom: .7rem; }
.order-meta b { display: block; font-size: .75rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); }
.order-foot { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; }
.order-foot select {
  border: 1.5px solid rgba(180,85,45,.3); border-radius: 999px; padding: .45rem .9rem; background: #fff; outline: none; font-size: .88rem;
}
.status-chip { font-size: .75rem; font-weight: 700; padding: .3rem .8rem; border-radius: 999px; letter-spacing: .04em; }
.status-Nova { background: #EAF2FB; color: #1F6FBF; }
.status-Confirmado { background: #E8F6EE; color: var(--ok); }
.status-Entregue { background: #F3E8FB; color: #7D3FAF; }
.status-Cancelado { background: #FDEBEA; color: var(--danger); }
.empty-state { text-align: center; padding: 2.4rem 1rem; color: var(--ink-soft); }
.empty-state .big { font-size: 2.4rem; display: block; margin-bottom: .6rem; }

/* ---------- formulários ---------- */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem 1.1rem; }
.form-grid label { font-size: .85rem; font-weight: 600; color: var(--ink-soft); display: grid; gap: .3rem; }
.form-grid label.full { grid-column: 1 / -1; }
.form-grid input, .form-grid select, .form-grid textarea {
  border: 1.5px solid rgba(180,85,45,.22); border-radius: 10px; padding: .7rem .85rem; background: #fff;
  outline: none; transition: border-color .2s; font-size: .95rem; color: var(--ink);
}
.form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { border-color: var(--terracotta); }
.form-grid .label { font-size: .85rem; font-weight: 600; color: var(--ink-soft); margin-bottom: .3rem; }
.check { display: flex !important; align-items: center; gap: .5rem !important; font-size: .92rem !important; color: var(--ink) !important; font-weight: 500 !important; }
.check input { width: 18px; height: 18px; accent-color: var(--terracotta); }
.save-note { color: var(--ok); font-weight: 600; font-size: .88rem; margin-left: .6rem; }
.inline-form { display: flex; gap: .7rem; flex-wrap: wrap; }
.inline-form input { flex: 1; min-width: 220px; border: 1.5px solid rgba(180,85,45,.22); border-radius: 10px; padding: .7rem .9rem; outline: none; }
.inline-form input:focus { border-color: var(--terracotta); }

/* ---------- modal produto ---------- */
.modal { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1rem; }
.modal[aria-hidden="true"] { display: none; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(46,33,26,.55); backdrop-filter: blur(4px); }
.modal-card {
  position: relative; z-index: 2; background: var(--cream); border-radius: 20px; padding: 1.8rem;
  width: min(680px, 96vw); max-height: 92vh; overflow: auto; box-shadow: var(--shadow); animation: pop .35s ease;
}
.modal-card h3 { font-family: var(--serif); font-size: 1.45rem; margin-bottom: 1.2rem; }
.modal-close {
  position: absolute; top: .9rem; right: .9rem; width: 36px; height: 36px; border-radius: 50%;
  border: 0; background: rgba(255,255,255,.9); font-size: .95rem; transition: all .25s;
}
.modal-close:hover { transform: rotate(90deg); background: var(--terracotta); color: #fff; }
.img-row { display: flex; gap: 1rem; align-items: flex-start; }
.img-preview { width: 110px; height: 110px; object-fit: cover; border-radius: 14px; border: 2px dashed rgba(180,85,45,.3); background: #fff; }
.img-actions { display: grid; gap: .5rem; flex: 1; }
.img-actions input[type="text"] { border: 1.5px solid rgba(180,85,45,.22); border-radius: 10px; padding: .6rem .8rem; outline: none; width: 100%; }
.pm-actions { display: flex; gap: .7rem; }

/* ---------- toast ---------- */
.toast {
  position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%) translateY(80px);
  background: var(--ink); color: #fff; padding: .85rem 1.5rem; border-radius: 999px;
  font-size: .93rem; z-index: 150; opacity: 0; transition: all .4s ease; box-shadow: var(--shadow); max-width: 92vw; text-align: center;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.ok { background: var(--ok); }
.toast.err { background: var(--danger); }

@keyframes pop { from { opacity: 0; transform: scale(.95) translateY(8px); } to { opacity: 1; transform: scale(1); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }

@media (max-width: 860px) {
  .admin { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; }
  .sb-nav { grid-template-columns: 1fr 1fr; }
  .stats { grid-template-columns: 1fr 1fr; }
  .prod-row { grid-template-columns: 56px 1fr auto; }
  .prod-row .prod-price { grid-column: 2; }
  .form-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .stats { grid-template-columns: 1fr; }
  .sb-nav { grid-template-columns: 1fr; }
  .content { padding: 1.4rem; }
  .img-row { flex-direction: column; }
}
````

---


## 📄 FICHEIRO 10/12 — `public/css/fonts.css`

**Onde:** em public/css/ (nome: public/css/fonts.css)

**Passos:** Add file → Create new file → cola `public/css/fonts.css` como nome → cola isto abaixo → Commit changes

````text
/* cyrillic */
@font-face {
  font-family: 'Jost';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/f1.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* latin-ext */
@font-face {
  font-family: 'Jost';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/f2.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Jost';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/f3.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(/fonts/f4.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* latin-ext */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(/fonts/f6.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(/fonts/f5.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/f4.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* latin-ext */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/f6.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/f5.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f4.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* latin-ext */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f6.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f5.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f4.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* latin-ext */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f6.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f5.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f12.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* vietnamese */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f14.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
/* latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f13.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f11.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f12.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* vietnamese */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f14.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
/* latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f13.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f11.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f9.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* vietnamese */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f8.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
/* latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f7.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/f10.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f9.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* vietnamese */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f8.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
/* latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f7.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/f10.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/f9.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
/* vietnamese */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/f8.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
/* latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/f7.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/f10.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
````

---


## 📄 FICHEIRO 11/12 — `public/js/app.js`

**Onde:** em public/js/ (nome: public/js/app.js)

**Passos:** Add file → Create new file → cola `public/js/app.js` como nome → cola isto abaixo → Commit changes

````text
/* ============================================================
   KIANDA — Loja (front-end)
   ============================================================ */
(function () {
  'use strict';

  const fmt = (v) => Math.round(Number(v) || 0).toLocaleString('pt-AO').replace(/,/g, '.') + ' Kz';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const state = {
    products: [],
    settings: {},
    category: 'Todas',
    cart: {}, // id -> qty
  };

  /* ---------- helpers ---------- */
  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 3600);
  }

  function waLink(number, text) {
    const n = String(number || '').replace(/\D/g, '');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- renderizar produtos ---------- */
  function renderFilters() {
    const cats = ['Todas'].concat(Array.from(new Set(state.products.map((p) => p.category))).filter(Boolean));
    $('#filters').innerHTML = cats
      .map((c) => `<button class="${c === state.category ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join('');
    $$('#filters button').forEach((b) =>
      b.addEventListener('click', () => {
        state.category = b.dataset.cat;
        renderFilters();
        renderGrid();
      })
    );
  }

  function cardHTML(p) {
    const sold = !p.stock;
    const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `
    <article class="card ${sold ? 'sold-out' : ''}" data-id="${p.id}">
      <div class="card-media">
        ${p.badge && p.stock ? `<span class="badge ${p.badge === 'NOVO' ? 'gold' : ''}">${escapeHtml(p.badge)}</span>` : ''}
        ${sold ? '<span class="stock-chip">ESGOTADO</span>' : ''}
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="card-body">
        <span class="card-cat">${escapeHtml(p.category)}</span>
        <h3 class="card-name">${escapeHtml(p.name)}</h3>
        <p class="card-desc">${escapeHtml(p.description)}</p>
        <div class="card-foot">
          <div class="card-price">
            <strong>${fmt(p.price)}</strong>
            ${p.oldPrice ? `<s>${fmt(p.oldPrice)}</s><span class="off">-${off}%</span>` : ''}
          </div>
          <button class="card-wa" data-wa="${p.id}" aria-label="Encomendar ${escapeHtml(p.name)} no WhatsApp" title="Encomendar no WhatsApp">➤</button>
        </div>
      </div>
    </article>`;
  }

  function renderGrid() {
    const list =
      state.category === 'Todas'
        ? state.products
        : state.products.filter((p) => p.category === state.category);
    $('#product-grid').innerHTML = list.map(cardHTML).join('');
    $('#grid-empty').classList.toggle('hidden', list.length > 0);
    bindCards();
  }

  function bindCards() {
    $$('#product-grid .card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-wa')) return; // o botão trata à parte
        openModal(card.dataset.id);
      });
    });
    $$('#product-grid .card-wa').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = state.products.find((x) => x.id === btn.dataset.wa);
        if (!p) return;
        const msg = `Olá Kianda! 🌊 Quero encomendar a *${p.name}* (${fmt(p.price)}). Está disponível?`;
        window.open(waLink(state.settings.whatsapp, msg), '_blank');
      })
    );
  }

  /* ---------- modal de produto ---------- */
  let current = null;

  function openModal(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    current = p;
    state.cart[p.id] = 1;

    $('#mp-img').src = p.image;
    $('#mp-img').alt = p.name;
    renderGallery(p);
    $('#mp-cat').textContent = p.category;
    $('#mp-name').textContent = p.name;
    $('#mp-price').textContent = fmt(p.price);
    $('#mp-old').textContent = p.oldPrice ? fmt(p.oldPrice) : '';
    $('#mp-old').classList.toggle('hidden', !p.oldPrice);
    $('#mp-badge').textContent = p.badge || '';
    $('#mp-badge').classList.toggle('hidden', !p.badge || !p.stock);
    $('#mp-desc').textContent = p.description;

    const sold = !p.stock;
    $('#mp-order').classList.toggle('hidden', sold);
    $('#mp-wa').classList.toggle('hidden', sold);
    $('#mp-form').classList.toggle('hidden', sold);
    $('#mp-form-wrap').classList.add('hidden');
    $('#mp-success').classList.add('hidden');
    $('#of-note').textContent = '';

    if (sold) {
      $('#mp-info').textContent = '😔 Este modelo está esgotado. Envia-nos mensagem para saberes quando volta!';
      $('#mp-info').style.color = 'var(--danger)';
      const btn = $('#mp-wa');
      btn.classList.remove('hidden');
      btn.textContent = 'Avise-me quando voltar';
      btn.onclick = () => {
        const msg = `Olá Kianda! 🌊 A bolsa *${p.name}* está esgotada. Podem avisar-me quando voltar a estar disponível?`;
        window.open(waLink(state.settings.whatsapp, msg), '_blank');
      };
    } else {
      $('#mp-info').style.color = '';
      $('#mp-info').textContent = '🚚 Entrega em Luanda 24–48h · 💳 Multicaixa Express · Pagamento na entrega';
      updateQtyUI();
      $('#mp-wa').textContent = 'Encomendar no WhatsApp';
      $('#mp-wa').onclick = waOrder;
      $('#mp-form').onclick = () => $('#mp-form-wrap').classList.toggle('hidden');
    }

    $('#product-modal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function renderGallery(p) {
    const gal = [p.image].concat(p.gallery || []).filter(Boolean);
    const wrap = $('#mp-gallery');
    if (gal.length < 2) { wrap.innerHTML = ''; wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    wrap.innerHTML = gal
      .map((u) => `<button class="mp-thumb" data-src="${u}" aria-label="Ver foto"><img src="${u}" alt="" loading="lazy"></button>`)
      .join('');
    $$('#mp-gallery .mp-thumb').forEach((b) =>
      b.addEventListener('click', () => {
        $('#mp-img').src = b.dataset.src;
        $$('#mp-gallery .mp-thumb').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      })
    );
    $$('#mp-gallery .mp-thumb')[0].classList.add('active');
  }

  function closeModal() {
    $('#product-modal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateQtyUI() {
    const q = state.cart[current.id] || 1;
    $('#qty-val').textContent = q;
    $('#mp-total').textContent = fmt(current.price * q);
  }

  function waOrder() {
    const q = state.cart[current.id] || 1;
    const total = current.price * q;
    const msg =
      `Olá Kianda! 🌊 Quero encomendar:\n\n` +
      `👜 *${current.name}*\n` +
      `Quantidade: ${q}\n` +
      `Preço: ${fmt(current.price)}\n` +
      `Total: ${fmt(total)}\n\n` +
      `Pode confirmar a disponibilidade e entrega?`;
    window.open(waLink(state.settings.whatsapp, msg), '_blank');
  }

  /* ---------- formulário de pedido ---------- */
  $('#order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#of-submit');
    btn.disabled = true;
    btn.textContent = 'A enviar...';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: $('#of-name').value,
          phone: $('#of-phone').value,
          address: $('#of-address').value,
          payment: $('#of-payment').value,
          notes: $('#of-notes').value,
          items: [{ name: current.name, price: current.price, qty: state.cart[current.id] || 1 }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
      $('#mp-form-wrap').classList.add('hidden');
      $('#mp-success').classList.remove('hidden');
      $('#mp-order-id').textContent = data.order.id;
      $('#mp-success-wa').onclick = () => {
        const msg = `Olá Kianda! 🌊 Acabei de fazer o pedido *${data.order.id}* no site. Quero confirmar!`;
        window.open(waLink(state.settings.whatsapp, msg), '_blank');
      };
      e.target.reset();
      toast('Pedido enviado com sucesso! 💌', 'ok');
    } catch (err) {
      toast(err.message || 'Não foi possível enviar o pedido.', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirmar pedido';
    }
  });

  $('#qty-minus').addEventListener('click', () => {
    const q = Math.max(1, (state.cart[current.id] || 1) - 1);
    state.cart[current.id] = q;
    updateQtyUI();
  });
  $('#qty-plus').addEventListener('click', () => {
    const q = Math.min(10, (state.cart[current.id] || 1) + 1);
    state.cart[current.id] = q;
    updateQtyUI();
  });
  $$('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  /* ---------- definir contactos/redes a partir das definições ---------- */
  function applySettings() {
    const s = state.settings || {};
    const insta = s.instagram ? 'https://instagram.com/' + s.instagram : '#';
    const tiktok = s.tiktok ? 'https://tiktok.com/@' + s.tiktok : '#';
    const facebook = s.facebook ? 'https://facebook.com/' + s.facebook : '#';
    const wa = s.whatsapp ? waLink(s.whatsapp, 'Olá Kianda! 🌊 Tenho uma pergunta sobre as bolsas.') : '#';

    if (s.announcement) $('#topbar-text').textContent = s.announcement;
    if (s.heroTitle) $('#hero-title').innerHTML = s.heroTitle;
    if (s.heroSubtitle) $('#hero-subtitle').textContent = s.heroSubtitle;

    ['#nav-wa', '#hero-wa', '#wa-float', '#foot-wa'].forEach((sel) => {
      const el = $(sel);
      if (el) el.href = wa;
    });
    if (s.whatsapp) $('#foot-wa-num').textContent = '+244 ' + s.whatsapp.slice(-9).replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
    $('#foot-mail').href = 'mailto:' + (s.email || 'ola@kianda.co.ao');
    $('#foot-mail-addr').textContent = s.email || 'ola@kianda.co.ao';

    $('#insta-handle').textContent = s.instagram || 'kianda.bolsas';
    ['#insta-link-1', '#insta-link-2', '#insta-link-3', '#insta-link-4', '#insta-follow'].forEach((sel) => {
      $(sel).href = insta;
    });
    $('#insta-follow span').textContent = s.instagram || 'kianda.bolsas';
    $('#soc-ig').href = insta;
    $('#soc-tt').href = tiktok;
    $('#soc-fb').href = facebook;
    $('#soc-wa').href = wa;

    if (s.freeShippingFrom) {
      $('#faq-delivery').textContent =
        `Entregamos em Luanda em 24–48h. A entrega é grátis para compras acima de ${fmt(s.freeShippingFrom)}; abaixo disso, o valor é combinado no WhatsApp conforme a zona.`;
    }
    if (s.paymentInfo) $('#faq-payment').textContent = s.paymentInfo;
    if (s.deliveryInfo) $('#mp-info').textContent = '🚚 ' + s.deliveryInfo + ' · 💳 ' + (s.paymentInfo || '');
  }

  /* ---------- newsletter ---------- */
  $('#newsletter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#newsletter-email').value;
    toast('Bem-vinda à família Kianda! 🌊 ' + email + ' vai receber as novidades.', 'ok');
    e.target.reset();
  });

  /* ---------- navegação mobile ---------- */
  const burger = $('#burger');
  const nav = $('#site-nav');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------- header com sombra ao rolar ---------- */
  window.addEventListener('scroll', () => {
    $('#site-header').classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---------- arranque ---------- */
  async function init() {
    try {
      const [prod, set] = await Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);
      state.products = prod.products || [];
      state.settings = set.site || {};
      applySettings();
      renderFilters();
      renderGrid();
      $('#foot-year').textContent = new Date().getFullYear();
    } catch (err) {
      console.error('Kianda init error', err);
      toast('Não foi possível carregar a loja. Recarrega a página.', 'err');
    }
  }
  init();
})();
````

---


## 📄 FICHEIRO 12/12 — `public/js/admin.js`

**Onde:** em public/js/ (nome: public/js/admin.js)

**Passos:** Add file → Create new file → cola `public/js/admin.js` como nome → cola isto abaixo → Commit changes

````text
/* ============================================================
   KIANDA — Painel Admin (front-end)
   Todas as alterações são enviadas para a API, que as grava
   PERMANENTEMENTE em ficheiros dentro do projeto (data/*.json)
   e em public/img/products/ para as fotos.
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const TOKEN_KEY = 'kianda_admin_token';

  const api = {
    headers(extra) {
      return Object.assign(
        { 'Content-Type': 'application/json' },
        { 'x-admin-token': localStorage.getItem(TOKEN_KEY) || '' },
        extra || {}
      );
    },
    async req(method, url, body) {
      const res = await fetch(url, { method, headers: this.headers(), body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        logout(true);
        throw new Error('Sessão expirada. Inicia sessão novamente.');
      }
      if (!res.ok) throw new Error(data.error || 'Erro na operação.');
      return data;
    },
  };

  let products = [];
  let orders = [];
  let settings = {};
  let editingId = null;
  let currentImage = '';

  /* ---------- toast ---------- */
  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- login ---------- */
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn');
    btn.disabled = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#login-pass').value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Senha incorreta.');
      localStorage.setItem(TOKEN_KEY, data.token);
      enterAdmin();
    } catch (err) {
      $('#login-err').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#logout').addEventListener('click', () => logout(false));
  function logout(expired) {
    localStorage.removeItem(TOKEN_KEY);
    $('#admin-view').classList.add('hidden');
    $('#login-view').classList.remove('hidden');
    if (expired) $('#login-err').textContent = 'A tua sessão expirou. Entra novamente.';
  }

  function enterAdmin() {
    $('#login-view').classList.add('hidden');
    $('#admin-view').classList.remove('hidden');
    loadAll();
  }

  /* ---------- navegação por separadores ---------- */
  $$('.sb-nav button').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.sb-nav button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      $$('.tab').forEach((t) => t.classList.remove('active'));
      $('#tab-' + b.dataset.tab).classList.add('active');
    })
  );
  $$('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const target = b.dataset.go;
      $$('.sb-nav button').forEach((x) => x.classList.toggle('active', x.dataset.tab === target));
      $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + target));
      if (target === 'products' && b.dataset.action === 'new') openProductModal(null);
    })
  );

  /* ---------- carregar dados ---------- */
  async function loadAll() {
    try {
      const [p, o, s] = await Promise.all([
        api.req('GET', '/api/products'),
        api.req('GET', '/api/orders'),
        api.req('GET', '/api/settings'),
      ]);
      products = p.products || [];
      orders = o.orders || [];
      settings = s.site || {};
      renderDashboard();
      renderProducts();
      renderOrders();
      fillSettingsForm();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    $('#st-products').textContent = products.length;
    $('#st-stock').textContent = products.filter((p) => p.stock).length;
    $('#st-featured').textContent = products.filter((p) => p.featured).length;
    $('#st-orders').textContent = orders.length;
    $('#orders-pill').textContent = orders.filter((o) => o.status === 'Nova').length;
  }

  /* ---------- produtos ---------- */
  const fmt = (v) => Math.round(Number(v) || 0).toLocaleString('pt-AO').replace(/,/g, '.') + ' Kz';

  function renderProducts() {
    const list = $('#prod-list');
    if (!products.length) {
      list.innerHTML = '<div class="empty-state"><span class="big">👜</span>Ainda não tens produtos. Clica em "+ Novo produto" para começar!</div>';
      return;
    }
    list.innerHTML = products
      .map(
        (p, i) => `
      <div class="prod-row ${p.stock ? '' : 'sold'}">
        <img src="${p.image}" alt="" onerror="this.style.opacity=.25">
        <div>
          <div class="prod-name">${p.name} ${p.featured ? '⭐' : ''}</div>
          <div class="prod-cat">${p.category} ${p.badge ? '· ' + p.badge : ''}</div>
        </div>
        <div class="prod-price">${fmt(p.price)}${p.oldPrice ? `<s>${fmt(p.oldPrice)}</s>` : ''}</div>
        <div>
          ${p.stock
            ? '<span class="status-chip" style="background:#E8F6EE;color:var(--ok)">Em stock</span>'
            : '<span class="status-chip" style="background:#FDEBEA;color:var(--danger)">ESGOTADO</span>'}
        </div>
        <div class="prod-actions">
          <button class="icon-btn" data-move="${p.id}" data-dir="-1" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-move="${p.id}" data-dir="1" title="Descer" ${i === products.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-edit="${p.id}" title="Editar">✏️</button>
          <button class="icon-btn danger" data-del="${p.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`
      )
      .join('');

    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => openProductModal(b.dataset.edit)));
    $$('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const p = products.find((x) => x.id === b.dataset.del);
        if (!confirm(`Eliminar "${p.name}" definitivamente?`)) return;
        try {
          await api.req('DELETE', '/api/admin/products/' + b.dataset.del);
          toast('Produto eliminado.', 'ok');
          loadAll();
        } catch (err) {
          toast(err.message, 'err');
        }
      })
    );
    $$('[data-move]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.req('POST', `/api/admin/products/${b.dataset.move}/move`, { dir: Number(b.dataset.dir) });
          loadAll();
        } catch (err) {
          toast(err.message, 'err');
        }
      })
    );
  }

  /* ---------- modal de produto ---------- */
  function openProductModal(id) {
    editingId = id || null;
    const p = id ? products.find((x) => x.id === id) : null;
    $('#pm-title').textContent = p ? 'Editar: ' + p.name : 'Novo produto';
    $('#pf-id').value = p ? p.id : '';
    $('#pf-name').value = p ? p.name : '';
    $('#pf-category').value = p ? p.category : 'Bolsas';
    $('#pf-price').value = p ? p.price : '';
    $('#pf-old').value = p && p.oldPrice ? p.oldPrice : '';
    $('#pf-badge').value = p ? p.badge : '';
    $('#pf-desc').value = p ? p.description : '';
    $('#pf-gallery').value = p && p.gallery && p.gallery.length ? p.gallery.join('\n') : '';
    $('#pf-featured').checked = p ? !!p.featured : false;
    $('#pf-stock').checked = p ? p.stock !== false : true;
    currentImage = p ? p.image : '';
    $('#pf-img-preview').src = currentImage || '';
    $('#pf-img-preview').style.opacity = currentImage ? 1 : 0.2;
    $('#pf-img-url').value = currentImage;
    $('#pf-img-status').textContent = '';
    $('#pf-delete').hidden = !p;
    $('#pmodal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    $('#pmodal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  $$('#pmodal [data-close]').forEach((el) => el.addEventListener('click', closeProductModal));

  $('#btn-new-product').addEventListener('click', () => openProductModal(null));

  /* carregar foto do computador */
  $('#pf-img-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $('#pf-img-status').textContent = 'A enviar foto...';
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const out = await api.req('POST', '/api/admin/upload', { dataUrl });
      currentImage = out.url;
      $('#pf-img-preview').src = currentImage;
      $('#pf-img-preview').style.opacity = 1;
      $('#pf-img-url').value = currentImage;
      $('#pf-img-status').textContent = '✅ Foto enviada e gravada permanentemente!';
      toast('Foto carregada!', 'ok');
    } catch (err) {
      $('#pf-img-status').textContent = 'Erro: ' + err.message;
      toast(err.message, 'err');
    }
    e.target.value = '';
  });

  /* colar URL */
  $('#pf-img-url').addEventListener('input', (e) => {
    currentImage = e.target.value.trim();
    if (currentImage) {
      $('#pf-img-preview').src = currentImage;
      $('#pf-img-preview').style.opacity = 1;
    }
  });

  /* guardar */
  $('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentImage) return toast('Escolhe uma foto para o produto.', 'err');
    const body = {
      name: $('#pf-name').value.trim(),
      category: $('#pf-category').value.trim() || 'Bolsas',
      price: Number($('#pf-price').value) || 0,
      oldPrice: $('#pf-old').value ? Number($('#pf-old').value) : null,
      badge: $('#pf-badge').value.trim(),
      description: $('#pf-desc').value.trim(),
      image: currentImage,
      gallery: $('#pf-gallery').value.split('\n').map((s) => s.trim()).filter(Boolean),
      featured: $('#pf-featured').checked,
      stock: $('#pf-stock').checked,
    };
    const btn = $('#pf-save');
    btn.disabled = true;
    try {
      if (editingId) {
        await api.req('PUT', '/api/admin/products/' + editingId, body);
        toast('Produto atualizado — alteração permanente! ✅', 'ok');
      } else {
        await api.req('POST', '/api/admin/products', body);
        toast('Produto adicionado ao catálogo! 🎉', 'ok');
      }
      closeProductModal();
      loadAll();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });

  $('#pf-delete').addEventListener('click', async () => {
    if (!confirm('Eliminar este produto definitivamente?')) return;
    try {
      await api.req('DELETE', '/api/admin/products/' + editingId);
      closeProductModal();
      toast('Produto eliminado.', 'ok');
      loadAll();
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  /* ---------- pedidos ---------- */
  function renderOrders() {
    const list = $('#orders-list');
    if (!orders.length) {
      list.innerHTML = '<div class="empty-state"><span class="big">📦</span>Ainda não há pedidos pelo site.<br>Quando uma cliente fizer um pedido no formulário, aparece aqui.</div>';
      return;
    }
    list.innerHTML = orders
      .map((o) => {
        const items = o.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
        return `
      <div class="order-card">
        <div class="order-head">
          <div>
            <span class="order-id">${o.id}</span>
            <span class="status-chip status-${o.status.replace(/\s+/g, '')}">${o.status}</span>
          </div>
          <span class="order-date">${new Date(o.createdAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        <p class="order-items"><strong>${o.items.reduce((t, i) => t + i.qty, 0)} artigos</strong> — ${items}</p>
        <p class="order-total">Total: ${fmt(o.total)}</p>
        <div class="order-meta">
          <div><b>Cliente</b>${o.name} · ${o.phone}</div>
          <div><b>Entrega</b>${o.address || '—'}</div>
          <div><b>Pagamento</b>${o.payment}</div>
          ${o.notes ? `<div><b>Notas</b>${o.notes}</div>` : ''}
        </div>
        <div class="order-foot">
          <a class="btn small" target="_blank" rel="noopener"
             href="https://wa.me/${String(o.phone).replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + o.name + '! 🌊 Aqui é da Kianda. Recebemos o teu pedido ' + o.id + ' (total ' + fmt(o.total) + '). Podemos confirmar a entrega?')}">
             💬 Falar com a cliente
          </a>
          <select data-status="${o.id}">
            ${['Nova', 'Confirmado', 'Entregue', 'Cancelado'].map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="icon-btn danger" data-delorder="${o.id}" title="Eliminar pedido">🗑️</button>
        </div>
      </div>`;
      })
      .join('');

    $$('[data-status]').forEach((sel) =>
      sel.addEventListener('change', async () => {
        try {
          await api.req('PUT', `/api/admin/orders/${sel.dataset.status}/status`, { status: sel.value });
          toast('Estado atualizado.', 'ok');
          loadAll();
        } catch (err) {
          toast(err.message, 'err');
        }
      })
    );
    $$('[data-delorder]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Eliminar este pedido?')) return;
        try {
          await api.req('DELETE', '/api/admin/orders/' + b.dataset.delorder);
          toast('Pedido eliminado.', 'ok');
          loadAll();
        } catch (err) {
          toast(err.message, 'err');
        }
      })
    );
  }

  /* ---------- definições ---------- */
  function fillSettingsForm() {
    const f = $('#settings-form');
    Object.keys(settings).forEach((k) => {
      const el = f.elements[k];
      if (el) el.value = settings[k] != null ? settings[k] : '';
    });
  }

  $('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    Object.keys(e.target.elements).forEach((k) => {
      const el = e.target.elements[k];
      if (el.name && el.type !== 'submit') body[el.name] = el.value;
    });
    if (body.freeShippingFrom) body.freeShippingFrom = Number(body.freeShippingFrom);
    try {
      const out = await api.req('PUT', '/api/admin/settings', body);
      settings = out.site;
      $('#settings-note').textContent = '✅ Guardado — já está vivo na loja!';
      setTimeout(() => ($('#settings-note').textContent = ''), 3500);
      toast('Definições guardadas!', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  $('#pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#new-pass').value;
    try {
      const out = await api.req('POST', '/api/admin/password', { password: pw });
      localStorage.setItem(TOKEN_KEY, out.token);
      e.target.reset();
      toast('Senha alterada com sucesso! 🔒', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  /* ---------- backup & restauro ---------- */
  $('#btn-backup').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/backup', {
        headers: { 'x-admin-token': localStorage.getItem(TOKEN_KEY) || '' },
      });
      if (res.status === 401) return logout(true);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kianda-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      $('#backup-note').textContent = '✅ Backup descarregado. Guarda-o num sítio seguro!';
      toast('Backup feito! 💾', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  $('#restore-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Isto vai SUBSTITUIR os produtos, pedidos e definições atuais pelos do backup. Continuar?')) {
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const out = await api.req('POST', '/api/admin/restore', { backup });
      $('#backup-note').textContent = '✅ Restaurado: ' + (out.restored || []).join(', ');
      toast('Backup restaurado com sucesso!', 'ok');
      loadAll();
    } catch (err) {
      $('#backup-note').textContent = 'Erro: ' + err.message;
      toast(err.message, 'err');
    }
    e.target.value = '';
  });

  /* ---------- arranque ---------- */
  if (localStorage.getItem(TOKEN_KEY)) enterAdmin();
})();
````

---


## 🖼️ FICHEIRO 13/13 — As FOTOS (não se colam, carregam-se)

Estas 41 fotos não são texto — tens de as **carregar como ficheiros** (não colar):

1. **1 foto de capa:** `public/img/hero.jpg`

2. **40 fotos dos produtos:** `public/img/products/kd-01.jpg` … `kd-40.jpg`


**Como carregar (2 opções):**

- **Computador (mais fácil):** abre a pasta `public/img/` do ZIP → entra em cada pasta e arrasta as fotos para a página de upload do GitHub (ou arrasta a pasta inteira `products/` — o GitHub aceita pastas arrastadas).

- **Telemóvel:** GitHub → entra na pasta `public` → `img` → `products` (cria com Add file se não existirem) → **Add file → Upload files** → escolhe as 40 fotos da galeria → Commit. Repete para `hero.jpg`.


> 💡 Sem as fotos, o site abre mas as imagens dos produtos ficam vazias. Com as fotos, fica completo.

> 💡 As fontes (`public/fonts/`) são opcionais: se não as carregares, o site usa tipografia alternativa. Podes carregá-las depois arrastando a pasta `fonts/`.
