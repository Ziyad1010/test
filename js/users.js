(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var ROLE_LABELS = { admin: 'مدير', sales: 'مبيعات', warehouse: 'مستودعات', finance: 'مالية', readonly: 'قراءة فقط' };

  var users = [
    { id: 1, name: 'محمد العتيبي', email: 'mohammed@example.sa', role: 'admin', status: 'active', lastActive: 'الآن' },
    { id: 2, name: 'سارة القحطاني', email: 'sara@example.sa', role: 'sales', status: 'active', lastActive: 'قبل ساعتين' },
    { id: 3, name: 'خالد المطيري', email: 'khaled@example.sa', role: 'warehouse', status: 'active', lastActive: 'أمس' },
    { id: 4, name: 'نورة الشمري', email: 'noura@example.sa', role: 'finance', status: 'invited', lastActive: '—' }
  ];
  var nextId = 5;

  function renderTable() {
    $('#usrTableBody').innerHTML = users.map(function (u) {
      return '<tr>' +
        '<td><strong>' + u.name + '</strong></td>' +
        '<td>' + u.email + '</td>' +
        '<td><span class="role-pill">' + ROLE_LABELS[u.role] + '</span></td>' +
        '<td><span class="pd-status-pill ' + (u.status === 'active' ? 'active' : 'draft') + '">' + (u.status === 'active' ? 'نشط' : 'دعوة مرسلة') + '</span></td>' +
        '<td>' + u.lastActive + '</td>' +
        '<td><div class="pd-table-actions"><button type="button" title="إزالة" data-remove="' + u.id + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button></div></td>' +
      '</tr>';
    }).join('');

    $all('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-remove'), 10);
        var user = users.find(function (u) { return u.id === id; });
        if (user && user.role === 'admin' && users.filter(function (u) { return u.role === 'admin'; }).length === 1) {
          if (window.Shell) Shell.toast('لا يمكن إزالة المدير الوحيد للحساب', 'danger');
          return;
        }
        if (window.confirm('هل تريد إزالة "' + user.name + '" من فريق العمل؟')) {
          users = users.filter(function (u) { return u.id !== id; });
          renderTable();
        }
      });
    });
  }

  var PERMISSIONS = [
    'إدارة المنتجات', 'إدارة الطلبات', 'إدارة العروض', 'الوصول للفواتير', 'إدارة المستودعات', 'إدارة المستخدمين', 'الإعدادات المالية'
  ];
  var ROLES = ['admin', 'sales', 'warehouse', 'finance', 'readonly'];

  // Sensible defaults per role — admin gets everything, read-only gets nothing.
  var DEFAULT_GRANTS = {
    admin: [1, 1, 1, 1, 1, 1, 1],
    sales: [1, 1, 1, 0, 0, 0, 0],
    warehouse: [0, 1, 0, 0, 1, 0, 0],
    finance: [0, 0, 0, 1, 0, 0, 1],
    readonly: [0, 0, 0, 0, 0, 0, 0]
  };

  function renderMatrix() {
    var head = '<thead><tr><th>الصلاحية</th>' + ROLES.map(function (r) { return '<th>' + ROLE_LABELS[r] + '</th>'; }).join('') + '</tr></thead>';
    var body = '<tbody>' + PERMISSIONS.map(function (perm, pIndex) {
      return '<tr><td>' + perm + '</td>' + ROLES.map(function (role) {
        var checked = DEFAULT_GRANTS[role][pIndex] ? 'checked' : '';
        var isAdmin = role === 'admin';
        return '<td><input type="checkbox" class="perm-check" ' + checked + (isAdmin ? ' disabled' : '') + ' data-role="' + role + '" data-perm="' + pIndex + '" /></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    $('#permTable').innerHTML = head + body;

    $all('.perm-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        DEFAULT_GRANTS[cb.getAttribute('data-role')][parseInt(cb.getAttribute('data-perm'), 10)] = cb.checked ? 1 : 0;
        if (window.Shell) Shell.toast('تم تحديث صلاحيات دور "' + ROLE_LABELS[cb.getAttribute('data-role')] + '"');
      });
    });
  }

  function initModal() {
    $('#usrInviteBtn').addEventListener('click', function () { $('#usrModalOverlay').hidden = false; });
    $('#usrModalClose').addEventListener('click', closeModal);
    $('#usrCancelBtn').addEventListener('click', closeModal);
    $('#usrModalOverlay').addEventListener('click', function (e) { if (e.target === $('#usrModalOverlay')) closeModal(); });

    $('#usrSendBtn').addEventListener('click', function () {
      var name = $('#usrName').value.trim();
      var email = $('#usrEmail').value.trim();
      var role = $('#usrRole').value;

      if (!email) {
        if (window.Shell) Shell.toast('يرجى إدخال البريد الإلكتروني', 'danger');
        return;
      }

      users.push({ id: nextId++, name: name || email.split('@')[0], email: email, role: role, status: 'invited', lastActive: '—' });
      renderTable();
      closeModal();
      if (window.Shell) Shell.toast('تم إرسال دعوة إلى ' + email, 'success');
    });
  }

  function closeModal() {
    $('#usrModalOverlay').hidden = true;
    $('#usrName').value = ''; $('#usrEmail').value = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderTable();
    renderMatrix();
    initModal();
  });
})();
