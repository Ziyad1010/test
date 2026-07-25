(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var TYPE_LABELS = { main: 'مستودع رئيسي', sub: 'مستودع فرعي', temp: 'تخزين مؤقت' };
  var WAREHOUSE_ICON = '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>';

  var fallbackWarehouses = [
    { name: 'مستودع الرياض الرئيسي', type: 'main', isMain: true, capacity: '2400', hoursFrom: '07:00', hoursTo: '18:00', contact: 'خالد المطيري', phone: '011 234 5678', address: 'المدينة الصناعية الثانية، الرياض' },
    { name: 'مستودع جدة', type: 'sub', isMain: false, capacity: '1500', hoursFrom: '08:00', hoursTo: '17:00', contact: 'سعود الحربي', phone: '012 654 3210', address: 'حي الشرفية، جدة' },
    { name: 'مستودع الدمام', type: 'sub', isMain: false, capacity: '900', hoursFrom: '08:00', hoursTo: '17:00', contact: 'فيصل القحطاني', phone: '013 456 7890', address: 'المنطقة الصناعية الأولى، الدمام' }
  ];

  function loadWarehouses() {
    try {
      var raw = localStorage.getItem('ammar_onboarding_data');
      if (raw) {
        var data = JSON.parse(raw);
        var named = (data.warehouses || []).filter(function (w) { return w.name && w.name.trim(); });
        if (named.length) return named;
      }
    } catch (e) { /* ignore */ }
    return fallbackWarehouses;
  }

  function renderCards() {
    var warehouses = loadWarehouses();
    // Deterministic pseudo-random fill percentage per warehouse for the capacity bar demo.
    $('#whGrid').innerHTML = warehouses.map(function (w, i) {
      var fillPct = 45 + ((i * 17) % 45);
      return '<div class="wh-card">' +
        '<div class="wh-card-head">' +
          '<div class="wh-card-title">' +
            '<span class="wh-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + WAREHOUSE_ICON + '</svg></span>' +
            '<div><strong>' + w.name + '</strong><div style="font-size:0.78rem;color:var(--muted);">' + (TYPE_LABELS[w.type] || 'مستودع') + '</div></div>' +
          '</div>' +
          (w.isMain ? '<span class="wh-main-badge">رئيسي</span>' : '') +
        '</div>' +
        '<div class="wh-capacity-bar"><div class="wh-capacity-fill" style="width:' + fillPct + '%"></div></div>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-bottom:6px;">نسبة الإشغال ' + fillPct + '%</div>' +
        '<div class="wh-meta-row"><span>ساعات العمل</span><strong>' + (w.hoursFrom || '—') + ' - ' + (w.hoursTo || '—') + '</strong></div>' +
        '<div class="wh-meta-row"><span>مسؤول التواصل</span><strong>' + (w.contact || '—') + '</strong></div>' +
        '<div class="wh-meta-row"><span>الهاتف</span><strong>' + (w.phone || '—') + '</strong></div>' +
        '<div class="wh-meta-row"><span>العنوان</span><strong>' + (w.address || '—') + '</strong></div>' +
      '</div>';
    }).join('');
  }

  var TAB_DATA = {
    inventory: {
      head: ['المنتج', 'الفئة', 'الكمية', 'المستودع', 'الحالة'],
      rows: [
        ['حديد تسليح سعودي 12مم', 'حديد وصلب', '50 طن', 'مستودع الرياض الرئيسي', '<span class="pd-status-pill active">متوفر</span>'],
        ['أسمنت بورتلاندي عادي', 'أسمنت', '8 كيس', 'مستودع الرياض الرئيسي', '<span class="pd-status-pill draft">منخفض</span>'],
        ['بلاط بورسلين 60×60', 'مواد تشطيب', '320 م²', 'مستودع الدمام', '<span class="pd-status-pill active">متوفر</span>'],
        ['طوب أسمنتي مصمت', 'طوب وبلوك', '0 قطعة', 'مستودع الرياض الرئيسي', '<span class="pd-status-pill archived">نفد</span>']
      ]
    },
    incoming: {
      head: ['رقم الشحنة', 'المورد', 'المنتج', 'الكمية', 'تاريخ الوصول المتوقع'],
      rows: [
        ['IN-3391', 'مصنع حديد الراجحي', 'حديد تسليح 16مم', '20 طن', '2026-07-28'],
        ['IN-3388', 'أسمنت اليمامة', 'أسمنت بورتلاندي', '500 كيس', '2026-07-26'],
        ['IN-3379', 'الخزف السعودي', 'بلاط بورسلين', '150 م²', '2026-07-24']
      ]
    },
    outgoing: {
      head: ['رقم الطلب', 'العميل', 'المنتج', 'الكمية', 'تاريخ الشحن'],
      rows: [
        ['#1024', 'شركة البناء الحديث', 'أسمنت بورتلاندي', '100 كيس', '2026-07-21'],
        ['#1022', 'شركة الرياض للمقاولات', 'خرسانة جاهزة C30', '20 م³', '2026-07-19'],
        ['#1019', 'شركة البناء الحديث', 'حديد تسليح 16مم', '2 طن', '2026-07-16']
      ]
    },
    transfers: {
      head: ['من مستودع', 'إلى مستودع', 'المنتج', 'الكمية', 'الحالة'],
      rows: [
        ['مستودع الرياض الرئيسي', 'مستودع جدة', 'أسمنت بورتلاندي', '200 كيس', '<span class="pd-status-pill prep">قيد النقل</span>'],
        ['مستودع جدة', 'مستودع الدمام', 'بلاط بورسلين', '80 م²', '<span class="pd-status-pill active">تم النقل</span>']
      ]
    }
  };

  function renderTab(tab) {
    var data = TAB_DATA[tab];
    $('#whTableHead').innerHTML = '<tr>' + data.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
    $('#whTableBody').innerHTML = data.rows.map(function (row) {
      return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
    }).join('');
  }

  function initTabs() {
    $all('#whTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#whTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        renderTab(btn.getAttribute('data-tab'));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderCards();
    initTabs();
    renderTab('inventory');
  });
})();
