/* ============================================================
   老人端 · 交互逻辑
   ============================================================ */
(function () {
  'use strict';

  const ses = SY.requireRole('elder');
  if (!ses) return;

  const elder = SY.elderById(ses.id);
  const $ = s => document.querySelector(s);
  const card = $('#voiceCard');
  const micBtn = $('#micBtn');
  const stateMain = $('#stateMain');
  const stateSub = $('#stateSub');
  const liveText = $('#liveText');
  const waveBox = $('#wave');

  let stage = 'idle';
  let listenSession = null;
  let autoTimer = null;
  let inputSource = '语音';
  let pendingText = '';

  const TYPE_ICON = {
    '助餐': 'fuel', '水电故障': 'drop', '家电维修': 'grid', '健康咨询': 'pulse',
    '居家保洁': 'spark', '政策咨询': 'shield', '家政': 'hand', '其他': 'file'
  };

  /* ---------------- 问候 ---------------- */
  function greetWord() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function honorific(e) {
    return e.gender === '女' ? '奶奶' : '爷爷';
  }
  function shortName(e) { return e.name.slice(0, 1); }

  function initHeader() {
    $('#whoAva').textContent = shortName(elder);
    $('#whoName').textContent = elder.name;
    $('#whoAddr').textContent = elder.building + ' ' + elder.unit;
    $('#greetHi').innerHTML = elder.name.slice(0, 1) + honorific(elder) + '，' + greetWord();

    const d = new Date();
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    $('#greetDate').textContent = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 星期' + week;

    const tips = [
      '天冷了，记得多喝热水',
      '今天降温，出门加件衣裳',
      '有事随时跟我说，我一直在',
      '上午天气好，可以下楼走走'
    ];
    $('#greetWeather').textContent = tips[d.getDate() % tips.length];
  }

  /* ---------------- 声波 ---------------- */
  const BAR_COUNT = 34;
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = document.createElement('i');
    waveBox.appendChild(b);
    bars.push({ el: b, v: 0, phase: Math.random() * Math.PI * 2 });
  }
  let level = 0, waveRaf = null, waveT = 0;

  function waveLoop() {
    waveT += 16;
    bars.forEach((b, i) => {
      const target = (stage === 'listening' || stage === 'thinking')
        ? Math.min(1, level) * (0.18 + 0.82 * Math.pow(Math.sin(waveT * 0.004 + i * 0.42 + b.phase), 2))
        : 0;
      b.v += (target - b.v) * 0.22;
      const h = 5 + 40 * b.v;
      b.el.style.height = h.toFixed(1) + 'px';
      b.el.style.opacity = stage === 'listening' ? (0.35 + 0.65 * b.v).toFixed(2) : '';
    });
    waveRaf = requestAnimationFrame(waveLoop);
  }
  waveLoop();

  /* ---------------- 阶段切换 ---------------- */
  function setStage(s) {
    stage = s;
    card.dataset.stage = s;
    if (s !== 'listening') { level = 0; }
  }

  function resetToIdle() {
    setStage('idle');
    stateMain.textContent = '点一下这个圆，就能说话';
    stateSub.textContent = '说清楚是啥事、在哪个屋就行';
    liveText.innerHTML = '';
    micBtn.querySelector('.lbl').textContent = '按一下 说话';
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  /* ---------------- 语音主流程 ---------------- */
  function startListening() {
    inputSource = '语音';
    setStage('listening');
    stateMain.textContent = '我在听，您慢慢说';
    stateSub.textContent = '说完了，再点一下这个圆';
    micBtn.querySelector('.lbl').textContent = '说完点这里';
    liveText.innerHTML = '<span class="cursor"></span>';

    const mock = !Speech.isConfigured();
    const sess = Speech.listen({
      onLevel(v) { level = v; },
      onPartial(t) {
        liveText.innerHTML = SY.escapeHtml(t) + '<span class="cursor"></span>';
      },
      onFinal(t) {
        liveText.innerHTML = SY.escapeHtml(t);
        setStage('thinking');
        stateMain.textContent = '让我理一理…';
        stateSub.textContent = '正在帮您填好地址和联系人';
        setTimeout(() => buildConfirm(t, inputSource), 620);
      },
      onError(err) {
        resetToIdle();
        UI.toast('没有听清楚，我们再试一次', 'err');
        console.warn(err);
      }
    });
    listenSession = sess;

    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (stage === 'listening') stopListening();
    }, mock ? 3400 : 30000);
  }

  function stopListening() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (listenSession) { listenSession.stop(); listenSession = null; }
  }

  micBtn.addEventListener('click', () => {
    if (stage === 'idle' || stage === 'done') {
      if (stage === 'done') { resetToIdle(); }
      startListening();
    } else if (stage === 'listening') {
      stopListening();
    }
  });

  /* ---------------- 识别确认 ---------------- */
  function buildConfirm(text, source) {
    pendingText = String(text || '').trim();
    inputSource = source || '语音';
    if (!pendingText) { resetToIdle(); return; }

    const cls = SY.classify(pendingText);
    const fill = SY.autoFill(pendingText, elder);
    const staff = SY.staffById(SY.assigneeFor(cls.type));

    $('#saidText').textContent = pendingText;

    const rows = [
      { k: '要办的事', v: cls.type },
      { k: '去的地方', v: fill.filled.location },
      { k: '联系人', v: fill.filled.guardian || elder.guardian },
      { k: '联系电话', v: fill.filled.phone || elder.phone }
    ];
    $('#filledBox').innerHTML = rows.map(r =>
      '<div class="row"><span class="k">' + r.k + '</span><span class="v' +
      (r.v ? '' : ' miss') + '">' + (r.v || '待补充') + '</span></div>'
    ).join('') +
      '<div class="row" style="grid-column:1/-1"><span class="k">会自动派给</span><span class="v">' +
      (staff ? staff.name + '（' + staff.org + '）' : '社区值班人员') + '</span></div>';

    if (cls.urgency === '紧急') {
      $('#filledBox').insertAdjacentHTML('beforeend',
        '<div class="row" style="grid-column:1/-1"><span class="k">紧急程度</span><span class="v miss">紧急 · 已置顶提醒</span></div>');
    }

    stateMain.textContent = '您看，是不是这个意思';
    stateSub.textContent = '';
    setStage('confirm');
  }

  $('#retryBtn').addEventListener('click', () => {
    resetToIdle();
    startListening();
  });

  $('#submitTicketBtn').addEventListener('click', () => {
    const text = ($('#saidText').innerText || '').trim();
    if (!text) { UI.toast('内容不能为空', 'err'); return; }
    const t = SY.createTicket({
      elderId: elder.id,
      content: text,
      source: inputSource
    });
    showDone(t);
  });

  function showDone(t) {
    setStage('done');
    $('#doneNo').textContent = t.id;
    const staff = SY.staffById(SY.assigneeFor(t.type)) || { name: '社区值班人员', org: '社区' };
    const pol = SY.matchPolicies(elder)[0];

    let say = '您的事我已经报给社区了，工单号 ' + t.id.slice(-3) + '。' + t.type + '，已经通知' + staff.name + '。';
    if (t.urgency === '紧急') say = '已经按紧急件报给社区值班室，' + staff.name + '马上处理。';
    if (pol) say += '另外，您的情况符合' + pol.name + '，' + pol.amount + '，可以让家里人帮您问问社区。';

    $('#doneSay').textContent = say;
    Speech.speak(say);
    renderProgress();
    renderHistory();
    UI.toast('已提交，社区马上就能看到', 'ok');
  }

  $('#btnSpeakAgain').addEventListener('click', () => {
    Speech.speak($('#doneSay').textContent);
  });
  $('#btnGoProgress').addEventListener('click', () => {
    $('#progressCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#progressCard').animate(
      [{ boxShadow: '0 0 0 0 rgba(201,148,51,.45)' }, { boxShadow: '0 0 0 14px rgba(201,148,51,0)' }],
      { duration: 1100, easing: 'ease-out' }
    );
  });

  /* ---------------- 进度 ---------------- */
  const STEP_DEF = [
    { lb: '已提交', key: 'createdAt' },
    { lb: '已接单', key: 'acceptedAt' },
    { lb: '处理中', key: 'processingAt' },
    { lb: '已完成', key: 'doneAt' }
  ];
  function stepOf(status) {
    return { '待接单': 0, '已接单': 1, '处理中': 2, '已完成': 3 }[status] || 0;
  }

  function renderProgress() {
    const t = SY.activeTicketOf(elder.id) || SY.ticketsOf(elder.id)[0];
    const box = $('#pcSteps');
    const foot = $('#pcFoot');

    if (!t) {
      $('#pcNo').textContent = '还没有正在办的事';
      box.innerHTML = '<div class="pc-empty"><div class="big">您还没有报过事</div><div>点上面那个大圆，说一句就行</div></div>';
      foot.innerHTML = '';
      return;
    }

    $('#pcNo').textContent = t.id + ' · ' + t.type;
    const cur = stepOf(t.status);
    const staff0 = () => SY.staffById(t.assignee);

    box.innerHTML = STEP_DEF.map((s, i) => {
      const cls = t.status === '已完成' ? (i <= cur ? 'done' : '') : (i < cur ? 'done' : i === cur ? 'now' : '');
      const tm = t[s.key];
      return '<div class="step ' + cls + '">' +
        '<div class="rail"><div class="pt">' +
        '<svg viewBox="0 0 24 24" fill="none"><path d="M4.8 12.6l4.6 4.6L19.4 7.2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div></div>' +
        '<div class="body"><div class="lb">' + s.lb + '</div>' +
        '<div class="tm">' + (tm ? SY.fmtTime(tm) : (i === cur ? '进行中' : '待处理')) + '</div></div>' +
        '</div>';
    }).join('');

    // 社区留言（双向沟通的老人侧入口）
    const msgs = (t.messages || []).filter(m => m.from === 'admin' || m.from === 'elder').slice(-1);
    if (msgs.length) {
      const m = msgs[0];
      const who = m.from === 'admin' ? ((staff0() || {}).name || '社区') + ' 留言' : '我说过';
      box.insertAdjacentHTML('beforeend',
        '<div class="pc-msg"><div class="tx"><div class="who">' + who + '</div>' +
        '<div class="b">' + SY.escapeHtml(m.text) + '</div></div>' +
        '<button class="btn btn--ghost" id="pcReply">回一句</button></div>');
      const rp = $('#pcReply');
      if (rp) rp.addEventListener('click', () => replyModal(t));
    }

    const staff = SY.staffById(t.assignee);
    foot.innerHTML =
      '<div style="font-size:12.5px;color:var(--slate);display:flex;align-items:center;gap:6px">' +
      UI.icon('user', 13) +
      (staff ? staff.name + ' · ' + staff.org : '等待社区接单') +
      '</div>' +
      '<button class="link-btn" id="pcAsk">问问进度</button>';

    const ask = $('#pcAsk');
    if (ask) ask.addEventListener('click', () => {
      const msg = t.status === '已完成'
        ? '您报的' + t.type + '已经办完了。'
        : '您报的' + t.type + '，现在是' + t.status + '，' + (staff ? staff.name + '在负责' : '正在安排人') + '。';
      Speech.speak(msg);
      UI.toast(msg);
    });
  }

  $('#pcSpeak').addEventListener('click', () => {
    const t = SY.activeTicketOf(elder.id) || SY.ticketsOf(elder.id)[0];
    if (!t) { Speech.speak('您还没有报过事情。'); return; }
    const staff = SY.staffById(t.assignee);
    Speech.speak('您报的' + t.type + '，现在是' + t.status + '。' + (staff ? staff.name + '在负责。' : ''));
    UI.toast('正在播报');
  });

  /* ---------------- 回复社区留言 ---------------- */
  function replyModal(t) {
    const quick = ['好的，麻烦你们了', '我在家，随时可以来', '能不能下午再来', '我听不太清，麻烦打电话'];
    UI.modal({
      title: '回一句',
      sub: '您说的话会直接发给社区工作人员',
      body:
        '<div class="type-wrap">' +
        '<textarea class="textarea" id="replyTa" style="min-height:110px;font-size:16px" placeholder="想说什么就写下来"></textarea>' +
        '<div><div style="font-size:12px;color:var(--slate-l);margin-bottom:8px">也可以点下面的话</div>' +
        '<div class="quick-row" id="replyQuick">' +
        quick.map(q => '<button class="quick-chip" data-q="' + q + '">' + q + '</button>').join('') +
        '</div></div></div>',
      footer: '<button class="btn btn--ghost" data-close>取消</button><button class="btn btn--amber" id="replyGo">发出去</button>',
      onMount(api) {
        const ta = api.el.querySelector('#replyTa');
        api.el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
          ta.value = b.dataset.q; ta.focus();
        }));
        api.el.querySelector('#replyGo').addEventListener('click', () => {
          const v = ta.value.trim();
          if (!v) { UI.toast('还没写内容', 'err'); return; }
          SY.addMessage(t.id, 'elder', v);
          api.close();
          UI.toast('已经发给社区了', 'ok');
          renderProgress();
        });
        setTimeout(() => ta.focus(), 120);
      }
    });
  }

  /* ---------------- 政策 ---------------- */
  function renderPolicy() {
    const list = SY.matchPolicies(elder).slice(0, 3);
    $('#policyCount').textContent = list.length + ' 项';
    if (!list.length) {
      $('#policyList').innerHTML = '<div class="pc-empty" style="padding:10px 0 4px">暂无匹配的政策</div>';
      return;
    }
    $('#policyList').innerHTML = list.map(p =>
      '<div class="policy-item" data-policy="' + p.id + '">' +
      '<div class="ic">' + UI.icon('shield', 16) + '</div>' +
      '<div class="tx"><div class="n">' + p.name + '</div><div class="a">' + p.target + ' · ' + p.amount + '</div></div>' +
      '<div class="go">' + UI.icon('arrow', 15) + '</div>' +
      '</div>'
    ).join('');

    $('#policyList').querySelectorAll('[data-policy]').forEach(el => {
      el.addEventListener('click', () => {
        const p = SY.policies().find(x => x.id === el.dataset.policy);
        UI.modal({
          title: p.name,
          sub: p.target + ' · ' + p.amount,
          body:
            '<p class="lead" style="margin-bottom:14px">' + p.desc + '</p>' +
            '<div class="card card--pad" style="background:var(--paper);border-style:dashed">' +
            '<div style="font-size:12px;color:var(--slate-l);letter-spacing:.1em;margin-bottom:6px">怎么办理</div>' +
            '<div style="font-size:14.5px;line-height:1.8">带好身份证、户口本到社区服务大厅，或让家里人代办。有不清楚的，按上面的语音按钮问一句就行。</div>' +
            '</div>',
          footer:
            '<button class="btn btn--ghost" data-close>关闭</button>' +
            '<button class="btn btn--amber" data-say>念给我听</button>',
          onMount(api) {
            api.el.querySelector('[data-say]').addEventListener('click', () => {
              Speech.speak(p.name + '。' + p.target + '，' + p.amount + '。' + p.desc);
            });
          }
        });
      });
    });
  }

  /* ---------------- 历史 ---------------- */
  function renderHistory() {
    const list = SY.ticketsOf(elder.id);
    $('#historyCount').textContent = list.length + ' 条';
    if (!list.length) {
      $('#historyList').innerHTML =
        '<div class="empty" style="padding:34px 20px"><div class="ico">' + UI.icon('inbox', 20) + '</div><p>还没有报过事</p></div>';
      return;
    }
    $('#historyList').innerHTML = list.slice(0, 6).map(t => {
      const tone = SY.STATUS[t.status].tone;
      return '<div class="h-row" data-ticket="' + t.id + '">' +
        '<div class="ic">' + UI.icon('file', 17) + '</div>' +
        '<div class="tx"><div class="c">' + SY.escapeHtml(t.content) + '</div>' +
        '<div class="m">' + t.type + ' · ' + SY.fmtTime(t.createdAt) + '</div></div>' +
        '<div class="r"><span class="tag tag--' + tone + '">' + t.status + '</span></div>' +
        '</div>';
    }).join('');

    $('#historyList').querySelectorAll('[data-ticket]').forEach(el => {
      el.addEventListener('click', () => openTicket(el.dataset.ticket));
    });
  }

  function openTicket(id) {
    const t = SY.ticketById(id);
    if (!t) return;
    const staff = SY.staffById(t.assignee);
    UI.modal({
      title: t.type,
      sub: t.id + ' · ' + SY.fmtTime(t.createdAt),
      body:
        '<div class="card card--pad" style="background:#FCFAF5;border-color:#EFE8D8;margin-bottom:14px">' +
        '<div style="font-size:11.5px;color:var(--amber-d);letter-spacing:.14em;font-weight:700;margin-bottom:6px">您当时说的</div>' +
        '<div style="font-size:16px;line-height:1.7">' + SY.escapeHtml(t.content) + '</div></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
        '<span class="tag tag--' + SY.STATUS[t.status].tone + '">' + t.status + '</span>' +
        '<span class="tag">' + t.source + '上报</span>' +
        '<span class="tag">' + (t.urgency || '一般') + '</span>' +
        (staff ? '<span class="tag tag--blue">' + staff.name + ' · ' + staff.org + '</span>' : '') +
        '</div>' +
        '<div style="font-size:13.5px;color:var(--slate);line-height:2">' +
        '提交时间：' + SY.fmtTime(t.createdAt, true) + '<br>' +
        (t.acceptedAt ? '接单时间：' + SY.fmtTime(t.acceptedAt, true) + '<br>' : '') +
        (t.doneAt ? '办结时间：' + SY.fmtTime(t.doneAt, true) : '') +
        '</div>',
      footer: '<button class="btn btn--ghost" data-close>关闭</button><button class="btn" data-say>念给我听</button>',
      onMount(api) {
        api.el.querySelector('[data-say]').addEventListener('click', () => {
          Speech.speak('您报的' + t.type + '，是' + t.status + '。' + (staff ? staff.name + '在负责。' : ''));
        });
      }
    });
  }

  /* ---------------- 紧急求助 ---------------- */
  const sosCard = $('#sosCard');
  $('#sosBtn').addEventListener('click', () => { sosCard.dataset.armed = '1'; });
  $('#sosCancel').addEventListener('click', () => { sosCard.dataset.armed = '0'; });

  $('#sosYes').addEventListener('click', () => {
    sosCard.dataset.armed = '0';
    const t = SY.createTicket({
      elderId: elder.id,
      content: '【紧急求助】' + elder.name + ' 一键呼叫，未说明具体事由，需立即联系确认。',
      source: '紧急',
      urgency: '紧急',
      type: '其他'
    });
    const now = Date.now();
    t.acceptedAt = now;
    t.responseMin = 1;
    t.status = '已接单';
    t.assignee = 'S01';
    t.escalated = true;
    SY.addMessage(t.id, 'system', '紧急求助：已推送老人档案与住址至值班室，置顶强提醒。');
    SY.updateElder(elder.id, {}); // 触发持久化
    localStorage.setItem('SY_DB_V1', JSON.stringify(SY.db));

    const msg = '已经通知社区值班室了，' + elder.name + '，' + elder.address + '。值班的人马上联系您，别着急。';
    Speech.speak(msg);

    UI.modal({
      title: '社区值班室已收到',
      sub: '已推送您的档案与住址 · ' + SY.fmtClock(now),
      size: 'sm',
      body:
        '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="card card--pad" style="background:var(--neg-bg);border-color:#EFD6D3">' +
        '<div style="font-size:12px;color:var(--neg);letter-spacing:.12em;font-weight:700;margin-bottom:6px">已通知</div>' +
        '<div style="font-size:15px;line-height:1.8">张桂芳（第三网格 · 值班）<br>内线 801</div></div>' +
        '<div style="font-size:13.5px;color:var(--slate);line-height:1.9">' +
        '工作人员会看到您的姓名、年龄、住址、既往病史和紧急联系人。' +
        '<br>如果情况危急，请同时拨打 120。</div>' +
        '</div>',
      footer:
        '<button class="btn btn--ghost" data-close>我知道了</button>' +
        '<a class="btn btn--danger" href="tel:120">拨打 120</a>',
      onMount(api) {
        api.el.querySelector('[data-close]').addEventListener('click', () => {
          renderProgress(); renderHistory();
        });
      }
    });
    renderProgress(); renderHistory();
  });

  /* ---------------- 手写输入 ---------------- */
  $('#btnHandwrite').addEventListener('click', () => {
    UI.modal({
      title: '手写输入',
      sub: '在小黑板上把想说的话写下来，写完点「认一下」',
      body:
        '<div class="hw-wrap">' +
        '<div class="hw-canvas-box" id="hwBox"><canvas id="hwCanvas"></canvas>' +
        '<div class="ph">在这里写字</div></div>' +
        '<div class="hw-tools"><button class="link-btn" id="hwClear">擦掉重写</button>' +
        '<span class="grow"></span><span class="tag" id="hwBadge">笔画识别</span></div>' +
        '<p class="hw-note">手写识别为预留接口，未配置识别服务时将以「原型演示」方式返回示例文字，配置方法见右上角「设置」。</p>' +
        '</div>',
      footer: '<button class="btn btn--ghost" data-close>取消</button><button class="btn btn--amber" id="hwGo">认一下</button>',
      onMount(api) {
        const box = api.el.querySelector('#hwBox');
        const cv = api.el.querySelector('#hwCanvas');
        const ctx = cv.getContext('2d');
        let drawing = false, dirty = false;

        function fit() {
          const r = box.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const img = dirty ? cv.toDataURL() : null;
          cv.width = r.width * dpr; cv.height = r.height * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = '#16304F';
          if (img) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height); im.src = img; }
        }
        setTimeout(fit, 30);

        function pos(e) {
          const r = cv.getBoundingClientRect();
          const p = e.touches ? e.touches[0] : e;
          return { x: p.clientX - r.left, y: p.clientY - r.top };
        }
        function down(e) {
          e.preventDefault();
          drawing = true; dirty = true; box.classList.add('written');
          const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        }
        function move(e) {
          if (!drawing) return;
          e.preventDefault();
          const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        function up() { drawing = false; }

        cv.addEventListener('mousedown', down);
        cv.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        cv.addEventListener('touchstart', down, { passive: false });
        cv.addEventListener('touchmove', move, { passive: false });
        cv.addEventListener('touchend', up);

        api.el.querySelector('#hwClear').addEventListener('click', () => {
          ctx.clearRect(0, 0, cv.width, cv.height);
          dirty = false; box.classList.remove('written');
        });

        api.el.querySelector('#hwGo').addEventListener('click', async () => {
          if (!dirty) { UI.toast('还没写呢', 'err'); return; }
          const btn = api.el.querySelector('#hwGo');
          btn.disabled = true; btn.textContent = '正在认字…';
          try {
            const res = await Speech.recognizeHandwriting(cv.toDataURL('image/png'));
            api.close();
            if (res.simulated) UI.toast('原型演示：手写识别接口尚未配置', 'warn');
            setTimeout(() => buildConfirm(res.text, '手写'), 180);
          } catch (err) {
            btn.disabled = false; btn.textContent = '认一下';
            UI.toast('识别失败：' + err.message, 'err');
          }
        });
        setTimeout(() => api.el.querySelector('#hwGo').focus(), 100);
      }
    });
  });

  /* ---------------- 打字输入 ---------------- */
  $('#btnType').addEventListener('click', () => {
    UI.modal({
      title: '打字输入',
      sub: '用拼音打出来，也可以用下面的常用话',
      body:
        '<div class="type-wrap">' +
        '<textarea class="textarea" id="typeTa" style="min-height:120px;font-size:16px" placeholder="想说啥就写啥，比如：家里水管漏水了"></textarea>' +
        '<div><div style="font-size:12px;color:var(--slate-l);margin-bottom:8px">常用的话，点一下就填上</div>' +
        '<div class="quick-row" id="quickRow"></div></div>' +
        '</div>',
      footer: '<button class="btn btn--ghost" data-close>取消</button><button class="btn btn--amber" id="typeGo">就这句</button>',
      onMount(api) {
        const ta = api.el.querySelector('#typeTa');
        api.el.querySelector('#quickRow').innerHTML = SY_DATA.quickPhrases
          .map(p => '<button class="quick-chip" data-p="' + p + '">' + p + '</button>').join('');
        api.el.querySelectorAll('[data-p]').forEach(b => {
          b.addEventListener('click', () => {
            ta.value = (ta.value ? ta.value + '，' : '') + b.dataset.p;
            ta.focus();
          });
        });
        api.el.querySelector('#typeGo').addEventListener('click', () => {
          const v = ta.value.trim();
          if (!v) { UI.toast('还没写内容', 'err'); return; }
          api.close();
          setTimeout(() => buildConfirm(v, '打字'), 180);
        });
        setTimeout(() => ta.focus(), 120);
      }
    });
  });

  /* ---------------- 设置 ---------------- */
  function openSettings() {
    const cfg = Speech.loadConfig();
    const configured = Speech.isConfigured && Speech.isConfigured();
    UI.modal({
      title: '设置',
      sub: '语音识别服务、播报与个人信息',
      size: 'lg',
      body:
        '<div class="set-sec">' +
        '<div class="h">语音识别服务 <span class="tag ' + (configured ? 'tag--green' : 'tag--amber') + '">' +
        (configured ? '已接入' : '原型演示中') + '</span></div>' +
        '<div style="font-size:12.5px;color:var(--slate-l);line-height:1.8;margin-bottom:14px">' +
        '填入识别服务地址与密钥后，系统会直接调用真实接口；留空则使用本地模拟，便于演示。' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="field"><label>识别服务地址（Endpoint）</label>' +
        '<input class="input" id="cfgEndpoint" placeholder="https://your-asr/api/recognize" value="' + (cfg.endpoint || '') + '"></div>' +
        '<div class="field"><label>API Key</label>' +
        '<input class="input" id="cfgKey" type="password" placeholder="sk-... / 应用密钥" value="' + (cfg.apiKey || '') + '"></div>' +
        '<div class="field"><label>AppID（部分平台需要）</label>' +
        '<input class="input" id="cfgAppId" placeholder="可选" value="' + (cfg.appId || '') + '"></div>' +
        '<div class="field"><label>方言</label>' +
        '<select class="select" id="cfgDialect">' +
        '<option value="zhongyuan"' + (cfg.dialect === 'zhongyuan' ? ' selected' : '') + '>中原官话</option>' +
        '<option value="mandarin"' + (cfg.dialect === 'mandarin' ? ' selected' : '') + '>普通话</option>' +
        '</select></div>' +
        '</div></div>' +

        '<div class="set-sec">' +
        '<div class="h">手写识别服务</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="field"><label>识别服务地址</label>' +
        '<input class="input" id="cfgHw" placeholder="https://your-ocr/api" value="' + (cfg.handwritingEndpoint || '') + '"></div>' +
        '<div class="field"><label>API Key</label>' +
        '<input class="input" id="cfgHwKey" type="password" placeholder="可选" value="' + (cfg.handwritingKey || '') + '"></div>' +
        '</div></div>' +

        '<div class="set-sec">' +
        '<div class="h">播报</div>' +
        '<div class="set-row"><div class="lb">语音播报<small>提交结果、进度、政策都会念给您听</small></div>' +
        '<label class="switch"><input type="checkbox" id="cfgTts"' + (cfg.ttsEnabled ? ' checked' : '') + '><span></span></label></div>' +
        '<div class="set-row"><div class="lb">语速<small>觉得快或慢，可以调一下</small></div>' +
        '<div class="fs-group" id="rateGroup">' +
        '<button data-rate="0.8"' + (cfg.ttsRate == 0.8 ? ' class="on"' : '') + '>慢一点</button>' +
        '<button data-rate="0.95"' + (cfg.ttsRate == 0.95 ? ' class="on"' : '') + '>正好</button>' +
        '<button data-rate="1.1"' + (cfg.ttsRate == 1.1 ? ' class="on"' : '') + '>快一点</button>' +
        '</div></div>' +
        '</div>' +

        '<div class="set-sec">' +
        '<div class="h">我的档案</div>' +
        '<div style="font-size:13px;line-height:2;color:var(--slate)">' +
        '姓名：' + elder.name + '（' + elder.age + ' 岁）<br>' +
        '住址：' + elder.address + '<br>' +
        '紧急联系人：' + elder.guardian + ' ' + elder.guardianPhone + '<br>' +
        '档案编号：' + elder.id + '</div>' +
        '</div>',
      footer:
        '<button class="btn btn--ghost" data-reset>恢复默认</button>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn--ghost" data-close>取消</button>' +
        '<button class="btn btn--amber" data-save>保存</button>',
      onMount(api) {
        api.el.querySelectorAll('#rateGroup button').forEach(b => {
          b.addEventListener('click', () => {
            api.el.querySelectorAll('#rateGroup button').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
          });
        });
        api.el.querySelector('[data-reset]').addEventListener('click', () => {
          Speech.saveConfig(Speech.DEFAULTS);
          Speech.stopSpeak();
          UI.toast('已恢复默认设置', 'ok');
          api.close();
          updateModeTag();
        });
        api.el.querySelector('[data-save]').addEventListener('click', () => {
          const rateBtn = api.el.querySelector('#rateGroup .on');
          Speech.saveConfig({
            provider: api.el.querySelector('#cfgEndpoint').value.trim() ? 'custom' : 'mock',
            endpoint: api.el.querySelector('#cfgEndpoint').value.trim(),
            apiKey: api.el.querySelector('#cfgKey').value.trim(),
            appId: api.el.querySelector('#cfgAppId').value.trim(),
            dialect: api.el.querySelector('#cfgDialect').value,
            handwritingEndpoint: api.el.querySelector('#cfgHw').value.trim(),
            handwritingKey: api.el.querySelector('#cfgHwKey').value.trim(),
            ttsEnabled: api.el.querySelector('#cfgTts').checked,
            ttsRate: rateBtn ? parseFloat(rateBtn.dataset.rate) : 0.95
          });
          updateModeTag();
          api.close();
          UI.toast('设置已保存', 'ok');
        });
      }
    });
  }

  function updateModeTag() {
    const on = Speech.isConfigured();
    const tag = $('#asrModeTag');
    tag.textContent = on ? '已接入识别' : '原型演示';
    tag.className = 'tag ' + (on ? 'tag--green' : 'tag--amber');
    tag.title = on ? '已配置真实语音识别服务' : '未配置识别服务，当前为模拟演示';
  }

  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnLogout').addEventListener('click', () => {
    UI.confirm({ title: '要退出吗', text: '退出后需要重新输入 ID 和密码。', okText: '退出', danger: true })
      .then(ok => {
        if (!ok) return;
        SY.logout(); Speech.stopSpeak();
        location.replace('index.html');
      });
  });

  /* 播报开关 */
  let ttsOn = Speech.loadConfig().ttsEnabled;
  function paintTtsBtn() {
    const b = $('#btnSpeakToggle');
    b.style.color = ttsOn ? '' : 'var(--slate-xl)';
    b.title = ttsOn ? '语音播报：开' : '语音播报：关';
  }
  $('#btnSpeakToggle').addEventListener('click', () => {
    ttsOn = !ttsOn;
    Speech.saveConfig({ ttsEnabled: ttsOn });
    paintTtsBtn();
    if (!ttsOn) Speech.stopSpeak();
    UI.toast(ttsOn ? '语音播报已打开' : '语音播报已关闭', 'ok');
  });

  /* ---------------- 启动 ---------------- */
  function boot() {
    initHeader();
    updateModeTag();
    paintTtsBtn();
    renderPolicy();
    renderProgress();
    renderHistory();
    SY.onChange(() => { renderProgress(); });
    resetToIdle();

    if (!Speech.supportsTTS) {
      $('#speakHint').innerHTML = '<span style="font-size:11.5px;color:var(--slate-xl)">当前浏览器不支持语音播报，可用文字阅读</span>';
    }
  }

  boot();
})();
