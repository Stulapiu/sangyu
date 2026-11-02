/* ============================================================
   桑榆智援 · 通用 UI 组件（toast / modal / 图标）
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- 图标 ---------------- */
  const P = 'stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    mic: '<path d="M12 3.6a3.1 3.1 0 0 1 3.1 3.1v5.1a3.1 3.1 0 1 1-6.2 0V6.7A3.1 3.1 0 0 1 12 3.6Z" ' + P + '/><path d="M5.6 11.2v.7a6.4 6.4 0 0 0 12.8 0v-.7M12 18.3v2.1" ' + P + '/>',
    keyboard: '<rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2.2" ' + P + '/><path d="M6.4 9.8h.01M9.6 9.8h.01M12.8 9.8h.01M16 9.8h.01M6.4 12.9h.01M9.6 12.9h.01M12.8 12.9h.01M16 12.9h.01M7.8 15.7h8.4" ' + P + '/>',
    pen: '<path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8V20Z" ' + P + '/><path d="M14.4 6.4l3.2 3.2" ' + P + '/>',
    search: '<circle cx="11" cy="11" r="6.4" ' + P + '/><path d="M16 16l4 4" ' + P + '/>',
    bell: '<path d="M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.1 1.4 5.6 1.4 5.6H5s1.4-1.5 1.4-5.6Z" ' + P + '/><path d="M10 18.4a2.1 2.1 0 0 0 4 0" ' + P + '/>',
    logout: '<path d="M14.6 7.8V5.6A1.6 1.6 0 0 0 13 4H6.2A1.6 1.6 0 0 0 4.6 5.6v12.8A1.6 1.6 0 0 0 6.2 20H13a1.6 1.6 0 0 0 1.6-1.6v-2.2" ' + P + '/><path d="M9.8 12h10.4M17.2 8.8L20.4 12l-3.2 3.2" ' + P + '/>',
    settings: '<circle cx="12" cy="12" r="3.1" ' + P + '/><path d="M12 3.4v2M12 18.6v2M4.8 7.8l1.7 1M17.5 15.2l1.7 1M4.8 16.2l1.7-1M17.5 8.8l1.7-1" ' + P + '/>',
    close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" ' + P + '/>',
    arrow: '<path d="M4.8 12h14.4M14 6.8l5.2 5.2-5.2 5.2" ' + P + '/>',
    phone: '<path d="M8.2 4.6h-2A1.8 1.8 0 0 0 4.4 6.6c0 7 6 13 13 13a1.8 1.8 0 0 0 2-2v-2l-4-1.6-1.8 2A14.6 14.6 0 0 1 8.2 8.6l2-1.8L8.2 4.6Z" ' + P + '/>',
    check: '<path d="M4.8 12.6l4.6 4.6L19.4 7.2" ' + P + '/>',
    alert: '<path d="M12 4.4l8.4 14.6H3.6L12 4.4Z" ' + P + '/><path d="M12 9.6v4M12 16.4h.01" ' + P + '/>',
    plus: '<path d="M12 5v14M5 12h14" ' + P + '/>',
    download: '<path d="M12 4.4v10.2M7.6 10.6L12 15l4.4-4.4M4.8 19.2h14.4" ' + P + '/>',
    send: '<path d="M20.4 3.6L10.6 13.4M20.4 3.6l-6.2 17-3.6-7.2-7.2-3.6 17-6.2Z" ' + P + '/>',
    video: '<rect x="2.8" y="6.4" width="12.4" height="11.2" rx="2.2" ' + P + '/><path d="M15.2 11l6-3.2v8.4l-6-3.2v-2Z" ' + P + '/>',
    user: '<circle cx="12" cy="8.4" r="3.6" ' + P + '/><path d="M4.8 20c0-3.6 3.2-6 7.2-6s7.2 2.4 7.2 6" ' + P + '/>',
    users: '<circle cx="9.2" cy="8.6" r="3.2" ' + P + '/><path d="M3.2 19.4c0-3.2 2.7-5.4 6-5.4s6 2.2 6 5.4" ' + P + '/><path d="M16 5.6a3.2 3.2 0 0 1 0 6.2M17.4 14.2c2 .6 3.4 2.2 3.4 4.4" ' + P + '/>',
    grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="1.6" ' + P + '/><rect x="13.4" y="3.6" width="7" height="7" rx="1.6" ' + P + '/><rect x="3.6" y="13.4" width="7" height="7" rx="1.6" ' + P + '/><rect x="13.4" y="13.4" width="7" height="7" rx="1.6" ' + P + '/>',
    inbox: '<path d="M4 13.6V6.2A1.6 1.6 0 0 1 5.6 4.6h12.8A1.6 1.6 0 0 1 20 6.2v7.4" ' + P + '/><path d="M4 13.6h4l1.2 2.2h5.6L16 13.6h4v4.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.2Z" ' + P + '/>',
    chart: '<path d="M4.4 19.4V4.6M4.4 19.4h15.2" ' + P + '/><path d="M8 15.4v-4M12.4 15.4V7.6M16.8 15.4v-6" ' + P + '/>',
    pulse: '<path d="M3 12.4h3.6l2.2-5.6 4 11.2 2.4-5.6H21" ' + P + '/>',
    shield: '<path d="M12 3.6l7 2.6v5.4c0 4.4-2.9 7.4-7 8.8-4.1-1.4-7-4.4-7-8.8V6.2l7-2.6Z" ' + P + '/><path d="M9 12l2.2 2.2L15.4 10" ' + P + '/>',
    clock: '<circle cx="12" cy="12" r="8" ' + P + '/><path d="M12 7.6V12l3 1.8" ' + P + '/>',
    pin: '<path d="M12 21s6.4-6 6.4-11.2A6.4 6.4 0 0 0 5.6 9.8C5.6 15 12 21 12 21Z" ' + P + '/><circle cx="12" cy="9.8" r="2.4" ' + P + '/>',
    file: '<path d="M13.4 3.6H7A1.6 1.6 0 0 0 5.4 5.2v13.6A1.6 1.6 0 0 0 7 20.4h10a1.6 1.6 0 0 0 1.6-1.6V8.8l-5.2-5.2Z" ' + P + '/><path d="M13.4 3.6v5.2h5.2M8.8 13h6.4M8.8 16.4h4.4" ' + P + '/>',
    spark: '<path d="M12 3.4l1.9 5.2 5.2 1.9-5.2 1.9L12 17.6l-1.9-5.2L4.9 10.5l5.2-1.9L12 3.4Z" ' + P + '/>',
    sun: '<circle cx="12" cy="12" r="4" ' + P + '/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" ' + P + '/>',
    hand: '<path d="M8.6 11V5.8a1.6 1.6 0 0 1 3.2 0V11m0-1.4a1.6 1.6 0 0 1 3.2 0V12m0-1.2a1.6 1.6 0 0 1 3.2 0v5.2a5.4 5.4 0 0 1-5.4 5.4h-1.2a5 5 0 0 1-3.6-1.5l-3.3-3.4a1.7 1.7 0 0 1 2.4-2.4l1.5 1.5" ' + P + '/>',
    fuel: '<path d="M12 3.2s5.2 5.4 5.2 9.2a5.2 5.2 0 0 1-10.4 0C6.8 8.6 12 3.2 12 3.2Z" ' + P + '/>',
    edit: '<path d="M4.6 19.4l.8-3.6L15.6 5.6a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.6 18.8l-4 .6Z" ' + P + '/><path d="M14.4 6.8l3.2 3.2" ' + P + '/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7" ' + P + '/><path d="M20.4 4.4v4.2h-4.2" ' + P + '/>'
  };

  function icon(name, size) {
    const s = size || 18;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" style="flex:none">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------------- Toast ---------------- */
  function toastWrap() {
    let w = document.querySelector('.toast-wrap');
    if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; document.body.appendChild(w); }
    return w;
  }
  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.innerHTML = (type === 'ok' ? icon('check', 15) : type === 'err' ? icon('alert', 15) : '') +
      '<span>' + msg + '</span>';
    toastWrap().appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  /* ---------------- Modal ---------------- */
  let openCount = 0;
  function modal(o) {
    o = o || {};
    const mask = document.createElement('div');
    mask.className = 'mask';
    mask.innerHTML =
      '<div class="modal ' + (o.size === 'lg' ? 'modal--lg' : o.size === 'sm' ? 'modal--sm' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-hd">' +
          '<div><h3>' + (o.title || '') + '</h3>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + '</div>' +
          '<button class="icon-btn" data-close aria-label="关闭">' + icon('close', 15) + '</button>' +
        '</div>' +
        '<div class="modal-bd">' + (o.body || '') + '</div>' +
        (o.footer === null ? '' : '<div class="modal-ft">' + (o.footer || '<button class="btn btn--ghost" data-close>关闭</button>') + '</div>') +
      '</div>';

    document.body.appendChild(mask);
    document.body.style.overflow = 'hidden';
    openCount++;

    const close = () => {
      mask.classList.add('out');
      setTimeout(() => {
        mask.remove();
        openCount = Math.max(0, openCount - 1);
        if (!openCount) document.body.style.overflow = '';
      }, 210);
      document.removeEventListener('keydown', onKey);
      o.onClose && o.onClose();
    };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    mask.addEventListener('click', e => {
      if (e.target === mask) return close();
      if (e.target.closest('[data-close]')) close();
    });

    const api = { el: mask, body: mask.querySelector('.modal-bd'), close };
    o.onMount && o.onMount(api);
    return api;
  }

  function confirm(o) {
    return new Promise(resolve => {
      const m = modal({
        title: o.title || '确认操作',
        sub: o.sub || '',
        size: 'sm',
        body: '<p class="lead" style="font-size:14px">' + (o.text || '') + '</p>',
        footer:
          '<button class="btn btn--ghost" data-no>' + (o.cancelText || '取消') + '</button>' +
          '<button class="btn ' + (o.danger ? 'btn--danger' : '') + '" data-yes>' + (o.okText || '确认') + '</button>',
        onClose: () => resolve(false),
        onMount: api => {
          api.el.querySelector('[data-yes]').addEventListener('click', () => {
            api.el.querySelector('[data-yes]').disabled = true;
            resolve(true);
            const m2 = api.el;
            m2.classList.add('out');
            setTimeout(() => { m2.remove(); document.body.style.overflow = ''; openCount = Math.max(0, openCount - 1); }, 200);
          });
          api.el.querySelector('[data-no]').addEventListener('click', () => { resolve(false); api.close(); });
        }
      });
      void m;
    });
  }

  global.UI = { icon, ICONS, toast, modal, confirm };
})(window);
