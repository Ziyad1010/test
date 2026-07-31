(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var slideIndex = 0;
  var slideTimer = null;

  /* ---------------- بانرات الهيرو ---------------- */
  function slides() {
    var deals = Buyer.flashDeals(1)[0];
    var top = Buyer.bestSellers(1)[0];

    return [
      {
        tag: 'عروض اليوم',
        title: deals ? ('خصم ' + deals.discount + '% على ' + deals.name) : 'خصومات تصل إلى 20% على مواد البناء',
        text: 'عروض محدودة تنتهي عند منتصف الليل — اطلب الآن قبل نفاد الكمية.',
        cta: 'تسوّق العروض',
        href: 'buyer-market.html?filter=deals',
        img: 'assets/images/banner-supply.jpg'
      },
      {
        tag: 'الأكثر طلباً',
        title: top ? (top.name + ' بأفضل سعر') : 'كل ما يحتاجه مشروعك في مكان واحد',
        text: 'من أسمنت وحديد إلى أدوات ومعدات — من موردين موثّقين فقط.',
        cta: 'تسوّق الآن',
        href: 'buyer-market.html?filter=best',
        img: 'assets/images/banner-delivery.jpg'
      },
      {
        tag: 'توصيل لكل المملكة',
        title: 'اطلب اليوم، ونوصّل لموقعك',
        text: 'شبكة شحن تغطي كل المناطق مع تتبّع مباشر لشحنتك خطوة بخطوة.',
        cta: 'تعرّف على الشحن',
        href: 'buyer-info.html?topic=shipping',
        img: 'assets/images/cat-concrete.jpg'
      }
    ];
  }

  function renderSlider() {
    var list = slides();

    $('#bhSlides').innerHTML = list.map(function (s) {
      return '<a class="by-slide" href="' + esc(s.href) + '">' +
        '<img src="' + esc(s.img) + '" alt="" />' +
        '<span class="by-slide-tag">' + esc(s.tag) + '</span>' +
        '<h2>' + esc(s.title) + '</h2>' +
        '<p>' + esc(s.text) + '</p>' +
        '<span class="by-slide-cta">' + esc(s.cta) +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</span>' +
      '</a>';
    }).join('');

    $('#bhDots').innerHTML = list.map(function (s, i) {
      return '<button type="button" class="by-dot' + (i === 0 ? ' is-active' : '') + '" data-slide="' + i + '" aria-label="شريحة ' + (i + 1) + '"></button>';
    }).join('');

    $all('[data-slide]', $('#bhDots')).forEach(function (dot) {
      dot.addEventListener('click', function () {
        go(parseInt(dot.getAttribute('data-slide'), 10));
        restart();
      });
    });

    // في RTL تتحرك الشرائح إلى اليمين، فالإزاحة موجبة
    function go(i) {
      var count = list.length;
      slideIndex = (i + count) % count;
      $('#bhSlides').style.transform = 'translateX(' + (slideIndex * 100) + '%)';
      $all('[data-slide]').forEach(function (d, di) {
        d.classList.toggle('is-active', di === slideIndex);
      });
    }

    function restart() {
      clearInterval(slideTimer);
      slideTimer = setInterval(function () { go(slideIndex + 1); }, 6000);
    }

    $('#bhPrev').addEventListener('click', function () { go(slideIndex - 1); restart(); });
    $('#bhNext').addEventListener('click', function () { go(slideIndex + 1); restart(); });

    go(0);
    restart();
  }

  /* ---------------- الفئات ---------------- */
  function renderCategories() {
    $('#bhCategories').innerHTML = Buyer.categories().map(function (c) {
      return '<a class="by-cat-circle" href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' +
        '<span class="by-cat-circle-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          (ByUI.CATEGORY_ICONS[c.key] || ByUI.CATEGORY_ICONS.tools) + '</svg></span>' +
        '<strong>' + esc(c.label) + '</strong>' +
        '<small>' + c.count + ' منتج</small>' +
      '</a>';
    }).join('');
  }

  /* ---------------- العداد التنازلي ---------------- */
  function startCountdown() {
    var el = $('#bhCountdownText');
    if (!el) return;

    function tick() {
      var left = Buyer.flashDealEndsAt() - Date.now();
      if (left < 0) left = 0;

      var h = Math.floor(left / 3600000);
      var m = Math.floor((left % 3600000) / 60000);
      var s = Math.floor((left % 60000) / 1000);

      function pad(n) { return n < 10 ? '0' + n : String(n); }
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- الموردون ---------------- */
  function renderSuppliers() {
    var list = Buyer.suppliers().slice(0, 6);

    if (!list.length) {
      $('#bhSuppliers').innerHTML = ByUI.emptyState('لا يوجد موردون لعرضهم حالياً.');
      return;
    }

    $('#bhSuppliers').innerHTML = list.map(function (s) {
      return '<a class="by-supplier" href="buyer-supplier.html?name=' + encodeURIComponent(s.name) + '">' +
        '<span class="by-supplier-logo">' + esc(s.name.trim().charAt(0)) + '</span>' +
        '<strong>' + esc(s.name) + '</strong>' +
        '<span class="by-card-rating" style="justify-content:center;">' +
          ByUI.starsHtml(s.rating) + '<span style="font-size:0.76rem;color:var(--muted);">' + s.rating + '</span>' +
        '</span>' +
        '<small>' + s.products + ' منتج — ' + s.categories.length + ' فئة</small>' +
      '</a>';
    }).join('');
  }

  /* ---------------- العلامات الموثوقة ---------------- */
  function renderBrands() {
    // شعارات حقيقية موجودة في assets — كل شعار يفتح بحث المتجر باسم العلامة
    var brands = [
      { name: 'سابك', file: 'sabic.svg' },
      { name: 'أرامكو السعودية', file: 'aramco.svg' },
      { name: 'الزامل للصلب', file: 'zamil-steel.svg' },
      { name: 'الفوزان لمواد البناء', file: 'al-fozan.svg' },
      { name: 'المهيدب', file: 'al-muhaidb.svg' },
      { name: 'الخرسانة السعودية', file: 'saudi-readymix.svg' }
    ];

    $('#bhBrands').innerHTML = brands.map(function (b) {
      return '<a href="buyer-market.html?q=' + encodeURIComponent(b.name) + '" title="' + esc(b.name) + '">' +
        '<img src="assets/images/partners/' + esc(b.file) + '" alt="' + esc(b.name) + '" />' +
      '</a>';
    }).join('');
  }

  /* ---------------- النشرة البريدية ---------------- */
  function initNewsletter() {
    $('#bhNewsletter').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#bhNewsEmail').value.trim();

      if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
        ByUI.toast('أدخل بريداً إلكترونياً صحيحاً', 'danger');
        return;
      }

      try {
        var subs = JSON.parse(localStorage.getItem('ammar_newsletter') || '[]');
        if (subs.indexOf(email) === -1) subs.push(email);
        localStorage.setItem('ammar_newsletter', JSON.stringify(subs));
      } catch (err) { /* ignore */ }

      $('#bhNewsEmail').value = '';
      // الاشتراك محفوظ محلياً — الإرسال الفعلي يتطلب خادم بريد عند الإطلاق
      ByUI.toast('تم تسجيل اشتراكك — سيصلك جديد العروض', 'success');
    });
  }

  /* ---------------- أقسام المنتجات ---------------- */
  function renderSections() {
    ByUI.renderProducts($('#bhDeals'), Buyer.flashDeals(6),
      'لا توجد عروض نشطة الآن — تابعنا، تُضاف عروض جديدة يومياً.');

    var reco = Buyer.recommended(8);
    var hasHistory = Buyer.orders().length > 0 || Buyer.recentlyViewed(1).length > 0;

    // مستخدم جديد بلا سجل: اعرض الأكثر مبيعاً بدل قسم فارغ
    if (!hasHistory) {
      $('#bhRecoTitle').textContent = 'الأكثر مبيعاً على المنصة';
      $('#bhRecoSub').textContent = 'ابدأ من هنا — سنخصّص التوصيات لك بعد أول طلب';
      reco = Buyer.bestSellers(8);
    }

    ByUI.renderProducts($('#bhReco'), reco,
      'سنعرض لك توصيات مخصّصة بمجرد تصفّحك أو شرائك لأول منتج.');

    var again = Buyer.buyAgain(6);
    $('#bhBuyAgainSection').hidden = again.length === 0;
    if (again.length) ByUI.renderProducts($('#bhBuyAgain'), again);

    ByUI.renderProducts($('#bhFeatured'), Buyer.featured(8));
    ByUI.renderProducts($('#bhBest'), Buyer.bestSellers(8));
    ByUI.renderProducts($('#bhNew'), Buyer.newArrivals(8));

    var viewed = Buyer.recentlyViewed(6);
    $('#bhViewedSection').hidden = viewed.length === 0;
    if (viewed.length) ByUI.renderProducts($('#bhViewed'), viewed);
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();

    var profile = Buyer.profile();
    $('#bhGreeting').textContent = 'مرحباً ' + profile.name + '،';
    $('#bhGreetingSub').textContent = 'شاهد أحدث العروض المخصصة لك اليوم';

    renderSlider();
    renderCategories();
    renderSuppliers();
    renderBrands();
    initNewsletter();
    startCountdown();

    // هياكل تحميل بدل شاشة فارغة أثناء تجهيز البيانات
    ['#bhDeals', '#bhReco', '#bhBuyAgain', '#bhFeatured', '#bhBest', '#bhNew'].forEach(function (sel) {
      ByUI.skeleton($(sel), 4);
    });

    setTimeout(function () {
      renderSections();
      ByUI.refreshChrome();
      Store.subscribe(function () { renderSections(); ByUI.refreshChrome(); });
    }, 420);
  });
})();
