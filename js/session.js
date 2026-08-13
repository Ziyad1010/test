/* ============================================================
   عمّار — فصل الجلسات بين البوابتين
   ------------------------------------------------------------
   بوابتان مستقلتان تماماً:
     • business — داشبورد المورد (dashboard.html وما يتبعها)
     • store    — بوابة المشتري (buyer-*.html و favorites.html)

   لكل بوابة مفتاح تخزين منفصل، فتسجيل الخروج من إحداهما لا يمسّ
   الأخرى، ولا تتسرّب هوية المورد إلى المتجر أو العكس. المفتاح
   المشترك الوحيد هو تفضيل المظهر (فاتح/داكن) عمداً.

   تنبيه صريح: هذا نموذج ثابت بلا خادم — لا تحقّق فعلياً من
   كلمة المرور ولا رمز جلسة موقّع. الطبقة هنا تضبط التوجيه وفصل
   الحالة فقط، وليست حماية أمنية.
   ============================================================ */

window.Session = (function () {
  'use strict';

  var K = {
    business: 'ammar_session_business',
    store: 'ammar_session_store'
  };

  var K_ACTIVE = 'ammar_active_portal';

  // صفحات كل بوابة — تُستخدم لاشتقاق البوابة الحالية والتوجيه
  var BUSINESS_PAGES = [
    'dashboard.html', 'products.html', 'product-details.html', 'orders.html', 'order-details.html',
    'offers.html', 'warehouses.html', 'invoices.html', 'invoice-details.html', 'analytics.html',
    'reports.html', 'notifications.html', 'notification-settings.html', 'settings.html',
    'company.html', 'users.html', 'user-details.html', 'customer.html', 'city-orders.html',
    'messaging.html', 'onboarding.html'
  ];

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function currentPage() {
    var parts = window.location.pathname.split('/');
    return (parts[parts.length - 1] || 'index.html').toLowerCase();
  }

  // البوابة التي تنتمي إليها الصفحة الحالية
  function portalOfPage(page) {
    var name = (page || currentPage()).toLowerCase();
    if (BUSINESS_PAGES.indexOf(name) !== -1) return 'business';
    if (name.indexOf('buyer-') === 0 || name === 'favorites.html') return 'store';
    return null;   // صفحات محايدة: index / login / signup / help
  }

  function get(portal) { return read(K[portal] || K.store); }

  function isActive(portal) { return !!get(portal); }

  function signIn(portal, data) {
    var key = K[portal];
    if (!key) return null;

    var session = {
      portal: portal,
      email: (data && data.email) || '',
      name: (data && data.name) || (portal === 'business' ? 'حساب الأعمال' : 'المشتري'),
      at: Date.now()
    };

    write(key, session);
    try { localStorage.setItem(K_ACTIVE, portal); } catch (e) { /* ignore */ }

    // التوافق مع الشيفرة القائمة التي تقرأ نوع الحساب
    try {
      localStorage.setItem('ammar_account_type', portal === 'business' ? 'supplier' : 'buyer');
    } catch (e) { /* ignore */ }

    return session;
  }

  // مفاتيح تخصّ كل بوابة وحدها وتُمسح عند الخروج منها فقط
  var SCOPED_KEYS = {
    business: ['ammar_supplier_onboarded', 'ammar_company_name'],
    store: ['ammar_buyer_id', 'ammar_buyer_profile', 'ammar_buyer_city', 'ammar_checkout_draft']
  };

  function signOut(portal) {
    var target = portal || activePortal() || 'store';
    drop(K[target]);
    (SCOPED_KEYS[target] || []).forEach(drop);

    // اسم المستخدم مشترك الاسم لكنه يخصّ البوابة النشطة
    drop('ammar_user_name');
    drop('ammar_account_type');

    var other = target === 'business' ? 'store' : 'business';
    try {
      if (isActive(other)) localStorage.setItem(K_ACTIVE, other);
      else localStorage.removeItem(K_ACTIVE);
    } catch (e) { /* ignore */ }

    return loginUrl(target);
  }

  function activePortal() {
    try { return localStorage.getItem(K_ACTIVE); } catch (e) { return null; }
  }

  function loginUrl(portal) {
    return portal === 'business' ? 'login.html?portal=business' : 'login.html';
  }

  function homeUrl(portal) {
    if (portal !== 'business') return 'buyer-home.html';
    var onboarded = false;
    try { onboarded = localStorage.getItem('ammar_supplier_onboarded') === 'true'; } catch (e) { /* ignore */ }
    return onboarded ? 'dashboard.html' : 'onboarding.html';
  }

  // تُستدعى من صفحات البوابتين: تُسجّل البوابة الحالية كنشطة حتى
  // يعرف زر تسجيل الخروج وروابط التبديل أي جلسة يتعاملان معها
  function markPortal() {
    var portal = portalOfPage();
    if (!portal) return null;

    try { localStorage.setItem(K_ACTIVE, portal); } catch (e) { /* ignore */ }

    // زيارة مباشرة بلا مرور بتسجيل الدخول: نُنشئ جلسة ضيف لتلك
    // البوابة وحدها، فيبقى الفصل قائماً في كل الأحوال
    if (!isActive(portal)) signIn(portal, { name: portal === 'business' ? 'حساب الأعمال' : 'المشتري' });
    return portal;
  }

  document.addEventListener('DOMContentLoaded', markPortal);

  return {
    PORTALS: ['business', 'store'],
    portalOfPage: portalOfPage,
    activePortal: activePortal,
    get: get,
    isActive: isActive,
    signIn: signIn,
    signOut: signOut,
    loginUrl: loginUrl,
    homeUrl: homeUrl,
    markPortal: markPortal
  };
})();
