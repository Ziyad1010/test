/* ============================================================
   عمّار — الصفحة الرئيسية للمتجر (واجهة المشتري)
   سوق فعلي قابل للتصفّح والشراء، لا صفحة هبوط تسويقية.
   كل البيانات من Store/Buyer (localStorage) كنموذج أولي —
   الدوال معزولة بحيث يسهل ربطها بباكند حقيقي لاحقاً.
   ============================================================ */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var esc = ByUI.esc;

  var CAT_IMAGES = {
    cement: 'assets/images/cat-cement.jpg',
    steel: 'assets/images/cat-steel.jpg',
    concrete: 'assets/images/cat-concrete.jpg',
    blocks: 'assets/images/cat-blocks.jpg',
    finishing: 'assets/images/cat-finishing.jpg',
    tools: 'assets/images/cat-tools.jpg'
  };

  /* ---------------- بحث الهيرو ---------------- */
  function initHeroSearch() {
    var form = $('#bhHeroForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('#bhHeroSearch').value.trim();
      window.location.href = 'buyer-market.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  /* ---------------- بطاقة موقع المشروع ---------------- */
  function etaText() {
    // موعد متوقع: غداً قبل السادسة مساءً (بيانات نموذجية حتمية)
    var d = new Date(Date.now() + 24 * 3600 * 1000);
    var days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[d.getDay()] + ' القادم، قبل 6 مساءً';
  }

  function renderSiteCard() {
    var body = $('#bhSiteBody');
    if (!body) return;

    var city = ByUI.getCity();
    var addr = ByUI.defaultAddress();

    if (!city && !addr) {
      // حالة: الموقع غير محدد
      body.innerHTML =
        '<div class="am-site-empty">لم تحدّد موقع التوصيل بعد. اختر مدينتك ليظهر لك المتوفر حولك وموعد التوصيل المتوقع.</div>';
      var btn = $('#bhSiteChangeCity');
      if (btn) btn.textContent = 'تحديد المدينة';
      return;
    }

    var pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    var truck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';

    var place = addr
      ? (addr.city || city || '') + (addr.district ? ' — ' + addr.district : '')
      : city;
    var label = addr && addr.label ? addr.label : 'عنوان التوصيل';

    body.innerHTML =
      '<div class="am-site-row">' + pin +
        '<span><small>' + esc(label) + '</small><strong>' + esc(place || 'غير محدد') + '</strong></span>' +
      '</div>' +
      '<div class="am-site-row">' + truck +
        '<span><small>أقرب موعد توصيل متوقع</small><strong class="am-eta">' + etaText() + '</strong></span>' +
      '</div>';
  }

  function initSiteCard() {
    var btn = $('#bhSiteChangeCity');
    if (btn) btn.addEventListener('click', function () {
      var cityBtn = $('#bhCityBtn');
      if (cityBtn) {
        cityBtn.click();
        cityBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  /* ---------------- لوحة المشتري المختصرة ----------------
     كل رقم هنا مشتق من طلبات هذا المشتري الفعلية. */
  function renderPanel() {
    if (!window.Smart) return;

    var d = Smart.dashboard();
    // لا معنى للوحة قبل أول طلب — نُخفيها بدل عرض أصفار
    if (!d.totalOrders && !d.savedItems) return;

    $('#bhPanelSection').hidden = false;

    var t = d.tier;
    var profile = Buyer.profile();

    $('#bhPanel').innerHTML =
      '<div class="sm-panel-head">' +
        '<div>' +
          '<h2>أهلاً ' + esc(String(profile.name || 'بك').split(' ')[0]) + '</h2>' +
          '<p>ملخّص نشاطك على المنصة</p>' +
        '</div>' +
        '<span class="sm-tier sm-tier--' + t.current.key + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
          'عضو ' + esc(t.current.label) +
        '</span>' +
      '</div>' +

      '<div class="sm-stats">' +
        stat('إنفاق هذا الشهر', ByUI.fmt(d.monthSpend) + ' <small>ر.س</small>',
          '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') +
        stat('طلبات نشطة', d.activeOrders,
          '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
          d.activeOrders ? 'buyer-orders.html' : '') +
        stat('نقاط الولاء', ByUI.fmt(d.points) + ' <small>= ' + Smart.pointsValue(d.points) + ' ر.س</small>',
          '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>') +
        stat('في المفضلة', d.savedItems,
          '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
          d.savedItems ? 'favorites.html' : '') +
      '</div>' +

      (t.next
        ? '<div class="sm-tier-bar">' +
            '<div class="sm-tier-track"><span style="width:' + Math.max(3, t.progress) + '%;"></span></div>' +
            '<small>تبقّى <b>' + ByUI.fmt(t.toNext) + '</b> نقطة للوصول إلى عضوية ' + esc(t.next.label) +
            ' — ' + esc(t.next.perk) + '</small>' +
          '</div>'
        : '<div class="sm-tier-bar"><small>أنت في أعلى مستوى عضوية: ' + esc(t.current.perk) + '</small></div>') +

      (d.points >= Smart.MIN_REDEEM
        ? '<button type="button" class="by-btn by-btn-primary sm-redeem" id="bhRedeem">' +
            'استبدل ' + ByUI.fmt(d.points) + ' نقطة بخصم ' + Smart.pointsValue(d.points) + ' ر.س' +
          '</button>'
        : '<p class="sm-panel-note">اجمع ' + Smart.MIN_REDEEM + ' نقطة لتتمكن من الاستبدال — تكسب نقطة لكل 10 ر.س من مشترياتك.</p>');

    var redeem = $('#bhRedeem');
    if (redeem) {
      redeem.addEventListener('click', function () {
        var res = Smart.redeem(Smart.points());
        ByUI.toast(res.message, res.ok ? 'success' : 'danger');
        if (res.ok) renderPanel();
      });
    }
  }

  function stat(label, value, icon, href) {
    var tag = href ? 'a' : 'div';
    return '<' + tag + ' class="sm-stat"' + (href ? ' href="' + href + '"' : '') + '>' +
      '<span class="sm-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></span>' +
      '<span class="sm-stat-body"><small>' + esc(label) + '</small><strong>' + value + '</strong></span>' +
    '</' + tag + '>';
  }

  /* ---------------- تنبيه انخفاض السعر على المفضلة ---------------- */
  function renderDrops() {
    if (!window.Smart) return;

    Smart.snapshotPrices();
    var drops = Smart.priceDrops();
    if (!drops.length) return;

    $('#bhDropsSection').hidden = false;

    $('#bhDrops').innerHTML =
      '<div class="sm-drops-head">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>' +
        '<strong>انخفض سعر ' + drops.length + ' من منتجاتك المفضّلة</strong>' +
        '<button type="button" id="bhDropsDismiss" aria-label="إخفاء">×</button>' +
      '</div>' +
      '<div class="sm-drops-list">' +
        drops.slice(0, 3).map(function (d) {
          return '<a class="sm-drop" href="buyer-product.html?id=' + encodeURIComponent(d.product.id) + '">' +
            '<img src="' + esc(d.product.img) + '" alt="" />' +
            '<span><b>' + esc(d.product.name) + '</b>' +
            '<small><del>' + ByUI.fmt(d.oldPrice) + '</del> ← <b>' + ByUI.fmt(d.newPrice) + ' ر.س</b></small></span>' +
            '<em>-' + d.pct + '%</em>' +
          '</a>';
        }).join('') +
      '</div>';

    $('#bhDropsDismiss').addEventListener('click', function () {
      Smart.acknowledgeDrops();
      $('#bhDropsSection').hidden = true;
    });
  }

  /* ---------------- التصنيفات بشبكة Bento ----------------
     أحجام متفاوتة تكسر رتابة الشبكة المتساوية: القسمان الأكثر
     منتجات يأخذان مساحة أكبر، والباقي صناديق عادية. */
  // النمط يملأ الشبكة بلا فراغات: صف كبير + عريض، ثم مربعان، ثم عريضان
  var BENTO_CAT_SHAPE = ['sf-tile--lg', 'sf-tile--wide', '', '', 'sf-tile--wide', 'sf-tile--wide'];

  function renderCategories() {
    var mount = $('#bhCategories');
    if (!mount) return;

    var cats = Buyer.categories().slice().sort(function (a, b) { return b.count - a.count; });

    mount.innerHTML = cats.map(function (c, i) {
      return '<a class="sf-tile has-media ' + BENTO_CAT_SHAPE[i % BENTO_CAT_SHAPE.length] + '" ' +
        'href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' +
        '<span class="sf-tile-bg"><img src="' + esc(CAT_IMAGES[c.key] || CAT_IMAGES.tools) + '" alt="" loading="lazy" /></span>' +
        '<span class="sf-tile-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          (ByUI.CATEGORY_ICONS[c.key] || ByUI.CATEGORY_ICONS.tools) + '</svg></span>' +
        '<span class="sf-tile-body"><strong>' + esc(c.label) + '</strong>' +
        '<small>' + c.count + ' منتج متاح</small></span>' +
      '</a>';
    }).join('');

    if (window.SF) SF.stagger(mount);
  }

  /* ---------------- عروض اليوم بشبكة Bento ----------------
     صندوق كبير للعرض الأقوى (أعلى نسبة خصم) ثم بطاقات المنتجات. */
  function renderDeals() {
    var mount = $('#bhDeals');
    if (!mount) return;

    // ثلاثة عناصر بالضبط: صندوق كبير 2×2 + بطاقتان — يملأ الشبكة تماماً
    var deals = Buyer.flashDeals(3);

    if (!deals.length) {
      mount.classList.remove('sf-bento');
      mount.innerHTML = ByUI.emptyState('لا توجد عروض نشطة الآن — تابعنا، تُضاف عروض جديدة يومياً.', 'لا عروض حالياً');
      return;
    }

    mount.classList.add('sf-bento');

    var top = deals[0];
    var rest = deals.slice(1, 3);
    var saving = ByUI.effectivePrice(top) < top.price ? top.price - ByUI.effectivePrice(top) : 0;

    var hero =
      '<a class="sf-tile has-media sf-tile--lg" href="buyer-product.html?id=' + encodeURIComponent(top.id) + '">' +
        '<span class="sf-tile-bg"><img src="' + esc(top.img) + '" alt="" loading="lazy" /></span>' +
        '<span class="sf-tile-badge"><span class="sf-badge sf-badge--sale">خصم ' + top.discount + '%</span></span>' +
        '<span class="sf-tile-body">' +
          '<strong>' + esc(top.name) + '</strong>' +
          '<small>' + esc(top.brand || 'عام') + ' — وفّر ' + ByUI.fmt(saving) + ' ر.س لكل ' + esc(top.unit || 'وحدة') + '</small>' +
        '</span>' +
      '</a>';

    mount.innerHTML = hero + rest.map(ByUI.productCard).join('');
    ByUI.bindCardActions(mount);
    if (window.SF) SF.stagger(mount);
  }

  /* ---------------- العداد التنازلي لعروض اليوم ---------------- */
  function startCountdown() {
    var el = $('#bhCountdownText');
    if (!el) return;

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
      var left = Buyer.flashDealEndsAt() - Date.now();
      if (left < 0) left = 0;
      var h = Math.floor(left / 3600000);
      var m = Math.floor((left % 3600000) / 60000);
      var s = Math.floor((left % 60000) / 1000);
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- الأكثر طلباً في مدينة المستخدم ----------------
     يُحتسب من طلبات النموذج الفعلية في Store مصنّفة حسب المدينة. */
  function cityBestSellers(city, limit) {
    var counts = {};
    Store.getOrders().forEach(function (o) {
      if (city && o.city !== city) return;
      (o.items || []).forEach(function (it) {
        counts[it.productId] = (counts[it.productId] || 0) + (it.qty || 1);
      });
    });

    var ranked = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .map(function (id) { return Store.getProduct(id); })
      .filter(function (p) { return p && p.status === 'active'; });

    return ranked.slice(0, limit || 4);
  }

  function renderCityBest() {
    var mount = $('#bhCityBest');
    if (!mount) return;

    var city = ByUI.getCity();
    var title = $('#bhCityBestTitle');

    if (!city) {
      if (title) title.textContent = 'الأكثر طلباً في المملكة';
      ByUI.renderProducts(mount, Buyer.bestSellers(4),
        'حدّد مدينتك من أعلى الصفحة لنعرض لك الأكثر طلباً حولك.');
      return;
    }

    if (title) title.textContent = 'الأكثر طلباً في ' + city;
    var list = cityBestSellers(city, 4);
    if (!list.length) list = Buyer.bestSellers(4);
    ByUI.renderProducts(mount, list, 'لا توجد بيانات طلبات كافية في ' + city + ' بعد.');
  }

  /* ---------------- اشترِ بالجملة ---------------- */
  function renderBulk() {
    var mount = $('#bhBulk');
    if (!mount) return;

    // المنتجات ذات الحد الأدنى الأعلى للطلب = الأنسب للشراء بالجملة
    var list = Buyer.activeProducts()
      .slice()
      .sort(function (a, b) { return (b.moq || 1) - (a.moq || 1); })
      .slice(0, 4);

    ByUI.renderProducts(mount, list, 'لا توجد منتجات بأسعار شرائح كمية حالياً.');
  }

  /* ---------------- بطاقات الموردين (ملف مختصر) ---------------- */
  function supplierCityCoverage(name) {
    var set = {};
    Store.getOrders().forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var p = Store.getProduct(it.productId);
        if (p && (p.brand || 'عام') === name) set[o.city] = true;
      });
    });
    return Object.keys(set);
  }

  // شعارات الموردين الحقيقية — ضع ملف الشعار الرسمي بنفس الاسم وسيظهر تلقائياً،
  // وإن غاب الملف يظهر حرف المورد داخل صندوق موحّد.
  var SUPPLIER_LOGOS = {
    'حديد الراجحي': 'assets/images/suppliers/rajhi-steel.png',
    'أسمنت اليمامة': 'assets/images/suppliers/yamama-cement.png',
    'الخزف السعودي': 'assets/images/suppliers/saudi-ceramics.png',
    'الخرسانة السعودية': 'assets/images/suppliers/saudi-readymix.png',
    'الفوزان لمواد البناء': 'assets/images/suppliers/alfozan.png',
    'أسمنت العربية': 'assets/images/suppliers/arabian-cement.png'
  };

  function supplierLogoHtml(name) {
    // الحرف الأول يبقى خلف الشعار دائماً: إن تعذّر تحميل الصورة تُزال فيظهر بدلها
    var initial = '<span class="am-monogram">' + esc(name.trim().charAt(0)) + '</span>';
    var src = SUPPLIER_LOGOS[name.trim()];
    if (!src) return initial;
    return initial + '<img src="' + src + '" alt="شعار ' + esc(name) + '" loading="lazy" onerror="this.remove()">';
  }

  function renderSuppliers() {
    var mount = $('#bhSuppliers');
    if (!mount) return;

    var list = Buyer.suppliers().slice(0, 6);
    if (!list.length) {
      mount.innerHTML = ByUI.emptyState('لا يوجد موردون لعرضهم حالياً.');
      return;
    }

    var star = '<svg viewBox="0 0 24 24"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    var box = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
    var pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    var clock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    var grid = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';

    mount.innerHTML = list.map(function (s, i) {
      var cities = supplierCityCoverage(s.name);
      var citiesLabel = cities.length ? (cities.length >= 5 ? 'كل المدن الرئيسية' : cities.slice(0, 2).join('، ') + (cities.length > 2 ? ' +' + (cities.length - 2) : '')) : 'حسب الطلب';
      var speed = (i % 3 === 0) ? 'توصيل خلال 24 ساعة' : (i % 3 === 1) ? 'توصيل خلال 48 ساعة' : 'توصيل 2–4 أيام';

      return '<a class="am-supplier" href="buyer-supplier.html?name=' + encodeURIComponent(s.name) + '">' +
        '<span class="am-supplier-top">' +
          '<span class="am-supplier-logo">' + supplierLogoHtml(s.name) + '</span>' +
          '<span><strong>' + esc(s.name) + '</strong>' +
            '<span class="am-supplier-rating">' + star + ' ' + s.rating + ' من 5</span>' +
          '</span>' +
          '<span class="am-supplier-verified">' + check + ' موثّق</span>' +
        '</span>' +
        '<span class="am-supplier-stats">' +
          '<span>' + box + '<b>' + s.products + '</b> منتج</span>' +
          '<span>' + grid + '<b>' + s.categories.length + '</b> فئات</span>' +
          '<span>' + pin + citiesLabel + '</span>' +
          '<span>' + clock + speed + '</span>' +
        '</span>' +
      '</a>';
    }).join('');
  }

  /* ---------------- تجميعات ذكية للمشاريع ---------------- */
  function renderBundles() {
    var mount = $('#bhBundles');
    if (!mount) return;

    var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    var bundles = [
      {
        tag: 'أعمال إنشائية',
        title: 'مواد صبّة خرسانة',
        text: 'خرسانة جاهزة، حديد تسليح، وقوالب — احسب احتياج الصبّة واطلبها دفعة واحدة.',
        items: ['خرسانة C30', 'حديد 12مم', 'حديد 16مم'],
        href: 'buyer-market.html?category=concrete'
      },
      {
        tag: 'مرحلة التشطيب',
        title: 'تجهيزات تشطيب شقة',
        text: 'بلاط، بورسلين، ومواد تشطيب أساسية لشقة سكنية بمساحة متوسطة.',
        items: ['بلاط بورسلين', 'مواد تشطيب', 'أدوات تركيب'],
        href: 'buyer-market.html?category=finishing'
      },
      {
        tag: 'بداية المشروع',
        title: 'أساسيات بناء فيلا',
        text: 'الأسمنت والبلوك والحديد لمرحلة العظم — بأسعار شرائح كمية من موردين موثّقين.',
        items: ['أسمنت بورتلاندي', 'بلوك 20سم', 'حديد تسليح'],
        href: 'buyer-market.html?category=cement'
      }
    ];

    mount.innerHTML = bundles.map(function (b) {
      return '<article class="am-bundle">' +
        '<span class="am-bundle-tag">' + esc(b.tag) + '</span>' +
        '<h3>' + esc(b.title) + '</h3>' +
        '<p>' + esc(b.text) + '</p>' +
        '<span class="am-bundle-items">' + b.items.map(function (i) { return '<span>' + esc(i) + '</span>'; }).join('') + '</span>' +
        '<a class="am-bundle-cta" href="' + esc(b.href) + '">اطلب مواد التجميعة ' + arrow + '</a>' +
      '</article>';
    }).join('');
  }

  /* ---------------- النشرة البريدية ---------------- */
  function initNewsletter() {
    var form = $('#bhNewsletter');
    if (!form) return;
    form.addEventListener('submit', function (e) {
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
      ByUI.toast('تم تسجيل اشتراكك — سيصلك جديد العروض', 'success');
    });
  }

  /* ---------------- أقسام المنتجات ---------------- */
  function renderSections() {
    renderDeals();

    var reco = Buyer.recommended(4);
    var hasHistory = Buyer.orders().length > 0 || Buyer.recentlyViewed(1).length > 0;

    if (!hasHistory) {
      $('#bhRecoTitle').textContent = 'الأكثر مبيعاً على المنصة';
      $('#bhRecoSub').textContent = 'ابدأ من هنا — سنخصّص التوصيات لك بعد أول طلب';
      reco = Buyer.bestSellers(4);
    }
    ByUI.renderProducts($('#bhReco'), reco,
      'سنعرض لك توصيات مخصّصة بمجرد تصفّحك أو شرائك لأول منتج.');

    renderCityBest();
    renderBulk();

    var viewed = Buyer.recentlyViewed(4);
    var viewedSection = $('#bhViewedSection');
    if (viewedSection) viewedSection.hidden = viewed.length === 0;
    if (viewed.length) ByUI.renderProducts($('#bhViewed'), viewed);

    // الظهور التدريجي يشمل البطاقات المُنشأة للتو
    if (window.SF) {
      ['#bhReco', '#bhCityBest', '#bhBulk', '#bhViewed', '#bhSuppliers', '#bhBundles'].forEach(function (sel) {
        SF.stagger($(sel));
      });
    }
  }

  /* ---------------- حالة فشل تحميل البيانات ---------------- */
  function renderLoadError() {
    ['#bhReco', '#bhDeals', '#bhCityBest', '#bhBulk'].forEach(function (sel) {
      var m = $(sel);
      if (!m) return;
      m.innerHTML = '<div class="am-error">' +
        '<strong>تعذّر تحميل البيانات</strong>' +
        '<p>حدث خطأ أثناء قراءة بيانات المتجر من المتصفح. أعد تحميل الصفحة للمحاولة مجدداً.</p>' +
        '<button type="button" onclick="window.location.reload()">إعادة التحميل</button>' +
      '</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      ByUI.initHeader();
      initHeroSearch();
      initSiteCard();
      renderSiteCard();
      renderPanel();
      renderDrops();
      renderCategories();
      renderSuppliers();
      renderBundles();
      initNewsletter();
      startCountdown();
      if (window.Tour) Tour.autoStart();
    } catch (err) {
      renderLoadError();
      return;
    }

    // هياكل تحميل بدل شاشة فارغة أثناء تجهيز البيانات
    ['#bhDeals', '#bhReco', '#bhCityBest', '#bhBulk'].forEach(function (sel) {
      ByUI.skeleton($(sel), 4);
    });

    setTimeout(function () {
      try {
        renderSections();
        ByUI.refreshChrome();
        Store.subscribe(function () {
          renderSections();
          renderSiteCard();
          renderPanel();
          ByUI.refreshChrome();
        });
      } catch (err) {
        renderLoadError();
      }
    }, 380);
  });
})();
