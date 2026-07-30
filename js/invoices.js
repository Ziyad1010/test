(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.INVOICE_STATUS;

  var TABS = [
    { key: '', label: 'الكل' },
    { key: 'paid', label: S.paid.label },
    { key: 'pending', label: S.pending.label },
    { key: 'overdue', label: S.overdue.label },
    { key: 'cancelled', label: S.cancelled.label }
  ];

  var invoices = [];
  var currentTab = '';
  var selectedIds = [];
  var filters = { q: '', from: '', to: '', min: '', max: '' };

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function load() {
    invoices = Store.getInvoices().sort(function (a, b) {
      return a.issue < b.issue ? 1 : a.issue > b.issue ? -1 : 0;
    });
  }

  function matches(inv) {
    if (currentTab && inv.status !== currentTab) return false;
    var q = filters.q.trim().toLowerCase();
    if (q && (inv.id + ' ' + inv.customer).toLowerCase().indexOf(q) === -1) return false;
    if (filters.from && inv.issue < filters.from) return false;
    if (filters.to && inv.issue > filters.to) return false;
    if (filters.min !== '' && inv.netAmount < parseFloat(filters.min)) return false;
    if (filters.max !== '' && inv.netAmount > parseFloat(filters.max)) return false;
    return true;
  }

  function visible() { return invoices.filter(matches); }

  function hasActiveFilters() {
    return filters.q !== '' || filters.from !== '' || filters.to !== '' || filters.min !== '' || filters.max !== '';
  }

  /* ---------------- الملخص المالي ---------------- */
  function renderSummary() {
    var s = Store.invoiceSummary();

    $('#finIssued').textContent = s.issuedThisMonth + ' فاتورة';
    $('#finIssuedSub').textContent = 'بقيمة ' + fmt(s.issuedThisMonthAmount) + ' ر.س';
    $('#finCollected').textContent = fmt(s.collected) + ' ر.س';
    $('#finOutstanding').textContent = fmt(s.outstanding) + ' ر.س';
    $('#finOverdue').textContent = fmt(s.overdueAmount) + ' ر.س';
    $('#finOverdueSub').textContent = s.overdueCount + ' فاتورة متأخرة';

    $('#invOverdueAlert').hidden = s.overdueCount === 0;
    if (s.overdueCount) {
      $('#invOverdueText').innerHTML = '<strong>' + s.overdueCount + ' فاتورة تجاوزت تاريخ الاستحقاق</strong> ' +
        'بإجمالي ' + fmt(s.overdueAmount) + ' ر.س. افتح الفاتورة لإرسال تذكير للعميل.';
    }
  }

  function renderTabs() {
    $('#invTabs').innerHTML = TABS.map(function (t) {
      var count = t.key ? invoices.filter(function (i) { return i.status === t.key; }).length : invoices.length;
      return '<button type="button" class="tab-btn' + (currentTab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
        esc(t.label) + '<span class="count">(' + count + ')</span></button>';
    }).join('');

    $all('[data-tab]', $('#invTabs')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTab = btn.getAttribute('data-tab');
        selectedIds = [];
        render();
      });
    });
  }

  /* ---------------- الجدول ---------------- */
  function renderTable() {
    var list = visible();

    $('#invLoading').hidden = true;
    $('#invTableWrap').hidden = list.length === 0;
    $('#invEmpty').hidden = list.length > 0;

    if (!list.length) {
      var label = '';
      TABS.forEach(function (t) { if (t.key === currentTab) label = t.label; });
      $('#invEmptyTitle').textContent = hasActiveFilters() ? 'لا توجد نتائج مطابقة' : 'لا توجد فواتير في «' + label + '»';
      $('#invEmptyText').textContent = hasActiveFilters()
        ? 'جرّب توسيع نطاق البحث أو مسح الفلاتر المطبّقة.'
        : 'تُصدر الفواتير تلقائياً عند قبول الطلبات — ستظهر هنا فور إصدار أول فاتورة.';
      $('#invEmptyReset').hidden = !hasActiveFilters();
      return;
    }

    $('#invTableBody').innerHTML = list.map(function (i) {
      var meta = S[i.status] || S.pending;
      var checked = selectedIds.indexOf(i.id) !== -1 ? ' checked' : '';
      var credit = i.creditTotal > 0
        ? '<span class="ord-flag partial">إشعار دائن ' + fmt(i.creditTotal) + '</span>' : '';

      return '<tr class="ord-row" data-open="' + esc(i.id) + '" tabindex="0">' +
        '<td class="ord-select-cell"><input type="checkbox" class="pd-check" data-isel="' + esc(i.id) + '"' + checked + ' aria-label="تحديد الفاتورة" /></td>' +
        '<td><span class="ord-id">' + esc(i.id) + '</span>' + credit + '</td>' +
        '<td><a class="ord-link" href="customer.html?id=' + encodeURIComponent(i.customerId) + '" data-stop>' + esc(i.customer) + '</a></td>' +
        '<td dir="ltr">' + esc(i.issue) + '</td>' +
        '<td dir="ltr">' + esc(i.due) + '</td>' +
        '<td class="ord-amount">' + fmt(i.netAmount) + ' ر.س</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    bindRows();
  }

  function bindRows() {
    var body = $('#invTableBody');

    $all('[data-open]', body).forEach(function (row) {
      function open() { window.location.href = 'invoice-details.html?id=' + encodeURIComponent(row.getAttribute('data-open')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    $all('[data-stop], .ord-select-cell', body).forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    $all('[data-isel]', body).forEach(function (box) {
      box.addEventListener('change', function (e) {
        e.stopPropagation();
        var id = box.getAttribute('data-isel');
        if (box.checked) {
          if (selectedIds.indexOf(id) === -1) selectedIds.push(id);
        } else {
          selectedIds = selectedIds.filter(function (x) { return x !== id; });
        }
        renderBulk();
      });
    });
  }

  function renderBulk() {
    $('#invBulkBar').hidden = selectedIds.length === 0;
    $('#invBulkCount').textContent = 'تم تحديد ' + selectedIds.length + ' فاتورة';

    var list = visible();
    $('#invCheckAll').checked = list.length > 0 && list.every(function (i) { return selectedIds.indexOf(i.id) !== -1; });
  }

  function selectedInvoices() {
    return invoices.filter(function (i) { return selectedIds.indexOf(i.id) !== -1; });
  }

  /* ---------------- التصدير والطباعة ---------------- */
  function exportExcel(list) {
    if (!list.length) { toast('لا توجد فواتير للتصدير', 'danger'); return; }

    var cols = [
      { key: 'id', label: 'رقم الفاتورة' },
      { key: 'orderId', label: 'رقم الطلب' },
      { key: 'customer', label: 'العميل' },
      { key: 'taxNo', label: 'الرقم الضريبي' },
      { key: 'issue', label: 'تاريخ الإصدار' },
      { key: 'due', label: 'تاريخ الاستحقاق' },
      { key: 'amount', label: 'المبلغ قبل الإشعارات الدائنة' },
      { key: 'creditTotal', label: 'إشعارات دائنة' },
      { key: 'netAmount', label: 'الصافي' },
      { key: 'payment', label: 'طريقة الدفع' },
      { key: 'status', label: 'الحالة' }
    ];

    var header = cols.map(function (c) { return c.label; }).join(',');
    var rows = list.map(function (i) {
      return cols.map(function (c) {
        var v = c.key === 'status' ? (S[i.status] ? S[i.status].label : i.status) : i[c.key];
        var s = String(v === undefined || v === null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    });

    var blob = new Blob(['﻿' + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'الفواتير-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    toast('تم تصدير ' + list.length + ' فاتورة', 'success');
  }

  function printInvoices(list) {
    if (!list.length) { toast('لا توجد فواتير للطباعة', 'danger'); return; }

    var company = 'شركتك';
    try { company = localStorage.getItem('ammar_company_name') || company; } catch (e) { /* ignore */ }

    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة', 'danger'); return; }

    var body = list.map(function (i) {
      var rows = (i.items || []).map(function (it) {
        return '<tr><td>' + esc(it.name) + '</td><td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
          '<td>' + fmt(it.price) + '</td><td>' + fmt(it.price * it.qty) + '</td></tr>';
      }).join('');
      var vat = i.amount * Store.VAT_RATE / (1 + Store.VAT_RATE);

      return '<div class="doc"><h1>فاتورة ضريبية</h1>' +
        '<div class="muted">المورد: ' + esc(company) + '</div>' +
        '<h2>' + esc(i.id) + ' — الطلب ' + esc(i.orderId) + '</h2>' +
        '<div class="muted">العميل: ' + esc(i.customer) + '<br />الرقم الضريبي: ' + esc(i.taxNo) +
        '<br />الإصدار: ' + esc(i.issue) + ' — الاستحقاق: ' + esc(i.due) + '<br />الدفع: ' + esc(i.payment) + '</div>' +
        '<table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="tot">الإجمالي شامل الضريبة: ' + fmt(i.amount) + ' ر.س</div>' +
        '<div class="muted tot">منها ضريبة القيمة المضافة (15%): ' + fmt(vat) + ' ر.س</div>' +
        (i.creditTotal > 0 ? '<div class="tot">إشعارات دائنة: -' + fmt(i.creditTotal) + ' ر.س<br />الصافي المستحق: ' + fmt(i.netAmount) + ' ر.س</div>' : '') +
      '</div>';
    }).join('');

    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>الفواتير</title>' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:28px;color:#0f172a;}' +
      'h1{font-size:1.25rem;margin:0 0 4px;}h2{font-size:1rem;margin:8px 0 12px;}' +
      '.doc{page-break-after:always;border:1px solid #e2e8f0;border-radius:12px;padding:22px;margin-bottom:20px;}' +
      '.doc:last-child{page-break-after:auto;}.muted{color:#64748b;font-size:0.85rem;line-height:1.8;}' +
      'table{width:100%;border-collapse:collapse;margin-top:14px;}' +
      'th,td{border-bottom:1px solid #e2e8f0;padding:9px;text-align:right;font-size:0.85rem;}' +
      'th{background:#f8fafc;color:#64748b;}.tot{text-align:left;font-weight:800;margin-top:10px;}</style></head><body>' +
      body + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 300);
  }

  function handleBulk(action) {
    if (action === 'clear') { selectedIds = []; render(); return; }

    var list = selectedInvoices();
    if (!list.length) return;

    if (action === 'excel') { exportExcel(list); return; }
    if (action === 'pdf') { printInvoices(list); return; }

    if (action === 'remind') {
      var due = list.filter(function (i) { return i.status === 'pending' || i.status === 'overdue'; });
      if (!due.length) { toast('الفواتير المحددة لا تحتاج تذكيراً', 'danger'); return; }
      due.forEach(function (i) { Store.remindInvoice(i.id); });
      toast('تم تسجيل تذكير لـ ' + due.length + ' فاتورة', 'success');
    } else if (action === 'paid') {
      if (!window.confirm('سيتم تعليم ' + list.length + ' فاتورة كمدفوعة. هل تريد المتابعة؟')) return;
      list.forEach(function (i) { Store.markInvoicePaid(i.id); });
      toast('تم تحديث ' + list.length + ' فاتورة', 'success');
    }

    selectedIds = [];
    load();
    render();
  }

  /* ---------------- الفلاتر ---------------- */
  function clearFilters() {
    filters = { q: '', from: '', to: '', min: '', max: '' };
    $('#invSearch').value = '';
    $('#invMinAmount').value = '';
    $('#invMaxAmount').value = '';
    if (window.DateField) { DateField.clear('invFrom'); DateField.clear('invTo'); }
    render();
  }

  function initFilters() {
    $('#invSearch').addEventListener('input', function () { filters.q = this.value; selectedIds = []; render(); });

    $('#invFilterToggle').addEventListener('click', function () {
      var box = $('#invFilters');
      box.hidden = !box.hidden;
    });

    ['#invMinAmount', '#invMaxAmount'].forEach(function (sel) {
      $(sel).addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9.]/g, '');
        filters[sel === '#invMinAmount' ? 'min' : 'max'] = this.value;
        render();
      });
    });

    ['#invFrom', '#invTo'].forEach(function (sel) {
      $(sel).addEventListener('change', function () {
        filters[sel === '#invFrom' ? 'from' : 'to'] = this.value;
        render();
      });
    });

    $('#invClearFilters').addEventListener('click', clearFilters);
    $('#invEmptyReset').addEventListener('click', function () { currentTab = ''; clearFilters(); });
    $('#invExportAll').addEventListener('click', function () { exportExcel(visible()); });

    $('#invCheckAll').addEventListener('change', function () {
      var list = visible();
      if (this.checked) {
        list.forEach(function (i) { if (selectedIds.indexOf(i.id) === -1) selectedIds.push(i.id); });
      } else {
        var ids = list.map(function (i) { return i.id; });
        selectedIds = selectedIds.filter(function (id) { return ids.indexOf(id) === -1; });
      }
      render();
    });

    $all('[data-ibulk]').forEach(function (btn) {
      btn.addEventListener('click', function () { handleBulk(btn.getAttribute('data-ibulk')); });
    });
  }

  function render() {
    renderSummary();
    renderTabs();
    renderTable();
    renderBulk();
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    initFilters();

    var tab = new URLSearchParams(window.location.search).get('tab');
    if (tab) TABS.forEach(function (t) { if (t.key === tab) currentTab = tab; });

    setTimeout(function () {
      load();
      render();
      Store.subscribe(function () { load(); render(); });
    }, 220);
  });
})();
