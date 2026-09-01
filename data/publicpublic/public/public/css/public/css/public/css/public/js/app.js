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
