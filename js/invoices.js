(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STATUS_LABELS = { paid: 'مسددة', pending: 'قيد التحصيل', overdue: 'متأخرة' };
  var STATUS_CLASS = { paid: 'active', pending: 'draft', overdue: 'archived' };

  var invoices = [
    { id: 'INV-3021', taxNo: '3100234567', customer: 'شركة البناء الحديث للمقاولات', amount: 2850, issue: '2026-07-20', due: '2026-07-27', status: 'pending', items: '100 كيس أسمنت بورتلاندي' },
    { id: 'INV-3020', taxNo: '3100987654', customer: 'مؤسسة الإعمار المتحدة', amount: 12250, issue: '2026-07-19', due: '2026-07-26', status: 'pending', items: '5 طن حديد تسليح 12مم' },
    { id: 'INV-3019', taxNo: '3100456789', customer: 'شركة الرياض للمقاولات العامة', amount: 4900, issue: '2026-07-18', due: '2026-07-25', status: 'paid', items: '20 م³ خرسانة جاهزة C30' },
    { id: 'INV-3018', taxNo: '3100112233', customer: 'مجموعة التطوير العقاري', amount: 11340, issue: '2026-07-17', due: '2026-07-24', status: 'paid', items: '300 م² بلاط بورسلين 60×60' },
    { id: 'INV-3016', taxNo: '3100778899', customer: 'مؤسسة النخبة للمقاولات', amount: 3850, issue: '2026-06-28', due: '2026-07-05', status: 'overdue', items: 'خلاطة خرسانة كهربائية 350 لتر' },
    { id: 'INV-3012', taxNo: '3100445566', customer: 'شركة الرياض للمقاولات العامة', amount: 3150, issue: '2026-06-20', due: '2026-06-27', status: 'overdue', items: '150 كيس أسمنت مقاوم للكبريتات' }
  ];

  var currentFilter = '';

  function fmt(n) { return Number(n).toLocaleString('ar-SA'); }

  function updateStats() {
    $('#invStatTotal').textContent = invoices.length;
    $('#invStatPaid').textContent = fmt(invoices.filter(function (i) { return i.status === 'paid'; }).reduce(function (s, i) { return s + i.amount; }, 0)) + ' ر.س';
    $('#invStatPending').textContent = fmt(invoices.filter(function (i) { return i.status === 'pending'; }).reduce(function (s, i) { return s + i.amount; }, 0)) + ' ر.س';
    $('#invStatOverdue').textContent = invoices.filter(function (i) { return i.status === 'overdue'; }).length;
  }

  function renderTable() {
    var list = currentFilter ? invoices.filter(function (i) { return i.status === currentFilter; }) : invoices;
    $('#invEmpty').hidden = list.length > 0;
    document.querySelector('.pd-table-wrap').hidden = list.length === 0;

    $('#invTableBody').innerHTML = list.map(function (i) {
      return '<tr>' +
        '<td class="order-id">' + i.id + '</td>' +
        '<td>' + i.customer + '</td>' +
        '<td>' + i.taxNo + '</td>' +
        '<td><strong>' + fmt(i.amount) + ' ر.س</strong></td>' +
        '<td>' + i.issue + '</td>' +
        '<td>' + i.due + '</td>' +
        '<td><span class="pd-status-pill ' + STATUS_CLASS[i.status] + '">' + STATUS_LABELS[i.status] + '</span></td>' +
        '<td><div class="pd-table-actions"><button type="button" title="تحميل PDF" data-download="' + i.id + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        '</button></div></td>' +
      '</tr>';
    }).join('');

    $all('[data-download]').forEach(function (btn) {
      btn.addEventListener('click', function () { downloadInvoice(btn.getAttribute('data-download')); });
    });
  }

  function initTabs() {
    $all('#invTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#invTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentFilter = btn.getAttribute('data-status');
        renderTable();
      });
    });
  }

  function downloadInvoice(id) {
    var inv = invoices.find(function (i) { return i.id === id; });
    if (!inv) return;

    var companyName = 'شركة البناء الحديث للمقاولات';
    try { companyName = localStorage.getItem('ammar_company_name') || companyName; } catch (e) { /* ignore */ }

    var vat = inv.amount * 0.15 / 1.15;
    var subtotal = inv.amount - vat;

    var win = window.open('', '_blank');
    if (!win) {
      if (window.Shell) Shell.toast('يرجى السماح بالنوافذ المنبثقة لتحميل الفاتورة', 'danger');
      return;
    }

    win.document.write(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>فاتورة ' + inv.id + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">' +
      '<style>' +
      'body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:40px;color:#0f172a;}' +
      '.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:24px;}' +
      '.head h1{font-size:1.4rem;} .muted{color:#64748b;font-size:0.85rem;}' +
      'table{width:100%;border-collapse:collapse;margin-top:20px;} td,th{padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:0.9rem;}' +
      '.totals{margin-top:20px;width:280px;margin-inline-start:auto;} .totals div{display:flex;justify-content:space-between;padding:6px 0;}' +
      '.totals .grand{font-weight:800;font-size:1.1rem;border-top:2px solid #0f172a;padding-top:10px;}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>فاتورة ضريبية</h1><div class="muted">' + companyName + '</div></div>' +
      '<div><div><strong>' + inv.id + '</strong></div><div class="muted">تاريخ الإصدار: ' + inv.issue + '</div></div></div>' +
      '<p><strong>العميل:</strong> ' + inv.customer + ' &nbsp;&nbsp; <strong>الرقم الضريبي:</strong> ' + inv.taxNo + '</p>' +
      '<table><thead><tr><th>الوصف</th><th>المبلغ قبل الضريبة</th><th>ضريبة القيمة المضافة (15%)</th><th>الإجمالي</th></tr></thead>' +
      '<tbody><tr><td>' + inv.items + '</td><td>' + subtotal.toFixed(2) + ' ر.س</td><td>' + vat.toFixed(2) + ' ر.س</td><td>' + inv.amount.toFixed(2) + ' ر.س</td></tr></tbody></table>' +
      '<div class="totals"><div><span>المجموع الفرعي</span><span>' + subtotal.toFixed(2) + ' ر.س</span></div>' +
      '<div><span>ضريبة القيمة المضافة</span><span>' + vat.toFixed(2) + ' ر.س</span></div>' +
      '<div class="grand"><span>الإجمالي</span><span>' + inv.amount.toFixed(2) + ' ر.س</span></div></div>' +
      '</body></html>'
    );
    win.document.close();
    setTimeout(function () { win.print(); }, 400);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    updateStats();
    renderTable();
  });
})();
