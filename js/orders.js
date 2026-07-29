(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.STATUS_META;

  // التبويبات: الحالات القياسية + تبويبات مشتقة (مخزون/فاشلة/إرجاع)
  var TABS = [
    { key: '', label: 'الكل' },
    { key: 'pending', label: S.pending.label },
    { key: 'processing', label: S.processing.label },
    { key: 'ready', label: S.ready.label },
    { key: 'shipping', label: S.shipping.label },
    { key: 'delivered', label: S.delivered.label },
    { key: 'cancelled', label: S.cancelled.label },
    { key: 'returns', label: 'طلبات الإرجاع' },
    { key: 'stock_hold', label: 'معلقة على المخزون' },
    { key: 'failed', label: 'طلبات فاشلة' }
  ];

  var orders = [];
  var currentTab = '';
  var selectedIds = [];
  var filters = { q: '', from: '', to: '', min: '', max: '', payment: '', city: '' };

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  /* ---------------- التصنيف ---------------- */
  function inTab(o, tab) {
    if (tab === '') return true;
    if (tab === 'returns') return !!o.returnRequest;
    if (tab === 'stock_hold') return Store.isStockHeld(o);
    if (tab === 'failed') return o.paymentStatus === 'failed';
    return o.status === tab;
  }

  function matchesFilters(o) {
    var q = filters.q.trim().toLowerCase();
    if (q && (o.id + ' ' + o.customer).toLowerCase().indexOf(q) === -1) return false;
    if (filters.from && o.date < filters.from) return false;
    if (filters.to && o.date > filters.to) return false;
    if (filters.min !== '' && o.total < parseFloat(filters.min)) return false;
    if (filters.max !== '' && o.total > parseFloat(filters.max)) return false;
    if (filters.payment && o.payment !== filters.payment) return false;
    if (filters.city && o.city !== filters.city) return false;
    return true;
  }

  function visibleOrders() {
    return orders.filter(function (o) { return inTab(o, currentTab) && matchesFilters(o); });
  }

  function hasActiveFilters() {
    return filters.q !== '' || filters.from !== '' || filters.to !== '' || filters.min !== '' ||
      filters.max !== '' || filters.payment !== '' || filters.city !== '';
  }

  /* ---------------- التحميل ---------------- */
  function load() {
    orders = Store.getOrders().slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1);
    });
  }

  /* ---------------- الإحصاءات والتنبيهات ---------------- */
  function renderStats() {
    $('#ordStatTotal').textContent = orders.length;
    $('#ordStatPending').textContent = orders.filter(function (o) { return o.status === 'pending'; }).length;
    $('#ordStatShipping').textContent = orders.filter(function (o) { return o.status === 'shipping'; }).length;
    $('#ordStatDone').textContent = orders.filter(function (o) { return o.status === 'delivered'; }).length;

    var overdue = orders.filter(Store.isOverdue);
    $('#ordOverdueAlert').hidden = overdue.length === 0;
    if (overdue.length) {
      $('#ordOverdueText').innerHTML = '<strong>' + overdue.length + ' طلب متأخر عن موعد الشحن المتوقع.</strong> ' +
        'يُنصح بمراجعتها فوراً لتفادي تأخير خدمة العميل.';
    }
  }

  function renderTabs() {
    var wrap = $('#ordTabs');
    wrap.innerHTML = TABS.map(function (t) {
      var count = orders.filter(function (o) { return inTab(o, t.key); }).length;
      return '<button type="button" class="tab-btn' + (currentTab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
        esc(t.label) + '<span class="count">(' + count + ')</span></button>';
    }).join('');

    $all('[data-tab]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTab = btn.getAttribute('data-tab');
        selectedIds = [];
        render();
      });
    });
  }

  /* ---------------- الجدول ---------------- */
  function itemsSummary(o) {
    var items = o.items || [];
    if (!items.length) return '—';
    var first = esc(items[0].name);
    var extra = items.length > 1 ? '<small>و' + (items.length - 1) + ' صنف آخر</small>' : '';
    return first + extra;
  }

  function totalQty(o) {
    return (o.items || []).reduce(function (s, it) { return s + (it.qty || 0); }, 0);
  }

  function flagsFor(o) {
    var out = '';
    if (!o.seen && o.status === 'pending') out += '<span class="ord-flag new">جديد</span>';
    if (Store.isOverdue(o)) out += '<span class="ord-flag overdue">متأخر</span>';
    if (Store.isPartial(o)) out += '<span class="ord-flag partial">تنفيذ جزئي</span>';
    if (Store.isStockHeld(o)) out += '<span class="ord-flag stock">معلّق على المخزون</span>';
    return out;
  }

  function renderTable() {
    var list = visibleOrders();

    $('#ordLoading').hidden = true;
    $('#ordTableWrap').hidden = list.length === 0;
    $('#ordEmpty').hidden = list.length > 0;

    if (!list.length) {
      var tabLabel = '';
      TABS.forEach(function (t) { if (t.key === currentTab) tabLabel = t.label; });
      $('#ordEmptyTitle').textContent = hasActiveFilters() ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات في «' + tabLabel + '»';
      $('#ordEmptyText').textContent = hasActiveFilters()
        ? 'جرّب توسيع نطاق البحث أو مسح الفلاتر المطبّقة.'
        : 'ستظهر الطلبات هنا فور وصولها من العملاء.';
      $('#ordEmptyReset').hidden = !hasActiveFilters() && currentTab === '';
      return;
    }

    $('#ordTableBody').innerHTML = list.map(function (o) {
      var meta = S[o.status] || S.pending;
      var checked = selectedIds.indexOf(o.id) !== -1 ? ' checked' : '';
      return '<tr class="ord-row" data-open="' + esc(o.id) + '" tabindex="0">' +
        '<td class="ord-select-cell"><input type="checkbox" class="pd-check" data-osel="' + esc(o.id) + '"' + checked + ' aria-label="تحديد الطلب" /></td>' +
        '<td><span class="ord-id">' + esc(o.id) + '</span>' + flagsFor(o) + '</td>' +
        '<td><a class="ord-link" href="customer.html?id=' + encodeURIComponent(o.customerId || o.customer) + '" data-stop>' + esc(o.customer) + '</a></td>' +
        '<td class="ord-items-cell">' + itemsSummary(o) + '</td>' +
        '<td>' + totalQty(o) + '</td>' +
        '<td dir="ltr">' + esc(o.date) + '</td>' +
        '<td>' + esc(o.payment) + (o.paymentStatus === 'failed' ? ' <span class="ord-flag overdue">فشل الدفع</span>' : '') + '</td>' +
        '<td class="ord-amount">' + fmt(o.total) + ' ر.س</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    bindRows();
  }

  function bindRows() {
    var body = $('#ordTableBody');

    // الصف كله قابل للنقر ويفتح صفحة التفاصيل
    $all('[data-open]', body).forEach(function (row) {
      function open() { window.location.href = 'order-details.html?id=' + encodeURIComponent(row.getAttribute('data-open')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // الروابط وخانات التحديد داخل الصف يجب ألا تفتح التفاصيل
    $all('[data-stop], .ord-select-cell', body).forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    $all('[data-osel]', body).forEach(function (box) {
      box.addEventListener('change', function (e) {
        e.stopPropagation();
        var id = box.getAttribute('data-osel');
        if (box.checked) {
          if (selectedIds.indexOf(id) === -1) selectedIds.push(id);
        } else {
          selectedIds = selectedIds.filter(function (x) { return x !== id; });
        }
        renderBulk();
      });
    });
  }

  /* ---------------- الإجراءات الجماعية ---------------- */
  function renderBulk() {
    $('#ordBulkBar').hidden = selectedIds.length === 0;
    $('#ordBulkCount').textContent = 'تم تحديد ' + selectedIds.length + ' طلب';

    var visible = visibleOrders();
    $('#ordCheckAll').checked = visible.length > 0 &&
      visible.every(function (o) { return selectedIds.indexOf(o.id) !== -1; });
  }

  function selectedOrders() {
    return orders.filter(function (o) { return selectedIds.indexOf(o.id) !== -1; });
  }

  function printDoc(title, bodyHtml) {
    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة', 'danger'); return; }
    win.document.write(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>' + esc(title) + '</title>' +
      '<style>' +
      'body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:26px;color:#0f172a;}' +
      'h1{font-size:1.2rem;margin:0 0 4px;}h2{font-size:1rem;margin:0 0 14px;}' +
      '.doc{page-break-after:always;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;}' +
      '.doc:last-child{page-break-after:auto;}' +
      '.muted{color:#64748b;font-size:0.85rem;}' +
      'table{width:100%;border-collapse:collapse;margin-top:12px;}' +
      'th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:right;font-size:0.85rem;}' +
      'th{background:#f8fafc;color:#64748b;}' +
      '.tot{text-align:left;font-weight:800;margin-top:10px;}' +
      '.lbl{border:2px dashed #0f172a;border-radius:10px;padding:16px;margin-top:10px;}' +
      '.big{font-size:1.4rem;font-weight:800;direction:ltr;letter-spacing:1px;}' +
      '</style></head><body>' + bodyHtml + '</body></html>'
    );
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 300);
  }

  function printInvoices(list) {
    var company = 'شركتك';
    try { company = localStorage.getItem('ammar_company_name') || company; } catch (e) { /* ignore */ }

    var html = list.map(function (o) {
      var rows = (o.items || []).map(function (it) {
        return '<tr><td>' + esc(it.name) + '</td><td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
          '<td>' + fmt(it.price) + '</td><td>' + fmt(it.price * it.qty) + '</td></tr>';
      }).join('');
      var vat = o.total * 0.15 / 1.15;
      return '<div class="doc"><h1>فاتورة ضريبية</h1>' +
        '<div class="muted">المورد: ' + esc(company) + '</div>' +
        '<h2>الطلب ' + esc(o.id) + '</h2>' +
        '<div class="muted">العميل: ' + esc(o.customer) + ' — ' + esc(o.phone) + '<br />' +
        'العنوان: ' + esc(o.address) + '<br />التاريخ: ' + esc(o.date) + ' — الدفع: ' + esc(o.payment) + '</div>' +
        '<table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
        '<div class="tot">الإجمالي شامل الضريبة: ' + fmt(o.total) + ' ر.س</div>' +
        '<div class="muted tot">منها ضريبة القيمة المضافة (15%): ' + fmt(vat) + ' ر.س</div>' +
        '</div>';
    }).join('');

    printDoc('فواتير الطلبات', html);
  }

  function printLabels(list) {
    var html = list.map(function (o) {
      var carrier = o.tracking ? Store.carrierByKey(o.tracking.carrier) : null;
      return '<div class="doc"><h1>بوليصة شحن</h1>' +
        '<h2>الطلب ' + esc(o.id) + '</h2>' +
        '<div class="lbl">' +
          '<div class="muted">المرسل إليه</div>' +
          '<div style="font-weight:800;font-size:1.05rem;">' + esc(o.customer) + '</div>' +
          '<div>' + esc(o.address) + '</div>' +
          '<div dir="ltr">' + esc(o.phone) + '</div>' +
          '<div class="muted" style="margin-top:12px;">رقم التتبع' + (carrier ? ' — ' + esc(carrier.name) : '') + '</div>' +
          '<div class="big">' + esc(o.tracking ? o.tracking.number : 'لم يُصدر بعد') + '</div>' +
          '<div class="muted" style="margin-top:10px;">عدد الأصناف: ' + (o.items || []).length + ' — الكمية: ' + totalQty(o) + '</div>' +
        '</div></div>';
    }).join('');

    printDoc('بوليصات الشحن', html);
  }

  var CSV_COLS = [
    { key: 'id', label: 'رقم الطلب' },
    { key: 'date', label: 'التاريخ' },
    { key: 'customer', label: 'العميل' },
    { key: 'phone', label: 'الجوال' },
    { key: 'city', label: 'المدينة' },
    { key: 'address', label: 'العنوان' },
    { key: 'payment', label: 'طريقة الدفع' },
    { key: 'paymentStatus', label: 'حالة الدفع' },
    { key: 'status', label: 'حالة الطلب' },
    { key: 'total', label: 'القيمة' }
  ];

  function exportExcel(list) {
    if (!list.length) { toast('لا توجد طلبات للتصدير', 'danger'); return; }

    var header = CSV_COLS.map(function (c) { return c.label; }).join(',');
    var rows = list.map(function (o) {
      return CSV_COLS.map(function (c) {
        var v = c.key === 'status' ? (S[o.status] ? S[o.status].label : o.status) : o[c.key];
        var s = String(v === undefined || v === null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    });

    // BOM حتى يفتح Excel الملف بترميز UTF-8 ويعرض العربية بشكل صحيح
    var blob = new Blob(['﻿' + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'الطلبات-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    toast('تم تصدير ' + list.length + ' طلب', 'success');
  }

  function exportPdf(list) {
    var rows = list.map(function (o) {
      return '<tr><td>' + esc(o.id) + '</td><td>' + esc(o.date) + '</td><td>' + esc(o.customer) + '</td>' +
        '<td>' + esc(o.city) + '</td><td>' + esc(o.payment) + '</td>' +
        '<td>' + esc(S[o.status] ? S[o.status].label : o.status) + '</td>' +
        '<td>' + fmt(o.total) + ' ر.س</td></tr>';
    }).join('');

    var total = list.reduce(function (s, o) { return s + (o.total || 0); }, 0);

    printDoc('تقرير الطلبات',
      '<h1>تقرير الطلبات</h1><div class="muted">عدد الطلبات: ' + list.length + ' — تاريخ التصدير: ' + new Date().toISOString().slice(0, 10) + '</div>' +
      '<table><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>العميل</th><th>المدينة</th><th>الدفع</th><th>الحالة</th><th>القيمة</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="tot">الإجمالي: ' + fmt(total) + ' ر.س</div>');
  }

  function handleBulk(action) {
    if (action === 'clear') { selectedIds = []; render(); return; }

    var list = selectedOrders();
    if (!list.length) return;

    if (action === 'invoices') printInvoices(list);
    else if (action === 'labels') printLabels(list);
    else if (action === 'excel') exportExcel(list);
    else if (action === 'pdf') exportPdf(list);
  }

  function bulkStatusChange(status) {
    var list = selectedOrders();
    if (!list.length || !status) return;

    if (!window.confirm('سيتم تحديث حالة ' + list.length + ' طلب إلى «' + S[status].label + '». هل تريد المتابعة؟')) {
      $('#ordBulkStatus').value = '';
      return;
    }

    list.forEach(function (o) { Store.setOrderStatus(o.id, status, { note: 'تحديث جماعي' }); });
    $('#ordBulkStatus').value = '';
    selectedIds = [];
    load();
    render();
    toast('تم تحديث ' + list.length + ' طلب وإشعار العملاء', 'success');
  }

  /* ---------------- الفلاتر ---------------- */
  function fillCityFilter() {
    var cities = [];
    orders.forEach(function (o) { if (o.city && cities.indexOf(o.city) === -1) cities.push(o.city); });
    cities.sort();

    var sel = $('#ordCity');
    var keep = sel.value;
    sel.innerHTML = '<option value="">كل المدن</option>' +
      cities.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    sel.value = keep;
  }

  function fillBulkStatuses() {
    var sel = $('#ordBulkStatus');
    sel.innerHTML = '<option value="">تحديث الحالة إلى…</option>' +
      Object.keys(S).map(function (k) { return '<option value="' + k + '">' + S[k].label + '</option>'; }).join('');
  }

  function clearFilters() {
    filters = { q: '', from: '', to: '', min: '', max: '', payment: '', city: '' };
    $('#ordSearch').value = '';
    $('#ordMinAmount').value = '';
    $('#ordMaxAmount').value = '';
    $('#ordPayment').value = '';
    $('#ordCity').value = '';
    if (window.DateField) { DateField.clear('ordFrom'); DateField.clear('ordTo'); }
    render();
  }

  function initFilters() {
    $('#ordSearch').addEventListener('input', function () { filters.q = this.value; selectedIds = []; render(); });

    $('#ordFilterToggle').addEventListener('click', function () {
      var box = $('#ordFilters');
      box.hidden = !box.hidden;
    });

    ['#ordMinAmount', '#ordMaxAmount'].forEach(function (sel) {
      $(sel).addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9.]/g, '');
        filters[sel === '#ordMinAmount' ? 'min' : 'max'] = this.value;
        render();
      });
    });

    $('#ordPayment').addEventListener('change', function () { filters.payment = this.value; render(); });
    $('#ordCity').addEventListener('change', function () { filters.city = this.value; render(); });

    ['#ordFrom', '#ordTo'].forEach(function (sel) {
      $(sel).addEventListener('change', function () {
        filters[sel === '#ordFrom' ? 'from' : 'to'] = this.value;
        render();
      });
    });

    $('#ordClearFilters').addEventListener('click', clearFilters);
    $('#ordEmptyReset').addEventListener('click', function () {
      currentTab = '';
      clearFilters();
    });

    $('#ordExportBtn').addEventListener('click', function () { exportExcel(visibleOrders()); });

    $('#ordCheckAll').addEventListener('change', function () {
      var visible = visibleOrders();
      if (this.checked) {
        visible.forEach(function (o) { if (selectedIds.indexOf(o.id) === -1) selectedIds.push(o.id); });
      } else {
        var ids = visible.map(function (o) { return o.id; });
        selectedIds = selectedIds.filter(function (id) { return ids.indexOf(id) === -1; });
      }
      render();
    });

    $all('[data-obulk]').forEach(function (btn) {
      btn.addEventListener('click', function () { handleBulk(btn.getAttribute('data-obulk')); });
    });

    $('#ordBulkStatus').addEventListener('change', function () { bulkStatusChange(this.value); });
  }

  /* ---------------- العرض ---------------- */
  function render() {
    renderStats();
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
    fillBulkStatuses();

    // فتح تبويب محدد عبر الرابط (مثلاً من إشعار الشريط الجانبي)
    var params = new URLSearchParams(window.location.search);
    var tab = params.get('tab');
    if (tab) {
      TABS.forEach(function (t) { if (t.key === tab) currentTab = tab; });
    }

    // مهلة قصيرة حتى تكون حالة التحميل مرئية فعلاً — القراءة نفسها متزامنة
    setTimeout(function () {
      load();
      fillCityFilter();
      render();

      Store.subscribe(function () {
        load();
        fillCityFilter();
        render();
      });
    }, 220);
  });
})();
