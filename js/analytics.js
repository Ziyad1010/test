(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var charts = {};
  var currentRange = '30';
  var filters = { category: '', city: '' };
  var lastData = null;

  var PALETTE = {
    primary: '#2563eb',
    primaryLight: 'rgba(37, 99, 235, 0.12)',
    success: '#16a34a',
    successLight: 'rgba(22, 163, 74, 0.12)',
    warning: '#f59e0b',
    violet: '#7c3aed',
    muted: '#94a3b8',
    danger: '#dc2626'
  };

  // Grid lines must follow the active theme — a light grid is invisible on the
  // dark surface and vice versa.
  function gridColor() {
    return (window.Shell && Shell.chartColors) ? Shell.chartColors().grid : '#e2e8f0';
  }

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }); }
  function fmt1(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 1 }); }

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

  /* ---------------- تحديد النطاق ---------------- */
  function resolveRange() {
    if (currentRange === 'custom') {
      var from = $('#anFrom').value;
      var to = $('#anTo').value;
      if (!from || !to) return null;
      if (from > to) { toast('تاريخ البداية يجب أن يسبق تاريخ النهاية', 'danger'); return null; }
      return { from: from, to: to };
    }
    var days = parseInt(currentRange, 10);
    return { from: iso(daysAgo(days - 1)), to: iso(new Date()) };
  }

  // الحبيبة المناسبة: يومي للفترات القصيرة، أسبوعي للمتوسطة، شهري للطويلة
  function granularityFor(days) {
    if (days <= 31) return 'day';
    if (days <= 120) return 'week';
    return 'month';
  }

  /* ---------------- المؤشرات ---------------- */
  function setChange(el, value, invert) {
    var v = Math.round(value * 10) / 10;
    el.classList.remove('up', 'down', 'flat');
    if (v > 0) { el.classList.add(invert ? 'down' : 'up'); el.textContent = '+' + v + '%'; }
    else if (v < 0) { el.classList.add(invert ? 'up' : 'down'); el.textContent = v + '%'; }
    else { el.classList.add('flat'); el.textContent = 'بدون تغيّر'; }
  }

  function renderKpis(stats) {
    var c = stats.current, p = stats.previous;

    $('#anSales').textContent = fmt(c.sales) + ' ر.س';
    $('#anSalesPrev').textContent = 'الفترة السابقة: ' + fmt(p.sales) + ' ر.س';
    setChange($('#anSalesChange'), stats.change.sales);

    $('#anOrders').textContent = fmt(c.orders);
    $('#anOrdersPrev').textContent = 'الفترة السابقة: ' + fmt(p.orders) + ' طلب';
    setChange($('#anOrdersChange'), stats.change.orders);

    $('#anAov').textContent = fmt(c.aov) + ' ر.س';
    $('#anAovPrev').textContent = 'الفترة السابقة: ' + fmt(p.aov) + ' ر.س';
    setChange($('#anAovChange'), stats.change.aov);

    $('#anRepeat').textContent = fmt1(c.repeatRate) + '%';
    $('#anRepeatPrev').textContent = 'الفترة السابقة: ' + fmt1(p.repeatRate) + '%';
    setChange($('#anRepeatChange'), stats.change.repeatRate);
  }

  function renderComparison(stats) {
    $('#anCompareTitle').textContent =
      'مقارنة الأداء: ' + stats.from + ' → ' + stats.to + '  مقابل  ' + stats.prevFrom + ' → ' + stats.prevTo;

    var rows = [
      { label: 'المبيعات', cur: fmt(stats.current.sales) + ' ر.س', prev: fmt(stats.previous.sales) + ' ر.س', delta: stats.change.sales },
      { label: 'الطلبات', cur: fmt(stats.current.orders), prev: fmt(stats.previous.orders), delta: stats.change.orders },
      { label: 'متوسط الطلب', cur: fmt(stats.current.aov) + ' ر.س', prev: fmt(stats.previous.aov) + ' ر.س', delta: stats.change.aov },
      { label: 'العملاء', cur: fmt(stats.current.customers), prev: fmt(stats.previous.customers), delta: 0 },
      { label: 'تكرار الشراء', cur: fmt1(stats.current.repeatRate) + '%', prev: fmt1(stats.previous.repeatRate) + '%', delta: stats.change.repeatRate }
    ];

    $('#anCompareGrid').innerHTML = rows.map(function (r) {
      var cls = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'flat';
      var arrow = r.delta > 0 ? '▲ +' + Math.round(r.delta * 10) / 10 + '%'
        : r.delta < 0 ? '▼ ' + Math.round(r.delta * 10) / 10 + '%' : '—';
      return '<div class="an-compare-cell">' +
        '<small>' + esc(r.label) + '</small>' +
        '<strong>' + r.cur + '</strong>' +
        '<div style="font-size:0.74rem;color:var(--muted);">السابقة: ' + r.prev + '</div>' +
        '<span class="delta kpi-change ' + cls + '">' + arrow + '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------------- المخططات ---------------- */
  function destroy(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function renderSalesChart(range) {
    var fromD = new Date(range.from), toD = new Date(range.to);
    var days = Math.round((toD - fromD) / 86400000) + 1;
    var gran = granularityFor(days);
    var series = Store.salesSeries(range.from, range.to, gran, filters);

    var granLabel = gran === 'day' ? 'يومياً' : gran === 'week' ? 'أسبوعياً' : 'شهرياً';
    $('#anSalesChartSub').textContent = 'الإيرادات مقابل عدد الطلبات، مجمّعة ' + granLabel;

    destroy('anSalesChart');
    charts.anSalesChart = new Chart($('#anSalesChart'), {
      data: {
        labels: series.labels,
        datasets: [
          {
            type: 'line', label: 'الإيرادات (ر.س)', data: series.values,
            borderColor: PALETTE.primary, backgroundColor: PALETTE.primaryLight,
            fill: true, tension: 0.32, yAxisID: 'y',
            pointRadius: series.labels.length > 40 ? 0 : 3
          },
          {
            type: 'bar', label: 'عدد الطلبات', data: series.orders,
            backgroundColor: 'rgba(22, 163, 74, 0.55)', borderRadius: 4, yAxisID: 'y1',
            maxBarThickness: 18
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } },
        scales: {
          y: {
            position: 'right', beginAtZero: true, grid: { color: gridColor() },
            ticks: { callback: function (v) { return v >= 1000 ? (v / 1000) + ' ألف' : v; } }
          },
          y1: { position: 'left', beginAtZero: true, grid: { display: false } },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }
        }
      }
    });
  }

  // مخطط منتجات قابل للنقر — النقر يفتح صفحة تفاصيل المنتج
  function renderProductChart(canvasId, rows, color) {
    destroy(canvasId);
    if (!rows.length) return;

    charts[canvasId] = new Chart($('#' + canvasId), {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return r.name; }),
        datasets: [{ label: 'الإيراد (ر.س)', data: rows.map(function (r) { return Math.round(r.revenue); }), backgroundColor: color, borderRadius: 6, maxBarThickness: 20 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: gridColor() } }, y: { grid: { display: false } } },
        onClick: function (evt, elements) {
          if (!elements.length) return;
          var row = rows[elements[0].index];
          if (row) window.location.href = 'product-details.html?id=' + encodeURIComponent(row.id);
        }
      }
    });
  }

  // مخطط المدن قابل للنقر — النقر يفتح صفحة طلبات تلك المدينة
  function renderCityChart(rows) {
    destroy('anCityChart');
    if (!rows.length) return;

    charts.anCityChart = new Chart($('#anCityChart'), {
      type: 'doughnut',
      data: {
        labels: rows.map(function (r) { return r.city; }),
        datasets: [{
          data: rows.map(function (r) { return Math.round(r.revenue); }),
          backgroundColor: [PALETTE.primary, PALETTE.success, PALETTE.warning, PALETTE.violet, PALETTE.muted, '#0ea5e9'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } },
        onClick: function (evt, elements) {
          if (!elements.length) return;
          var row = rows[elements[0].index];
          if (!row) return;
          var r = resolveRange();
          window.location.href = 'city-orders.html?city=' + encodeURIComponent(row.city) +
            '&from=' + encodeURIComponent(r.from) + '&to=' + encodeURIComponent(r.to);
        }
      }
    });
  }

  function renderCustomersChart(behaviour) {
    destroy('anCustomersChart');
    if (!behaviour.newCustomers && !behaviour.returning) return;

    charts.anCustomersChart = new Chart($('#anCustomersChart'), {
      type: 'doughnut',
      data: {
        labels: ['عملاء جدد', 'عملاء متكررون'],
        datasets: [{
          data: [behaviour.newCustomers, behaviour.returning],
          backgroundColor: [PALETTE.primary, PALETTE.success],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } }
      }
    });
  }

  function renderTopCustomers(rows) {
    if (!rows.length) {
      $('#anTopCustomers').innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">لا يوجد عملاء ضمن هذه الفترة</td></tr>';
      return;
    }

    $('#anTopCustomers').innerHTML = rows.map(function (c) {
      return '<tr class="ord-row" data-customer="' + esc(c.id) + '" tabindex="0">' +
        '<td><span class="ord-link">' + esc(c.name) + '</span></td>' +
        '<td>' + c.orders + '</td>' +
        '<td class="ord-amount">' + fmt(c.spend) + ' ر.س</td>' +
        '<td>' + fmt(c.spend / c.orders) + ' ر.س</td>' +
      '</tr>';
    }).join('');

    $all('[data-customer]', $('#anTopCustomers')).forEach(function (row) {
      function open() { window.location.href = 'customer.html?id=' + encodeURIComponent(row.getAttribute('data-customer')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  /* ---------------- التصدير ---------------- */
  function exportChartImage(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !charts[canvasId]) { toast('لا يوجد مخطط لتصديره', 'danger'); return; }

    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png', 1.0);
    a.download = canvasId + '-' + new Date().toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('تم تنزيل المخطط كصورة', 'success');
  }

  function exportAnalyticsPdf() {
    if (!lastData) { toast('لا توجد بيانات للتصدير', 'danger'); return; }

    var company = 'شركتك';
    try { company = localStorage.getItem('ammar_company_name') || company; } catch (e) { /* ignore */ }

    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة', 'danger'); return; }

    var s = lastData.stats;
    var imgs = ['anSalesChart', 'anTopProductsChart', 'anCityChart', 'anCustomersChart']
      .filter(function (id) { return charts[id]; })
      .map(function (id) {
        return '<img src="' + document.getElementById(id).toDataURL('image/png') + '" style="width:100%;margin:14px 0;border:1px solid #e2e8f0;border-radius:10px;" />';
      }).join('');

    var products = lastData.products.slice(0, 10).map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td>' + p.qty + '</td><td>' + fmt(p.revenue) + ' ر.س</td></tr>';
    }).join('');

    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>التقرير التحليلي</title>' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:30px;color:#0f172a;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;}h2{font-size:1rem;margin:22px 0 8px;}' +
      '.muted{color:#64748b;font-size:0.85rem;line-height:1.8;}' +
      '.kpis{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;}' +
      '.kpi{border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:150px;}' +
      '.kpi small{color:#64748b;font-size:0.76rem;display:block;}' +
      '.kpi strong{font-size:1.05rem;}' +
      'table{width:100%;border-collapse:collapse;margin-top:10px;}' +
      'th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:right;font-size:0.85rem;}' +
      'th{background:#f8fafc;color:#64748b;}</style></head><body>' +
      '<h1>التقرير التحليلي</h1><div class="muted">' + esc(company) + '<br />' +
      'الفترة: ' + esc(s.from) + ' → ' + esc(s.to) + ' (مقارنة بـ ' + esc(s.prevFrom) + ' → ' + esc(s.prevTo) + ')</div>' +
      '<div class="kpis">' +
        '<div class="kpi"><small>إجمالي المبيعات</small><strong>' + fmt(s.current.sales) + ' ر.س</strong></div>' +
        '<div class="kpi"><small>عدد الطلبات</small><strong>' + fmt(s.current.orders) + '</strong></div>' +
        '<div class="kpi"><small>متوسط قيمة الطلب</small><strong>' + fmt(s.current.aov) + ' ر.س</strong></div>' +
        '<div class="kpi"><small>معدل تكرار الشراء</small><strong>' + fmt1(s.current.repeatRate) + '%</strong></div>' +
      '</div>' +
      '<h2>المخططات</h2>' + imgs +
      '<h2>أداء المنتجات</h2>' +
      '<table><thead><tr><th>المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>' + products + '</tbody></table>' +
      '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 500);
  }

  /* ---------------- العرض ---------------- */
  function render() {
    var range = resolveRange();
    if (!range) {
      $('#anLoading').hidden = true;
      $('#anContent').hidden = true;
      $('#anEmpty').hidden = false;
      $('#anEmpty').querySelector('strong').textContent = 'حدّد نطاق التاريخ';
      $('#anEmpty').querySelector('p').textContent = 'اختر تاريخ البداية والنهاية لعرض التحليلات.';
      return;
    }

    $('#anRangeLabel').textContent = range.from + ' → ' + range.to;

    var stats = Store.periodStats(range.from, range.to);
    var products = Store.productPerformance(range.from, range.to, filters);
    var cities = Store.cityPerformance(range.from, range.to, filters);
    var behaviour = Store.customerBehaviour(range.from, range.to);
    var customers = Store.topCustomers(range.from, range.to, 8);

    lastData = { stats: stats, products: products, cities: cities };

    $('#anLoading').hidden = true;

    // حالة فارغة حقيقية: لا طلبات ضمن النطاق/الفلاتر
    var hasData = stats.current.orders > 0 || products.length > 0;
    $('#anEmpty').hidden = hasData;
    $('#anContent').hidden = !hasData;
    if (!hasData) {
      Object.keys(charts).forEach(destroy);
      return;
    }

    renderKpis(stats);
    renderComparison(stats);

    if (typeof Chart === 'undefined') return;

    renderSalesChart(range);
    renderProductChart('anTopProductsChart', products.slice(0, 6), PALETTE.primary);
    renderProductChart('anLowProductsChart', products.slice(-6).reverse(), PALETTE.warning);
    renderCityChart(cities.slice(0, 6));
    renderCustomersChart(behaviour);
    renderTopCustomers(customers);
  }

  /* ---------------- التهيئة ---------------- */
  function fillCityFilter() {
    var cities = [];
    Store.getOrders().forEach(function (o) { if (o.city && cities.indexOf(o.city) === -1) cities.push(o.city); });
    cities.sort();

    var sel = $('#anCity');
    var keep = sel.value;
    sel.innerHTML = '<option value="">كل المدن</option>' +
      cities.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    sel.value = keep;
  }

  function initControls() {
    $all('#rangeTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#rangeTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentRange = btn.getAttribute('data-range');
        $('#anCustomRange').hidden = currentRange !== 'custom';
        render();
      });
    });

    ['#anFrom', '#anTo'].forEach(function (sel) {
      $(sel).addEventListener('change', render);
    });

    $('#anCategory').addEventListener('change', function () { filters.category = this.value; render(); });
    $('#anCity').addEventListener('change', function () { filters.city = this.value; render(); });

    $all('[data-export-chart]').forEach(function (btn) {
      btn.addEventListener('click', function () { exportChartImage(btn.getAttribute('data-export-chart')); });
    });

    $('#anExportAll').addEventListener('click', exportAnalyticsPdf);
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    initControls();

    if (window.Shell) Shell.applyChartTheme();

    setTimeout(function () {
      fillCityFilter();
      render();
      Store.subscribe(function () { fillCityFilter(); render(); });
    }, 240);
  });
})();
