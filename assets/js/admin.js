/* ============================================================
   社区端 · 工作台逻辑
   ============================================================ */
(function () {
  'use strict';

  const ses = SY.requireRole('admin');
  if (!ses) return;

  const $ = s => document.querySelector(s);
  const V = $('#view');
  const esc = SY.escapeHtml;
  const I = UI.icon;

  const TYPE_COLOR = {
    '助餐': '#C99433', '水电故障': '#36689C', '家电维修': '#63548C',
    '健康咨询': '#457A56', '居家保洁': '#B5763F', '政策咨询': '#7A8B5E',
    '家政': '#9C6B8E', '其他': '#9AA3AD'
  };
  const URG_TONE = { '紧急': 'red', '较急': 'amber', '一般': '' };

  const state = {
    route: 'dashboard',
    trendDays: 14,
    inbox: { q: '', status: '全部', type: '全部', urgentOnly: false },
    elders: { q: '' }
  };

  /* ============================================================
     图表
     ============================================================ */
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0].x + ',' + pts[0].y;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
    }
    return d;
  }

  function areaChart(data) {
    const W = 660, H = 208, pl = 28, pr = 12, pt = 16, pb = 26;
    const iw = W - pl - pr, ih = H - pt - pb;
    const maxRaw = Math.max.apply(null, data.map(d => Math.max(d.count, d.done)).concat([2]));
    const max = Math.max(4, Math.ceil(maxRaw / 4) * 4);
    const n = data.length;
    const x = i => pl + (n <= 1 ? iw / 2 : iw * i / (n - 1));
    const y = v => pt + ih - (v / max) * ih;
    const p1 = data.map((d, i) => ({ x: x(i), y: y(d.count) }));
    const p2 = data.map((d, i) => ({ x: x(i), y: y(d.done) }));
    const line1 = smoothPath(p1), line2 = smoothPath(p2);
    const area = line1 + ' L' + p1[n - 1].x.toFixed(1) + ',' + (pt + ih) + ' L' + p1[0].x.toFixed(1) + ',' + (pt + ih) + ' Z';

    let grid = '';
    for (let g = 0; g <= 4; g++) {
      const gy = (pt + ih * g / 4).toFixed(1);
      const gv = Math.round(max * (4 - g) / 4);
      grid += '<line x1="' + pl + '" y1="' + gy + '" x2="' + (W - pr) + '" y2="' + gy + '" stroke="#F0ECE3" stroke-width="1"/>' +
        '<text x="' + (pl - 7) + '" y="' + (+gy + 3.4) + '" text-anchor="end" font-size="9.5" fill="#BFC6CF" font-family="Bahnschrift,Segoe UI">' + gv + '</text>';
    }

    let labs = '';
    const step = Math.ceil(n / 8);
    data.forEach((d, i) => {
      if (i % step === 0 || i === n - 1) {
        labs += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9.5" fill="#BFC6CF" font-family="Bahnschrift,Segoe UI">' + d.label + '</text>';
      }
    });

    const uid = 'ga' + Math.random().toString(36).slice(2, 7);
    return '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#C99433" stop-opacity=".24"/>' +
      '<stop offset="1" stop-color="#C99433" stop-opacity="0"/></linearGradient></defs>' +
      grid +
      '<path d="' + area + '" fill="url(#' + uid + ')"/>' +
      '<path d="' + line2 + '" fill="none" stroke="#2E4767" stroke-width="1.5" stroke-dasharray="4 4" opacity=".5"/>' +
      '<path d="' + line1 + '" fill="none" stroke="#C99433" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + p1[n - 1].x.toFixed(1) + '" cy="' + p1[n - 1].y.toFixed(1) + '" r="4" fill="#fff" stroke="#C99433" stroke-width="2.2"/>' +
      labs + '</svg>';
  }

  function barChart(items, colorOf) {
    const W = 660, H = 212, pl = 28, pr = 8, pt = 14, pb = 40;
    const iw = W - pl - pr, ih = H - pt - pb;
    const max = Math.max.apply(null, items.map(d => d.count).concat([2]));
    const bw = Math.min(34, iw / items.length * 0.52);
    let bars = '';
    items.forEach((d, i) => {
      const cx = pl + iw * (i + 0.5) / items.length;
      const h = (d.count / max) * ih;
      const y = pt + ih - h;
      bars += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) +
        '" height="' + Math.max(2, h).toFixed(1) + '" rx="5" fill="' + (colorOf ? colorOf(d) : '#C99433') + '" opacity=".88"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="#56657A" font-family="Bahnschrift,Segoe UI">' + d.count + '</text>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (H - 22) + '" text-anchor="middle" font-size="9.8" fill="#8B97A6">' + d.label + '</text>';
    });
    return '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<line x1="' + pl + '" y1="' + (pt + ih) + '" x2="' + (W - pr) + '" y2="' + (pt + ih) + '" stroke="#F0ECE3" stroke-width="1"/>' +
      bars + '</svg>';
  }

  function donutChart(items, total) {
    const R = 52, C = 2 * Math.PI * R;
    let acc = 0, segs = '';
    items.forEach(it => {
      const len = total ? C * it.count / total : 0;
      if (len <= 0) return;
      const rot = -90 + (acc / C) * 360;
      segs += '<circle cx="76" cy="76" r="' + R + '" fill="none" stroke="' + (TYPE_COLOR[it.type] || '#9AA3AD') +
        '" stroke-width="16" stroke-dasharray="' + Math.max(1, len - 2.5).toFixed(2) + ' ' + (C - Math.max(1, len - 2.5)).toFixed(2) +
        '" transform="rotate(' + rot.toFixed(2) + ' 76 76)"/>';
      acc += len;
    });
    return '<svg viewBox="0 0 152 152" style="width:100%;max-width:160px;height:auto;display:block;margin:0 auto">' +
      '<circle cx="76" cy="76" r="52" fill="none" stroke="#F5F2EA" stroke-width="16"/>' + segs +
      '<text x="76" y="72" text-anchor="middle" font-size="27" font-weight="600" fill="#12233A" font-family="Bahnschrift,Segoe UI">' + total + '</text>' +
      '<text x="76" y="90" text-anchor="middle" font-size="9.5" fill="#B9C1CB" letter-spacing="1.4">工单总数</text></svg>';
  }

  /* ============================================================
     路由
     ============================================================ */
  const PAGES = {
    dashboard: { title: '总览', sub: '今日社区养老诉求与处置情况', render: renderDashboard },
    inbox: { title: '诉求接收', sub: '工单收件箱 · 分类、派单与协同处置', render: renderInbox },
    analytics: { title: '数据分析', sub: '诉求分布、响应效率与重复求助识别', render: renderAnalytics },
    elders: { title: '老人档案', sub: '档案录入、画像与政策匹配', render: renderElders },
    insights: { title: '研判预警', sub: '风险预警 · 群体共性 · 前置帮扶建议', render: renderInsights },
    settings: { title: '设置', sub: '语音识别服务与数据管理', render: renderSettings }
  };

  function currentRoute() {
    const h = (location.hash || '').replace('#', '');
    return PAGES[h] ? h : 'dashboard';
  }

  function go(route, opts) {
    state.route = route;
    if (opts && opts.inbox) Object.assign(state.inbox, opts.inbox);
    if (location.hash.replace('#', '') === route) render();
    else location.hash = route;
  }

  function render() {
    const route = currentRoute();
    state.route = route;
    const page = PAGES[route];
    $('#pageTitle').textContent = page.title;
    $('#pageSub').textContent = page.sub;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.route === route));
    V.innerHTML = '';
    page.render(V);
    updateBadges();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function updateBadges() {
    const s = SY.stats();
    const risk = SY.riskList();
    const p = $('#navPending'), a = $('#navAlerts'), b = $('#bellCount');
    p.textContent = s.pending;
    p.classList.toggle('hot', s.pending > 0);
    a.textContent = risk.filter(r => r.level === '高').length;
    const n = s.pending + risk.length;
    b.textContent = n > 99 ? '99+' : n;
    b.style.display = n ? 'grid' : 'none';
  }

  /* ============================================================
     总览
     ============================================================ */
  function statCard(o) {
    return '<div class="stat ' + (o.hot ? 'stat--hot' : '') + '">' +
      '<div class="lb">' + (o.icon ? I(o.icon, 13) : '') + o.label + '</div>' +
      '<div class="v">' + o.value + (o.unit ? '<small>' + o.unit + '</small>' : '') + '</div>' +
      '<div class="ft">' + (o.foot || '') + '</div>' +
      '</div>';
  }

  function renderDashboard(root) {
    const s = SY.stats();
    const yest = SY.trend(2)[0].count;
    const diff = s.today - yest;
    const diffTxt = diff === 0
      ? '与昨日持平'
      : '<span class="' + (diff > 0 ? 'up' : 'dn') + '">' + (diff > 0 ? '+' : '') + diff + '</span> 较昨日';

    const risk = SY.riskList();
    const hot = SY.tickets()
      .filter(t => t.status !== '已完成')
      .sort((a, b) => {
        const w = { '紧急': 0, '较急': 1, '一般': 2 };
        return (w[a.urgency] - w[b.urgency]) || (a.createdAt - b.createdAt);
      })
      .slice(0, 4);

    const types = SY.byType();
    const trendData = SY.trend(state.trendDays);

    root.innerHTML =
      '<div class="stats">' +
      statCard({ label: '今日诉求', value: s.today, unit: '件', icon: 'inbox', foot: diffTxt }) +
      statCard({ label: '待接单', value: s.pending, unit: '件', icon: 'clock', hot: true, foot: s.urgent ? '<span class="up">' + s.urgent + '</span> 件紧急需优先处理' : '暂无紧急件' }) +
      statCard({ label: '平均响应', value: s.avgResponse, unit: '分钟', icon: 'pulse', foot: '从提交到接单的平均时长' }) +
      statCard({ label: '办结率', value: s.completionRate, unit: '%', icon: 'check', foot: '累计 ' + s.done + ' / ' + s.total + ' 件已办结' }) +
      '</div>' +

      '<div class="grid-dash">' +
      '<div class="panel">' +
      '<div class="panel-hd"><div><h3>诉求趋势</h3><div class="sub">每日提交量与办结量</div></div>' +
      '<div class="seg" id="trendSeg">' +
      [7, 14, 30].map(d => '<button data-d="' + d + '"' + (state.trendDays === d ? ' class="on"' : '') + '>' + d + ' 天</button>').join('') +
      '</div></div>' +
      '<div class="panel-bd" id="trendBox">' + areaChart(trendData) + '</div>' +
      '<div class="legend" style="padding:0 20px 16px">' +
      '<div class="it"><i style="background:#C99433"></i>提交量 <b>' + trendData.reduce((a, b) => a + b.count, 0) + '</b></div>' +
      '<div class="it"><i style="background:#2E4767"></i>办结量 <b>' + trendData.reduce((a, b) => a + b.done, 0) + '</b></div>' +
      '</div></div>' +

      '<div class="panel">' +
      '<div class="panel-hd"><div><h3>诉求类型分布</h3><div class="sub">按 AI 自动分类统计</div></div></div>' +
      '<div class="panel-bd">' + donutChart(types, s.total) +
      '<div class="legend" style="margin-top:14px">' +
      types.slice(0, 6).map(t => '<div class="it"><i style="background:' + TYPE_COLOR[t.type] + '"></i>' + t.type + ' <b>' + t.count + '</b></div>').join('') +
      '</div></div></div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="panel">' +
      '<div class="panel-hd"><div><h3>待处理工单</h3><div class="sub">按紧急程度排序</div></div>' +
      '<button class="link-btn" data-go="inbox">全部工单 →</button></div>' +
      '<div class="panel-bd">' +
      (hot.length ? hot.map(t =>
        '<div class="alert-item' + (t.urgency === '紧急' ? ' high' : '') + '" data-ticket="' + t.id + '" style="cursor:pointer">' +
        '<div class="lv">' + (t.urgency === '紧急' ? '急' : t.urgency === '较急' ? '较' : '普') + '</div>' +
        '<div class="tx"><div class="t">' + esc(t.content) + '</div>' +
        '<div class="d">' + t.elderName + ' · ' + t.building + t.unit + ' · ' + t.type + '</div>' +
        '<div class="k">' + SY.fromNow(t.createdAt) + ' · ' + t.source + '上报 · ' + t.id + '</div></div>' +
        '<span class="tag tag--' + SY.STATUS[t.status].tone + '">' + t.status + '</span>' +
        '</div>').join('')
        : '<div class="blk-empty">' + I('check', 22) + '<span>暂无待处理工单</span></div>') +
      '</div></div>' +

      '<div class="panel">' +
      '<div class="panel-hd"><div><h3>风险预警</h3><div class="sub">AI 研判生成，建议人工复核</div></div>' +
      '<button class="link-btn" data-go="insights">研判详情 →</button></div>' +
      '<div class="panel-bd">' +
      (risk.length ? risk.slice(0, 3).map(r =>
        '<div class="alert-item' + (r.level === '高' ? ' high' : '') + '">' +
        '<div class="lv">' + (r.level === '高' ? '高' : '中') + '</div>' +
        '<div class="tx"><div class="t">' + esc(r.title) + '</div>' +
        '<div class="d">' + esc(r.desc).slice(0, 58) + '…</div>' +
        '<div class="k">' + r.kind + ' · ' + SY.fromNow(r.at) + '</div></div>' +
        '</div>').join('')
        : '<div class="blk-empty">' + I('shield', 22) + '<span>暂无预警</span></div>') +
      '</div></div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="panel">' +
      '<div class="panel-hd"><div><h3>楼栋诉求热力</h3><div class="sub">近 7 天，颜色越深诉求越集中</div></div></div>' +
      '<div class="panel-bd" id="heatBox"></div></div>' +
      '<div class="panel">' +
      '<div class="panel-hd"><div><h3>上报方式</h3><div class="sub">语音是否真的降低了上报门槛</div></div></div>' +
      '<div class="panel-bd" id="sourceBox"></div>' +
      '<div style="padding:0 20px 16px;font-size:11px;color:var(--slate-l);line-height:1.7">' +
      '语音上报占比越高，说明越多的诉求是通过「说一句」进入系统的，这正是设计要验证的核心假设。</div>' +
      '</div></div>' +

      '<div class="panel" style="margin-top:14px">' +
      '<div class="panel-bd" style="padding:14px 20px;display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--slate-l);line-height:1.7">' +
      I('alert', 15) +
      '<span>当前为参赛原型环境，全部老人档案、工单与预警均为<b style="color:var(--slate)">模拟脱敏数据</b>，未接入真实社区业务系统；语音识别与智能体接口的接入位置见「设置」。</span>' +
      '</div></div>';

    drawHeat($('#heatBox'));
    drawSource($('#sourceBox'));

    root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    root.querySelectorAll('[data-ticket]').forEach(el => el.addEventListener('click', () => openDrawer(el.dataset.ticket)));
    const seg = $('#trendSeg');
    seg.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        state.trendDays = +b.dataset.d;
        seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        $('#trendBox').innerHTML = areaChart(SY.trend(state.trendDays));
      });
    });
  }

  function drawHeat(box) {
    if (!box) return;
    const h = SY.heatByBuilding();
    const maxV = Math.max(1, ...h.rows.map(b => Math.max(...h.cols.map(c => h.value(b, c.key)))));
    let html = '<div class="heat" style="grid-template-columns:58px repeat(' + h.cols.length + ',1fr)">';
    html += '<div></div>' + h.cols.map(c => '<div class="heat-lab" style="text-align:center">' + c.label + '</div>').join('');
    h.rows.forEach(b => {
      html += '<div class="heat-lab">' + b + '</div>';
      h.cols.forEach(c => {
        const v = h.value(b, c.key);
        const lv = v === 0 ? 0 : v <= maxV * 0.25 ? 1 : v <= maxV * 0.5 ? 2 : v <= maxV * 0.75 ? 3 : 4;
        html += '<div class="heat-cell' + (lv ? ' l' + lv : '') + '" title="' + b + ' ' + c.label + '：' + v + ' 件">' + (v || '') + '</div>';
      });
    });
    html += '</div>';
    box.innerHTML = html;
  }

  function drawSource(box) {
    if (!box) return;
    const list = SY.bySource();
    const total = list.reduce((a, b) => a + b.count, 0) || 1;
    const color = { '语音': '#C99433', '打字': '#36689C', '手写': '#63548C', '紧急': '#B0403A' };
    box.innerHTML = '<div style="display:flex;flex-direction:column;gap:11px">' +
      list.map(x => {
        const pct = Math.round(x.count / total * 100);
        return '<div class="mini-bar"><span class="lb" style="width:36px">' + x.source + '</span>' +
          '<span class="tr" style="height:9px"><span class="fi" style="width:' + pct + '%;background:' + color[x.source] + '"></span></span>' +
          '<span class="v" style="width:34px">' + pct + '%</span></div>';
      }).join('') + '</div>';
  }

  /* ============================================================
     诉求接收
     ============================================================ */
  function inboxFiltered() {
    const f = state.inbox;
    const q = f.q.trim().toLowerCase();
    return SY.tickets().filter(t => {
      if (f.status !== '全部' && t.status !== f.status) return false;
      if (f.type !== '全部' && t.type !== f.type) return false;
      if (f.urgentOnly && t.urgency !== '紧急') return false;
      if (q) {
        const hay = (t.content + ' ' + t.elderName + ' ' + t.id + ' ' + t.type + ' ' + t.building).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }

  function renderInbox(root) {
    const f = state.inbox;
    const list = inboxFiltered();
    const statuses = ['全部', '待接单', '已接单', '处理中', '已完成'];

    root.innerHTML =
      '<div class="toolbar">' +
      '<div class="seg" id="stSeg">' +
      statuses.map(s => '<button data-st="' + s + '"' + (f.status === s ? ' class="on"' : '') + '>' + s +
        (s === '待接单' ? ' ' + SY.stats().pending : '') + '</button>').join('') +
      '</div>' +
      '<select class="select" id="typeSel">' +
      '<option value="全部">全部类型</option>' +
      SY.TYPE_LIST.map(t => '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + t + '</option>').join('') +
      '</select>' +
      '<button class="btn btn--ghost btn--sm" id="urgToggle" style="' + (f.urgentOnly ? 'border-color:var(--neg);color:var(--neg);background:var(--neg-bg)' : '') + '">只看紧急</button>' +
      '<div class="grow"></div>' +
      '<div class="search"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.4" stroke="currentColor" stroke-width="1.7"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      '<input class="input" id="inboxQ" placeholder="搜内容、姓名、工单号" value="' + esc(f.q) + '"></div>' +
      '<span class="cnt-label">共 <b class="num" style="color:var(--ink)">' + list.length + '</b> 条</span>' +
      '</div>' +

      '<div class="ticket-list">' +
      '<div class="tk-head"><span></span><span>诉求内容</span><span>老人 / 楼栋</span><span>类型</span><span>来源</span><span>状态</span><span>时间</span></div>' +
      (list.length ? list.map(t =>
        '<div class="tk" data-ticket="' + t.id + '">' +
        '<div class="urg ' + (t.urgency === '紧急' ? '' : 'n') + '">' + (t.urgency === '紧急' ? '急' : t.urgency === '较急' ? '较' : '·') + '</div>' +
        '<div class="c"><div class="t">' + esc(t.content) + '</div>' +
        '<div class="m">' + t.id + (t.repeated ? ' · 重复求助' : '') + (t.escalated ? ' · 置顶' : '') + '</div></div>' +
        '<div class="who">' + t.elderName + '<small>' + t.building + ' ' + t.unit + '</small></div>' +
        '<div><span class="tag" style="background:' + TYPE_COLOR[t.type] + '14;color:' + TYPE_COLOR[t.type] + ';border-color:' + TYPE_COLOR[t.type] + '30">' + t.type + '</span></div>' +
        '<div><span class="tag tag--' + (SY.SOURCE_TONE[t.source] || '') + '">' + t.source + '</span></div>' +
        '<div><span class="tag tag--' + SY.STATUS[t.status].tone + '">' + t.status + '</span></div>' +
        '<div class="tm">' + SY.fromNow(t.createdAt) + '</div>' +
        '</div>').join('')
        : '<div class="empty" style="padding:56px 20px"><div class="ico">' + I('inbox', 20) + '</div><p>没有符合条件的工单</p></div>') +
      '</div>';

    root.querySelectorAll('#stSeg button').forEach(b => b.addEventListener('click', () => {
      state.inbox.status = b.dataset.st;
      renderInbox(root);
    }));
    $('#typeSel').addEventListener('change', e => { state.inbox.type = e.target.value; renderInbox(root); });
    $('#urgToggle').addEventListener('click', () => {
      state.inbox.urgentOnly = !state.inbox.urgentOnly;
      renderInbox(root);
    });
    const q = $('#inboxQ');
    let timer = null;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.inbox.q = q.value;
        renderInbox(root);
        const nq = $('#inboxQ'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length);
      }, 260);
    });
    root.querySelectorAll('[data-ticket]').forEach(el => el.addEventListener('click', () => openDrawer(el.dataset.ticket)));
  }

  /* ============================================================
     工单抽屉
     ============================================================ */
  let drawerEl = null, drawerMask = null, drawerId = null;

  function closeDrawer() {
    if (drawerMask) { drawerMask.remove(); drawerMask = null; }
    if (drawerEl) { drawerEl.remove(); drawerEl = null; }
    document.body.style.overflow = '';
    drawerId = null;
  }

  function openDrawer(id) {
    const t = SY.ticketById(id);
    if (!t) return;
    closeDrawer();
    drawerId = id;

    drawerMask = document.createElement('div');
    drawerMask.className = 'drawer-mask';
    drawerEl = document.createElement('div');
    drawerEl.className = 'drawer';
    document.body.appendChild(drawerMask);
    document.body.appendChild(drawerEl);
    document.body.style.overflow = 'hidden';
    drawerMask.addEventListener('click', closeDrawer);

    paintDrawer();
  }

  function paintDrawer() {
    const t = SY.ticketById(drawerId);
    if (!t || !drawerEl) return;
    const elder = SY.elderById(t.elderId) || {};
    const staff = SY.staffById(t.assignee);
    const cur = SY.STATUS[t.status].step;

    const steps = [
      { lb: '提交诉求', at: t.createdAt },
      { lb: '社区接单', at: t.acceptedAt },
      { lb: '上门 / 处理中', at: t.processingAt },
      { lb: '办结', at: t.doneAt }
    ];

    const risk = SY.riskList().filter(r => r.elderId === t.elderId);

    drawerEl.innerHTML =
      '<div class="drawer-hd">' +
      '<div style="flex:1;min-width:0"><div class="t">' + t.type + ' · ' + t.elderName + '</div>' +
      '<div class="m">' + t.id + ' · ' + SY.fmtTime(t.createdAt, true) + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">' +
      '<span class="tag tag--' + SY.STATUS[t.status].tone + '">' + t.status + '</span>' +
      '<span class="tag tag--' + (SY.SOURCE_TONE[t.source] || '') + '">' + t.source + '上报</span>' +
      '<span class="tag tag--' + (URG_TONE[t.urgency] || '') + '">' + (t.urgency || '一般') + '</span>' +
      (t.repeated ? '<span class="tag tag--red">重复求助</span>' : '') +
      (t.escalated ? '<span class="tag tag--red">置顶强提醒</span>' : '') +
      '</div></div>' +
      '<button class="icon-btn" data-close>' + I('close', 15) + '</button>' +
      '</div>' +

      '<div class="drawer-bd">' +
      '<div class="d-sec"><div class="lb">诉求原文</div>' +
      '<div class="d-quote">' + esc(t.content) + '</div>' +
      '<div class="d-tags">' +
      '<span class="tag tag--amber">AI 分类：' + t.type + '</span>' +
      (t.aiTags || []).map(g => '<span class="tag">' + esc(g) + '</span>').join('') +
      '<span class="tag">紧急度：' + (t.urgency || '一般') + '</span>' +
      '</div></div>' +

      (risk.length ? '<div class="d-sec"><div class="lb">该老人风险提示</div>' +
        risk.slice(0, 2).map(r => '<div class="alert-item' + (r.level === '高' ? ' high' : '') + '" style="margin-bottom:6px">' +
          '<div class="lv">' + (r.level === '高' ? '高' : '中') + '</div>' +
          '<div class="tx"><div class="t">' + esc(r.title) + '</div><div class="d">' + esc(r.desc).slice(0, 60) + '…</div></div>' +
          '</div>').join('') + '</div>' : '') +

      '<div class="d-sec"><div class="lb">老人档案</div>' +
      '<div class="d-kv">' +
      '<div><div class="k">姓名 / 年龄</div><div class="v">' + (elder.name || '—') + ' / ' + (elder.age || '—') + ' 岁</div></div>' +
      '<div><div class="k">档案编号</div><div class="v">' + (elder.id || '—') + '</div></div>' +
      '<div style="grid-column:1/-1"><div class="k">住址</div><div class="v">' + (elder.address || '—') + '</div></div>' +
      '<div><div class="k">紧急联系人</div><div class="v">' + (elder.guardian || '—') + '</div></div>' +
      '<div><div class="k">联系电话</div><div class="v">' + (elder.phone || '—') + '</div></div>' +
      '<div style="grid-column:1/-1"><div class="k">关怀标签</div><div class="v" style="font-weight:500">' + ((elder.tags || []).join(' · ') || '—') + '</div></div>' +
      '</div></div>' +

      '<div class="d-sec"><div class="lb">处置进度<span style="font-weight:500;letter-spacing:0;color:var(--slate-l)">' +
      (staff ? '负责人 ' + staff.name : '尚未指派') + '</span></div>' +
      '<div class="timeline">' +
      steps.map((s, i) => {
        const cls = i < cur ? 'done' : i === cur ? (t.status === '已完成' ? 'done' : 'on') : '';
        return '<div class="tl ' + cls + '"><div class="rail"><div class="d"></div></div>' +
          '<div class="tx"><b>' + s.lb + '</b><span>' + (s.at ? SY.fmtTime(s.at) : '—') + '</span></div></div>';
      }).join('') +
      '</div></div>' +

      '<div class="d-sec"><div class="lb">双向沟通<span style="font-weight:500;letter-spacing:0;color:var(--slate-l)">文字 / 语音留言</span></div>' +
      '<div class="chat">' +
      '<div class="chat-list" id="chatList">' +
      ((t.messages || []).length ? t.messages.map(m => {
        if (m.from === 'system') return '<div class="msg sys"><div class="b">' + esc(m.text) + '</div></div>';
        return '<div class="msg ' + (m.from === 'admin' ? 'me' : '') + '">' +
          '<div class="b">' + esc(m.text) + '</div>' +
          '<div class="tm2">' + SY.fmtClock(m.at) + '</div></div>';
      }).join('') : '<div class="blk-empty" style="padding:16px">还没有沟通记录，可以先给老人打个电话</div>') +
      '</div>' +
      '<div class="chat-input">' +
      '<input class="input" id="chatInput" placeholder="给老人或家属发条消息…">' +
      '<button class="btn btn--sm" id="chatSend">发送</button>' +
      '</div></div></div>' +

      '<div class="d-sec"><div class="lb">备注</div>' +
      '<div style="font-size:12.5px;color:var(--slate);line-height:1.8">' +
      (t.note ? esc(t.note) : '<span style="color:var(--slate-xl)">暂无备注。可在派单或转派时补充说明。</span>') +
      '</div></div>' +

      '</div>' +

      '<div class="drawer-ft">' +
      (t.status === '待接单'
        ? '<button class="btn btn--amber" data-act="accept">接单</button>'
        : t.status === '已完成'
          ? '<span class="tag tag--green" style="height:32px">已办结</span>'
          : '<button class="btn btn--amber" data-act="advance">' + (t.status === '已接单' ? '开始处理' : '标记办结') + '</button>') +
      '<button class="btn btn--ghost btn--sm" data-act="transfer">转派</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="remote">' + I('video', 14) + ' 远程协助</button>' +
      '<span style="flex:1"></span>' +
      (elder.phone ? '<a class="btn btn--soft btn--sm" href="tel:' + elder.phone.replace(/\*/g, '') + '">' + I('phone', 14) + ' 电话</a>' : '') +
      '</div>';

    drawerEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeDrawer));

    const act = drawerEl.querySelectorAll('[data-act]');
    act.forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.act;
        if (a === 'accept') {
          SY.acceptTicket(t.id);
          UI.toast('已接单，已按类型自动指派给 ' + (SY.staffById(SY.assigneeFor(t.type)) || {}).name, 'ok');
          paintDrawer(); refreshAfterChange();
        } else if (a === 'advance') {
          const nx = SY.advanceTicket(t.id);
          UI.toast('工单状态已更新为「' + nx.status + '」', 'ok');
          paintDrawer(); refreshAfterChange();
        } else if (a === 'transfer') {
          openTransfer(t.id);
        } else if (a === 'remote') {
          openRemote(t);
        }
      });
    });

    const send = drawerEl.querySelector('#chatSend');
    const input = drawerEl.querySelector('#chatInput');
    function doSend() {
      const v = input.value.trim();
      if (!v) return;
      SY.addMessage(t.id, 'admin', v);
      input.value = '';
      paintDrawer();
    }
    send.addEventListener('click', doSend);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });

    const cl = drawerEl.querySelector('#chatList');
    if (cl) cl.scrollTop = cl.scrollHeight;
  }

  function refreshAfterChange() {
    if (state.route === 'inbox') renderInbox(V);
    else if (state.route === 'dashboard') renderDashboard(V);
    updateBadges();
  }

  function openTransfer(ticketId) {
    const t = SY.ticketById(ticketId);
    UI.modal({
      title: '转派工单',
      sub: t.id + ' · 当前 ' + (SY.staffById(t.assignee) ? SY.staffById(t.assignee).name : '未指派'),
      body:
        '<div class="field" style="margin-bottom:14px"><label>转派给</label>' +
        '<select class="select" id="tfSel">' +
        SY.staff().map(s => '<option value="' + s.id + '"' + (s.id === t.assignee ? ' selected' : '') + '>' +
          s.name + ' · ' + s.role + '（' + s.org + '）</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>转派原因（会记录在工单里）</label>' +
        '<textarea class="textarea" id="tfReason" placeholder="例如：涉及电路，需维修组上门处理"></textarea></div>',
      footer: '<button class="btn btn--ghost" data-close>取消</button><button class="btn btn--amber" id="tfGo">确认转派</button>',
      onMount(api) {
        api.el.querySelector('#tfGo').addEventListener('click', () => {
          const sid = api.el.querySelector('#tfSel').value;
          const reason = api.el.querySelector('#tfReason').value.trim();
          SY.transferTicket(ticketId, sid, reason);
          api.close();
          UI.toast('已转派给 ' + SY.staffById(sid).name, 'ok');
          paintDrawer();
        });
      }
    });
  }

  function openRemote(t) {
    const elder = SY.elderById(t.elderId) || {};
    UI.modal({
      title: '远程协助',
      sub: '屏幕共享 / 视频通话 · ' + (elder.name || '') + ' ' + (elder.building || ''),
      size: 'lg',
      body:
        '<div class="card--flush" style="border-radius:14px;overflow:hidden;background:#0E1C2E;position:relative;aspect-ratio:16/9;display:grid;place-items:center">' +
        '<video id="rmVideo" autoplay muted playsinline style="width:100%;height:100%;object-fit:contain;display:none"></video>' +
        '<div id="rmPh" style="text-align:center;color:rgba(243,239,230,.55);padding:20px">' +
        '<div style="font-size:13px;letter-spacing:.12em;margin-bottom:6px">远程协助通道</div>' +
        '<div style="font-size:12px;line-height:1.8;max-width:380px" id="rmHint">点击下方按钮发起屏幕共享，帮老人在线办理业务。</div>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">' +
        '<button class="btn btn--amber btn--sm" id="rmShare">' + I('video', 14) + ' 发起屏幕共享</button>' +
        '<button class="btn btn--ghost btn--sm" id="rmStop">结束</button>' +
        '<span style="flex:1"></span><span class="tag" id="rmStatus">未连接</span>' +
        '</div>' +
        '<p class="hw-note" style="margin-top:12px">屏幕共享依赖浏览器安全上下文，需通过 https 或 localhost 打开本页面；直接双击 HTML 文件打开时浏览器会拒绝授权，此处会给出提示。</p>',
      footer: '<button class="btn btn--ghost" data-close>关闭</button>',
      onMount(api) {
        const video = api.el.querySelector('#rmVideo');
        const ph = api.el.querySelector('#rmPh');
        const status = api.el.querySelector('#rmStatus');
        let stream = null;
        api.el.querySelector('#rmShare').addEventListener('click', async () => {
          status.textContent = '连接中…';
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            video.srcObject = stream;
            video.style.display = 'block';
            ph.style.display = 'none';
            status.textContent = '共享中';
            status.className = 'tag tag--green';
            stream.getVideoTracks()[0].addEventListener('ended', () => {
              status.textContent = '已结束'; status.className = 'tag';
              video.style.display = 'none'; ph.style.display = 'grid';
            });
            SY.addMessage(t.id, 'system', '已发起远程协助（屏幕共享）。');
          } catch (err) {
            status.textContent = '不可用';
            api.el.querySelector('#rmHint').innerHTML =
              '当前环境无法获取屏幕共享权限。<br>请通过 <b style="color:#E2B45F">localhost 或 https</b> 打开页面后重试。';
            UI.toast('屏幕共享不可用：' + (err.name || '未授权'), 'warn');
          }
        });
        api.el.querySelector('#rmStop').addEventListener('click', () => {
          if (stream) stream.getTracks().forEach(x => x.stop());
          video.style.display = 'none'; ph.style.display = 'grid';
          status.textContent = '已结束'; status.className = 'tag';
        });
      }
    });
  }

  /* ============================================================
     数据分析
     ============================================================ */
  function renderAnalytics(root) {
    const s = SY.stats();
    const types = SY.byType();
    const buildings = SY.byBuilding();
    const respType = SY.responseByType();
    const repeats = SY.repeatTickets();
    const ledger = SY.monthlyLedger();
    const trendData = SY.trend(14);

    root.innerHTML =
      '<div class="stats">' +
      statCard({ label: '累计工单', value: s.total, unit: '件', icon: 'file', foot: '覆盖 ' + s.residents + ' 位在册老人' }) +
      statCard({ label: '平均响应', value: s.avgResponse, unit: '分钟', icon: 'clock', foot: '接单口径，不含办结时长' }) +
      statCard({ label: '办结率', value: s.completionRate, unit: '%', icon: 'check', foot: '已完成 ' + s.done + ' 件' }) +
      statCard({ label: '重复求助', value: s.repeated, unit: '件', icon: 'refresh', foot: s.repeated ? '建议复核处置是否彻底' : '暂未发现', hot: s.repeated > 3 }) +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="panel"><div class="panel-hd"><div><h3>诉求类型分布</h3><div class="sub">按 AI 自动分类</div></div></div>' +
      '<div class="panel-bd">' + barChart(types.map(t => ({ label: t.type, count: t.count })), d => {
        const k = types.find(x => x.type === d.label);
        return k ? TYPE_COLOR[k.type] : '#C99433';
      }) + '</div></div>' +

      '<div class="panel"><div class="panel-hd"><div><h3>楼栋诉求量</h3><div class="sub">定位共性问题集中的片区</div></div></div>' +
      '<div class="panel-bd" style="padding-top:6px">' +
      '<div class="mini-bars">' +
      buildings.map(b => {
        const max = Math.max.apply(null, buildings.map(x => x.count).concat([1]));
        return '<div class="mini-bar"><span class="lb">' + b.building + '</span>' +
          '<span class="tr" style="height:9px"><span class="fi" style="width:' + Math.round(b.count / max * 100) + '%"></span></span>' +
          '<span class="v">' + b.count + '</span></div>';
      }).join('') +
      '</div></div></div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="panel"><div class="panel-hd"><div><h3>近 14 天趋势</h3><div class="sub">提交量与办结量</div></div></div>' +
      '<div class="panel-bd">' + areaChart(trendData) +
      '<div class="legend" style="margin-top:4px">' +
      '<div class="it"><i style="background:#C99433"></i>提交量 <b>' + trendData.reduce((a, b) => a + b.count, 0) + '</b></div>' +
      '<div class="it"><i style="background:#2E4767"></i>办结量 <b>' + trendData.reduce((a, b) => a + b.done, 0) + '</b></div>' +
      '<div class="it" style="color:var(--slate-xl)">当日提交的工单尚未办结，因此两条线末端会出现差距</div>' +
      '</div></div></div>' +

      '<div class="panel"><div class="panel-hd"><div><h3>各类型平均响应</h3><div class="sub">单位：分钟</div></div></div>' +
      '<div class="panel-bd" style="padding-top:6px"><div class="mini-bars">' +
      respType.sort((a, b) => b.avg - a.avg).map(r => {
        const max = Math.max.apply(null, respType.map(x => x.avg).concat([1]));
        return '<div class="mini-bar"><span class="lb">' + r.type + '</span>' +
          '<span class="tr" style="height:9px"><span class="fi" style="width:' + Math.round(r.avg / max * 100) + '%;background:linear-gradient(90deg,#7FA0C4,#2E4767)"></span></span>' +
          '<span class="v" style="width:30px">' + r.avg + '</span></div>';
      }).join('') +
      '</div></div></div>' +
      '</div>' +

      '<div class="panel" style="margin-top:14px">' +
      '<div class="panel-hd"><div><h3>楼栋 × 日期热力</h3><div class="sub">近 7 天，用于识别同一楼栋的集中诉求</div></div></div>' +
      '<div class="panel-bd" id="heatBox2"></div></div>' +

      '<div class="grid-2">' +
      '<div class="panel"><div class="panel-hd"><div><h3>重复求助识别</h3><div class="sub">同一老人、同一类型 7 天内再次提交</div></div>' +
      '<span class="tag tag--' + (repeats.length ? 'red' : 'green') + '">' + repeats.length + ' 条</span></div>' +
      '<div class="panel-bd">' +
      (repeats.length ? repeats.slice(0, 5).map(t =>
        '<div class="alert-item high" data-ticket="' + t.id + '" style="cursor:pointer">' +
        '<div class="lv">重</div>' +
        '<div class="tx"><div class="t">' + esc(t.content) + '</div>' +
        '<div class="d">' + t.elderName + ' · ' + t.type + ' · ' + SY.fromNow(t.createdAt) + '</div>' +
        '<div class="k">原单 ' + (t.repeatOf || '—') + ' · 建议复核处置是否彻底</div></div>' +
        '</div>').join('')
        : '<div class="blk-empty">' + I('check', 22) + '<span>暂未发现重复求助</span></div>') +
      '</div></div>' +

      '<div class="panel"><div class="panel-hd"><div><h3>' + ledger.month + ' 月服务台账</h3><div class="sub">可导出为 CSV 供社区上报</div></div>' +
      '<button class="btn btn--soft btn--sm" id="btnExport">' + I('download', 13) + ' 导出</button></div>' +
      '<div class="panel-bd">' +
      '<div class="report-row"><span>本月诉求总量</span><span class="v">' + ledger.total + ' 件</span></div>' +
      '<div class="report-row"><span>已办结</span><span class="v">' + ledger.done + ' 件</span></div>' +
      '<div class="report-row"><span>平均响应时长</span><span class="v">' + ledger.avgResponse + ' 分钟</span></div>' +
      '<div class="report-row"><span>办结率</span><span class="v">' + (ledger.total ? Math.round(ledger.done / ledger.total * 100) : 0) + '%</span></div>' +
      '<div class="report-row"><span>诉求最集中类型</span><span class="v">' + (ledger.byType[0] ? ledger.byType[0].type : '—') + '</span></div>' +
      '<div style="margin-top:12px;font-size:11.5px;color:var(--slate-l);line-height:1.8">' +
      '台账字段包含工单编号、提交时间、老人、楼栋、类型、来源、状态、负责人、响应时长与诉求内容，导出后可直接用于月度复盘与资源申请。' +
      '</div></div></div>' +
      '</div>';

    drawHeat($('#heatBox2'));
    root.querySelectorAll('[data-ticket]').forEach(el => el.addEventListener('click', () => openDrawer(el.dataset.ticket)));
    $('#btnExport').addEventListener('click', () => {
      const csv = '\ufeff' + SY.csvOfLedger();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '桑榆智援-' + ledger.month + '月服务台账.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      UI.toast('台账已导出', 'ok');
    });
  }

  /* ============================================================
     老人档案
     ============================================================ */
  function renderElders(root) {
    const q = state.elders.q.trim().toLowerCase();
    const list = SY.elders().filter(e => {
      if (!q) return true;
      return (e.name + e.id + e.building + e.unit + (e.tags || []).join('')).toLowerCase().indexOf(q) > -1;
    });
    const risk = SY.riskList();

    root.innerHTML =
      '<div class="toolbar">' +
      '<div class="search"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.4" stroke="currentColor" stroke-width="1.7"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      '<input class="input" id="elderQ" placeholder="搜姓名、编号、楼栋、标签" value="' + esc(state.elders.q) + '"></div>' +
      '<div class="grow"></div>' +
      '<span class="cnt-label">在册 <b class="num" style="color:var(--ink)">' + list.length + '</b> 人</span>' +
      '<button class="btn btn--amber btn--sm" id="btnAddElder">' + I('plus', 14) + ' 录入档案</button>' +
      '</div>' +
      '<div class="el-grid">' +
      (list.length ? list.map(e => {
        const ts = SY.ticketsOf(e.id);
        const r = risk.filter(x => x.elderId === e.id);
        return '<div class="el-card" data-elder="' + e.id + '">' +
          (r.length ? '<span class="flag" title="存在风险提示"></span>' : '') +
          '<div class="top"><div class="ava">' + e.name.slice(0, 1) + '</div>' +
          '<div style="flex:1;min-width:0"><div class="nm">' + e.name + ' <span style="font-size:11px;color:var(--slate-l);font-weight:500">' + e.age + ' 岁 · ' + e.gender + '</span></div>' +
          '<div class="ad">' + e.building + ' ' + e.unit + '</div></div></div>' +
          '<div class="tags">' +
          '<span class="tag tag--' + (e.careLevel === '一般' ? '' : e.careLevel === '重点关注' ? 'amber' : 'red') + '">' + e.careLevel + '</span>' +
          (e.tags || []).slice(0, 2).map(t => '<span class="tag">' + t + '</span>').join('') +
          '</div>' +
          '<div class="ft"><span>诉求 <b>' + ts.length + '</b> 次</span>' +
          '<span>' + (ts[0] ? SY.fromNow(ts[0].createdAt) : '暂无记录') + '</span></div>' +
          '</div>';
      }).join('')
        : '<div class="empty" style="grid-column:1/-1;padding:56px"><div class="ico">' + I('users', 20) + '</div><p>没有匹配的老人档案</p></div>') +
      '</div>';

    const qEl = $('#elderQ');
    let timer = null;
    qEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.elders.q = qEl.value;
        renderElders(root);
        const n = $('#elderQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length);
      }, 240);
    });
    $('#btnAddElder').addEventListener('click', () => openElderForm(null));
    root.querySelectorAll('[data-elder]').forEach(el => el.addEventListener('click', () => openProfile(el.dataset.elder)));
  }

  function openProfile(id) {
    const e = SY.elderById(id);
    if (!e) return;
    const ts = SY.ticketsOf(id);
    const risk = SY.riskList().filter(r => r.elderId === id);
    const pols = SY.matchPolicies(e);
    const recent = ts.filter(t => Date.now() - t.createdAt < 30 * 86400000);
    const counts = {};
    recent.forEach(t => { counts[t.type] = (counts[t.type] || 0) + 1; });
    const maxC = Math.max.apply(null, Object.values(counts).concat([1]));

    UI.modal({
      title: '老人画像',
      sub: '档案编号 ' + e.id + ' · 建档于 ' + e.since,
      size: 'lg',
      body:
        '<div class="pf-hero"><div class="ava">' + e.name.slice(0, 1) + '</div>' +
        '<div style="flex:1"><div class="n">' + e.name + ' <span style="font-size:12px;color:var(--slate-l);font-weight:500">' + e.age + ' 岁 · ' + e.gender + ' · ' + e.careLevel + '</span></div>' +
        '<div class="m">' + e.address + '</div></div>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">' +
        (e.tags || []).map(t => '<span class="tag">' + t + '</span>').join('') + '</div></div>' +

        '<div class="grid-2" style="margin-top:0">' +
        '<div class="card card--pad" style="box-shadow:none">' +
        '<div class="lb" style="font-size:10.5px;letter-spacing:.14em;color:var(--slate-l);font-weight:700;margin-bottom:10px">近 30 天诉求结构</div>' +
        (Object.keys(counts).length ? '<div class="mini-bars">' +
          Object.keys(counts).map(k => '<div class="mini-bar"><span class="lb">' + k + '</span>' +
            '<span class="tr"><span class="fi" style="width:' + Math.round(counts[k] / maxC * 100) + '%"></span></span>' +
            '<span class="v">' + counts[k] + '</span></div>').join('') + '</div>'
          : '<div class="blk-empty" style="padding:20px 0">近 30 天无诉求</div>') +
        '<div style="margin-top:12px;font-size:11.5px;color:var(--slate-l);line-height:1.7">累计诉求 <b style="color:var(--ink)">' + ts.length + '</b> 次，' +
        (ts[0] ? '最近一次 ' + SY.fromNow(ts[0].createdAt) : '暂无记录') + '</div>' +
        '</div>' +
        '<div class="card card--pad" style="box-shadow:none">' +
        '<div class="lb" style="font-size:10.5px;letter-spacing:.14em;color:var(--slate-l);font-weight:700;margin-bottom:10px">匹配的政策资源</div>' +
        (pols.length ? pols.map(p => '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12.5px">' +
          '<span style="color:var(--amber-d)">' + I('shield', 13) + '</span>' + p.name + '</div>').join('')
          : '<div style="font-size:12px;color:var(--slate-l)">暂无匹配</div>') +
        '</div></div>' +

        (risk.length ? '<div class="d-sec" style="margin-top:16px"><div class="lb">风险提示</div>' +
          risk.map(r => '<div class="alert-item' + (r.level === '高' ? ' high' : '') + '">' +
            '<div class="lv">' + (r.level === '高' ? '高' : '中') + '</div>' +
            '<div class="tx"><div class="t">' + esc(r.title) + '</div><div class="d">' + esc(r.desc) + '</div></div></div>').join('') +
          '</div>' : '') +

        '<div class="d-sec" style="margin-top:16px"><div class="lb">联系与备注</div>' +
        '<div class="d-kv">' +
        '<div><div class="k">本人电话</div><div class="v">' + (e.phone || '—') + '</div></div>' +
        '<div><div class="k">紧急联系人</div><div class="v">' + (e.guardian || '—') + '</div></div>' +
        '<div><div class="k">联系人电话</div><div class="v">' + (e.guardianPhone || '—') + '</div></div>' +
        '<div><div class="k">所属网格</div><div class="v">' + e.grid + '</div></div>' +
        '<div style="grid-column:1/-1"><div class="k">备注</div><div class="v" style="font-weight:500">' + (e.note || '—') + '</div></div>' +
        '</div></div>' +

        '<div class="d-sec" style="margin-top:16px"><div class="lb">最近工单</div>' +
        (ts.length ? ts.slice(0, 4).map(t =>
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line-2);font-size:12.5px">' +
          '<span class="tag tag--' + SY.STATUS[t.status].tone + '">' + t.status + '</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.content) + '</span>' +
          '<span style="font-size:11px;color:var(--slate-l);font-family:var(--font-num)">' + SY.fmtTime(t.createdAt) + '</span></div>').join('')
          : '<div style="font-size:12px;color:var(--slate-l)">暂无工单记录</div>') +
        '</div>',
      footer: '<button class="btn btn--ghost" data-close>关闭</button><button class="btn btn--amber" data-edit>' + I('edit', 14) + ' 编辑档案</button>',
      onMount(api) {
        api.el.querySelector('[data-edit]').addEventListener('click', () => { api.close(); openElderForm(id); });
      }
    });
  }

  function openElderForm(id) {
    const e = id ? SY.elderById(id) : null;
    const v = k => e ? (e[k] == null ? '' : e[k]) : '';
    const fields = [
      { k: 'name', lb: '姓名', ph: '请输入姓名' },
      { k: 'age', lb: '年龄', ph: '例如 78', type: 'number' },
      { k: 'phone', lb: '本人电话', ph: '可脱敏填写' },
      { k: 'building', lb: '楼栋', ph: '例如 2号楼' },
      { k: 'unit', lb: '单元房号', ph: '例如 1单元302' },
      { k: 'guardian', lb: '紧急联系人', ph: '姓名 + 关系' },
      { k: 'guardianPhone', lb: '联系人电话', ph: '可脱敏填写' }
    ];
    UI.modal({
      title: e ? '编辑档案' : '录入老人档案',
      sub: e ? '编号 ' + e.id + ' · 修改后立即生效' : '录入后分配唯一 ID，老人即可用该 ID 登录老人端',
      size: 'lg',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">' +
        (e ? '' : '<div class="field" style="grid-column:1/-1"><label>档案编号（唯一 ID）</label>' +
          '<input class="input" id="f_id" placeholder="留空则自动生成，如 E1009"></div>') +
        fields.map(f =>
          '<div class="field"><label>' + f.lb + '</label>' +
          '<input class="input" id="f_' + f.k + '" type="' + (f.type || 'text') + '" placeholder="' + f.ph + '" value="' + esc(v(f.k)) + '"></div>').join('') +
        '<div class="field"><label>性别</label><select class="select" id="f_gender">' +
        '<option value="女"' + (v('gender') === '女' ? ' selected' : '') + '>女</option>' +
        '<option value="男"' + (v('gender') !== '女' ? ' selected' : '') + '>男</option></select></div>' +
        '<div class="field"><label>关怀等级</label><select class="select" id="f_careLevel">' +
        ['一般', '重点关注', '重点照护'].map(x => '<option value="' + x + '"' + (v('careLevel') === x ? ' selected' : '') + '>' + x + '</option>').join('') +
        '</select></div>' +
        '<div class="field" style="grid-column:1/-1"><label>住址</label>' +
        '<input class="input" id="f_address" placeholder="完整住址，用于紧急求助时推送给值班人员" value="' + esc(v('address')) + '"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>标签（用顿号或逗号分隔）</label>' +
        '<input class="input" id="f_tags" placeholder="独居、高血压、听力下降" value="' + esc((e && e.tags ? e.tags.join('、') : '')) + '"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>备注</label>' +
        '<textarea class="textarea" id="f_note" placeholder="沟通注意事项，例如语速、听力、家属情况">' + esc(v('note')) + '</textarea></div>' +
        '</div>',
      footer: '<button class="btn btn--ghost" data-close>取消</button><button class="btn btn--amber" id="fSave">保存档案</button>',
      onMount(api) {
        api.el.querySelector('#fSave').addEventListener('click', () => {
          const name = api.el.querySelector('#f_name').value.trim();
          if (!name) { UI.toast('请填写姓名', 'err'); return; }
          const data = {
            name,
            age: parseInt(api.el.querySelector('#f_age').value, 10) || 70,
            gender: api.el.querySelector('#f_gender').value,
            phone: api.el.querySelector('#f_phone').value.trim(),
            building: api.el.querySelector('#f_building').value.trim() || '1号楼',
            unit: api.el.querySelector('#f_unit').value.trim(),
            guardian: api.el.querySelector('#f_guardian').value.trim(),
            guardianPhone: api.el.querySelector('#f_guardianPhone').value.trim(),
            address: api.el.querySelector('#f_address').value.trim(),
            careLevel: api.el.querySelector('#f_careLevel').value,
            tags: api.el.querySelector('#f_tags').value.split(/[、,，\s]+/).filter(Boolean),
            note: api.el.querySelector('#f_note').value.trim()
          };
          if (!data.address) data.address = '金水区花园路 3 号院 ' + data.building + ' ' + data.unit;
          if (e) SY.updateElder(e.id, data);
          else {
            const nid = api.el.querySelector('#f_id').value.trim();
            if (nid) data.id = nid;
            SY.addElder(data);
          }
          api.close();
          UI.toast(e ? '档案已更新' : '档案已录入，初始密码 123456', 'ok');
          if (state.route === 'elders') renderElders(V);
        });
      }
    });
  }

  /* ============================================================
     研判预警
     ============================================================ */
  function renderInsights(root) {
    const all = SY.riskList();
    const personal = all.filter(r => r.kind !== '群体共性');
    const cluster = all.filter(r => r.kind === '群体共性');
    const season = SY.seasonHint();
    const multi = SY.multiRoleList();
    const highCount = personal.filter(r => r.level === '高').length;

    const summary = [
      { label: '在册老人', value: SY.elders().length, unit: '人', icon: 'users', foot: '覆盖 ' + SY.byBuilding().length + ' 个楼栋 · 5 个网格' },
      { label: '需关注个人', value: personal.length, unit: '人', icon: 'alert', foot: highCount ? highCount + ' 人需优先回访' : '暂无高优先个案', hot: highCount > 0 },
      { label: '群体共性问题', value: cluster.length, unit: '处', icon: 'grid', foot: '同楼栋、同类型集中出现' },
      { label: '建议上门', value: multi.length + personal.length, unit: '次', icon: 'pin', foot: '含主动巡检与多岗联合上门' }
    ];

    const personalPanel =
      '<div class="panel"><div class="panel-hd"><div><h3>个体风险预警</h3><div class="sub">基于诉求频次、类型变化与沉默期自动生成</div></div>' +
      '<span class="tag ' + (highCount ? 'tag--red' : 'tag--green') + '">' + (highCount ? highCount + ' 条高优先' : '状态平稳') + '</span></div>' +
      '<div class="panel-bd">' +
      (personal.length ? personal.map(r =>
        '<div class="alert-item' + (r.level === '高' ? ' high' : '') + '">' +
        '<div class="lv">' + (r.level === '高' ? '高' : '中') + '</div>' +
        '<div class="tx"><div class="t">' + esc(r.title) + '</div>' +
        '<div class="d">' + esc(r.desc) + '</div>' +
        '<div class="k">' + r.kind + ' · ' + SY.fromNow(r.at) + '</div>' +
        (r.elderId ? '<div style="margin-top:8px;display:flex;gap:6px">' +
          '<button class="btn btn--sm btn--amber" data-visit="' + r.elderId + '">安排上门</button>' +
          '<button class="btn btn--sm btn--ghost" data-elder="' + r.elderId + '">看档案</button></div>' : '') +
        '</div></div>').join('')
        : '<div class="blk-empty">' + I('shield', 24) + '<span>本期未发现个体风险信号</span></div>') +
      '</div></div>';

    const multiPanel =
      '<div class="panel"><div class="panel-hd"><div><h3>多角色协同建议</h3><div class="sub">同时存在健康与生活服务需求的老人</div></div>' +
      '<span class="tag">' + multi.length + ' 例</span></div>' +
      '<div class="panel-bd">' +
      (multi.length ? multi.map(m =>
        '<div class="alert-item">' +
        '<div class="lv">协</div>' +
        '<div class="tx"><div class="t">' + m.elderName + ' · ' + m.building + m.unit + '</div>' +
        '<div class="d">近 30 天涉及 ' + m.kinds.join('、') + ' 共 ' + m.count + ' 次诉求，建议卫生服务站与居家养老专员联合上门，减少重复打扰。</div>' +
        '<div class="k">建议由 2 个岗位协同</div></div>' +
        '<button class="btn btn--sm btn--ghost go" data-elder="' + m.elderId + '">档案</button>' +
        '</div>').join('')
        : '<div class="blk-empty">' + I('users', 22) + '<span>暂无需协同的个案</span></div>') +
      '</div></div>';

    const seasonPanel =
      '<div class="panel"><div class="panel-hd"><div><h3>季节性预判</h3><div class="sub">' + season.season + ' · 基于历史工单规律</div></div></div>' +
      '<div class="panel-bd">' +
      '<div class="card card--pad" style="background:linear-gradient(150deg,#FCFAF4,#F7F3E9);border-color:#EDE5D3">' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:var(--amber-d)">' +
      I('sun', 15) + season.title + '</div>' +
      '<p style="font-size:12px;line-height:1.8;color:var(--slate);margin-top:7px">' + season.text + '</p>' +
      (season.types.length ? '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
        season.types.map(t => '<span class="tag tag--amber">' + t + '</span>').join('') + '</div>' : '') +
      '</div></div></div>';

    const clusterPanel =
      '<div class="panel"><div class="panel-hd"><div><h3>群体共性与专项服务</h3><div class="sub">定位楼栋 / 片区的共性问题</div></div>' +
      '<span class="tag tag--amber">' + cluster.length + ' 处</span></div>' +
      '<div class="panel-bd">' +
      (cluster.length ? cluster.map(c =>
        '<div class="alert-item"><div class="lv">群</div>' +
        '<div class="tx"><div class="t">' + esc(c.title) + '</div>' +
        '<div class="d">' + esc(c.desc) + '</div>' +
        '<div class="k">建议：集中检修 / 专项义诊 / 政策宣讲，并同步调配人力</div></div></div>').join('')
        : '<div class="blk-empty">' + I('grid', 22) + '<span>暂无片区共性问题</span></div>') +
      '</div></div>';

    const policyPanel =
      '<div class="panel"><div class="panel-hd"><div><h3>政策主动推送</h3><div class="sub">按画像匹配，而非只在单次上报时匹配</div></div></div>' +
      '<div class="panel-bd">' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      SY.elders().slice(0, 6).map(e => {
        const ps = SY.matchPolicies(e);
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--line-2)">' +
          '<div style="width:28px;height:28px;border-radius:50%;background:#F1EDE3;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--ink-3);flex:none">' + e.name.slice(0, 1) + '</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600">' + e.name + ' <span style="font-weight:500;color:var(--slate-l);font-size:11px">' + e.age + ' 岁</span></div>' +
          '<div style="font-size:11px;color:var(--slate-l);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          (ps.slice(0, 2).map(p => p.name).join('、') || '暂无匹配') + '</div></div>' +
          '<button class="btn btn--sm btn--ghost" data-push="' + e.id + '">推送</button>' +
          '</div>';
      }).join('') +
      '</div></div></div>';

    root.innerHTML =
      '<div class="stats">' + summary.map(x => statCard(x)).join('') + '</div>' +
      '<div class="grid-a" style="align-items:start">' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + personalPanel + multiPanel + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + seasonPanel + clusterPanel + policyPanel + '</div>' +
      '</div>';

    root.querySelectorAll('[data-elder]').forEach(b => b.addEventListener('click', () => openProfile(b.dataset.elder)));
    root.querySelectorAll('[data-visit]').forEach(b => b.addEventListener('click', () => {
      const eid = b.dataset.visit;
      const e = SY.elderById(eid);
      UI.confirm({
        title: '安排主动上门',
        text: '将为 ' + e.name + '（' + e.building + e.unit + '）创建一条巡检工单，指派给网格员张桂芳，并立即出现在工单收件箱。',
        okText: '创建巡检单'
      }).then(ok => {
        if (!ok) return;
        SY.createTicket({
          elderId: eid,
          content: '【主动巡检】系统研判提示该老人存在风险信号，网格员上门核实生活状况与未表达的需求。',
          source: '其他', type: '其他', urgency: '一般', note: '由风险预警自动生成'
        });
        UI.toast('巡检工单已创建', 'ok');
        updateBadges();
      });
    }));
    root.querySelectorAll('[data-push]').forEach(b => b.addEventListener('click', () => {
      const e = SY.elderById(b.dataset.push);
      const ps = SY.matchPolicies(e);
      UI.toast('已向 ' + e.name + ' 推送 ' + ps.length + ' 项匹配政策', 'ok');
      b.textContent = '已推送'; b.disabled = true;
    }));
  }

  /* ============================================================
     设置
     ============================================================ */
  function renderSettings(root) {
    const cfg = Speech.loadConfig();
    const on = Speech.isConfigured();

    root.innerHTML =
      '<div class="grid-2" style="align-items:start">' +
      '<div class="panel"><div class="panel-hd"><div><h3>语音识别服务</h3><div class="sub">老人端语音输入所调用的接口</div></div>' +
      '<span class="tag ' + (on ? 'tag--green' : 'tag--amber') + '">' + (on ? '已接入' : '原型演示') + '</span></div>' +
      '<div class="panel-bd">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div class="field" style="grid-column:1/-1"><label>识别服务地址（Endpoint）</label>' +
      '<input class="input" id="s_endpoint" placeholder="https://your-asr/api/recognize" value="' + esc(cfg.endpoint) + '"></div>' +
      '<div class="field"><label>API Key</label><input class="input" id="s_key" type="password" placeholder="sk-..." value="' + esc(cfg.apiKey) + '"></div>' +
      '<div class="field"><label>AppID（可选）</label><input class="input" id="s_appid" placeholder="部分平台需要" value="' + esc(cfg.appId) + '"></div>' +
      '<div class="field"><label>方言</label><select class="select" id="s_dialect">' +
      '<option value="zhongyuan"' + (cfg.dialect === 'zhongyuan' ? ' selected' : '') + '>中原官话</option>' +
      '<option value="mandarin"' + (cfg.dialect === 'mandarin' ? ' selected' : '') + '>普通话</option></select></div>' +
      '<div class="field"><label>手写识别地址（可选）</label><input class="input" id="s_hw" placeholder="https://your-ocr/api" value="' + esc(cfg.handwritingEndpoint) + '"></div>' +
      '</div>' +
      '<div style="margin-top:14px;padding:12px 14px;background:var(--paper);border:1px dashed var(--line);border-radius:10px;font-size:11.5px;line-height:1.8;color:var(--slate)">' +
      '接口约定：<b>POST</b> FormData（audio / format / dialect），返回 <code>{ "text": "..." }</code>。' +
      '填写后老人端会从「原型演示」自动切换为真实调用，无需改动页面代码。' +
      '</div>' +
      '<div style="display:flex;gap:9px;margin-top:14px">' +
      '<button class="btn btn--amber btn--sm" id="s_save">保存配置</button>' +
      '<button class="btn btn--ghost btn--sm" id="s_clear">清空服务配置</button>' +
      '</div></div></div>' +

      '<div>' +
      '<div class="panel"><div class="panel-hd"><div><h3>账号</h3><div class="sub">当前登录身份</div></div></div>' +
      '<div class="panel-bd">' +
      '<div class="d-kv">' +
      '<div><div class="k">工号</div><div class="v">' + ses.id + '</div></div>' +
      '<div><div class="k">姓名</div><div class="v">' + ses.name + '</div></div>' +
      '<div><div class="k">角色</div><div class="v">网格员</div></div>' +
      '<div><div class="k">所属</div><div class="v">' + (ses.org || '第三网格') + '</div></div>' +
      '</div>' +
      '<div style="margin-top:12px;font-size:11.5px;color:var(--slate-l);line-height:1.8">' +
      '工号与职责范围一一对应：登录后仅能看到本网格的工单与档案（原型中为全量演示）。</div>' +
      '</div></div>' +

      '<div class="panel" style="margin-top:14px"><div class="panel-hd"><div><h3>演示数据</h3><div class="sub">用于反复演示与调试</div></div></div>' +
      '<div class="panel-bd">' +
      '<div style="font-size:12px;color:var(--slate);line-height:1.8;margin-bottom:12px">' +
      '当前共 ' + SY.elders().length + ' 位老人、' + SY.tickets().length + ' 条工单，全部为模拟脱敏数据。重置后会恢复初始状态，你自己提交的工单会被清空。' +
      '</div>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
      '<button class="btn btn--ghost btn--sm" id="s_reset">' + I('refresh', 13) + ' 重置演示数据</button>' +
      '<a class="btn btn--ghost btn--sm" href="elder.html" target="_blank">在老人端查看</a>' +
      '</div></div></div>' +

      '<div class="panel" style="margin-top:14px"><div class="panel-hd"><div><h3>关于</h3></div></div>' +
      '<div class="panel-bd" style="font-size:11.5px;color:var(--slate-l);line-height:1.9">' +
      '桑榆智援 · 社区养老诉求智能体<br>郑州大学首届 AI 智能体创新应用大赛 · 参赛原型<br>' +
      '当前版本仍在开发中，前端与智能体接口尚未完成联调。' +
      '</div></div>' +
      '</div></div>';

    $('#s_save').addEventListener('click', () => {
      const ep = $('#s_endpoint').value.trim();
      Speech.saveConfig({
        provider: ep ? 'custom' : 'mock',
        endpoint: ep,
        apiKey: $('#s_key').value.trim(),
        appId: $('#s_appid').value.trim(),
        dialect: $('#s_dialect').value,
        handwritingEndpoint: $('#s_hw').value.trim()
      });
      UI.toast('配置已保存，老人端将同步生效', 'ok');
      renderSettings(root);
    });
    $('#s_clear').addEventListener('click', () => {
      Speech.saveConfig({ provider: 'mock', endpoint: '', apiKey: '', appId: '', handwritingEndpoint: '', handwritingKey: '' });
      UI.toast('已切换回原型演示模式', 'ok');
      renderSettings(root);
    });
    $('#s_reset').addEventListener('click', () => {
      UI.confirm({
        title: '重置演示数据',
        text: '将清空所有新增工单与修改，恢复到初始演示数据。此操作不可撤销。',
        okText: '确认重置', danger: true
      }).then(ok => {
        if (!ok) return;
        SY.reset();
        UI.toast('演示数据已重置', 'ok');
        render();
      });
    });
  }

  /* ============================================================
     通知 / 搜索
     ============================================================ */
  let noticeEl = null;
  function closeNotice() { if (noticeEl) { noticeEl.remove(); noticeEl = null; } }

  function toggleNotice() {
    if (noticeEl) { closeNotice(); return; }
    const urgent = SY.tickets().filter(t => t.urgency === '紧急' && t.status !== '已完成')
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    const risk = SY.riskList().filter(r => r.level === '高').slice(0, 3);

    noticeEl = document.createElement('div');
    noticeEl.className = 'notice-pop';
    noticeEl.innerHTML =
      '<div class="hd"><span>置顶提醒</span><span class="tag tag--red">' + (urgent.length + risk.length) + '</span></div>' +
      (urgent.length ? urgent.map(t =>
        '<div class="notice-row" data-tk="' + t.id + '">' +
        '<div class="ic" style="background:var(--neg-bg);color:var(--neg)">急</div>' +
        '<div class="tx"><div class="t">' + t.elderName + ' · ' + t.type + '</div>' +
        '<div class="m">' + esc(t.content).slice(0, 24) + '… · ' + SY.fromNow(t.createdAt) + '</div></div></div>').join('') : '') +
      (risk.length ? risk.map(r =>
        '<div class="notice-row" data-insight="1">' +
        '<div class="ic" style="background:var(--warn-bg);color:var(--amber-d)">警</div>' +
        '<div class="tx"><div class="t">' + esc(r.title) + '</div>' +
        '<div class="m">' + r.kind + ' · ' + SY.fromNow(r.at) + '</div></div></div>').join('') : '') +
      (!urgent.length && !risk.length ? '<div class="blk-empty" style="padding:24px">暂无提醒</div>' : '') +
      '<div style="padding:6px 10px 4px;border-top:1px solid var(--line-2);margin-top:4px">' +
      '<button class="link-btn" id="noticeAll">查看全部工单 →</button></div>';

    $('.topbar').appendChild(noticeEl);
    noticeEl.querySelectorAll('[data-tk]').forEach(el => el.addEventListener('click', () => {
      closeNotice(); openDrawer(el.dataset.tk);
    }));
    noticeEl.querySelectorAll('[data-insight]').forEach(el => el.addEventListener('click', () => {
      closeNotice(); go('insights');
    }));
    const all = noticeEl.querySelector('#noticeAll');
    if (all) all.addEventListener('click', () => { closeNotice(); go('inbox'); });
  }

  /* ============================================================
     启动
     ============================================================ */
  function boot() {
    $('#sideName').textContent = ses.name;
    $('#sideAva').textContent = ses.name.slice(0, 1);

    document.querySelectorAll('.nav-item').forEach(b => {
      b.addEventListener('click', () => go(b.dataset.route));
    });

    window.addEventListener('hashchange', render);

    $('#btnBell').addEventListener('click', e => { e.stopPropagation(); toggleNotice(); });
    document.addEventListener('click', e => {
      if (noticeEl && !e.target.closest('.notice-pop') && !e.target.closest('#btnBell')) closeNotice();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeNotice(); if (drawerEl) closeDrawer(); }
      if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        const s = $('#globalSearch'); if (s) s.focus();
      }
    });

    const gs = $('#globalSearch');
    gs.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        state.inbox.q = gs.value.trim();
        state.inbox.status = '全部';
        go('inbox');
      }
    });
    gs.addEventListener('input', () => {
      if (!gs.value.trim()) return;
    });

    $('#btnLogout').addEventListener('click', () => {
      UI.confirm({ title: '退出登录', text: '退出后需要重新输入工号与密码。', okText: '退出', danger: true })
        .then(ok => {
          if (!ok) return;
          SY.logout();
          location.replace('index.html');
        });
    });

    if (!location.hash) location.replace('#dashboard');
    render();
  }

  boot();
})();
