/* ============================================================
   桑榆智援 · 数据层与业务规则
   - localStorage 持久化（原型演示用）
   - 分类 / 派单 / 补全 / 风险研判 / 统计 均为本地规则引擎
   ============================================================ */
(function (global) {
  'use strict';

  const DB_KEY = 'SY_DB_V1';
  const SESSION_KEY = 'SY_SESSION_V1';
  const DAY = 86400000;
  const D = global.SY_DATA;

  const TYPE_LIST = ['助餐', '水电故障', '家电维修', '健康咨询', '居家保洁', '政策咨询', '家政', '其他'];
  const TYPE_EN = {
    '助餐': 'meal', '水电故障': 'water', '家电维修': 'appliance', '健康咨询': 'health',
    '居家保洁': 'clean', '政策咨询': 'policy', '家政': 'service', '其他': 'other'
  };
  const STATUS = {
    '待接单': { tone: 'amber', step: 0 },
    '已接单': { tone: 'blue', step: 1 },
    '处理中': { tone: 'violet', step: 2 },
    '已完成': { tone: 'green', step: 3 }
  };
  const SOURCE_TONE = { '语音': 'blue', '打字': 'green', '手写': 'violet', '紧急': 'red' };

  /* ---------------- 小工具 ---------------- */
  const pad = n => String(n).padStart(2, '0');

  function fmtTime(ts, withYear) {
    const d = new Date(ts);
    const y = d.getFullYear(), m = pad(d.getMonth() + 1), dd = pad(d.getDate());
    const hh = pad(d.getHours()), mm = pad(d.getMinutes());
    return (withYear ? y + '-' : '') + m + '-' + dd + ' ' + hh + ':' + mm;
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtClock(ts) {
    const d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromNow(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    const h = Math.floor(min / 60);
    if (h < 24) return h + ' 小时前';
    const dd = Math.floor(h / 24);
    if (dd < 30) return dd + ' 天前';
    return Math.floor(dd / 30) + ' 个月前';
  }
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function uid(prefix) {
    return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------------- 规则引擎 ---------------- */
  const RULES = [
    { type: '家政', re: /(陪(着|同)?|陪同|代买|代购|代办|带我|跑一趟)/ },
    { type: '助餐', re: /(饭|餐|吃|菜|粥|面|包子|馒头|送饭|订饭)/ },
    { type: '健康咨询', re: /(血压|血糖|头晕|头昏|胸闷|胸口|疼|痛|药|医生|医院|不舒服|失眠|睡不着|发烧|感冒|喘)/ },
    { type: '水电故障', re: /(水管|漏水|下水|堵|灯|灯泡|电灯|暖气|热水|跳闸|插座|水龙头|积水|停水|停电)/ },
    { type: '家电维修', re: /(空调|电视|洗衣机|冰箱|遥控|电饭锅|风扇|微波炉|热水器|家电)/ },
    { type: '居家保洁', re: /(打扫|保洁|擦|洗|收拾|油烟机|卫生|床单|拖地)/ },
    { type: '政策咨询', re: /(补贴|政策|申请|材料|年审|保险|待遇|津贴|手续|怎么办)/ }
  ];

  const URGENT_RE = /(胸口|喘不上|站不住|摔|出血|昏|晕倒|疼得厉害|救|不行了|急)/;
  const SOON_RE = /(漏水|不热|看不见|快吃完|晚上|疼|冷|没水|没电|堵)/;
  const PLACE_RE = /(厨房|卫生间|厕所|客厅|卧室|阳台|屋里|楼道)/;

  function classify(text) {
    const t = String(text || '');
    let type = '其他';
    for (const r of RULES) { if (r.re.test(t)) { type = r.type; break; } }
    let urgency = '一般';
    if (URGENT_RE.test(t)) urgency = '紧急';
    else if (SOON_RE.test(t)) urgency = '较急';
    const tags = [];
    if (PLACE_RE.test(t)) tags.push(t.match(PLACE_RE)[1] + '');
    if (/独居|一个人|没人/.test(t)) tags.push('独居');
    if (/听力|听不清|耳背/.test(t)) tags.push('听力');
    return { type, urgency, tags };
  }

  function assigneeFor(type) {
    const s = D.staff.find(st => st.handles.indexOf(type) > -1);
    return s ? s.id : 'S01';
  }

  /* 档案完整性校验 + 自动补全 */
  function autoFill(text, elder) {
    const missing = [];
    const filled = {};
    if (!elder.address) { missing.push('住址'); } else { filled.address = elder.address; }
    if (!elder.guardianPhone) { missing.push('紧急联系人电话'); } else { filled.guardian = elder.guardian + ' ' + elder.guardianPhone; }
    if (!elder.phone) { missing.push('本人电话'); } else { filled.phone = elder.phone; }
    const place = PLACE_RE.test(text) ? text.match(PLACE_RE)[1] : '';
    filled.location = place ? elder.building + ' ' + elder.unit + ' ' + place : elder.building + ' ' + elder.unit;
    const needMed = /(药|医院|就诊|复查)/.test(text);
    filled.extra = needMed ? '需同步社区卫生服务站' : '';
    return { missing, filled, complete: missing.length === 0 };
  }

  function matchPolicies(elder) {
    if (!elder) return [];
    return D.policies.filter(p => {
      const m = p.match || {};
      if (m.minAge && elder.age < m.minAge) return false;
      if (m.tags && !m.tags.some(t => elder.tags.indexOf(t) > -1)) return false;
      return true;
    });
  }

  /* ---------------- 持久化 ---------------- */
  function seed() {
    const tickets = D.ticketSeed.map((row, i) => {
      const [days, elderId, type, source, status, content, urgency, assignee, resp] = row;
      const elder = D.elders.find(e => e.id === elderId);
      const createdAt = D.ago(days, 8 + (i % 9), (i * 7) % 60);
      const accepted = status === '待接单' ? null : createdAt + (resp || 20) * 60000;
      const processing = ['处理中', '已完成'].indexOf(status) > -1 ? (accepted || createdAt) + 12 * 60000 : null;
      const done = status === '已完成' ? (processing || accepted || createdAt) + 46 * 60000 : null;
      return {
        id: 'GD' + fmtDate(createdAt).replace(/-/g, '') + '-' + pad(i + 1),
        elderId,
        elderName: elder ? elder.name : '—',
        building: elder ? elder.building : '—',
        unit: elder ? elder.unit : '',
        type, source, status,
        urgency,
        content,
        aiTags: classify(content).tags,
        assignee: assignee || (status === '待接单' ? null : assigneeFor(type)),
        createdAt, acceptedAt: accepted, processingAt: processing, doneAt: done,
        responseMin: status === '待接单' ? null : (resp || 20),
        messages: [],
        note: '',
        repeated: false,
        escalated: source === '紧急'
      };
    });
    // 标记重复求助：同一老人 + 同一类型 + 7 天内出现两次
    const seen = {};
    tickets.slice().sort((a, b) => a.createdAt - b.createdAt).forEach(t => {
      const k = t.elderId + '|' + t.type;
      if (seen[k] && t.createdAt - seen[k] < 7 * DAY) { t.repeated = true; t.repeatOf = seen[k + 'id']; }
      seen[k] = t.createdAt; seen[k + 'id'] = t.id;
    });

    const db = {
      version: 1,
      elders: JSON.parse(JSON.stringify(D.elders)),
      staff: JSON.parse(JSON.stringify(D.staff)),
      tickets,
      alertsRead: [],
      noticeRead: [],
      createdAt: Date.now()
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  let db = null;
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      db = raw ? JSON.parse(raw) : seed();
      if (!db || !db.tickets) db = seed();
    } catch (e) { db = seed(); }
    return db;
  }
  function save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* 忽略配额错误 */ }
    listeners.forEach(fn => { try { fn(db); } catch (e) {} });
  }
  function onChange(fn) { listeners.push(fn); }
  function reset() { localStorage.removeItem(DB_KEY); load(); listeners.forEach(fn => fn(db)); }

  /* ---------------- 查询 ---------------- */
  function elderById(id) { return db.elders.find(e => e.id === id); }
  function staffById(id) { return db.staff.find(s => s.id === id); }
  function ticketById(id) { return db.tickets.find(t => t.id === id); }
  function ticketsOf(elderId) {
    return db.tickets.filter(t => t.elderId === elderId).sort((a, b) => b.createdAt - a.createdAt);
  }
  function activeTicketOf(elderId) {
    return ticketsOf(elderId).find(t => t.status !== '已完成');
  }

  /* ---------------- 登录 ---------------- */
  function login(idRaw, pw, role) {
    const id = String(idRaw || '').trim();
    if (!id) return { ok: false, msg: '请输入唯一 ID' };
    if (!pw) return { ok: false, msg: '请输入密码' };
    if (role === 'elder') {
      const e = db.elders.find(x => x.id.toUpperCase() === id.toUpperCase());
      if (!e) return { ok: false, msg: '未找到该 ID 对应的老人档案，请联系社区网格员' };
      if (e.password !== pw) return { ok: false, msg: '密码不正确，请重试' };
      const s = { role: 'elder', id: e.id, name: e.name, at: Date.now() };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return { ok: true, session: s };
    }
    const a = D.accounts.admin;
    if (id !== a.id) return { ok: false, msg: '未找到该工号，请输入社区工作人员工号' };
    if (pw !== a.password) return { ok: false, msg: '密码不正确，请重试' };
    const s = { role: 'admin', id: a.id, name: a.name, org: a.org, at: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return { ok: true, session: s };
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function logout() { sessionStorage.removeItem(SESSION_KEY); }
  function requireRole(role, fallback) {
    const s = session();
    if (!s || s.role !== role) { location.replace(fallback || 'index.html'); return null; }
    if (role === 'elder' && !elderById(s.id)) { location.replace('index.html'); return null; }
    return s;
  }

  /* ---------------- 写操作 ---------------- */
  function createTicket(payload) {
    const elder = elderById(payload.elderId);
    const cls = classify(payload.content);
    const type = payload.type || cls.type;
    const now = Date.now();
    const t = {
      id: 'GD' + fmtDate(now).replace(/-/g, '') + '-' + String(db.tickets.length + 1).padStart(3, '0'),
      elderId: payload.elderId,
      elderName: elder ? elder.name : payload.elderName || '—',
      building: elder ? elder.building : '—',
      unit: elder ? elder.unit : '',
      type,
      source: payload.source || '语音',
      status: '待接单',
      urgency: payload.urgency || cls.urgency,
      content: payload.content,
      aiTags: cls.tags,
      assignee: null,
      createdAt: now,
      acceptedAt: null, processingAt: null, doneAt: null,
      responseMin: null,
      messages: [],
      note: payload.note || '',
      repeated: false,
      escalated: payload.source === '紧急'
    };
    // 重复求助识别
    const prev = db.tickets.find(x => x.elderId === t.elderId && x.type === t.type && now - x.createdAt < 7 * DAY);
    if (prev) { t.repeated = true; t.repeatOf = prev.id; }
    db.tickets.unshift(t);
    save();
    return t;
  }

  function acceptTicket(id, staffId) {
    const t = ticketById(id);
    if (!t) return null;
    t.status = '已接单';
    t.assignee = staffId || t.assignee || assigneeFor(t.type);
    t.acceptedAt = Date.now();
    t.responseMin = Math.max(1, Math.round((t.acceptedAt - t.createdAt) / 60000));
    save();
    return t;
  }

  function advanceTicket(id) {
    const t = ticketById(id);
    if (!t) return null;
    if (t.status === '待接单') return acceptTicket(id);
    if (t.status === '已接单') { t.status = '处理中'; t.processingAt = Date.now(); }
    else if (t.status === '处理中') { t.status = '已完成'; t.doneAt = Date.now(); }
    save();
    return t;
  }

  function transferTicket(id, staffId, reason) {
    const t = ticketById(id);
    if (!t) return null;
    t.assignee = staffId;
    t.status = t.status === '待接单' ? '已接单' : t.status;
    if (!t.acceptedAt) { t.acceptedAt = Date.now(); t.responseMin = Math.max(1, Math.round((t.acceptedAt - t.createdAt) / 60000)); }
    t.messages.push({ from: 'system', text: '工单已转派至 ' + (staffById(staffId) || {}).name + (reason ? '（' + reason + '）' : ''), at: Date.now() });
    save();
    return t;
  }

  function addMessage(id, from, text) {
    const t = ticketById(id);
    if (!t) return null;
    t.messages.push({ from, text, at: Date.now() });
    save();
    return t;
  }

  function addElder(data) {
    const id = data.id || ('E' + String(1001 + db.elders.length).slice(-4));
    const item = Object.assign({
      id, password: '123456', name: '', gender: '男', age: 70,
      phone: '', building: '1号楼', unit: '', grid: '第一网格',
      address: '', guardian: '', guardianPhone: '',
      tags: [], dialect: '中原官话', careLevel: '一般',
      since: fmtDate(Date.now()), note: ''
    }, data, { id });
    db.elders.push(item);
    save();
    return item;
  }

  function updateElder(id, patch) {
    const e = elderById(id);
    if (!e) return null;
    Object.assign(e, patch);
    save();
    return e;
  }

  /* ---------------- 研判 ---------------- */
  function riskList() {
    const out = [];
    const now = Date.now();
    db.elders.forEach(e => {
      const list = ticketsOf(e.id);
      const recent7 = list.filter(t => now - t.createdAt < 7 * DAY).length;
      const prev7 = list.filter(t => now - t.createdAt >= 7 * DAY && now - t.createdAt < 14 * DAY).length;
      const last = list[0];
      const silentDays = last ? Math.round((now - last.createdAt) / DAY) : 999;

      if (recent7 >= 4 && recent7 > prev7) {
        out.push({
          id: 'R-surge-' + e.id, level: '高', kind: '诉求激增', elderId: e.id, elderName: e.name,
          title: e.name + ' 近 7 天提交 ' + recent7 + ' 次诉求', at: last ? last.createdAt : now,
          desc: '较前一周（' + prev7 + ' 次）明显上升。' + D.alertNotes.surge
        });
      }
      if (silentDays >= 60 && e.tags.indexOf('独居') > -1) {
        out.push({
          id: 'R-silence-' + e.id, level: '高', kind: '失访风险', elderId: e.id, elderName: e.name,
          title: e.name + ' 已 ' + silentDays + ' 天无诉求记录',
          at: now - silentDays * DAY,
          desc: '独居高龄老人长期零诉求。' + D.alertNotes.silence
        });
      }
      const last5 = list.slice(0, 5);
      const healthRecent = last5.filter(t => t.type === '健康咨询').length;
      if (healthRecent >= 3) {
        out.push({
          id: 'R-shift-' + e.id, level: '中', kind: '类型突变', elderId: e.id, elderName: e.name,
          title: e.name + ' 近期健康类诉求集中出现', at: last.createdAt,
          desc: D.alertNotes.shift
        });
      }
    });

    // 群体性共性问题：同楼栋同类型 7 天内 >= 2（助餐等日常类不计入）
    const cluster = {};
    const CLUSTER_TYPES = ['水电故障', '家电维修', '健康咨询'];
    db.tickets.filter(t => now - t.createdAt < 7 * DAY && CLUSTER_TYPES.indexOf(t.type) > -1).forEach(t => {
      const k = t.building + '|' + t.type;
      (cluster[k] = cluster[k] || []).push(t);
    });
    Object.keys(cluster).forEach(k => {
      const arr = cluster[k];
      if (arr.length >= 2) {
        const [building, type] = k.split('|');
        out.push({
          id: 'R-cluster-' + k, level: '中', kind: '群体共性', building, type,
          title: building + ' 近 7 天出现 ' + arr.length + ' 起「' + type + '」诉求',
          at: Math.max.apply(null, arr.map(x => x.createdAt)),
          desc: D.alertNotes.cluster
        });
      }
    });

    return out.sort((a, b) => (b.level === '高') - (a.level === '高') || b.at - a.at);
  }

  function repeatTickets() {
    return db.tickets.filter(t => t.repeated).sort((a, b) => b.createdAt - a.createdAt);
  }

  function seasonHint() {
    const m = new Date().getMonth() + 1;
    const winter = [11, 12, 1, 2, 3].indexOf(m) > -1;
    const summer = [6, 7, 8].indexOf(m) > -1;
    const recent = db.tickets.filter(t => Date.now() - t.createdAt < 30 * DAY);
    const share = type => recent.length ? Math.round(recent.filter(t => t.type === type).length / recent.length * 100) : 0;
    const topBuildings = type => {
      const m2 = {};
      recent.filter(t => t.type === type).forEach(t => { m2[t.building] = (m2[t.building] || 0) + 1; });
      return Object.keys(m2).sort((a, b) => m2[b] - m2[a]).slice(0, 2);
    };

    if (winter) {
      const t = topBuildings('水电故障');
      return {
        season: '采暖季', title: '提前排查供暖与管线防冻',
        text: '近 30 天水电故障类诉求占 ' + share('水电故障') + '%' +
          (t.length ? '，' + t.join('、') + ' 相对集中' : '') +
          '。建议本周内完成管线巡检，并预置管件、阀门等备料。',
        types: ['水电故障']
      };
    }
    if (summer) {
      const t = topBuildings('健康咨询');
      return {
        season: '高温季', title: '关注中暑与用电负荷',
        text: '近 30 天健康咨询类诉求占 ' + share('健康咨询') + '%' +
          (t.length ? '，' + t.join('、') + ' 相对集中' : '') +
          '。建议开放社区纳凉点，并排查老旧线路。',
        types: ['健康咨询', '家电维修']
      };
    }
    return {
      season: '春秋季', title: '适合开展集中上门服务',
      text: '气温暖和、诉求量平稳，适合安排适老化改造施工与集中体检，减少对老人的重复打扰。',
      types: []
    };
  }

  function multiRoleList() {
    const now = Date.now();
    const out = [];
    db.elders.forEach(e => {
      const recent = ticketsOf(e.id).filter(t => now - t.createdAt < 30 * DAY);
      const kinds = {};
      recent.forEach(t => { kinds[t.type] = 1; });
      const hasHealth = kinds['健康咨询'];
      const hasService = kinds['居家保洁'] || kinds['家政'] || kinds['助餐'];
      if (hasHealth && hasService) {
        out.push({
          elderId: e.id, elderName: e.name, building: e.building, unit: e.unit,
          kinds: Object.keys(kinds), count: recent.length,
          desc: D.alertNotes.multi
        });
      }
    });
    return out;
  }

  /* ---------------- 统计 ---------------- */
  function stats() {
    const now = Date.now();
    const all = db.tickets;
    const today = all.filter(t => dayKey(t.createdAt) === dayKey(now));
    const pending = all.filter(t => t.status === '待接单');
    const doing = all.filter(t => t.status === '处理中' || t.status === '已接单');
    const done = all.filter(t => t.status === '已完成');
    const responded = all.filter(t => t.responseMin != null);
    const avg = responded.length ? Math.round(responded.reduce((s, t) => s + t.responseMin, 0) / responded.length) : 0;
    const doneToday = all.filter(t => t.doneAt && dayKey(t.doneAt) === dayKey(now)).length;
    return {
      total: all.length,
      today: today.length,
      pending: pending.length,
      doing: doing.length,
      done: done.length,
      doneToday,
      avgResponse: avg,
      completionRate: all.length ? Math.round(done.length / all.length * 100) : 0,
      repeated: all.filter(t => t.repeated).length,
      urgent: all.filter(t => t.urgency === '紧急' && t.status !== '已完成').length,
      residents: db.elders.length
    };
  }

  function byType() {
    const map = {};
    TYPE_LIST.forEach(t => { map[t] = 0; });
    db.tickets.forEach(t => { map[t.type] = (map[t.type] || 0) + 1; });
    return TYPE_LIST.map(t => ({ type: t, count: map[t], en: TYPE_EN[t] })).filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  function byBuilding() {
    const map = {};
    db.elders.forEach(e => { map[e.building] = map[e.building] || 0; });
    db.tickets.forEach(t => { map[t.building] = (map[t.building] || 0) + 1; });
    return Object.keys(map).map(k => ({ building: k, count: map[k] }))
      .sort((a, b) => a.building.localeCompare(b.building, 'zh'));
  }

  function bySource() {
    const map = { '语音': 0, '打字': 0, '手写': 0, '紧急': 0 };
    db.tickets.forEach(t => { map[t.source] = (map[t.source] || 0) + 1; });
    return Object.keys(map).map(k => ({ source: k, count: map[k] }));
  }

  function trend(days) {
    const n = days || 14;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const k = dayKey(d.getTime());
      out.push({
        key: k,
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        count: db.tickets.filter(t => dayKey(t.createdAt) === k).length,
        done: db.tickets.filter(t => t.doneAt && dayKey(t.doneAt) === k).length
      });
    }
    return out;
  }

  function heatByBuilding() {
    // 楼栋 × 近 7 天
    const rows = byBuilding().map(x => x.building);
    const cols = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      cols.push({ key: dayKey(d.getTime()), label: (d.getMonth() + 1) + '/' + d.getDate() });
    }
    return {
      rows, cols,
      value: (b, k) => db.tickets.filter(t => t.building === b && dayKey(t.createdAt) === k).length
    };
  }

  function responseByType() {
    return byType().map(x => {
      const list = db.tickets.filter(t => t.type === x.type && t.responseMin != null);
      const avg = list.length ? Math.round(list.reduce((s, t) => s + t.responseMin, 0) / list.length) : 0;
      return { type: x.type, avg, count: list.length };
    });
  }

  function monthlyLedger() {
    const month = new Date().getMonth() + 1;
    const list = db.tickets.filter(t => new Date(t.createdAt).getMonth() + 1 === month);
    const byT = {};
    list.forEach(t => { byT[t.type] = (byT[t.type] || 0) + 1; });
    return {
      month, total: list.length,
      done: list.filter(t => t.status === '已完成').length,
      byType: Object.keys(byT).map(k => ({ type: k, count: byT[k] })).sort((a, b) => b.count - a.count),
      avgResponse: list.filter(t => t.responseMin).length
        ? Math.round(list.filter(t => t.responseMin).reduce((s, t) => s + t.responseMin, 0) / list.filter(t => t.responseMin).length)
        : 0,
      list
    };
  }

  function csvOfLedger() {
    const rows = [['工单编号', '提交时间', '老人', '楼栋', '类型', '来源', '状态', '负责人', '响应时长(分钟)', '诉求内容']];
    monthlyLedger().list.forEach(t => {
      rows.push([
        t.id, fmtTime(t.createdAt, true), t.elderName, t.building + t.unit, t.type, t.source, t.status,
        (staffById(t.assignee) || {}).name || '未指派', t.responseMin == null ? '' : t.responseMin, t.content
      ]);
    });
    return rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  }

  /* ---------------- 对外 ---------------- */
  load();

  global.SY = {
    // 常量
    TYPE_LIST, TYPE_EN, STATUS, SOURCE_TONE,
    // 工具
    fmtTime, fmtDate, fmtClock, fromNow, dayKey, escapeHtml, pad,
    // 数据
    get db() { return db; },
    elders: () => db.elders,
    staff: () => db.staff,
    tickets: () => db.tickets,
    policies: () => db.policies,
    elderById, staffById, ticketById, ticketsOf, activeTicketOf,
    // 认证
    login, session, logout, requireRole,
    // 写
    createTicket, acceptTicket, advanceTicket, transferTicket, addMessage, addElder, updateElder,
    // 规则
    classify, assigneeFor, autoFill, matchPolicies,
    riskList, repeatTickets, seasonHint, multiRoleList,
    // 统计
    stats, byType, byBuilding, bySource, trend, heatByBuilding, responseByType, monthlyLedger, csvOfLedger,
    // 其他
    onChange, reset, load,
    seed
  };
})(window);
