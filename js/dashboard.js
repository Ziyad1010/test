(function () {
  'use strict';

  var PROGRESS_KEY = 'ammar_profile_progress';

  function getProgress() {
    var raw;
    try { raw = localStorage.getItem(PROGRESS_KEY); } catch (e) { raw = null; }
    var defaults = { cr: false, location: false, warehouse: false };
    if (!raw) return defaults;
    try { return Object.assign(defaults, JSON.parse(raw)); } catch (e) { return defaults; }
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  /* ---------------- Profile Completion Banner ---------------- */
  function renderProfileBanner() {
    var progress = getProgress();
    var tasks = [
      {
        key: 'cr', title: 'رفع السجل التجاري', sub: 'يسرّع اعتماد حسابك كمورد موثّق', optional: false,
        icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
        href: 'onboarding.html?step=2'
      },
      {
        key: 'location', title: 'تحديد موقع الشركة', sub: 'يساعد المشترين على حساب مدة التوصيل', optional: false,
        icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        href: 'onboarding.html?step=3'
      },
      {
        key: 'warehouse', title: 'إضافة مستودع', sub: 'لربط منتجاتك بالمخزون الصحيح', optional: true,
        icon: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>',
        href: 'onboarding.html?step=4'
      }
    ];

    var doneCount = tasks.filter(function (t) { return progress[t.key]; }).length;

    if (doneCount === tasks.length) {
      document.getElementById('profileBanner').hidden = true;
      return;
    }

    var percent = Math.round((doneCount / tasks.length) * 100);
    document.getElementById('profileBannerPercent').textContent = percent + '%';
    document.getElementById('profileBannerFill').style.width = percent + '%';

    var wrap = document.getElementById('profileTasks');
    wrap.innerHTML = tasks.map(function (t) {
      var done = !!progress[t.key];
      return '<div class="profile-task' + (done ? ' is-done' : '') + '">' +
        '<div class="profile-task-head">' +
          '<span class="profile-task-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + t.icon + '</svg></span>' +
          '<span class="profile-task-title">' + t.title + (t.optional ? '<span class="profile-task-optional">اختياري</span>' : '') + '</span>' +
        '</div>' +
        '<span class="profile-task-sub">' + t.sub + '</span>' +
        (done
          ? '<span class="profile-task-btn">✓ تم الإكمال</span>'
          : '<a class="profile-task-btn" href="' + t.href + '">إكمال الآن</a>') +
        '</div>';
    }).join('');
  }

  /* ---------------- Formatting ---------------- */
  function fmt(n) {
    return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 });
  }

  function changeBadge(el, value, suffix) {
    if (!el) return;
    var rounded = Math.round(value * 10) / 10;
    el.classList.remove('up', 'down', 'flat');
    if (rounded > 0) {
      el.classList.add('up');
      el.textContent = '+' + rounded + (suffix || '%');
    } else if (rounded < 0) {
      el.classList.add('down');
      el.textContent = rounded + (suffix || '%');
    } else {
      el.classList.add('flat');
      el.textContent = 'بدون تغيّر';
    }
  }

  /* ---------------- Chart loading / empty states ---------------- */
  var EMPTY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>';

  function stateEl(canvasId) {
    return document.querySelector('[data-state-for="' + canvasId + '"]');
  }

  function showEmpty(canvasId, message) {
    var el = stateEl(canvasId);
    if (!el) return;
    el.hidden = false;
    el.classList.remove('is-loading');
    el.innerHTML = '<span class="chart-empty-icon">' + EMPTY_ICON + '</span>' +
      '<strong>لا توجد بيانات كافية بعد</strong>' +
      '<span>' + message + '</span>';
  }

  function hideState(canvasId) {
    var el = stateEl(canvasId);
    if (el) el.hidden = true;
  }

  /* ---------------- Charts ---------------- */
  var charts = {};

  var PALETTE = {
    primary: '#2563eb',
    primaryLight: 'rgba(37, 99, 235, 0.12)',
    success: '#16a34a',
    successLight: 'rgba(22, 163, 74, 0.1)',
    warning: '#f59e0b',
    violet: '#7c3aed',
    muted: '#94a3b8'
  };

  function hasData(values) {
    return values && values.length > 0 && values.some(function (v) { return v > 0; });
  }

  // Rebuild a chart in place: create it the first time, then just swap the
  // data so updates animate instead of flickering.
  function upsert(canvasId, config, values, emptyMessage) {
    if (!hasData(values)) {
      if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }
      showEmpty(canvasId, emptyMessage);
      return;
    }

    hideState(canvasId);

    if (charts[canvasId]) {
      charts[canvasId].data.labels = config.data.labels;
      charts[canvasId].data.datasets[0].data = config.data.datasets[0].data;
      charts[canvasId].update();
      return;
    }

    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    charts[canvasId] = new Chart(canvas, config);
  }

  function renderRevenue() {
    var d = Store.monthlyRevenue(6);

    document.getElementById('revenueTotal').textContent = fmt(d.total) + ' ر.س';
    var changeEl = document.getElementById('revenueChange');
    if (d.change > 0) {
      changeEl.textContent = '+' + d.change + '% ▲';
      changeEl.style.color = PALETTE.success;
    } else if (d.change < 0) {
      changeEl.textContent = d.change + '% ▼';
      changeEl.style.color = '#dc2626';
    } else {
      changeEl.textContent = 'بدون تغيّر';
      changeEl.style.color = PALETTE.muted;
    }

    upsert('revenueChart', {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'الإيرادات (ر.س)',
          data: d.values,
          borderColor: PALETTE.primary,
          backgroundColor: PALETTE.primaryLight,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: PALETTE.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#e2e8f0' },
            ticks: { callback: function (v) { return v >= 1000 ? (v / 1000) + ' ألف' : v; } }
          },
          x: { grid: { display: false } }
        }
      }
    }, d.values, 'ستظهر الإيرادات هنا بمجرد اكتمال أول طلب في متجرك.');
  }

  function renderTopProducts() {
    var d = Store.topProducts(30, 5);

    upsert('topProductsChart', {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'الإيراد (ر.س)',
          data: d.values,
          backgroundColor: PALETTE.primary,
          borderRadius: 6,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#e2e8f0' } },
          y: { grid: { display: false } }
        }
      }
    }, d.values, 'لم تُسجَّل مبيعات خلال آخر 30 يوماً — أضف منتجاتك لتبدأ.');
  }

  function renderCity() {
    var d = Store.ordersByCity(30, 6);

    upsert('cityChart', {
      type: 'doughnut',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.values,
          backgroundColor: [PALETTE.primary, PALETTE.success, PALETTE.warning, PALETTE.violet, PALETTE.muted, '#0ea5e9'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } }
      }
    }, d.values, 'سيظهر التوزيع الجغرافي بعد ورود أول طلب بعنوان شحن.');
  }

  function renderVisitors() {
    var d = Store.visitors(7);
    document.getElementById('visitorsTotal').textContent = fmt(d.total) + ' زيارة';

    upsert('visitorsChart', {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'الزوار',
          data: d.values,
          borderColor: PALETTE.success,
          backgroundColor: PALETTE.successLight,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: PALETTE.success
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
          x: { grid: { display: false } }
        }
      }
    }, d.values, 'لم تُسجَّل زيارات بعد لصفحات متجرك.');
  }

  /* ---------------- KPI cards ---------------- */
  function renderKpis() {
    var k = Store.kpis();

    var salesEl = document.getElementById('kpiWeeklySales');
    salesEl.textContent = fmt(k.weeklySales);
    salesEl.classList.remove('is-loading');

    changeBadge(document.getElementById('kpiSalesChange'), k.weeklySalesChange);

    document.getElementById('kpiNewOrders').textContent = fmt(k.newOrders);
    changeBadge(document.getElementById('kpiOrdersChange'), k.newOrdersChange);

    document.getElementById('kpiInDelivery').textContent = fmt(k.inDelivery);
    document.getElementById('kpiStockAlerts').textContent = fmt(k.stockAlerts);
    document.getElementById('kpiStockBadge').hidden = k.stockAlerts === 0;
  }

  /* ---------------- Latest orders panel ---------------- */
  function renderLatestOrders() {
    var body = document.getElementById('latestOrdersBody');
    if (!body) return;

    var orders = Store.getOrders().slice();
    orders.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    orders = orders.slice(0, 5);

    if (!orders.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px 12px;">' +
        'لا توجد طلبات بعد — ستظهر هنا فور وصول أول طلب.</td></tr>';
      return;
    }

    body.innerHTML = orders.map(function (o) {
      var st = Store.STATUS_META[o.status] || Store.STATUS_META.pending;
      var first = (o.items && o.items[0]) ? o.items[0] : null;
      var summary = first
        ? (first.qty + ' × ' + first.name + (o.items.length > 1 ? ' +' + (o.items.length - 1) : ''))
        : '—';
      return '<tr class="ord-row" data-open="' + o.id + '" tabindex="0">' +
        '<td class="order-id">' + o.id + '</td>' +
        '<td>' + o.customer + '</td>' +
        '<td>' + summary + '</td>' +
        '<td><strong>' + fmt(o.total) + ' ر.س</strong></td>' +
        '<td><span class="ord-status ' + st.tone + '">' + st.label + '</span></td>' +
      '</tr>';
    }).join('');

    // الصف كله يفتح تفاصيل الطلب، مثل صفحة الطلبات
    Array.prototype.slice.call(body.querySelectorAll('[data-open]')).forEach(function (row) {
      function open() { window.location.href = 'order-details.html?id=' + encodeURIComponent(row.getAttribute('data-open')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  /* ---------------- Stock alerts panel ---------------- */
  function renderStockAlerts() {
    var wrap = document.getElementById('stockAlertList');
    if (!wrap) return;

    var low = Store.getProducts().filter(function (p) {
      return p.status !== 'archived' && (p.stock <= 0 || (p.lowStock > 0 && p.stock <= p.lowStock));
    }).sort(function (a, b) { return a.stock - b.stock; }).slice(0, 4);

    if (!low.length) {
      wrap.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:24px 8px;">' +
        'كل المنتجات ضمن المستوى الآمن للمخزون 👌</p>';
      return;
    }

    wrap.innerHTML = low.map(function (p) {
      var msg = p.stock <= 0 ? 'نفد المخزون' : 'باقي ' + p.stock + ' ' + (p.unit || 'وحدة');
      return '<div class="stock-item">' +
        '<img src="' + p.img + '" alt="' + p.name + '" class="stock-img" />' +
        '<div class="stock-info">' +
          '<div class="stock-name">' + p.name + '</div>' +
          '<div class="stock-remaining">' + msg + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderAll() {
    renderKpis();
    renderLatestOrders();
    renderStockAlerts();
    if (typeof Chart === 'undefined') return;
    renderRevenue();
    renderTopProducts();
    renderCity();
    renderVisitors();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    renderProfileBanner();

    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
      Chart.defaults.color = '#64748b';
      Chart.defaults.plugins.legend.rtl = true;
      Chart.defaults.plugins.tooltip.rtl = true;
    }

    // Count this page view, then draw everything from the store.
    Store.recordVisit();

    // A tick of delay so the loading state is actually perceivable rather than
    // flashing — the read itself is synchronous.
    setTimeout(function () {
      renderAll();
      // Re-render whenever data changes here or in another open tab.
      Store.subscribe(renderAll);
    }, 260);

    var refreshBtn = document.querySelector('.page-header .refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        renderAll();
        if (window.Shell) Shell.toast('تم تحديث البيانات', 'success');
      });
    }
  });
})();
