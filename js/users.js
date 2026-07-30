(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SECTIONS = Store.PERMISSION_SECTIONS;
  var LEVELS = Store.ACCESS_LEVELS;

  var filters = { q: '', role: '', status: '' };
  var editingUserId = '';
  var editingRoleId = '';
  var draftPerms = {};

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

  function roleName(roleId) {
    var r = Store.getRole(roleId);
    return r ? r.name : '—';
  }

  /* ---------------- التبويبات ---------------- */
  function initTabs() {
    $all('#usTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#usTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var key = btn.getAttribute('data-tab');
        $all('.co-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
        });
      });
    });
  }

  /* ---------------- جدول المستخدمين ---------------- */
  function visibleUsers() {
    var q = filters.q.trim().toLowerCase();
    return Store.getUsers().filter(function (u) {
      if (q && (u.name + ' ' + u.email).toLowerCase().indexOf(q) === -1) return false;
      if (filters.role && u.roleId !== filters.role) return false;
      if (filters.status && u.status !== filters.status) return false;
      return true;
    });
  }

  function renderStats() {
    var users = Store.getUsers();
    $('#usStatTotal').textContent = users.length;
    $('#usStatActive').textContent = users.filter(function (u) { return u.status === 'active'; }).length;
    $('#usStatDisabled').textContent = users.filter(function (u) { return u.status === 'disabled'; }).length;
    $('#usStatRoles').textContent = Store.getRoles().length;
  }

  function renderTable() {
    var list = visibleUsers();
    var hasFilters = filters.q !== '' || filters.role !== '' || filters.status !== '';

    $('#usTableWrap').hidden = list.length === 0;
    $('#usEmpty').hidden = list.length > 0;

    if (!list.length) {
      $('#usEmptyTitle').textContent = hasFilters ? 'لا توجد نتائج مطابقة' : 'لا يوجد مستخدمون';
      $('#usEmptyText').textContent = hasFilters
        ? 'جرّب تغيير كلمة البحث أو الفلاتر.'
        : 'ادعُ موظفيك للعمل تحت حساب الشركة بصلاحيات محددة.';
      return;
    }

    $('#usTableBody').innerHTML = list.map(function (u) {
      var statusTone = u.status === 'active' ? 'ok' : 'bad';
      var statusLabel = u.status === 'active' ? 'نشط' : 'معطّل';
      return '<tr class="ord-row" data-user="' + esc(u.id) + '" tabindex="0">' +
        '<td><strong>' + esc(u.name) + '</strong>' +
          (u.owner ? '<span class="ord-flag stock">مالك الحساب</span>' : '') + '</td>' +
        '<td dir="ltr">' + esc(u.email) + '</td>' +
        '<td><span class="pd-tag">' + esc(roleName(u.roleId)) + '</span></td>' +
        '<td><span class="ord-status ' + statusTone + '">' + statusLabel + '</span></td>' +
        '<td dir="ltr">' + esc(prettyTime(u.lastLogin)) + '</td>' +
      '</tr>';
    }).join('');

    // كل صف يفتح صفحة تعديل بيانات وصلاحيات المستخدم
    $all('[data-user]', $('#usTableBody')).forEach(function (row) {
      function open() { window.location.href = 'user-details.html?id=' + encodeURIComponent(row.getAttribute('data-user')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  /* ---------------- بطاقات الأدوار ---------------- */
  function permSummary(perms) {
    return SECTIONS.map(function (s) {
      var level = (perms && perms[s.key]) || 'none';
      if (level === 'none') return '';
      var label = level === 'edit' ? 'تعديل' : 'عرض';
      return '<span class="pd-tag">' + esc(s.label) + ': ' + label + '</span>';
    }).filter(Boolean).join('') || '<span class="pd-tag" style="color:var(--muted);background:var(--bg);">لا صلاحيات</span>';
  }

  function renderRoles() {
    var roles = Store.getRoles();

    $('#usRoles').innerHTML = roles.map(function (r) {
      var count = Store.getUsers().filter(function (u) { return u.roleId === r.id; }).length;
      return '<div class="ord-card" style="margin-bottom:14px;">' +
        '<div class="ord-card-head" style="margin-bottom:12px;padding-bottom:10px;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
          '<h3>' + esc(r.name) + '</h3>' +
          (r.system ? '<span class="ord-status info">دور أساسي</span>' : '<span class="ord-status ok">دور مخصص</span>') +
        '</div>' +
        '<p style="font-size:0.82rem;color:var(--muted);margin-bottom:10px;">' + esc(r.desc || '—') + '</p>' +
        '<div class="offer-meta" style="margin-bottom:12px;">' + permSummary(r.perms) + '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
          '<span style="font-size:0.79rem;color:var(--muted);margin-inline-end:auto;">' + count + ' مستخدم بهذا الدور</span>' +
          '<button type="button" class="pd-bulk-btn" data-role-edit="' + esc(r.id) + '">' +
            (r.system ? 'عرض الصلاحيات' : 'تعديل') + '</button>' +
          (r.system ? '' : '<button type="button" class="pd-bulk-btn danger" data-role-remove="' + esc(r.id) + '">حذف</button>') +
        '</div>' +
      '</div>';
    }).join('');

    $all('[data-role-edit]', $('#usRoles')).forEach(function (btn) {
      btn.addEventListener('click', function () { openRoleModal(btn.getAttribute('data-role-edit')); });
    });

    $all('[data-role-remove]', $('#usRoles')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-role-remove');
        var assigned = Store.getUsers().filter(function (u) { return u.roleId === id; });
        if (assigned.length) {
          toast('لا يمكن حذف دور مُسند إلى ' + assigned.length + ' مستخدم — غيّر أدوارهم أولاً', 'danger');
          return;
        }
        if (!window.confirm('حذف هذا الدور نهائياً؟')) return;
        Store.removeRole(id);
        render();
        toast('تم حذف الدور', 'danger');
      });
    });
  }

  /* ---------------- شجرة الصلاحيات ---------------- */
  function renderPermTree(readonly) {
    $('#usPermTree').innerHTML = SECTIONS.map(function (s) {
      var current = draftPerms[s.key] || 'none';
      return '<div class="perm-tree-row">' +
        '<span class="perm-tree-label">' + esc(s.label) + '</span>' +
        '<div class="perm-levels">' +
          LEVELS.map(function (l) {
            return '<button type="button" class="perm-level' + (current === l.key ? ' is-active' : '') + '" ' +
              'data-level="' + l.key + '" data-section="' + s.key + '"' + (readonly ? ' disabled' : '') + '>' +
              esc(l.label) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    if (readonly) return;

    $all('[data-section]', $('#usPermTree')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        draftPerms[btn.getAttribute('data-section')] = btn.getAttribute('data-level');
        renderPermTree(false);
      });
    });
  }

  function openRoleModal(roleId) {
    editingRoleId = roleId || '';
    var role = roleId ? Store.getRole(roleId) : null;
    var readonly = !!(role && role.system);

    $('#usRoleTitle').textContent = role
      ? (readonly ? 'صلاحيات دور: ' + role.name : 'تعديل دور: ' + role.name)
      : 'إنشاء دور مخصص';

    $('#usRoleName').value = role ? role.name : '';
    $('#usRoleDesc').value = role ? (role.desc || '') : '';
    $('#usRoleName').disabled = readonly;
    $('#usRoleDesc').disabled = readonly;
    $('#usRoleSave').hidden = readonly;

    draftPerms = {};
    SECTIONS.forEach(function (s) {
      draftPerms[s.key] = (role && role.perms && role.perms[s.key]) || 'none';
    });

    renderPermTree(readonly);
    $('#usRoleOverlay').hidden = false;
  }

  function saveRole() {
    var name = $('#usRoleName').value.trim();
    if (name.length < 2) { toast('أدخل اسماً صحيحاً للدور', 'danger'); return; }

    var hasAny = SECTIONS.some(function (s) { return draftPerms[s.key] !== 'none'; });
    if (!hasAny) { toast('حدّد صلاحية واحدة على الأقل لهذا الدور', 'danger'); return; }

    Store.saveRole({
      id: editingRoleId || undefined,
      name: name,
      desc: $('#usRoleDesc').value.trim(),
      perms: Object.assign({}, draftPerms)
    });

    $('#usRoleOverlay').hidden = true;
    render();
    toast(editingRoleId ? 'تم تحديث الدور' : 'تم إنشاء الدور بنجاح', 'success');
  }

  /* ---------------- نافذة المستخدم ---------------- */
  function fillRoleSelect(selectEl, selected) {
    selectEl.innerHTML = '<option value="">اختر الدور</option>' +
      Store.getRoles().map(function (r) {
        return '<option value="' + esc(r.id) + '"' + (r.id === selected ? ' selected' : '') + '>' + esc(r.name) + '</option>';
      }).join('');
  }

  function renderRolePreview(roleId) {
    var role = Store.getRole(roleId);
    if (!role) { $('#usRolePreview').innerHTML = ''; return; }

    $('#usRolePreview').innerHTML =
      '<div class="ord-alert info" style="margin-bottom:0;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<span><strong>' + esc(role.name) + ':</strong> ' + esc(role.desc || '') +
        '<div class="offer-meta" style="margin-top:8px;">' + permSummary(role.perms) + '</div></span>' +
      '</div>';
  }

  function openUserModal(userId) {
    editingUserId = userId || '';
    var user = userId ? Store.getUser(userId) : null;

    $('#usUserTitle').textContent = user ? 'تعديل المستخدم' : 'دعوة مستخدم جديد';
    $('#usName').value = user ? user.name : '';
    $('#usEmail').value = user ? user.email : '';
    $('#usPhone').value = user ? (user.phone || '') : '';
    $('#usRoleError').textContent = '';

    fillRoleSelect($('#usRole'), user ? user.roleId : '');
    renderRolePreview(user ? user.roleId : '');

    $all('.field-error', $('#usUserOverlay')).forEach(function (e) { e.textContent = ''; });
    $all('.is-invalid', $('#usUserOverlay')).forEach(function (e) { e.classList.remove('is-invalid'); });

    $('#usUserOverlay').hidden = false;
  }

  function saveUser() {
    if (window.Validate && !Validate.isValid($('#usUserOverlay'))) {
      toast('يرجى تصحيح الحقول المطلوبة', 'danger');
      return;
    }
    if (!$('#usRole').value) {
      $('#usRoleError').textContent = 'يجب اختيار دور للمستخدم';
      return;
    }

    Store.saveUser({
      id: editingUserId || undefined,
      name: $('#usName').value.trim(),
      email: $('#usEmail').value.trim(),
      phone: $('#usPhone').value.trim(),
      roleId: $('#usRole').value
    });

    $('#usUserOverlay').hidden = true;
    render();
    toast(editingUserId ? 'تم تحديث بيانات المستخدم' : 'تمت دعوة المستخدم بنجاح', 'success');
  }

  /* ---------------- الفلاتر ---------------- */
  function fillRoleFilter() {
    var sel = $('#usRoleFilter');
    var keep = sel.value;
    sel.innerHTML = '<option value="">كل الأدوار</option>' +
      Store.getRoles().map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join('');
    sel.value = keep;
  }

  function initControls() {
    $('#usSearch').addEventListener('input', function () { filters.q = this.value; renderTable(); });
    $('#usRoleFilter').addEventListener('change', function () { filters.role = this.value; renderTable(); });
    $('#usStatusFilter').addEventListener('change', function () { filters.status = this.value; renderTable(); });

    $('#usAddUserBtn').addEventListener('click', function () { openUserModal(''); });
    $('#usAddRoleBtn').addEventListener('click', function () { openRoleModal(''); });

    $('#usUserClose').addEventListener('click', function () { $('#usUserOverlay').hidden = true; });
    $('#usUserCancel').addEventListener('click', function () { $('#usUserOverlay').hidden = true; });
    $('#usUserOverlay').addEventListener('click', function (e) {
      if (e.target === $('#usUserOverlay')) $('#usUserOverlay').hidden = true;
    });
    $('#usUserSave').addEventListener('click', saveUser);
    $('#usRole').addEventListener('change', function () { renderRolePreview(this.value); });

    $('#usRoleClose').addEventListener('click', function () { $('#usRoleOverlay').hidden = true; });
    $('#usRoleCancel').addEventListener('click', function () { $('#usRoleOverlay').hidden = true; });
    $('#usRoleOverlay').addEventListener('click', function (e) {
      if (e.target === $('#usRoleOverlay')) $('#usRoleOverlay').hidden = true;
    });
    $('#usRoleSave').addEventListener('click', saveRole);
  }

  function render() {
    renderStats();
    fillRoleFilter();
    renderTable();
    renderRoles();
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) $('#dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    initTabs();
    initControls();

    setTimeout(function () {
      $('#usLoading').hidden = true;
      $('#usContent').hidden = false;
      render();
      if (window.Validate) Validate.attachAll(document);
      Store.subscribe(render);
    }, 220);
  });
})();
