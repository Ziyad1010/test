/* ============================================================
   عمّار — طبقة تعدّد اللغات (عربي / English)
   ------------------------------------------------------------
   التبديل فوري بلا إعادة تحميل: يُبدَّل lang و dir على <html>،
   ثم تُترجم كل عقدة تحمل data-i18n، ويُعاد رسم المحتوى الديناميكي
   عبر حدث `i18n:change` الذي تستمع له الصفحات.

   نطاق الترجمة: عناصر الواجهة الثابتة (تنقّل، أزرار، عناوين
   الأقسام، تسميات الحقول). أسماء المنتجات والموردين والعناوين
   تبقى كما أدخلها المورد — ترجمتها تحتاج حقول لغة في البيانات
   نفسها لا في الواجهة.
   ============================================================ */

window.I18n = (function () {
  'use strict';

  var KEY = 'ammar_lang';

  var DICT = {
    /* --- التنقّل والهيدر --- */
    'nav.market': { ar: 'السوق', en: 'Marketplace' },
    'nav.categories': { ar: 'التصنيفات', en: 'Categories' },
    'nav.suppliers': { ar: 'الموردون', en: 'Suppliers' },
    'nav.orders': { ar: 'طلباتي', en: 'My Orders' },
    'nav.cart': { ar: 'سلة التسوق', en: 'Cart' },
    'nav.favorites': { ar: 'المفضلة', en: 'Favorites' },
    'nav.compare': { ar: 'مقارنة المنتجات', en: 'Compare' },
    'nav.notifications': { ar: 'الإشعارات', en: 'Notifications' },
    'nav.account': { ar: 'حسابي', en: 'My Account' },
    'nav.addresses': { ar: 'عناويني', en: 'Addresses' },
    'nav.wallet': { ar: 'المحفظة', en: 'Wallet' },
    'nav.invoices': { ar: 'فواتيري', en: 'Invoices' },
    'nav.settings': { ar: 'الإعدادات', en: 'Settings' },
    'nav.logout': { ar: 'تسجيل الخروج', en: 'Sign out' },
    'nav.allProducts': { ar: 'كل المنتجات', en: 'All products' },
    'nav.deals': { ar: 'عروض اليوم', en: "Today's deals" },
    'nav.business': { ar: 'عمّار أعمال', en: 'Ammar Business' },

    /* --- البحث --- */
    'search.placeholder': { ar: 'ابحث عن منتج، تصنيف، أو مورد…', en: 'Search products, categories, suppliers…' },
    'search.all': { ar: 'كل الأقسام', en: 'All categories' },
    'search.go': { ar: 'بحث', en: 'Search' },
    'search.visual': { ar: 'ابحث بصورة منتج', en: 'Search by image' },
    'search.voice': { ar: 'ابحث بصوتك', en: 'Search by voice' },
    'search.deliverTo': { ar: 'التوصيل إلى', en: 'Deliver to' },
    'search.chooseCity': { ar: 'اختر مدينتك', en: 'Choose your city' },

    /* --- أقسام الصفحة الرئيسية --- */
    'home.categories.title': { ar: 'تصفح حسب التصنيف', en: 'Browse by category' },
    'home.categories.sub': { ar: 'اختر القسم الذي يحتاجه مشروعك وابدأ فوراً', en: 'Pick the section your project needs and start right away' },
    'home.categories.all': { ar: 'جميع التصنيفات', en: 'All categories' },
    'home.reco.title': { ar: 'منتجات مقترحة لك', en: 'Recommended for you' },
    'home.reco.sub': { ar: 'مبنية على تصفّحك ومشترياتك السابقة', en: 'Based on your browsing and past purchases' },
    'home.deals.title': { ar: 'عروض اليوم', en: "Today's deals" },
    'home.deals.sub': { ar: 'خصومات تنتهي عند منتصف الليل', en: 'Discounts ending at midnight' },
    'home.city.title': { ar: 'الأكثر طلباً في مدينتك', en: 'Most ordered in your city' },
    'home.city.sub': { ar: 'ما يطلبه المقاولون والأفراد حولك هذا الشهر', en: 'What contractors near you ordered this month' },
    'home.bulk.title': { ar: 'اشترِ بالجملة', en: 'Buy in bulk' },
    'home.bulk.sub': { ar: 'أسعار شرائح كمية تنخفض كلما زادت طلبيتك', en: 'Tiered pricing that drops as your order grows' },
    'home.suppliers.title': { ar: 'موردون موثوقون', en: 'Verified suppliers' },
    'home.suppliers.sub': { ar: 'ملفات مختصرة لشركائنا الأعلى تقييماً', en: 'Short profiles of our top-rated partners' },
    'home.suppliers.all': { ar: 'كل الموردين', en: 'All suppliers' },
    'home.bundles.title': { ar: 'تجميعات ذكية للمشاريع', en: 'Smart project bundles' },
    'home.bundles.sub': { ar: 'كل مواد المرحلة في قائمة واحدة جاهزة للطلب', en: 'A whole phase of materials in one ready list' },
    'home.viewed.title': { ar: 'شاهدتها مؤخراً', en: 'Recently viewed' },
    'home.viewed.sub': { ar: 'آخر المنتجات التي تصفّحتها', en: 'The last products you browsed' },
    'home.seeAll': { ar: 'عرض الكل', en: 'See all' },

    /* --- عام --- */
    'common.addToCart': { ar: 'أضف للسلة', en: 'Add to cart' },
    'common.inCart': { ar: 'في السلة', en: 'In cart' },
    'common.outOfStock': { ar: 'غير متوفر', en: 'Out of stock' },
    'common.checkout': { ar: 'إتمام الشراء', en: 'Checkout' },
    'common.continue': { ar: 'متابعة التسوّق', en: 'Continue shopping' },
    'common.total': { ar: 'الإجمالي', en: 'Total' },
    'common.quantity': { ar: 'الكمية', en: 'Quantity' },
    'common.price': { ar: 'السعر', en: 'Price' },
    'common.supplier': { ar: 'المورد', en: 'Supplier' },
    'common.currency': { ar: 'ر.س', en: 'SAR' },

    /* --- الفوتر --- */
    'footer.about': { ar: 'عن عمّار', en: 'About Ammar' },
    'footer.aboutText': {
      ar: 'منصة سعودية تربط المقاولين والأفراد بموردي مواد البناء الموثوقين، بأسعار شفافة وتوصيل موثوق لكل مناطق المملكة.',
      en: 'A Saudi platform connecting contractors and individuals with trusted building-material suppliers — transparent pricing and reliable delivery across the Kingdom.'
    },
    'footer.company': { ar: 'الشركة', en: 'Company' },
    'footer.support': { ar: 'الدعم', en: 'Support' },
    'footer.policies': { ar: 'السياسات', en: 'Policies' },
    'footer.newsletter': { ar: 'اشترك ليصلك جديد العروض', en: 'Subscribe for new deals' },
    'footer.subscribe': { ar: 'اشترك', en: 'Subscribe' },
    'footer.rights': { ar: '© 2026 عمّار — جميع الحقوق محفوظة', en: '© 2026 Ammar — All rights reserved' },
    'footer.madeIn': { ar: 'صُنع في المملكة العربية السعودية', en: 'Made in Saudi Arabia' },

    /* --- مبدّل اللغة --- */
    'lang.switch': { ar: 'English', en: 'العربية' },
    'lang.label': { ar: 'تغيير اللغة', en: 'Change language' }
  };

  function current() {
    try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; }
  }

  function t(key, lang) {
    var entry = DICT[key];
    if (!entry) return key;
    return entry[lang || current()] || entry.ar;
  }

  /* ---------------- التطبيق على الصفحة ---------------- */
  function applyTo(root) {
    var lang = current();
    var scope = root || document;

    Array.prototype.slice.call(scope.querySelectorAll('[data-i18n]')).forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'), lang);
    });

    // السمات المترجمة: placeholder / title / aria-label
    ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
      var sel = '[data-i18n-' + attr + ']';
      Array.prototype.slice.call(scope.querySelectorAll(sel)).forEach(function (el) {
        el.setAttribute(attr, t(el.getAttribute('data-i18n-' + attr), lang));
      });
    });
  }

  function apply() {
    var lang = current();
    var html = document.documentElement;

    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    html.setAttribute('data-lang', lang);

    applyTo(document);
    syncSwitchers();

    // الصفحات تُعيد رسم محتواها الديناميكي عند سماع هذا الحدث
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
  }

  function set(lang) {
    var next = lang === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
    apply();
  }

  function toggle() { set(current() === 'ar' ? 'en' : 'ar'); }

  function syncSwitchers() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lang-toggle]')).forEach(function (btn) {
      btn.textContent = t('lang.switch');
      btn.setAttribute('aria-label', t('lang.label'));
    });
  }

  /* ---------------- زر التبديل في الهيدر ---------------- */
  function initSwitcher() {
    var tools = document.querySelector('.by-tools');
    if (!tools || document.querySelector('[data-lang-toggle]')) { syncSwitchers(); return; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'by-icon-btn sm-lang-btn';
    btn.setAttribute('data-lang-toggle', '');
    btn.textContent = t('lang.switch');
    btn.addEventListener('click', toggle);

    tools.insertBefore(btn, tools.firstChild);
    syncSwitchers();
  }

  // تُطبَّق اللغة المحفوظة فوراً قبل أول رسم
  if (document.documentElement) {
    var lang = current();
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('data-lang', lang);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTo(document);
    initSwitcher();
  });

  return {
    KEY: KEY,
    DICT: DICT,
    current: current,
    t: t,
    set: set,
    toggle: toggle,
    apply: apply,
    applyTo: applyTo,
    initSwitcher: initSwitcher
  };
})();
