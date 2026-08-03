(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.STATUS_META;

  // نفس مفردات حالة الطلب المستخدمة في بوابة المورد
  var TABS = [
    { key: '', label: 'الكل' },
    { key: 'pending', label: S.pending.label },
    { key: 'processing', label: S.processing.label },
    { key: 'shipping', label: S.shipping.label },
    { key: 'delivered', label: 'مكتملة' },
    { key: 'cancelled', label: S.cancelled.label }
  ];

  var currentTab = '';
  var search = '';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inTab(o, tab) {
    if (!tab) return true;
    // "جاهز للشحن" يظهر للمشتري ضمن قيد المعالجة
    if (tab === 'processing') return o.status === 'processing' || o.status === 'ready';
    return o.status === tab;
  }

  function visible() {
    var q = search.trim().toLowerCase();
    return Buyer.orders().filter(function (o) {
      if (!inTab(o, currentTab)) return false;
      if (!q) return true;
      var hay = o.id + ' ' + (o.items || []).map(function (it) { return it.name; }).join(' ');
      return hay.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderTabs() {
    var all = Buyer.orders();
    $('#boTabs').innerHTML = TABS.map(function (t) {
      var count = all.filter(function (o) { return inTab(o, t.key); }).length;
      return '<button type="button" class="tab-btn' + (currentTab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
        esc(t.label) + '<span class="count">(' + count + ')</span></button>';
    }).join('');

    $all('[data-tab]', $('#boTabs')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTab = btn.getAttribute('data-tab');
        render();
      });
    });
  }

  function renderTable() {
    var list = visible();

    $('#boLoading').hidden = true;
    $('#boTableWrap').hidden = list.length === 0;
    $('#boEmpty').hidden = list.length > 0;

    if (!list.length) {
      var label = '';
      TABS.forEach(function (t) { if (t.key === currentTab) label = t.label; });
      $('#boEmptyTitle').textContent = search ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات في «' + label + '»';
      $('#boEmptyText').textContent = search
        ? 'جرّب كلمة بحث أخرى.'
        : 'ابدأ التسوّق وستظهر طلباتك هنا.';
      return;
    }

    $('#boTableBody').innerHTML = list.map(function (o) {
      var meta = S[o.status] || S.pending;
      var first = (o.items && o.items[0]) ? o.items[0].name : '—';
      var extra = (o.items || []).length > 1 ? '<small>و' + (o.items.length - 1) + ' صنف آخر</small>' : '';
      var qty = (o.items || []).reduce(function (s, it) { return s + (it.qty || 0); }, 0);

      return '<tr class="ord-row" data-open="' + esc(o.id) + '" tabindex="0">' +
        '<td><span class="ord-id">' + esc(o.id) + '</span>' +
          (o.status === 'shipping' && o.tracking ? '<span class="ord-flag stock">قابل للتتبع</span>' : '') + '</td>' +
        '<td dir="ltr">' + esc(o.date) + '</td>' +
        '<td class="ord-items-cell">' + esc(first) + extra + '</td>' +
        '<td>' + qty + '</td>' +
        '<td class="ord-amount">' + fmt(o.total) + ' ر.س</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    // كل طلب قابل للنقر لفتح تفاصيله الكاملة
    $all('[data-open]', $('#boTableBody')).forEach(function (row) {
      function open() { window.location.href = 'buyer-order-details.html?id=' + encodeURIComponent(row.getAttribute('data-open')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  /* ---------------- رسم الإنفاق الشهري ----------------
     مشتق من طلبات هذا المشتري فقط، ويتحدّث مع أي تغيير في المتجر. */
  var spendChart = null;

  function renderSpend() {
    if (!window.Smart || !window.Chart) return;

    var card = $('#boSpendCard');
    var series = Smart.spendSeries(6);
    var any = series.some(function (s) { return s.total > 0; });

    // لا رسم بلا بيانات — بطاقة فارغة أسوأ من عدمها
    if (!any) { card.hidden = true; return; }
    card.hidden = false;

    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
    var tick = dark ? '#94a3b8' : '#64748b';

    var data = {
      labels: series.map(function (s) { return s.label; }),
      datasets: [
        {
          label: 'الإنفاق (ر.س)', data: series.map(function (s) { return s.total; }),
          backgroundColor: '#00a8cc', borderRadius: 8, borderSkipped: false,
          yAxisID: 'y', order: 2
        },
        {
          label: 'عدد الطلبات', data: series.map(function (s) { return s.orders; }),
          type: 'line', borderColor: dark ? '#e8eff8' : '#0e2439',
          backgroundColor: dark ? '#e8eff8' : '#0e2439',
          borderWidth: 2.5, tension: 0.35, pointRadius: 4, pointHoverRadius: 6,
          yAxisID: 'y1', order: 1
        }
      ]
    };

    if (spendChart) { spendChart.destroy(); spendChart = null; }

    spendChart = new Chart($('#boSpendChart'), {
      type: 'bar',
      data: data,
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true, textDirection: 'rtl',
            callbacks: {
              label: function (ctx) {
                return ctx.datasetIndex === 0
                  ? ' الإنفاق: ' + ctx.parsed.y.toLocaleString('ar-SA') + ' ر.س'
                  : ' الطلبات: ' + ctx.parsed.y;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: tick, font: { family: 'IBM Plex Sans Arabic' } } },
          y: {
            position: 'right', beginAtZero: true,
            grid: { color: grid }, border: { display: false },
            ticks: { color: tick, font: { family: 'IBM Plex Sans Arabic' },
              callback: function (v) { return v.toLocaleString('ar-SA'); } }
          },
          y1: {
            position: 'left', beginAtZero: true,
            grid: { display: false }, border: { display: false },
            ticks: { color: tick, stepSize: 1, font: { family: 'IBM Plex Sans Arabic' } }
          }
        }
      }
    });
  }

  function render() {
    renderTabs();
    renderTable();
    renderSpend();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var tab = new URLSearchParams(window.location.search).get('tab');
    if (tab) TABS.forEach(function (t) { if (t.key === tab) currentTab = tab; });

    $('#boSearch').addEventListener('input', function () { search = this.value; renderTable(); });

    setTimeout(function () {
      render();
      if (window.Live) Live.start();
      Store.subscribe(render);
    }, 220);
  });
})();
