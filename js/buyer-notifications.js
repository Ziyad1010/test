(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var ICONS = {
    order: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    shipping: '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    offer: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/>'
  };

  var TABS = [
    { key: '', label: 'الكل' },
    { key: 'order', label: 'الطلبات' },
    { key: 'shipping', label: 'الشحن' },
    { key: 'invoice', label: 'الفواتير' },
    { key: 'offer', label: 'العروض' }
  ];

  var currentTab = '';
  var readFilter = '';
  var search = '';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function relativeTime(at) {
    if (!at) return '—';
    var then = new Date(String(at).replace(' ', 'T'));
    if (isNaN(then.getTime())) return String(at);

    var diffMin = Math.round((new Date() - then) / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return 'قبل ' + diffMin + ' دقيقة';
    if (diffMin < 60 * 24) return 'قبل ' + Math.round(diffMin / 60) + ' ساعة';
    if (diffMin < 60 * 48) return 'أمس';
    return String(at).split('T')[0];
  }

  function visible() {
    var q = search.trim().toLowerCase();
    return Buyer.notifications().filter(function (n) {
      if (currentTab && n.type !== currentTab) return false;
      if (readFilter === 'unread' && n.read) return false;
      if (readFilter === 'read' && !n.read) return false;
      if (q && (n.title + ' ' + n.body).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function renderTabs() {
    var all = Buyer.notifications();
    $('#bnTabs').innerHTML = TABS.map(function (t) {
      var count = t.key ? all.filter(function (n) { return n.type === t.key; }).length : all.length;
      if (t.key && count === 0) return '';
      return '<button type="button" class="tab-btn' + (currentTab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
        esc(t.label) + '<span class="count">(' + count + ')</span></button>';
    }).join('');

    $all('[data-tab]', $('#bnTabs')).forEach(function (btn) {
      btn.addEventListener('click', function () { currentTab = btn.getAttribute('data-tab'); render(); });
    });
  }

  function renderList() {
    var list = visible();

    $('#bnLoading').hidden = true;
    $('#bnList').hidden = list.length === 0;
    $('#bnEmpty').hidden = list.length > 0;

    if (!list.length) {
      $('#bnEmptyTitle').textContent = (search || readFilter) ? 'لا توجد نتائج مطابقة' : 'لا توجد إشعارات';
      $('#bnEmptyText').textContent = (search || readFilter)
        ? 'جرّب تغيير كلمة البحث أو حالة القراءة.'
        : 'ستظهر هنا تحديثات طلباتك وشحناتك.';
      return;
    }

    $('#bnList').innerHTML = list.map(function (n) {
      var icon = ICONS[n.type] || ICONS.order;
      return '<div class="nt-item' + (n.read ? '' : ' is-unread') + (n.priority === 'high' ? ' is-high' : '') + '" ' +
        'data-notif="' + esc(n.id) + '" data-link="' + esc(n.link || '') + '" tabindex="0">' +
        (n.read ? '<span class="nt-dot placeholder"></span>' : '<span class="nt-dot"></span>') +
        '<span class="nt-icon ' + (n.type === 'shipping' ? 'order' : esc(n.type)) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></span>' +
        '<div class="nt-body">' +
          '<div class="nt-title">' + esc(n.title) +
            (n.priority === 'high' ? '<span class="nt-priority">عاجل</span>' : '') + '</div>' +
          '<div class="nt-desc">' + esc(n.body) + '</div>' +
        '</div>' +
        '<span class="nt-time">' + esc(relativeTime(n.at)) + '</span>' +
      '</div>';
    }).join('');

    // كل إشعار يقود لصفحته ذات العلاقة
    $all('[data-notif]', $('#bnList')).forEach(function (el) {
      function open() {
        Buyer.markNotificationRead(el.getAttribute('data-notif'));
        var link = el.getAttribute('data-link');
        if (link) window.location.href = link; else render();
      }
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function render() {
    renderTabs();
    renderList();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#bnSearch').addEventListener('input', function () { search = this.value; renderList(); });
    $('#bnReadFilter').addEventListener('change', function () { readFilter = this.value; renderList(); });

    $('#bnMarkAll').addEventListener('click', function () {
      Buyer.markAllNotificationsRead();
      render();
      toast('تم تحديد جميع الإشعارات كمقروءة', 'success');
    });

    setTimeout(function () {
      render();
      Store.subscribe(render);
    }, 220);
  });
})();
