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

  /* ---------------- Charts ---------------- */
  function initCharts() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.legend.rtl = true;
    Chart.defaults.plugins.tooltip.rtl = true;

    var primary = '#2563eb';
    var primaryLight = 'rgba(37, 99, 235, 0.12)';
    var success = '#16a34a';
    var warning = '#f59e0b';
    var danger = '#dc2626';
    var muted = '#94a3b8';

    // Monthly Revenue
    new Chart(document.getElementById('revenueChart'), {
      type: 'line',
      data: {
        labels: ['فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو'],
        datasets: [{
          label: 'الإيرادات (ر.س)',
          data: [24000, 28500, 31000, 29800, 35200, 37900],
          borderColor: primary,
          backgroundColor: primaryLight,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { callback: function (v) { return (v / 1000) + ' ألف'; } } },
          x: { grid: { display: false } }
        }
      }
    });

    // Top Selling Products
    new Chart(document.getElementById('topProductsChart'), {
      type: 'bar',
      data: {
        labels: ['حديد تسليح 12مم', 'أسمنت بورتلاندي', 'خرسانة جاهزة', 'طوب أسمنتي', 'بلاط بورسلين'],
        datasets: [{
          label: 'الإيراد (ر.س)',
          data: [52400, 41200, 33800, 21500, 15300],
          backgroundColor: [primary, primary, primary, primary, primary],
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
    });

    // Orders by City
    new Chart(document.getElementById('cityChart'), {
      type: 'doughnut',
      data: {
        labels: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'الخبر'],
        datasets: [{
          data: [186, 124, 78, 52, 34],
          backgroundColor: [primary, success, warning, '#7c3aed', muted],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } }
      }
    });

    // Visitors (last 7 days)
    new Chart(document.getElementById('visitorsChart'), {
      type: 'line',
      data: {
        labels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
        datasets: [{
          label: 'الزوار',
          data: [320, 410, 380, 460, 512, 470, 298],
          borderColor: success,
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: success
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
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    renderProfileBanner();
    initCharts();
  });
})();
