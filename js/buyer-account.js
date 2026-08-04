/* ============================================================
   عمّار — قشرة صفحات حساب المشتري
   ------------------------------------------------------------
   تحلّ محل buyer-shell.js القديم الذي كان يحقن قائمة جانبية
   بهيكل داشبورد المورد نفسه (dash-shell / dash-sidebar / nav-item).

   بوابة المشتري الآن مستقلة كلياً: هيدر المتجر نفسه، وتنقّل حساب
   أفقي بهوية المتجر، بلا أي عنصر من عناصر لوحة تحكم الأعمال.
   ============================================================ */

var BuyerAccount = (function () {
  'use strict';

  var THEME_KEY = 'ammar_theme';

  var NAV = [
    { href: 'buyer-orders.html', label: 'طلباتي', icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
    { href: 'buyer-invoices.html', label: 'فواتيري', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    { href: 'buyer-wallet.html', label: 'المحفظة', icon: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
    { href: 'buyer-addresses.html', label: 'عناويني', icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
    { href: 'buyer-wishlist.html', label: 'المفضلة', icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    { href: 'buyer-reviews.html', label: 'تقييماتي', icon: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' },
    { href: 'buyer-notifications.html', label: 'الإشعارات', icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', badge: true },
    { href: 'buyer-settings.html', label: 'إعدادات الحساب', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
  ];

  function $(sel, root) { return (root || document).querySelector(sel); }

  function currentPage() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'buyer-home.html';
  }

  function icon(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- تسجيل الخروج ---------------- */
  function logout() {
    // جلسة المتجر وحدها تُمسح — جلسة بوابة الأعمال تبقى كما هي
    if (window.Session) {
      window.location.href = Session.signOut('store');
      return;
    }
    ['ammar_account_type', 'ammar_user_name', 'ammar_buyer_id'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    });
    window.location.href = 'login.html';
  }

  /* ---------------- تنقّل الحساب ---------------- */
  function renderNav() {
    var mount = $('#baNav');
    if (!mount) return;

    var active = currentPage();
    var unread = 0;
    if (window.Buyer) {
      try { unread = Buyer.unreadCount(); } catch (e) { unread = 0; }
    }

    mount.innerHTML =
      '<div class="ba-nav-scroll">' +
        NAV.map(function (item) {
          var badge = (item.badge && unread > 0)
            ? '<span class="ba-badge">' + (unread > 99 ? '99+' : unread) + '</span>' : '';
          return '<a href="' + item.href + '" class="ba-tab' + (item.href === active ? ' is-active' : '') + '">' +
            icon(item.icon) + '<span>' + esc(item.label) + '</span>' + badge + '</a>';
        }).join('') +
      '</div>';
  }

  function renderHead() {
    var mount = $('#baHead');
    if (!mount || !window.Buyer) return;

    var p = Buyer.profile();
    mount.innerHTML =
      '<span class="ba-avatar">' + esc(String(p.name || 'م').trim().charAt(0)) + '</span>' +
      '<span class="ba-who">' +
        '<strong>' + esc(p.name || 'المشتري') + '</strong>' +
        '<small>' + esc(p.email || 'حساب مشترٍ على عمّار') + '</small>' +
      '</span>' +
      '<button type="button" class="ba-logout" id="baLogout">' +
        icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>') +
        'تسجيل الخروج' +
      '</button>';

    $('#baLogout').addEventListener('click', function () {
      if (window.confirm('هل تريد تسجيل الخروج من حسابك؟')) logout();
    });
  }

  /* ---------------- التوست ---------------- */
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

  /* ---------------- المظهر ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }

  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  }

  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    applyTheme(theme);
    if (window.Store && Store.emit) Store.emit();
  }

  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', function () {
    renderNav();
    renderHead();

    // هيدر المتجر نفسه يعمل هنا تماماً كما في بقية صفحات المتجر
    if (window.ByUI && ByUI.initHeader) ByUI.initHeader();

    if (window.Store && Store.subscribe) {
      Store.subscribe(function () { renderNav(); renderHead(); });
    }
  });

  return { toast: toast, logout: logout, setTheme: setTheme, getTheme: getTheme };
})();

// نفس اسم الواجهة المستخدم في البوابتين حتى تعمل نداءات Shell.toast
window.Shell = window.Shell || BuyerAccount;
