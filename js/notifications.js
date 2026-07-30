(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var ICONS = {
    order: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    status: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    stock: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>',
    invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    offer: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    admin: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    'return': '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'
  };

  var TABS = [
    { key: '', label: 'الكل' },
    { key: 'order', label: 'طلبات جديدة' },
    { key: 'stock', label: 'تنبيهات المخزون' },
    { key: 'invoice', label: 'فواتير مستحقة' },
    { key: 'offer', label: 'تحديثات العروض' },
    { key: 'admin', label: 'رسائل إدارية' },
    { key: 'status', label: 'تحديثات الطلبات' },
    { key: 'return', label: 'طلبات الإرجاع' }
  ];

  var notifications = [];
  var currentTab = '';
  var readFilter = '';
  var search = '';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  // 2026-07-20T14:30 → "قبل 10 دقائق" / "اليوم 14:30" / "2026-07-18"
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

  function load() {
    notifications = Store.allNotifications();
  }

  function matches(n) {
    if (currentTab && n.type !== currentTab) return false;
    if (readFilter === 'unread' && n.read) return false;
    if (readFilter === 'read' && !n.read) return false;
    var q = search.trim().toLowerCase();
    if (q && (n.title + ' ' + n.body).toLowerCase().indexOf(q) === -1) return false;
    return true;
  }

  function visible() { return notifications.filter(matches); }

  function renderHighAlert() {
    var high = notifications.filter(function (n) { return n.priority === 'high' && !n.read; });
    $('#notifHighAlert').hidden = high.length === 0;
    if (high.length) {
      $('#notifHighText').innerHTML = '<strong>' + high.length + ' تنبيه حرج يحتاج إجراءً فورياً</strong> — ' +
        'نفاد مخزون أو تأخر شحن أو فواتير متأخرة. تظهر مميّزة بشريط أحمر في القائمة.';
    }
  }

  function renderTabs() {
    $('#notifTabs').innerHTML = TABS.map(function (t) {
      var count = t.key
        ? notifications.filter(function (n) { return n.type === t.key; }).length
        : notifications.length;
      if (t.key && count === 0) return '';
      return '<button type="button" class="tab-btn' + (currentTab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
        esc(t.label) + '<span class="count">(' + count + ')</span></button>';
    }).join('');

    $all('[data-tab]', $('#notifTabs')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTab = btn.getAttribute('data-tab');
        render();
      });
    });
  }

  function renderList() {
    var list = visible();

    $('#notifLoading').hidden = true;
    $('#notifList').hidden = list.length === 0;
    $('#notifEmpty').hidden = list.length > 0;

    if (!list.length) {
      var label = '';
      TABS.forEach(function (t) { if (t.key === currentTab) label = t.label; });
      $('#notifEmptyTitle').textContent = (search || readFilter)
        ? 'لا توجد نتائج مطابقة'
        : 'لا توجد إشعارات في «' + label + '»';
      $('#notifEmptyText').textContent = (search || readFilter)
        ? 'جرّب تغيير كلمة البحث أو حالة القراءة.'
        : 'ستظهر هنا التنبيهات المتعلقة بطلباتك ومخزونك وفواتيرك.';
      return;
    }

    $('#notifList').innerHTML = list.map(function (n) {
      var icon = ICONS[n.type] || ICONS.admin;
      return '<div class="nt-item' + (n.read ? '' : ' is-unread') + (n.priority === 'high' ? ' is-high' : '') + '" ' +
        'data-notif="' + esc(n.id) + '" data-link="' + esc(n.link || '') + '" tabindex="0">' +
        (n.read ? '<span class="nt-dot placeholder"></span>' : '<span class="nt-dot"></span>') +
        '<span class="nt-icon ' + esc(n.type) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></span>' +
        '<div class="nt-body">' +
          '<div class="nt-title">' + esc(n.title) +
            (n.priority === 'high' ? '<span class="nt-priority">عاجل</span>' : '') + '</div>' +
          '<div class="nt-desc">' + esc(n.body) + '</div>' +
        '</div>' +
        '<span class="nt-time">' + esc(relativeTime(n.at)) + '</span>' +
      '</div>';
    }).join('');

    // كل إشعار يفتح الصفحة ذات العلاقة مباشرة
    $all('[data-notif]', $('#notifList')).forEach(function (el) {
      function open() {
        var id = el.getAttribute('data-notif');
        var link = el.getAttribute('data-link');
        // الإشعارات المشتقة (live) لا تُخزَّن، فلا حالة قراءة لها
        if (id.indexOf('LIVE-') !== 0) Store.markNotificationRead(id);
        if (link) window.location.href = link;
        else { load(); render(); }
      }
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function render() {
    renderHighAlert();
    renderTabs();
    renderList();
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();

    var type = new URLSearchParams(window.location.search).get('type');
    if (type) TABS.forEach(function (t) { if (t.key === type) currentTab = type; });

    $('#notifSearch').addEventListener('input', function () { search = this.value; render(); });
    $('#notifReadFilter').addEventListener('change', function () { readFilter = this.value; render(); });

    $('#notifMarkAllBtn').addEventListener('click', function () {
      Store.markAllNotificationsRead();
      load();
      render();
      toast('تم تحديد جميع الإشعارات المخزّنة كمقروءة', 'success');
    });

    setTimeout(function () {
      load();
      render();
      Store.subscribe(function () { load(); render(); });
    }, 220);
  });
})();
