(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var charts = {};

  function seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function lastNDates(n) {
    var out = [];
    var today = new Date('2026-07-26');
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push((d.getMonth() + 1) + '/' + d.getDate());
    }
    return out;
  }

  function generateSeries(days, base, variance, seedOffset) {
    var out = [];
    for (var i = 0; i < days; i++) {
      var r = seededRandom(i + seedOffset);
      out.push(Math.round(base + (r - 0.5) * variance + (i / days) * variance * 0.6));
    }
    return out;
  }

  function fmt(n) { return Number(n).toLocaleString('ar-SA'); }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); });
  }

  function render(range) {
    var days = parseInt(range, 10);
    var labels = lastNDates(days);
    var revenueBase = days <= 7 ? 32000 : days <= 30 ? 28000 : 26000;
    var revenueSeries = generateSeries(days, revenueBase, 12000, 1);
    var ordersSeries = generateSeries(days, days <= 7 ? 18 : 14, 10, 5);
    var visitorsSeries = generateSeries(days, days <= 7 ? 420 : 380, 220, 9);

    var totalRevenue = revenueSeries.reduce(function (s, v) { return s + v; }, 0);
    var totalOrders = ordersSeries.reduce(function (s, v) { return s + v; }, 0);
    var totalVisitors = visitorsSeries.reduce(function (s, v) { return s + v; }, 0);
    var conversion = totalVisitors > 0 ? ((totalOrders / totalVisitors) * 100).toFixed(1) : '0';

    $('#anRevenue').textContent = fmt(totalRevenue) + ' ر.س';
    $('#anOrders').textContent = fmt(totalOrders);
    $('#anVisitors').textContent = fmt(totalVisitors);
    $('#anConversion').textContent = conversion + '%';

    if (typeof Chart === 'undefined') return;
    destroyCharts();

    Chart.defaults.font.family = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.color = '#64748b';

    var primary = '#2563eb';
    var success = '#16a34a';
    var warning = '#f59e0b';

    charts.revenue = new Chart($('#anRevenueChart'), {
      type: 'line',
      data: { labels: labels, datasets: [{ label: 'الإيرادات', data: revenueSeries, borderColor: primary, backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.3, pointRadius: days > 30 ? 0 : 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#e2e8f0' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } } }
    });

    charts.orders = new Chart($('#anOrdersChart'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'الطلبات', data: ordersSeries, backgroundColor: success, borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#e2e8f0' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } } }
    });

    charts.products = new Chart($('#anProductsChart'), {
      type: 'bar',
      data: {
        labels: ['حديد تسليح 12مم', 'أسمنت بورتلاندي', 'خرسانة جاهزة', 'طوب أسمنتي', 'بلاط بورسلين'],
        datasets: [{ data: [52400, 41200, 33800, 21500, 15300].map(function (v) { return Math.round(v * (days / 30)); }), backgroundColor: primary, borderRadius: 6, maxBarThickness: 22 }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#e2e8f0' } }, y: { grid: { display: false } } } }
    });

    charts.city = new Chart($('#anCityChart'), {
      type: 'doughnut',
      data: {
        labels: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'الخبر'],
        datasets: [{ data: [186, 124, 78, 52, 34].map(function (v) { return Math.round(v * (days / 30)); }), backgroundColor: [primary, success, warning, '#7c3aed', '#94a3b8'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } } }
    });
  }

  function initTabs() {
    $all('#rangeTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#rangeTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        render(btn.getAttribute('data-range'));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    render('30');
  });
})();
