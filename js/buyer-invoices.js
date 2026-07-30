(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.INVOICE_STATUS;

  var TABS = [
    { key: '', label: 'الكل' },
    { key: 'paid', label: S.paid.label },
    { key: 'pending', label: S.pending.label },
    { key: 'overdue', label: S.overdue.label }
  ];

  var currentTab = '';
  var current = null;

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function visible() {
    return Buyer.invoices().filter(function (i) { return !currentTab || i.status === currentTab; });
  }

  function renderTabs() {
    var all = Buyer.invoices();
    $('#biTabs').innerHTML = TABS.map(function (t) {
      var count = t.key ? all.filter(function (i) { return i.status === t.key; }).length : all.length;
      return '<button type="button" class="tab-btn' + (currentTab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
        esc(t.label) + '<span class="count">(' + count + ')</span></button>';
    }).join('');

    $all('[data-tab]', $('#biTabs')).forEach(function (btn) {
      btn.addEventListener('click', function () { currentTab = btn.getAttribute('data-tab'); render(); });
    });
  }

  function renderTable() {
    var list = visible();

    $('#biLoading').hidden = true;
    $('#biTableWrap').hidden = list.length === 0;
    $('#biEmpty').hidden = list.length > 0;

    if (!list.length) {
      var label = '';
      TABS.forEach(function (t) { if (t.key === currentTab) label = t.label; });
      $('#biEmptyTitle').textContent = 'لا توجد فواتير في «' + label + '»';
      $('#biEmptyText').textContent = 'تُصدر الفواتير تلقائياً بعد تأكيد طلباتك.';
      return;
    }

    $('#biTableBody').innerHTML = list.map(function (i) {
      var meta = S[i.status] || S.pending;
      return '<tr class="ord-row" data-inv="' + esc(i.id) + '" tabindex="0">' +
        '<td><span class="ord-id">' + esc(i.id) + '</span></td>' +
        '<td><span class="ord-link" dir="ltr">' + esc(i.orderId) + '</span></td>' +
        '<td dir="ltr">' + esc(i.issue) + '</td>' +
        '<td dir="ltr">' + esc(i.due) + '</td>' +
        '<td class="ord-amount">' + fmt(i.netAmount) + ' ر.س</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    // كل فاتورة قابلة للنقر لعرض تفاصيلها
    $all('[data-inv]', $('#biTableBody')).forEach(function (row) {
      function open() { openModal(row.getAttribute('data-inv')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function openModal(id) {
    current = Buyer.invoice(id);
    if (!current) return;

    var meta = S[current.status] || S.pending;
    var vat = current.amount * Store.VAT_RATE / (1 + Store.VAT_RATE);

    $('#biModalTitle').textContent = 'الفاتورة ' + current.id;

    $('#biModalBody').innerHTML =
      '<div class="ord-info-list" style="margin-bottom:16px;">' +
        '<div class="ord-info-row"><span>الحالة</span><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></div>' +
        '<div class="ord-info-row"><span>الطلب</span>' +
          '<a class="ord-link" href="buyer-order-details.html?id=' + encodeURIComponent(current.orderId) + '" dir="ltr">' + esc(current.orderId) + '</a></div>' +
        '<div class="ord-info-row"><span>تاريخ الإصدار</span><span dir="ltr">' + esc(current.issue) + '</span></div>' +
        '<div class="ord-info-row"><span>تاريخ الاستحقاق</span><span dir="ltr">' + esc(current.due) + '</span></div>' +
        '<div class="ord-info-row"><span>طريقة الدفع</span><span>' + esc(current.payment) + '</span></div>' +
      '</div>' +
      '<div style="overflow-x:auto;"><table class="ord-items-table">' +
        '<thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>' +
        (current.items || []).map(function (it) {
          return '<tr><td>' + esc(it.name) + '</td><td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
            '<td>' + fmt(it.price) + ' ر.س</td><td><strong>' + fmt(it.price * it.qty) + ' ر.س</strong></td></tr>';
        }).join('') +
      '</tbody></table></div>' +
      '<div class="ord-totals">' +
        '<div class="ord-total-row"><span>المجموع قبل الضريبة</span><span>' + fmt(current.amount - vat) + ' ر.س</span></div>' +
        '<div class="ord-total-row"><span>ضريبة القيمة المضافة (15%)</span><span>' + fmt(vat) + ' ر.س</span></div>' +
        (current.creditTotal > 0
          ? '<div class="ord-total-row"><span>إشعارات دائنة</span><span style="color:var(--danger);">-' + fmt(current.creditTotal) + ' ر.س</span></div>'
          : '') +
        '<div class="ord-total-row grand"><span>الإجمالي</span><span>' + fmt(current.netAmount) + ' ر.س</span></div>' +
      '</div>';

    $('#biOverlay').hidden = false;
  }

  function printInvoice() {
    if (!current) return;

    var vat = current.amount * Store.VAT_RATE / (1 + Store.VAT_RATE);
    var rows = (current.items || []).map(function (it) {
      return '<tr><td>' + esc(it.name) + '</td><td>' + it.qty + '</td><td>' + fmt(it.price) + '</td><td>' + fmt(it.price * it.qty) + '</td></tr>';
    }).join('');

    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة', 'danger'); return; }

    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />' +
      '<title>فاتورة ' + esc(current.id) + '</title>' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:34px;color:#0f172a;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;}.muted{color:#64748b;font-size:0.85rem;line-height:1.8;}' +
      'table{width:100%;border-collapse:collapse;margin-top:16px;}' +
      'th,td{border-bottom:1px solid #e2e8f0;padding:9px;text-align:right;font-size:0.86rem;}' +
      'th{background:#f8fafc;color:#64748b;}' +
      '.totals{margin-top:18px;width:300px;margin-inline-start:auto;}' +
      '.totals div{display:flex;justify-content:space-between;padding:6px 0;font-size:0.88rem;}' +
      '.totals .grand{font-weight:800;font-size:1.05rem;border-top:2px solid #0f172a;padding-top:10px;}</style></head><body>' +
      '<h1>فاتورة ضريبية</h1>' +
      '<div class="muted">رقم الفاتورة: ' + esc(current.id) + ' — الطلب: ' + esc(current.orderId) +
      '<br />العميل: ' + esc(current.customer) + '<br />الإصدار: ' + esc(current.issue) + ' — الاستحقاق: ' + esc(current.due) +
      '<br />الدفع: ' + esc(current.payment) + '</div>' +
      '<table><thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="totals">' +
        '<div><span>المجموع قبل الضريبة</span><span>' + fmt(current.amount - vat) + ' ر.س</span></div>' +
        '<div><span>ضريبة القيمة المضافة (15%)</span><span>' + fmt(vat) + ' ر.س</span></div>' +
        '<div class="grand"><span>الإجمالي</span><span>' + fmt(current.netAmount) + ' ر.س</span></div>' +
      '</div></body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 300);
  }

  function render() {
    renderTabs();
    renderTable();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#biClose').addEventListener('click', function () { $('#biOverlay').hidden = true; });
    $('#biCancel').addEventListener('click', function () { $('#biOverlay').hidden = true; });
    $('#biOverlay').addEventListener('click', function (e) {
      if (e.target === $('#biOverlay')) $('#biOverlay').hidden = true;
    });
    $('#biPrint').addEventListener('click', printInvoice);

    var deep = new URLSearchParams(window.location.search).get('id');

    setTimeout(function () {
      render();
      if (deep) openModal(deep);
      Store.subscribe(render);
    }, 220);
  });
})();
