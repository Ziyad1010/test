/* ============================================================
   عمار — هيكل بوابة المشتري
   نسخة موازية لـ js/shell.js بنفس السلوك والمظهر تماماً
   (نفس الشريط الجانبي، الدرج على الجوال، التوست، الوضع الداكن)
   لكن بعناصر تنقّل تخصّ المشتري.
   ============================================================ */

var BuyerShell = (function () {
  'use strict';

  var THEME_KEY = 'ammar_theme';

  var NAV_ITEMS = [
    { href: 'buyer-home.html', label: 'الرئيسية', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { href: 'buyer-orders.html', label: 'طلباتي', icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
    { href: 'buyer-wishlist.html', label: 'المفضلة', icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    { href: 'buyer-addresses.html', label: 'العناوين المحفوظة', icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
    { href: 'buyer-wallet.html', label: 'المحفظة والمدفوعات', icon: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
    { href: 'buyer-invoices.html', label: 'الفواتير', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    { href: 'buyer-reviews.html', label: 'تقييماتي ومراجعاتي', icon: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' },
    { href: 'buyer-notifications.html', label: 'الإشعارات', icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    { href: 'buyer-settings.html', label: 'إعدادات الحساب', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
  ];

  var FOOTER_ITEMS = [
    { href: 'help.html', label: 'مركز المساعدة', icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' }
  ];

  var LOGOUT_KEYS = ['ammar_account_type', 'ammar_user_name', 'ammar_buyer_id'];

  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function currentPage() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'buyer-home.html';
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

    var unread = 0;
    if (window.Buyer) {
      try { unread = Buyer.unreadCount(); } catch (e) { unread = 0; }
    }

    var navHtml = NAV_ITEMS.map(function (item) {
      var badge = (item.href === 'buyer-notifications.html' && unread > 0)
        ? '<span class="nav-badge">' + (unread > 99 ? '99+' : unread) + '</span>' : '';
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
        '<div class="sidebar-brand"><strong>عمّار</strong><small>بوابة المشتري</small></div>' +
      '</div>' +
      '<nav class="sidebar-nav">' + navHtml + '</nav>' +
      '<div class="sidebar-footer">' + footerHtml + '</div>';

    var logoutBtn = document.getElementById('shellLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.confirm('هل تريد تسجيل الخروج من حسابك؟')) logout();
    });

    $all('.nav-item', mount).forEach(function (link) {
      link.addEventListener('click', function () { closeMobileMenu(); });
    });
  }

  /* ---------------- Mobile drawer ---------------- */
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMobileMenu();
    });
  }

  /* ---------------- Toast ---------------- */
  var toastEl = null;
  var toastTimer = null;

  function toast(message, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'shell-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.className = 'shell-toast' + (kind ? ' ' + kind : '');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 3200);
  }

  /* ---------------- Theme ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }

  function getTheme() {
    var theme = 'light';
    try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* ignore */ }
    return theme;
  }

  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    applyTheme(theme);
    if (window.Store && Store.emit) Store.emit();
  }

  applyTheme(getTheme());

  function setBuyerName() {
    var el = document.getElementById('dashCompanyName');
    if (el && window.Buyer) el.textContent = Buyer.profile().name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderSidebar();
    setBuyerName();
    initMobileMenu();
    if (window.Store && Store.subscribe) Store.subscribe(renderSidebar);
  });

  return { toast: toast, logout: logout, setTheme: setTheme, getTheme: getTheme };
})();

// نفس اسم الواجهة المستخدم في بوابة المورد، حتى تعمل المكوّنات المشتركة
// (مثل نداءات Shell.toast) دون تعديل في كلتا البوابتين.
window.Shell = window.Shell || BuyerShell;
