/* ============================================================
   عمار — Shared Supplier Portal Shell (sidebar nav, logout, toast)
   Included on every dashboard page so the nav list, active state,
   and logout behavior stay identical everywhere.
   ============================================================ */
var Shell = (function () {
  'use strict';

  var NAV_ITEMS = [
    { href: 'dashboard.html', label: 'الرئيسية', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>' },
    { href: 'products.html', label: 'المنتجات', icon: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>' },
    { href: 'orders.html', label: 'الطلبات', icon: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
    { href: 'offers.html', label: 'العروض', icon: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.7" r="1.2"/>' },
    { href: 'warehouses.html', label: 'المستودعات', icon: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>' },
    { href: 'invoices.html', label: 'الفواتير', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    { href: 'analytics.html', label: 'التحليلات', icon: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>' },
    { href: 'reports.html', label: 'التقارير', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>' },
    { href: 'notifications.html', label: 'الإشعارات', icon: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    { href: 'messaging.html', label: 'المحادثات', icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    { href: 'company.html', label: 'الشركة', icon: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>' },
    { href: 'users.html', label: 'المستخدمين والصلاحيات', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { href: 'settings.html', label: 'الإعدادات', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
  ];

  var FOOTER_ITEMS = [
    { href: 'help.html', label: 'مركز المساعدة', icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' }
  ];

  var LOGOUT_KEYS = [
    'ammar_supplier_onboarded', 'ammar_supplier_profile_verified', 'ammar_onboarding_data',
    'ammar_profile_progress', 'ammar_company_name', 'ammar_user_name'
  ];

  function currentPage() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'dashboard.html';
  }

  function iconSvg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  function logout() {
    LOGOUT_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    window.location.href = 'login.html';
  }

  function renderSidebar() {
    var mount = document.getElementById('dashSidebar');
    if (!mount) return;
    var active = currentPage();

    // شارات: الطلبات الجديدة غير المطّلع عليها، والإشعارات غير المقروءة
    var counts = { 'orders.html': 0, 'notifications.html': 0 };
    if (window.Store) {
      try { counts['orders.html'] = Store.unseenOrdersCount(); } catch (e) { /* ignore */ }
      try { counts['notifications.html'] = Store.unreadTotal(); } catch (e) { /* ignore */ }
    }

    var navHtml = NAV_ITEMS.map(function (item) {
      var n = counts[item.href] || 0;
      var badge = n > 0 ? '<span class="nav-badge">' + (n > 99 ? '99+' : n) + '</span>' : '';
      return '<a href="' + item.href + '" class="nav-item' + (item.href === active ? ' active' : '') + '">' +
        iconSvg(item.icon) + '<span>' + item.label + '</span>' + badge + '</a>';
    }).join('');

    var footerHtml = FOOTER_ITEMS.map(function (item) {
      return '<a href="' + item.href + '" class="nav-item' + (item.href === active ? ' active' : '') + '">' +
        iconSvg(item.icon) + '<span>' + item.label + '</span></a>';
    }).join('') +
      '<a href="#" class="nav-item nav-logout" id="shellLogoutBtn">' +
        iconSvg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>') +
        '<span>تسجيل الخروج</span>' +
      '</a>';

    mount.innerHTML =
      '<div class="sidebar-header">' +
        '<img src="assets/images/logo.png" alt="شعار عمار" />' +
        '<div class="sidebar-brand"><strong>عمّار</strong><small>بوابة الموردين</small></div>' +
      '</div>' +
      '<nav class="sidebar-nav">' + navHtml + '</nav>' +
      '<div class="sidebar-footer">' + footerHtml + '</div>';

    var logoutBtn = document.getElementById('shellLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.confirm('هل تريد تسجيل الخروج من حساب المورد؟')) logout();
    });

    // Closing the drawer when a nav link is tapped matters on mobile even
    // though the link also navigates away — without it the drawer stays
    // visually "open" for the brief moment before the new page loads.
    $all('.nav-item', mount).forEach(function (link) {
      link.addEventListener('click', function () { closeMobileMenu(); });
    });
  }

  /* ---------------- Mobile drawer ---------------- */
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function openMobileMenu() {
    var sidebar = document.getElementById('dashSidebar');
    var backdrop = document.getElementById('dashBackdrop');
    if (sidebar) sidebar.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-open');
  }

  function closeMobileMenu() {
    var sidebar = document.getElementById('dashSidebar');
    var backdrop = document.getElementById('dashBackdrop');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
  }

  function initMobileMenu() {
    var navbar = document.querySelector('.top-navbar');
    if (!navbar || document.getElementById('mobileMenuBtn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mobileMenuBtn';
    btn.className = 'mobile-menu-btn';
    btn.setAttribute('aria-label', 'القائمة');
    btn.innerHTML = iconSvg('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>');
    navbar.insertBefore(btn, navbar.firstChild);
    btn.addEventListener('click', openMobileMenu);

    var backdrop = document.createElement('div');
    backdrop.id = 'dashBackdrop';
    backdrop.className = 'dash-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeMobileMenu);

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMobileMenu(); });
  }

  function setCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    var el = document.getElementById('dashCompanyName');
    if (name && el) el.textContent = name;
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(message, type) {
    var el = document.getElementById('shellToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shellToast';
      el.className = 'shell-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'shell-toast is-visible' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  /* ---------------- Theme ---------------- */
  var THEME_KEY = 'ammar_theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }

  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    applyTheme(theme);

    // Charts bake their colours in at construction time, so switching theme
    // has to rebuild them — Store.emit() makes every page redraw itself.
    applyChartTheme();
    if (window.Store && Store.emit) Store.emit();
  }

  function getTheme() {
    var theme = 'light';
    try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* ignore */ }
    return theme;
  }

  // Apply immediately (not gated on DOMContentLoaded) so there's minimal flash.
  applyTheme(getTheme());

  // Chart.js colours are set in JS, so they can't inherit the CSS theme.
  // Expose the current palette so chart code reads the right values.
  function chartColors() {
    var dark = getTheme() === 'dark';
    return {
      dark: dark,
      grid: dark ? '#2c3a53' : '#e2e8f0',
      text: dark ? '#94a3b8' : '#64748b',
      surface: dark ? '#161f33' : '#ffffff'
    };
  }

  function applyChartTheme() {
    if (typeof Chart === 'undefined') return;
    var c = chartColors();
    Chart.defaults.font.family = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.color = c.text;
    Chart.defaults.borderColor = c.grid;
    Chart.defaults.plugins.legend.rtl = true;
    Chart.defaults.plugins.tooltip.rtl = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderSidebar();
    setCompanyName();
    initMobileMenu();

    // أعد رسم الشريط الجانبي عند تغيّر الطلبات ليبقى عدد الشارة صحيحاً
    if (window.Store && Store.subscribe) Store.subscribe(renderSidebar);
  });

  return {
    toast: toast, logout: logout, setTheme: setTheme, getTheme: getTheme,
    chartColors: chartColors, applyChartTheme: applyChartTheme
  };
})();
