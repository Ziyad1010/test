(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.STATUS_META;
  var INV = Store.INVOICE_STATUS;

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var currentType = 'sales';
  var lastReport = null;

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function iso(d) {
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function daysAgo(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  function prettyTime(s) {
    if (!s) return '—';
    var parts = String(s).split('T');
    return parts.length > 1 ? parts[0] + ' · ' + parts[1] : parts[0];
  }

  /* ---------------- مكتبة التقارير ----------------
     كل تقرير يبني صفوفه من المتجر المشترك، فالأرقام تعكس البيانات الفعلية. */
  var REPORTS = {
    sales: {
      title: 'تقرير المبيعات',
      desc: 'الإيرادات وعدد الطلبات مجمّعة حسب اليوم خلال الفترة المحددة.',
      icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      head: ['التاريخ', 'عدد الطلبات', 'الإيرادات (ر.س)'],
      build: function (f) {
        var series = Store.salesSeries(f.from, f.to, 'day', { city: f.city, category: f.category });
        var rows = [];
        series.labels.forEach(function (label, i) {
          if (!series.orders[i] && !series.values[i]) return;
          rows.push([label, String(series.orders[i]), fmt(series.values[i])]);
        });
        return rows;
      }
    },
    inventory: {
      title: 'تقرير المخزون',
      desc: 'الكميات المتاحة وحالة كل منتج في المستودعات.',
      icon: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>',
      head: ['المنتج', 'الفئة', 'المستودع', 'الكمية', 'حد التنبيه', 'الحالة'],
      build: function (f) {
        var AVAIL = { in_stock: 'متوفر', limited: 'كمية محدودة', out_of_stock: 'نفد المخزون', on_demand: 'عند الطلب' };
        return Store.getProducts()
          .filter(function (p) { return !f.category || p.category === f.category; })
          .map(function (p) {
            return [
              p.name,
              CATEGORY_LABELS[p.category] || p.category,
              p.warehouse || '—',
              String(p.stock) + ' ' + (p.unit || ''),
              String(p.lowStock || 0),
              AVAIL[Store.deriveAvailability(p)] || '—'
            ];
          });
      }
    },
    orders: {
      title: 'تقرير الطلبات',
      desc: 'كل الطلبات مع العميل والمدينة والحالة والقيمة.',
      icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
      head: ['رقم الطلب', 'التاريخ', 'العميل', 'المدينة', 'الدفع', 'الحالة', 'القيمة (ر.س)'],
      build: function (f) {
        return Store.ordersInRange(f.from, f.to)
          .filter(function (o) {
            if (f.status && o.status !== f.status) return false;
            if (f.city && o.city !== f.city) return false;
            return true;
          })
          .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
          .map(function (o) {
            return [o.id, o.date, o.customer, o.city, o.payment,
              (S[o.status] ? S[o.status].label : o.status), fmt(o.total)];
          });
      }
    },
    invoices: {
      title: 'تقرير الفواتير والمدفوعات',
      desc: 'الفواتير المُصدرة وحالة تحصيلها والمتأخرات.',
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      head: ['رقم الفاتورة', 'الطلب', 'العميل', 'الإصدار', 'الاستحقاق', 'الحالة', 'الصافي (ر.س)'],
      build: function (f) {
        return Store.getInvoices()
          .filter(function (i) {
            if (i.issue < f.from || i.issue > f.to) return false;
            if (f.city && i.city !== f.city) return false;
            return true;
          })
          .sort(function (a, b) { return a.issue < b.issue ? 1 : -1; })
          .map(function (i) {
            return [i.id, i.orderId, i.customer, i.issue, i.due,
              (INV[i.status] ? INV[i.status].label : i.status), fmt(i.netAmount)];
          });
      }
    },
    products: {
      title: 'تقرير أداء المنتجات',
      desc: 'الكميات المباعة والإيراد لكل منتج مرتبة تنازلياً.',
      icon: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>',
      head: ['المنتج', 'الكمية المباعة', 'عدد الطلبات', 'الإيراد (ر.س)', 'نسبة من الإجمالي'],
      build: function (f) {
        var rows = Store.productPerformance(f.from, f.to, { city: f.city, category: f.category });
        var total = rows.reduce(function (s, r) { return s + r.revenue; }, 0);
        return rows.map(function (r) {
          return [r.name, String(r.qty), String(r.orders), fmt(r.revenue),
            (total ? Math.round((r.revenue / total) * 100) : 0) + '%'];
        });
      }
    }
  };

  function currentFilters() {
    return {
      from: $('#repFrom').value,
      to: $('#repTo').value,
      category: $('#repCategory').value,
      status: $('#repStatus').value,
      city: $('#repCity').value
    };
  }

  /* ---------------- المكتبة ---------------- */
  function renderLibrary() {
    $('#repLibrary').innerHTML = Object.keys(REPORTS).map(function (key) {
      var r = REPORTS[key];
      return '<button type="button" class="rp-card' + (currentType === key ? ' is-active' : '') + '" data-report="' + key + '">' +
        '<span class="rp-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + r.icon + '</svg></span>' +
        '<strong>' + esc(r.title) + '</strong>' +
        '<span>' + esc(r.desc) + '</span>' +
      '</button>';
    }).join('');

    // النقر على أي تقرير يولّد معاينته مباشرة، لا مجرد تحديد
    $all('[data-report]', $('#repLibrary')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentType = btn.getAttribute('data-report');
        renderLibrary();
        generate();
      });
    });
  }

  /* ---------------- التوليد والمعاينة ---------------- */
  function generate() {
    var f = currentFilters();
    if (!f.from || !f.to) { toast('حدّد نطاق التاريخ أولاً', 'danger'); return; }
    if (f.from > f.to) { toast('تاريخ البداية يجب أن يسبق تاريخ النهاية', 'danger'); return; }

    $('#repResult').hidden = true;
    $('#repEmpty').hidden = true;
    $('#repLoading').hidden = false;

    setTimeout(function () {
      var def = REPORTS[currentType];
      var rows = def.build(f);

      $('#repLoading').hidden = true;
      lastReport = { type: currentType, title: def.title, head: def.head, rows: rows, from: f.from, to: f.to };

      if (!rows.length) {
        $('#repEmpty').hidden = false;
        return;
      }

      $('#repTitle').textContent = def.title;
      $('#repRange').textContent = 'من ' + f.from + ' إلى ' + f.to + ' — ' + rows.length + ' سجل';
      $('#repTableHead').innerHTML = '<tr>' + def.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>';
      $('#repTableBody').innerHTML = rows.map(function (row) {
        return '<tr>' + row.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('');

      $('#repResult').hidden = false;
      Store.addReportHistory({ type: currentType, title: def.title, from: f.from, to: f.to, rows: rows.length, format: 'preview' });
      toast('تم توليد ' + def.title, 'success');
    }, 320);
  }

  /* ---------------- التصدير ---------------- */
  function exportDelimited(format) {
    if (!lastReport) { toast('أنشئ التقرير أولاً', 'danger'); return; }

    var lines = [lastReport.head.join(',')].concat(lastReport.rows.map(function (row) {
      return row.map(function (c) {
        var s = String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }));

    // نفس محتوى CSV — Excel يفتح ملفات CSV بترميز UTF-8 BOM أصلاً
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = lastReport.title + '-' + lastReport.from + '-' + lastReport.to + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    Store.addReportHistory({
      type: lastReport.type, title: lastReport.title, from: lastReport.from,
      to: lastReport.to, rows: lastReport.rows.length, format: format
    });
    toast('تم تنزيل التقرير بصيغة ' + format.toUpperCase(), 'success');
  }

  function exportPdf() {
    if (!lastReport) { toast('أنشئ التقرير أولاً', 'danger'); return; }

    var company = 'شركتك';
    try { company = localStorage.getItem('ammar_company_name') || company; } catch (e) { /* ignore */ }

    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة', 'danger'); return; }

    var head = lastReport.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    var body = lastReport.rows.map(function (row) {
      return '<tr>' + row.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('');

    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />' +
      '<title>' + esc(lastReport.title) + '</title>' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:32px;color:#0f172a;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;}.muted{color:#64748b;font-size:0.85rem;margin-bottom:18px;line-height:1.8;}' +
      'table{width:100%;border-collapse:collapse;}' +
      'th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:0.85rem;}' +
      'th{background:#f8fafc;color:#64748b;}</style></head><body>' +
      '<h1>' + esc(lastReport.title) + '</h1>' +
      '<div class="muted">' + esc(company) + '<br />من ' + esc(lastReport.from) + ' إلى ' + esc(lastReport.to) +
      ' — ' + lastReport.rows.length + ' سجل</div>' +
      '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 350);

    Store.addReportHistory({
      type: lastReport.type, title: lastReport.title, from: lastReport.from,
      to: lastReport.to, rows: lastReport.rows.length, format: 'pdf'
    });
  }

  /* ---------------- الجدولة ---------------- */
  function nextRunFor(freq) {
    var d = new Date();
    if (freq === 'weekly') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
    return iso(d);
  }

  function renderSchedules() {
    var list = Store.getReportSchedules();
    var wrap = $('#repSchedules');

    if (!list.length) {
      wrap.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);padding:16px 0;text-align:center;">' +
        'لا توجد تقارير مجدولة بعد. أنشئ تقريراً ثم اضغط «جدولة دورية».</p>';
      return;
    }

    wrap.innerHTML = list.map(function (s) {
      return '<div class="rp-schedule-item">' +
        '<div class="rp-schedule-body">' +
          '<strong>' + esc(s.title) + '</strong>' +
          '<small>' + (s.frequency === 'weekly' ? 'أسبوعي' : 'شهري') + ' — ' + esc(s.email) +
          ' — التشغيل القادم: ' + esc(s.nextRun) + '</small>' +
        '</div>' +
        '<span class="rp-format-badge">' + esc(s.format) + '</span>' +
        '<span class="ord-status ' + (s.active ? 'ok' : 'bad') + '">' + (s.active ? 'مفعّل' : 'موقوف') + '</span>' +
        '<button type="button" class="pd-bulk-btn" data-sched-toggle="' + esc(s.id) + '">' + (s.active ? 'إيقاف' : 'تفعيل') + '</button>' +
        '<button type="button" class="pd-bulk-btn danger" data-sched-remove="' + esc(s.id) + '">حذف</button>' +
      '</div>';
    }).join('');

    $all('[data-sched-toggle]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.toggleReportSchedule(btn.getAttribute('data-sched-toggle'));
        renderSchedules();
      });
    });
    $all('[data-sched-remove]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.confirm('حذف هذه الجدولة نهائياً؟')) return;
        Store.removeReportSchedule(btn.getAttribute('data-sched-remove'));
        renderSchedules();
        toast('تم حذف الجدولة', 'danger');
      });
    });
  }

  function renderHistory() {
    var list = Store.getReportHistory();
    var wrap = $('#repHistory');

    if (!list.length) {
      wrap.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);padding:16px 0;text-align:center;">' +
        'لم تُولّد أي تقارير بعد — سيظهر السجل هنا بعد أول تقرير.</p>';
      return;
    }

    wrap.innerHTML = list.map(function (h) {
      return '<div class="rp-history-item" data-history="' + esc(h.id) + '" ' +
        'data-type="' + esc(h.type) + '" data-from="' + esc(h.from) + '" data-to="' + esc(h.to) + '" tabindex="0">' +
        '<div class="rp-history-body">' +
          '<strong>' + esc(h.title) + '</strong>' +
          '<small>' + esc(h.from) + ' → ' + esc(h.to) + ' — ' + h.rows + ' سجل — ' + prettyTime(h.at) + '</small>' +
        '</div>' +
        '<span class="rp-format-badge">' + esc(h.format) + '</span>' +
      '</div>';
    }).join('');

    // النقر على أي تقرير سابق يعيد توليده بنفس نطاقه ويعرضه فوراً
    $all('[data-history]', wrap).forEach(function (row) {
      function open() {
        currentType = row.getAttribute('data-type');
        $('#repFrom').value = row.getAttribute('data-from');
        $('#repTo').value = row.getAttribute('data-to');
        if (window.DateField) DateField.refresh();
        renderLibrary();
        generate();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function initScheduleModal() {
    $('#repScheduleBtn').addEventListener('click', function () {
      $('#repSchedType').innerHTML = Object.keys(REPORTS).map(function (k) {
        return '<option value="' + k + '"' + (k === currentType ? ' selected' : '') + '>' + esc(REPORTS[k].title) + '</option>';
      }).join('');
      $('#repSchedError').textContent = '';
      $('#repScheduleOverlay').hidden = false;
    });

    function close() { $('#repScheduleOverlay').hidden = true; }
    $('#repScheduleClose').addEventListener('click', close);
    $('#repScheduleCancel').addEventListener('click', close);
    $('#repScheduleOverlay').addEventListener('click', function (e) {
      if (e.target === $('#repScheduleOverlay')) close();
    });

    $('#repScheduleSave').addEventListener('click', function () {
      var email = $('#repSchedEmail').value.trim();
      if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
        $('#repSchedError').textContent = 'أدخل بريداً إلكترونياً صحيحاً';
        return;
      }

      var type = $('#repSchedType').value;
      var freq = $('#repSchedFreq').value;

      Store.addReportSchedule({
        type: type, title: REPORTS[type].title, frequency: freq,
        email: email, format: $('#repSchedFormat').value, nextRun: nextRunFor(freq)
      });

      close();
      renderSchedules();
      toast('تمت جدولة «' + REPORTS[type].title + '» ' + (freq === 'weekly' ? 'أسبوعياً' : 'شهرياً'), 'success');
    });
  }

  function fillFilters() {
    var statusSel = $('#repStatus');
    statusSel.innerHTML = '<option value="">كل الحالات</option>' +
      Object.keys(S).map(function (k) { return '<option value="' + k + '">' + S[k].label + '</option>'; }).join('');

    var cities = [];
    Store.getOrders().forEach(function (o) { if (o.city && cities.indexOf(o.city) === -1) cities.push(o.city); });
    cities.sort();

    var citySel = $('#repCity');
    citySel.innerHTML = '<option value="">كل المدن</option>' +
      cities.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();

    // النطاق الافتراضي: آخر 30 يوماً
    $('#repFrom').value = iso(daysAgo(29));
    $('#repTo').value = iso(new Date());
    if (window.DateField) DateField.refresh();

    fillFilters();
    renderLibrary();
    renderSchedules();
    renderHistory();
    initScheduleModal();

    $('#repGenerateBtn').addEventListener('click', generate);
    $('#repExportPdf').addEventListener('click', exportPdf);
    $('#repExportExcel').addEventListener('click', function () { exportDelimited('excel'); });
    $('#repExportCsv').addEventListener('click', function () { exportDelimited('csv'); });

    Store.subscribe(function () { renderSchedules(); renderHistory(); });
  });
})();
