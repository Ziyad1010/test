(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SECTIONS = Store.PERMISSION_SECTIONS;
  var LEVELS = Store.ACCESS_LEVELS;

  var userId = '';
  var user = null;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function prettyTime(s) {
    if (!s) return 'لم يسجّل الدخول بعد';
    var parts = String(s).split('T');
    return parts.length > 1 ? parts[0] + ' · ' + parts[1] : parts[0];
  }

  function row(label, value) {
    return '<div class="ord-info-row"><span>' + esc(label) + '</span><span>' + value + '</span></div>';
  }

  function alertHtml(tone, body) {
    return '<div class="ord-alert ' + tone + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span>' + body + '</span></div>';
  }

  /* ---------------- العرض ---------------- */
  function fillForm() {
    $('#udNameInput').value = user.name || '';
    $('#udEmail').value = user.email || '';
    $('#udPhone').value = user.phone || '';

    $('#udRole').innerHTML = Store.getRoles().map(function (r) {
      return '<option value="' + esc(r.id) + '"' + (r.id === user.roleId ? ' selected' : '') + '>' + esc(r.name) + '</option>';
    }).join('');

    // مالك الحساب لا يمكن تغيير دوره — يملك كل الصلاحيات دائماً
    $('#udRole').disabled = !!user.owner;
  }

  function renderPermTree() {
    var role = Store.getRole($('#udRole').value) || Store.getRole(user.roleId);
    $('#udRoleDesc').textContent = role ? (role.desc || '') : '';

    $('#udPermTree').innerHTML = SECTIONS.map(function (s) {
      var current = (role && role.perms && role.perms[s.key]) || 'none';
      return '<div class="perm-tree-row">' +
        '<span class="perm-tree-label">' + esc(s.label) + '</span>' +
        '<div class="perm-levels">' +
          LEVELS.map(function (l) {
            return '<button type="button" class="perm-level' + (current === l.key ? ' is-active' : '') + '" ' +
              'data-level="' + l.key + '" disabled>' + esc(l.label) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderMeta() {
    var role = Store.getRole(user.roleId);
    var statusTone = user.status === 'active' ? 'ok' : 'bad';
    var statusLabel = user.status === 'active' ? 'نشط' : 'معطّل';

    $('#udMeta').innerHTML =
      row('الحالة', '<span class="ord-status ' + statusTone + '">' + statusLabel + '</span>') +
      row('الدور', '<span class="pd-tag">' + esc(role ? role.name : '—') + '</span>') +
      row('آخر دخول', '<span dir="ltr">' + esc(prettyTime(user.lastLogin)) + '</span>') +
      row('تاريخ الإضافة', '<span dir="ltr">' + esc(user.createdAt || '—') + '</span>') +
      row('نوع الحساب', user.owner ? 'مالك الحساب الرئيسي' : 'مستخدم فرعي');
  }

  function renderAlerts() {
    var out = '';
    if (user.owner) {
      out += alertHtml('info', '<strong>هذا هو مالك الحساب الرئيسي.</strong> ' +
        'لا يمكن تعطيله أو تغيير دوره لضمان بقاء صلاحية إدارة كاملة على الحساب.');
    } else if (user.status === 'disabled') {
      out += alertHtml('warn', '<strong>هذا الحساب معطّل حالياً.</strong> ' +
        'لا يستطيع المستخدم تسجيل الدخول، لكن بياناته وسجل نشاطه محفوظان.');
    }
    $('#udAlerts').innerHTML = out;
  }

  function renderActivity() {
    var list = Store.getUserActivity(user.id);
    var wrap = $('#udActivity');

    if (!list.length) {
      wrap.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);text-align:center;padding:22px 0;">' +
        'لم يُسجَّل أي نشاط لهذا المستخدم بعد.</p>';
      return;
    }

    wrap.innerHTML = '<div class="ord-timeline">' + list.map(function (a, i) {
      return '<div class="ord-tl-item' + (i === 0 ? ' is-current' : ' is-done') + '">' +
        '<span class="ord-tl-dot">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
        '</span>' +
        '<div class="ord-tl-body">' +
          '<div class="ord-tl-title">' + esc(a.action) + '</div>' +
          '<span class="ord-tl-time">' + esc(prettyTime(a.at)) + '</span>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderActions() {
    var out = '';

    if (!user.owner) {
      if (user.status === 'active') {
        out += '<button type="button" class="ord-action-btn danger" data-act="disable">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' +
          'تعطيل الحساب فوراً</button>';
      } else {
        out += '<button type="button" class="ord-action-btn primary" data-act="enable">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          'إعادة تفعيل الحساب</button>';
      }

      out += '<button type="button" class="ord-action-btn" data-act="reset">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        'إرسال رابط إعادة تعيين كلمة المرور</button>';

      out += '<button type="button" class="ord-action-btn danger" data-act="remove">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
        'حذف المستخدم نهائياً</button>';
    } else {
      out += '<p style="font-size:0.84rem;color:var(--muted);line-height:1.7;">' +
        'لا توجد إجراءات متاحة على مالك الحساب الرئيسي.</p>';
    }

    $('#udActions').innerHTML = out;

    $all('[data-act]', $('#udActions')).forEach(function (btn) {
      btn.addEventListener('click', function () { handleAction(btn.getAttribute('data-act')); });
    });
  }

  function handleAction(act) {
    if (act === 'disable') {
      if (!window.confirm('تعطيل حساب «' + user.name + '»؟ لن يتمكن من تسجيل الدخول، وتبقى بياناته محفوظة.')) return;
      Store.setUserStatus(user.id, 'disabled');
      toast('تم تعطيل الحساب', 'danger');
      reload();
      return;
    }

    if (act === 'enable') {
      Store.setUserStatus(user.id, 'active');
      toast('تم إعادة تفعيل الحساب', 'success');
      reload();
      return;
    }

    if (act === 'reset') {
      Store.addUserActivity(user.id, 'أُرسل له رابط إعادة تعيين كلمة المرور');
      Store.addAudit('المالك', 'إعادة تعيين كلمة مرور', user.name);
      // لا إرسال بريد فعلي بدون خادم خلفي — يُسجَّل الإجراء فقط
      toast('تم تسجيل طلب إعادة التعيين — الإرسال الفعلي يتطلب ربط خادم بريد', 'success');
      reload();
      return;
    }

    if (act === 'remove') {
      if (!window.confirm('حذف «' + user.name + '» نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
      Store.removeUser(user.id);
      toast('تم حذف المستخدم', 'danger');
      window.location.href = 'users.html';
    }
  }

  function save() {
    if (window.Validate && !Validate.isValid($('#udContent'))) {
      toast('يرجى تصحيح الحقول المطلوبة', 'danger');
      return;
    }

    Store.saveUser({
      id: user.id,
      name: $('#udNameInput').value.trim(),
      email: $('#udEmail').value.trim(),
      phone: $('#udPhone').value.trim(),
      roleId: user.owner ? user.roleId : $('#udRole').value
    });

    toast('تم حفظ بيانات المستخدم', 'success');
    reload();
  }

  function render() {
    $('#udName').textContent = user.name;
    $('#udSubtitle').textContent = user.email + ' — ' +
      (Store.getRole(user.roleId) ? Store.getRole(user.roleId).name : '');

    fillForm();
    renderPermTree();
    renderMeta();
    renderAlerts();
    renderActivity();
    renderActions();
  }

  function reload() {
    user = Store.getUser(userId);
    if (user) render();
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) $('#dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    userId = new URLSearchParams(window.location.search).get('id') || '';

    $('#udSaveBtn').addEventListener('click', save);

    setTimeout(function () {
      user = Store.getUser(userId);
      $('#udLoading').hidden = true;

      if (!user) {
        $('#udNotFound').hidden = false;
        $('#udSubtitle').textContent = 'المستخدم غير موجود';
        return;
      }

      $('#udContent').hidden = false;
      $('#udSaveBtn').hidden = false;
      render();

      $('#udRole').addEventListener('change', renderPermTree);
      if (window.Validate) Validate.attachAll(document);
    }, 220);
  });
})();
