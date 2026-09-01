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
