/* 登录页交互 */
(function () {
  'use strict';

  const roleBox = document.querySelector('.roles');
  const form = document.getElementById('loginForm');
  const uid = document.getElementById('uid');
  const pwd = document.getElementById('pwd');
  const errBox = document.getElementById('loginError');
  const errText = document.getElementById('loginErrorText');
  const submit = document.getElementById('submitBtn');
  const uidLabel = document.getElementById('uidLabel');
  const uidHint = document.getElementById('uidHint');
  let role = 'elder';

  const COPY = {
    elder: {
      label: '老人档案编号',
      hint: 'ID 由社区在录入档案时分配，与您的个人信息一一对应',
      ph: '例如 E1001'
    },
    admin: {
      label: '社区工作工号',
      hint: '工号由街道统一分配，登录后按职责范围查看工单',
      ph: '例如 sg001'
    }
  };

  function setRole(next, keepValues) {
    role = next;
    roleBox.dataset.role = next;
    roleBox.querySelectorAll('[data-role-btn]').forEach(b => {
      b.classList.toggle('on', b.dataset.roleBtn === next);
    });
    uidLabel.textContent = COPY[next].label;
    uidHint.textContent = COPY[next].hint;
    uid.placeholder = COPY[next].ph;
    hideError();
    if (!keepValues) { uid.value = ''; pwd.value = ''; }
    uid.focus({ preventScroll: true });
  }

  roleBox.querySelectorAll('[data-role-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.roleBtn === role) return;
      setRole(btn.dataset.roleBtn);
    });
  });

  /* 密码可见切换 */
  document.getElementById('pwToggle').addEventListener('click', function () {
    const show = pwd.type === 'password';
    pwd.type = show ? 'text' : 'password';
    this.style.color = show ? '#12233A' : '';
  });

  document.querySelectorAll('[data-fill]').forEach(chip => {
    chip.addEventListener('click', () => {
      const [r, id, pw] = chip.dataset.fill.split('|');
      setRole(r);
      uid.value = id;
      pwd.value = pw;
      hideError();
      submit.focus({ preventScroll: true });
    });
  });

  function showError(msg) {
    errText.textContent = msg;
    errBox.classList.add('show');
    errBox.style.animation = 'none';
    void errBox.offsetWidth;
    errBox.style.animation = '';
  }
  function hideError() { errBox.classList.remove('show'); }

  form.addEventListener('submit', e => {
    e.preventDefault();
    hideError();
    if (!uid.value.trim()) { showError('请输入唯一 ID'); uid.focus(); return; }
    if (!pwd.value) { showError('请输入密码'); pwd.focus(); return; }

    submit.classList.add('loading');
    submit.querySelector('.txt').textContent = '正 在 验 证';

    setTimeout(() => {
      const res = SY.login(uid.value, pwd.value, role);
      if (!res.ok) {
        submit.classList.remove('loading');
        submit.querySelector('.txt').textContent = '进 入 系 统';
        showError(res.msg);
        return;
      }
      submit.querySelector('.txt').textContent = '验 证 通 过';
      setTimeout(() => {
        location.href = role === 'elder' ? 'elder.html' : 'admin.html';
      }, 260);
    }, 420);
  });

  [uid, pwd].forEach(el => el.addEventListener('input', hideError));

  /* 已登录则直接进入 */
  const s = SY.session();
  if (s && s.role === 'elder' && SY.elderById(s.id)) {
    location.replace('elder.html');
  } else if (s && s.role === 'admin') {
    location.replace('admin.html');
  } else {
    uid.focus();
  }
})();
