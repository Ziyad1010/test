/* ============================================================
   عمار — مكوّنات واجهة المتجر المشتركة
   بطاقة المنتج، الهيدر الذكي، شريط السلة والمقارنة، التوست،
   وهياكل التحميل — تُستخدم في كل صفحات المتجر بلا تكرار.
   ============================================================ */

var ByUI = (function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var CATEGORY_ICONS = {
    steel: '<path d="M2 12h20"/><path d="M6 8v8"/><path d="M12 6v12"/><path d="M18 8v8"/>',
    cement: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    concrete: '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    finishing: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/>',
    blocks: '<rect x="2" y="4" width="9" height="7"/><rect x="13" y="4" width="9" height="7"/><rect x="2" y="13" width="9" height="7"/><rect x="13" y="13" width="9" height="7"/>',
    tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
  };

  var AVAIL = {
    in_stock: { label: 'متوفر', tone: 'in_stock' },
    limited: { label: 'كمية محدودة', tone: 'limited' },
    out_of_stock: { label: 'غير متوفر', tone: 'out_of_stock' },
    on_demand: { label: 'عند الطلب', tone: 'on_demand' }
  };

  var STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 3000);
  }

  /* ---------------- مدينة وموقع التوصيل ---------------- */
  var K_CITY = 'ammar_buyer_city';
  var CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'خميس مشيط', 'أبها', 'بريدة', 'تبوك', 'الطائف', 'حائل', 'جازان', 'نجران'];

  function getCity() {
    var c = '';
    try { c = localStorage.getItem(K_CITY) || ''; } catch (e) { /* ignore */ }
    return c;
  }

  function setCity(city) {
    try { localStorage.setItem(K_CITY, city); } catch (e) { /* ignore */ }
  }

  function defaultAddress() {
    if (!window.Buyer) return null;
    var list = [];
    try { list = Buyer.addresses(); } catch (e) { list = []; }
    var def = null;
    list.forEach(function (a) { if (a.isDefault) def = a; });
    return def || list[0] || null;
  }

  /* ---------------- شعار المورد ----------------
     شعار مرفوع من صفحة «بيانات الشركة» إن وُجد، وإلا أيقونة مصنع
     موحّدة — لا حرف نائب. كل الشعارات على خلفية واحدة بـ contain
     فلا تختلف النسب بين مورد وآخر. */
  var FACTORY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 20h20"/><path d="M4 20V9l5 3V9l5 3V6l6 4v10"/>' +
    '<line x1="8" y1="16" x2="8" y2="16.01"/><line x1="13" y1="16" x2="13" y2="16.01"/><line x1="18" y1="16" x2="18" y2="16.01"/></svg>';

  function supplierLogoHtml(name, extraClass) {
    var src = '';
    try { src = Store.supplierLogo(name); } catch (e) { src = ''; }

    var cls = 'by-sup-logo' + (extraClass ? ' ' + extraClass : '');

    if (src) {
      // الشعارات المرفقة مع النموذج مربّعات كاملة الحواف، أما المرفوعة
      // فقد تكون بخلفية شفافة وتحتاج حشواً حولها
      if (src.indexOf('assets/') === 0) cls += ' is-tile';

      // onerror يُسقط الصورة التالفة فتظهر الأيقونة الموحّدة خلفها
      return '<span class="' + cls + '">' +
        '<span class="by-sup-logo-ph">' + FACTORY_ICON + '</span>' +
        '<img src="' + esc(src) + '" alt="شعار ' + esc(name) + '" loading="lazy" onerror="this.remove()" />' +
      '</span>';
    }

    return '<span class="' + cls + '"><span class="by-sup-logo-ph">' + FACTORY_ICON + '</span></span>';
  }

  /* ---------------- دليل اجتماعي من بيانات حقيقية ----------------
     عدد الوحدات المباعة فعلاً خلال آخر 30 يوماً من سجل الطلبات،
     لا رقم تسويقي مخترع. يعود بصفر إن لم يُطلب المنتج بعد. */
  var soldCache = null;

  function soldLast30(productId) {
    if (!soldCache) {
      soldCache = {};
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      Store.getOrders().forEach(function (o) {
        if (o.status === 'cancelled') return;
        if (o.date && new Date(o.date) < cutoff) return;
        (o.items || []).forEach(function (it) {
          soldCache[it.productId] = (soldCache[it.productId] || 0) + (it.qty || 0);
        });
      });
    }
    return soldCache[productId] || 0;
  }

  function clearSoldCache() { soldCache = null; }

  /* ---------------- شارات موحّدة الشكل ----------------
     شكل واحد وحجم واحد لكل الشارات: خصم، الأكثر مبيعاً، جديد، نفدت. */
  function badgesFor(p) {
    var out = [];
    var avail = Store.deriveAvailability(p);

    if (avail === 'out_of_stock') {
      out.push({ kind: 'out', label: 'نفدت الكمية' });
    }
    if (p.discount > 0) {
      out.push({ kind: 'sale', label: 'خصم ' + p.discount + '%' });
    }
    if (soldLast30(p.id) >= 20) {
      out.push({ kind: 'best', label: 'الأكثر مبيعاً' });
    }
    if (p.tiers && p.tiers.length) {
      out.push({ kind: 'bulk', label: 'سعر جملة' });
    }
    // "جديد" حين لا توجد شارة أهم منها، ويكون المنتج ضمن أحدث المضافات
    if (out.length < 2 && isNewArrival(p)) {
      out.push({ kind: 'new', label: 'وصل حديثاً' });
    }

    return out.slice(0, 2);   // شارتان كحد أقصى حتى لا تزدحم البطاقة
  }

  var newestIds = null;

  function isNewArrival(p) {
    if (!newestIds) {
      newestIds = {};
      Store.getProducts()
        .filter(function (x) { return x.status === 'active'; })
        .sort(function (a, b) { return b.id - a.id; })
        .slice(0, 4)
        .forEach(function (x) { newestIds[x.id] = true; });
    }
    return !!newestIds[p.id];
  }

  function badgeHtml(b) {
    return '<span class="sf-badge sf-badge--' + b.kind + '">' + esc(b.label) + '</span>';
  }

  /* ---------------- سعر الجملة المشتق ----------------
     لا تملك بيانات النموذج شرائح كميات مخزّنة، فنشتق شريحة
     واحدة حتمياً من الحد الأدنى للطلب والسعر — دون لمس البيانات. */
  function tierOf(p) {
    if (p.tiers && p.tiers.length) return p.tiers[0];
    var qty = Math.max((p.moq || 1) * 5, 10);
    // تقريب الكمية لعتبة مقروءة
    if (qty >= 100) qty = Math.round(qty / 50) * 50;
    else if (qty >= 20) qty = Math.round(qty / 10) * 10;
    var off = p.price >= 1000 ? 0.03 : 0.06;
    var eff = effectivePrice(p);
    return { qty: qty, price: Math.round(eff * (1 - off) * 100) / 100 };
  }

  /* ---------------- وقت التوصيل المتوقع ---------------- */
  function deliveryOf(p) {
    var a = Store.deriveAvailability(p);
    if (a === 'out_of_stock') return null;
    if (a === 'on_demand') return 'توصيل خلال 2–4 أيام';
    if (a === 'limited') return 'توصيل خلال 48 ساعة';
    return 'توصيل خلال 24–48 ساعة';
  }

  /* ---------------- النجوم ---------------- */
  function starsHtml(value) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="' + (i <= Math.round(value) ? 'is-on' : '') + '">' + STAR + '</span>';
    }
    return '<span class="by-stars">' + out + '</span>';
  }

  function effectivePrice(p) {
    return p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
  }

  /* ---------------- بطاقة المنتج ----------------
     البطاقة كلها رابط إلى صفحة المنتج؛ أزرار الإجراء السريع تُوقف
     انتشار الحدث حتى لا تفتح الصفحة عند الضغط عليها. */
  function productCard(p) {
    var eff = effectivePrice(p);
    var avail = AVAIL[Store.deriveAvailability(p)] || AVAIL.in_stock;
    var rating = Buyer.ratingOf(p.id);
    var fav = Buyer.inWishlist(p.id);
    var inCart = Buyer.inCart(p.id);
    var inCmp = Buyer.inCompare(p.id);
    var hasTiers = (p.tiers && p.tiers.length > 0);
    var soldOut = Store.deriveAvailability(p) === 'out_of_stock';
    var href = 'buyer-product.html?id=' + encodeURIComponent(p.id);

    var badges = badgesFor(p).map(badgeHtml).join('');
    var sold = soldLast30(p.id);

    return '<article class="by-card' + (p.discount > 0 ? ' has-sale' : '') + '" data-product="' + esc(p.id) + '">' +
      '<a class="by-card-media" href="' + href + '">' +
        '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy" />' +
      '</a>' +
      (badges ? '<div class="by-card-badges">' + badges + '</div>' : '') +
      '<div class="by-card-quick">' +
        '<button type="button" class="by-quick-btn fav' + (fav ? ' is-on' : '') + '" data-fav="' + esc(p.id) + '" aria-label="المفضلة" title="إضافة للمفضلة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        '</button>' +
        '<button type="button" class="by-quick-btn cart' + (inCart ? ' is-on' : '') + '" data-cart="' + esc(p.id) + '" aria-label="أضف للسلة" title="إضافة سريعة للسلة"' + (soldOut ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
        '</button>' +
        '<button type="button" class="by-quick-btn eye" data-quick="' + esc(p.id) + '" aria-label="معاينة سريعة" title="معاينة سريعة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</button>' +
        '<button type="button" class="by-quick-btn compare' + (inCmp ? ' is-on' : '') + '" data-compare="' + esc(p.id) + '" aria-label="مقارنة" title="أضف للمقارنة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="by-card-body">' +
        '<a class="by-card-supplier" href="buyer-supplier.html?name=' + encodeURIComponent(p.brand || 'عام') + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>' +
          esc(p.brand || 'عام') +
        '</a>' +
        '<a class="by-card-name" href="' + href + '">' + esc(p.name) + '</a>' +
        '<div class="by-card-rating">' +
          starsHtml(rating.value) +
          '<a class="by-rating-link" href="' + href + '#reviews">' + rating.value + ' (' + rating.count + ' مراجعة)</a>' +
        '</div>' +
        // سطر واحد للحالة بدل صفّ شرائح مزدحم
        '<div class="am-meta-row">' +
          '<span class="am-chip stock-' + (avail.tone === 'in_stock' ? 'in' : avail.tone === 'limited' ? 'low' : avail.tone === 'on_demand' ? 'demand' : 'out') + '">' + avail.label + '</span>' +
          (!soldOut && deliveryOf(p) ? '<span class="am-chip ship"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' + deliveryOf(p) + '</span>' : '') +
        '</div>' +
        '<div class="am-price">' +
          '<span class="val">' + fmt(eff) + '</span><span class="cur">ر.س</span>' +
          '<span class="unit">/ ' + esc(p.unit || 'وحدة') + '</span>' +
          (eff < p.price ? '<span class="old">' + fmt(p.price) + '</span>' : '') +
        '</div>' +
        (sold >= 5 ? '<span class="sf-proof">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' +
          'تم شراؤه ' + fmt(sold) + ' ' + esc(p.unit || 'مرة') + ' هذا الشهر' +
        '</span>' : (hasTiers ? '<span class="sf-proof">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>' +
          'جملة من ' + fmt(tierOf(p).price) + ' ر.س' +
        '</span>' : '')) +
        '<div class="by-card-foot">' +
          '<button type="button" class="by-add-btn" data-cart="' + esc(p.id) + '"' + (soldOut ? ' disabled' : '') + '>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
            (soldOut ? 'غير متوفر' : (inCart ? 'في السلة' : 'أضف للسلة')) +
          '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderProducts(mount, list, emptyMessage) {
    if (!mount) return;

    if (!list.length) {
      mount.innerHTML = emptyState(emptyMessage || 'لا توجد منتجات لعرضها حالياً.');
      mount.classList.add('is-empty');
      return;
    }

    mount.classList.remove('is-empty');
    mount.innerHTML = list.map(productCard).join('');
    bindCardActions(mount);
  }

  function emptyState(message, title) {
    return '<div class="by-empty" style="grid-column:1/-1;width:100%;">' +
      '<span class="by-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>' +
      '<strong>' + esc(title || 'لا توجد نتائج') + '</strong>' +
      '<p>' + esc(message) + '</p>' +
    '</div>';
  }

  function skeleton(mount, count) {
    if (!mount) return;
    var one = '<div class="by-skeleton"><div class="by-sk-media"></div>' +
      '<div class="by-sk-body">' +
        '<div class="by-sk-line w40"></div>' +
        '<div class="by-sk-line w80"></div>' +
        '<div class="by-sk-line w60"></div>' +
        '<div class="by-sk-line tall"></div>' +
      '</div></div>';
    mount.innerHTML = new Array((count || 4) + 1).join(one);
  }

  /* ---------------- إجراءات البطاقة ---------------- */
  function bindCardActions(root) {
    $all('[data-fav]', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var added = Buyer.toggleWishlist(btn.getAttribute('data-fav'));
        btn.classList.toggle('is-on', added);
        toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', added ? 'success' : 'danger');
      });
    });

    $all('[data-cart]', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-cart');
        var p = Store.getProduct(id);
        if (!p) return;

        if (Buyer.addToCart(id)) {
          // الصورة تطير إلى أيقونة السلة قبل تحديث الأرقام
          if (window.SF) { SF.flyFromCard(btn); SF.pulse(btn); }
          toast('أُضيف "' + p.name + '" إلى السلة', 'success');
          refreshChrome();
        } else {
          toast('هذا المنتج غير متوفر حالياً', 'danger');
        }
      });
    });

    $all('[data-quick]', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.SmartUI) SmartUI.quickView(btn.getAttribute('data-quick'));
      });
    });

    $all('[data-compare]', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var res = Buyer.toggleCompare(btn.getAttribute('data-compare'));
        if (res === 'full') { toast('يمكن مقارنة 4 منتجات كحد أقصى', 'danger'); return; }
        btn.classList.toggle('is-on', res === 'added');
        toast(res === 'added' ? 'أُضيف للمقارنة' : 'أُزيل من المقارنة', res === 'added' ? 'success' : 'danger');
        refreshChrome();
      });
    });
  }

  /* ---------------- الهيدر والأشرطة العائمة ---------------- */
  function refreshChrome() {
    clearSoldCache();               // الطلبات قد تكون تغيّرت
    var count = Buyer.cartCount();
    var total = Buyer.cartTotal();

    var cartBadge = $('#bhCartBadge');
    if (cartBadge) {
      cartBadge.hidden = count === 0;
      cartBadge.textContent = count > 99 ? '99+' : count;
    }

    var notifBadge = $('#bhNotifBadge');
    if (notifBadge) {
      var unread = Buyer.unreadCount();
      notifBadge.hidden = unread === 0;
      notifBadge.textContent = unread > 99 ? '99+' : unread;
    }

    var wishBadge = $('#bhWishBadge');
    if (wishBadge) {
      var wl = Buyer.wishlist().length;
      wishBadge.hidden = wl === 0;
      wishBadge.textContent = wl > 99 ? '99+' : wl;
    }

    var cmpBadge = $('#bhCompareBadge');
    if (cmpBadge) {
      var cl = Buyer.compareList().length;
      cmpBadge.hidden = cl === 0;
      cmpBadge.textContent = cl;
    }

    renderCartDrawer();

    var sticky = $('#bhStickyCart');
    if (sticky) {
      $('#bhStickyCount').textContent = count + (count === 1 ? ' منتج في سلتك' : ' منتجات في سلتك');
      // قيمة المنتجات فقط — الشحن والخصم يُحسبان في السلة والدفع
      $('#bhStickyTotal').textContent = 'قيمة المنتجات: ' + fmt(total) + ' ر.س';
      // يظهر فقط عند وجود سلة وبعد التمرير قليلاً
      sticky.classList.toggle('is-visible', count > 0 && window.scrollY > 320);
    }

    var cmpBar = $('#bhCompareBar');
    if (cmpBar) {
      var cmp = Buyer.compareList().length;
      $('#bhCompareCount').textContent = 'تمت إضافة ' + cmp + ' منتج للمقارنة';
      // شريط المقارنة له الأولوية على شريط السلة حتى لا يتراكبا
      cmpBar.classList.toggle('is-visible', cmp > 0);
      if (cmp > 0 && sticky) sticky.classList.remove('is-visible');
    }
  }

  /* ---------------- شريط التصنيفات مع القوائم الفرعية ---------------- */
  var CATBAR_ORDER = ['cement', 'steel', 'concrete', 'blocks', 'finishing', 'tools'];
  var CATBAR_LABELS = {
    cement: 'أسمنت', steel: 'حديد', concrete: 'خرسانة',
    blocks: 'بلوك وطوب', finishing: 'تشطيبات', tools: 'أدوات ومعدات'
  };

  function subcategoriesOf(catKey) {
    var map = {};
    Store.getProducts().forEach(function (p) {
      if (p.status !== 'active' || p.category !== catKey) return;
      var s = p.subcategory || 'أخرى';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.keys(map).map(function (k) { return { name: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function buildCatBar(catBar) {
    var chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

    var html = CATBAR_ORDER.map(function (key) {
      var subs = subcategoriesOf(key);
      var mega = '';
      if (subs.length) {
        mega = '<div class="by-mega" role="menu">' +
          '<div class="by-mega-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            (CATEGORY_ICONS[key] || CATEGORY_ICONS.tools) + '</svg>' + esc(CATBAR_LABELS[key]) + '</div>' +
          '<a href="buyer-market.html?category=' + key + '" role="menuitem">كل منتجات القسم<small>عرض الكل</small></a>' +
          subs.map(function (s) {
            return '<a href="buyer-market.html?category=' + key + '&q=' + encodeURIComponent(s.name) + '" role="menuitem">' +
              esc(s.name) + '<small>' + s.count + ' منتج</small></a>';
          }).join('') +
        '</div>';
      }
      return '<div class="by-cat-item"><a href="buyer-market.html?category=' + key + '" aria-haspopup="true">' +
        esc(CATBAR_LABELS[key]) + (mega ? chev : '') + '</a>' + mega + '</div>';
    }).join('');

    // كهرباء وسباكة: تصنيف قادم — يقود لبحث في السوق (حالة «لا نتائج» مصممة)
    html += '<div class="by-cat-item"><a href="buyer-market.html?q=' + encodeURIComponent('كهرباء وسباكة') + '">كهرباء وسباكة</a></div>';
    html += '<a href="buyer-market.html?filter=deals">عروض اليوم</a>';
    html += '<a class="by-cat-all" href="buyer-categories.html">جميع التصنيفات</a>';

    catBar.innerHTML = html;
  }

  /* ---------------- زر المدينة وموقع التوصيل ---------------- */
  function initCityButton() {
    var btn = $('#bhCityBtn');
    if (!btn) return;

    var wrap = btn.parentElement;
    var pop = $('#bhCityPop');

    function label() {
      var city = getCity();
      var addr = defaultAddress();
      var cityEl = $('#bhCityName');
      if (cityEl) cityEl.textContent = city || (addr ? addr.city : '') || 'اختر مدينتك';
    }

    if (pop) {
      var sel = $('#bhCitySelect', pop);
      if (sel) {
        sel.innerHTML = CITIES.map(function (c) {
          return '<option value="' + esc(c) + '"' + (c === getCity() ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('');
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        pop.hidden = !pop.hidden;
      });
      pop.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () { pop.hidden = true; });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pop.hidden = true; });

      var save = $('#bhCitySave', pop);
      if (save) save.addEventListener('click', function () {
        var v = sel ? sel.value : '';
        if (v) {
          setCity(v);
          label();
          pop.hidden = true;
          toast('تم تحديد ' + v + ' مدينةً للتوصيل', 'success');
          try { Store.emit(); } catch (e) { /* ignore */ }
        }
      });
    }

    label();
  }

  /* ---------------- درج السلة الجانبي ---------------- */
  var VAT_RATE = 0.15;
  var DELIVERY_FEE = 150;
  var drawerReady = false;

  function injectCartDrawer() {
    if (drawerReady || document.getElementById('amCartDrawer')) { drawerReady = true; return; }
    drawerReady = true;

    var backdrop = document.createElement('div');
    backdrop.className = 'am-cart-backdrop';
    backdrop.id = 'amCartBackdrop';

    var drawer = document.createElement('aside');
    drawer.className = 'am-cart-drawer';
    drawer.id = 'amCartDrawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'سلة التسوق');
    drawer.innerHTML =
      '<div class="am-cart-head">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
        '<div><strong>سلة التسوق</strong><small id="amCartCount"></small></div>' +
        '<button type="button" class="am-cart-close" id="amCartClose" aria-label="إغلاق السلة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="am-cart-body" id="amCartBody"></div>' +
      '<div class="am-cart-foot" id="amCartFoot" hidden></div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    backdrop.addEventListener('click', closeCartDrawer);
    $('#amCartClose').addEventListener('click', closeCartDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeCartDrawer();
    });
  }

  function openCartDrawer() {
    injectCartDrawer();
    var body = $('#amCartBody');

    // حالة تحميل قصيرة تُظهر أن البيانات تُجلب فعلاً
    body.innerHTML = '<div class="am-cart-state"><div class="am-cart-spin" aria-hidden="true"></div><p>جارٍ تحميل سلتك…</p></div>';
    $('#amCartFoot').hidden = true;
    $('#amCartDrawer').classList.add('is-open');
    $('#amCartBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';

    setTimeout(function () {
      try {
        renderCartDrawer();
      } catch (err) {
        body.innerHTML = '<div class="am-cart-state">' +
          '<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
          '<strong>تعذّر تحميل السلة</strong><p>حدث خطأ أثناء قراءة بيانات سلتك. أعد المحاولة.</p>' +
          '<button type="button" class="act" id="amCartRetry">إعادة المحاولة</button></div>';
        var retry = $('#amCartRetry');
        if (retry) retry.addEventListener('click', openCartDrawer);
      }
      var closeBtn = $('#amCartClose');
      if (closeBtn) closeBtn.focus();
    }, 220);
  }

  function closeCartDrawer() {
    var d = $('#amCartDrawer');
    var b = $('#amCartBackdrop');
    if (d) d.classList.remove('is-open');
    if (b) b.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function renderCartDrawer() {
    var body = $('#amCartBody');
    var foot = $('#amCartFoot');
    if (!body || !foot) return;

    var drawer = $('#amCartDrawer');
    if (!drawer || !drawer.classList.contains('is-open')) {
      // الدرج مغلق — لا حاجة لإعادة الرسم الآن
      if (!drawer) return;
    }

    var lines = Buyer.cartLines();
    var countEl = $('#amCartCount');
    if (countEl) countEl.textContent = lines.length ? (Buyer.cartCount() + ' منتج من ' + supplierCountIn(lines) + ' مورد') : 'سلتك بانتظارك';

    if (!lines.length) {
      body.innerHTML = '<div class="am-cart-state">' +
        '<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>' +
        '<strong>سلتك فارغة</strong>' +
        '<p>ابدأ بإضافة مواد مشروعك — أسمنت، حديد، تشطيبات وغيرها من موردين موثوقين.</p>' +
        '<a class="act" href="buyer-market.html">تصفّح السوق</a></div>';
      foot.hidden = true;
      return;
    }

    var supCount = supplierCountIn(lines);
    var warn = supCount > 1
      ? '<div class="am-cart-warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        'سلتك تضم منتجات من ' + supCount + ' موردين مختلفين — قد تصل شحناتك في مواعيد منفصلة وبرسوم توصيل لكل مورد.</div>'
      : '';

    body.innerHTML = warn + lines.map(function (l) {
      var p = l.product || {};
      var minQty = p.moq || 1;
      return '<div class="am-cart-line" data-line="' + esc(l.productId) + '">' +
        '<a href="buyer-product.html?id=' + encodeURIComponent(l.productId) + '"><img src="' + esc(p.img || '') + '" alt="" /></a>' +
        '<div>' +
          '<a class="name" href="buyer-product.html?id=' + encodeURIComponent(l.productId) + '">' + esc(l.name) + '</a>' +
          '<span class="sup"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>' + esc(p.brand || 'عام') + ' · ' + esc(l.unit || p.unit || 'وحدة') + '</span>' +
          '<div class="am-cart-qty">' +
            '<button type="button" data-inc="' + esc(l.productId) + '" aria-label="زيادة الكمية">+</button>' +
            '<span>' + l.qty + '</span>' +
            '<button type="button" data-dec="' + esc(l.productId) + '" aria-label="إنقاص الكمية"' + (l.qty <= minQty ? ' disabled title="الحد الأدنى للطلب ' + minQty + '"' : '') + '>−</button>' +
          '</div>' +
        '</div>' +
        '<div class="col-end">' +
          '<button type="button" class="rm" data-rm="' + esc(l.productId) + '" aria-label="إزالة من السلة">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          '</button>' +
          '<span class="price">' + fmt(l.lineTotal) + ' ر.س</span>' +
        '</div>' +
      '</div>';
    }).join('');

    // نفس حساب السلة والدفع بالضبط، حتى لا يرى المستخدم رقمين مختلفين للطلب نفسه
    var sum = Buyer.orderSummary(getCity());

    foot.hidden = false;
    foot.innerHTML =
      '<div class="am-cart-sums">' +
        '<div><span>المجموع (' + sum.count + ' وحدة)</span><span>' + fmt(sum.subtotal) + ' ر.س</span></div>' +
        (sum.discount ? '<div><span>خصم ' + esc((sum.promo || {}).code || '') + '</span><span>-' + fmt(sum.discount) + ' ر.س</span></div>' : '') +
        '<div><span>التوصيل (' + supCount + ' مورد)</span><span>' +
          (sum.shippingFree ? 'مجاني' : fmt(sum.shipping) + ' ر.س') + '</span></div>' +
        '<div><span>منها ضريبة القيمة المضافة (15٪)</span><span>' + fmt(sum.vat) + ' ر.س</span></div>' +
        '<div class="total"><span>الإجمالي شامل الضريبة</span><span>' + fmt(sum.total) + ' ر.س</span></div>' +
      '</div>' +
      '<a class="am-cart-checkout" href="buyer-checkout.html">' +
        'إتمام الطلب' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</a>' +
      '<a class="am-cart-view-link" href="buyer-cart.html">عرض صفحة السلة الكاملة</a>';

    bindDrawerActions(body);
  }

  function supplierCountIn(lines) {
    var set = {};
    lines.forEach(function (l) { set[(l.product && l.product.brand) || 'عام'] = true; });
    return Object.keys(set).length;
  }

  function bindDrawerActions(root) {
    $all('[data-inc]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        var line = Buyer.cart().filter(function (i) { return String(i.productId) === String(id); })[0];
        if (line) { Buyer.setCartQty(id, line.qty + 1); refreshChrome(); }
      });
    });
    $all('[data-dec]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        var line = Buyer.cart().filter(function (i) { return String(i.productId) === String(id); })[0];
        if (line && line.qty > 1) { Buyer.setCartQty(id, line.qty - 1); refreshChrome(); }
      });
    });
    $all('[data-rm]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        Buyer.removeFromCart(b.getAttribute('data-rm'));
        toast('أُزيل المنتج من السلة', 'danger');
        refreshChrome();
      });
    });
  }

  function initCartDrawerTrigger() {
    var link = $('#bhCartLink');
    if (!link) return;
    injectCartDrawer();
    link.addEventListener('click', function (e) {
      e.preventDefault();
      openCartDrawer();
    });
  }

  function initHeader() {
    // شريط التصنيفات الثانوي مع القوائم الفرعية
    var catBar = $('#bhCatBar');
    if (catBar) {
      if (catBar.classList.contains('by-catbar-inner')) buildCatBar(catBar);
      else {
        catBar.innerHTML = '<a href="buyer-market.html">كل المنتجات</a>' +
          Buyer.categories().map(function (c) {
            return '<a href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' + esc(c.label) + '</a>';
          }).join('') +
          '<a href="buyer-market.html?filter=deals">عروض اليوم</a>';
      }
    }

    initCityButton();
    initCartDrawerTrigger();

    // قائمة أقسام البحث
    var sel = $('#bhSearchCategory');
    if (sel) {
      sel.innerHTML = '<option value="">كل الأقسام</option>' +
        Buyer.categories().map(function (c) {
          return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>';
        }).join('');
    }

    initSearch();
    initSearchTools();
    initAccountMenu();
    refreshChrome();

    // الميزات الذكية تُركّب فوق الهيدر إن كان ملفها محمّلاً
    if (window.SmartUI) {
      SmartUI.initThemeToggle();
      SmartUI.ensureAssistant();
    }
    // تحديثات الطلبات تصل لحظياً من تبويب المورد إلى أي صفحة متجر
    if (window.Live) Live.start();

    window.addEventListener('scroll', refreshChrome, { passive: true });

    var clear = $('#bhCompareClear');
    if (clear) {
      clear.addEventListener('click', function () {
        Buyer.clearCompare();
        refreshChrome();
        $all('[data-compare]').forEach(function (b) { b.classList.remove('is-on'); });
        toast('تم إلغاء المقارنة', 'danger');
      });
    }
  }

  /* ---------------- أدوات البحث: الصورة والصوت ----------------
     تُحقن داخل شريط البحث نفسه قبل زر «بحث». */
  function initSearchTools() {
    if (!window.SmartUI) return;

    var inner = $('.by-smart-search-inner');
    var goBtn = $('#bhSearchBtn');
    if (!inner || $('#bhVisualBtn')) return;

    var cam = document.createElement('button');
    cam.type = 'button';
    cam.className = 'sm-search-tool';
    cam.id = 'bhVisualBtn';
    cam.setAttribute('aria-label', 'البحث بالصورة');
    cam.title = 'ابحث بصورة منتج';
    cam.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    cam.addEventListener('click', function () { SmartUI.openVisualSearch(); });

    if (goBtn) inner.insertBefore(cam, goBtn); else inner.appendChild(cam);

    // الميكروفون يظهر فقط حيث تدعمه المتصفحات فعلاً
    if (!SmartUI.speechAvailable()) return;

    var mic = document.createElement('button');
    mic.type = 'button';
    mic.className = 'sm-search-tool';
    mic.id = 'bhVoiceBtn';
    mic.setAttribute('aria-label', 'البحث الصوتي');
    mic.title = 'ابحث بصوتك';
    mic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
    mic.addEventListener('click', function () {
      SmartUI.startVoiceSearch($('#bhSearch'), function (text) {
        if (text) window.location.href = 'buyer-market.html?q=' + encodeURIComponent(text);
      });
    });

    if (goBtn) inner.insertBefore(mic, goBtn); else inner.appendChild(mic);
  }

  /* ---------------- البحث الذكي ---------------- */
  function initSearch() {
    var input = $('#bhSearch');
    var box = $('#bhSuggest');
    if (!input || !box) return;

    function go() {
      var q = input.value.trim();
      var cat = $('#bhSearchCategory') ? $('#bhSearchCategory').value : '';
      var params = [];
      if (q) params.push('q=' + encodeURIComponent(q));
      if (cat) params.push('category=' + encodeURIComponent(cat));
      window.location.href = 'buyer-market.html' + (params.length ? '?' + params.join('&') : '');
    }

    var TYPE_ICON = {
      category: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      supplier: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>'
    };

    function renderSuggest() {
      var q = input.value.trim();
      // الاقتراحات تبدأ من أول حرفين
      if (q.length < 2) { box.hidden = true; return; }

      var items = Buyer.suggest(q, 8);

      if (!items.length) {
        // بدل رسالة فارغة: اقترح الفئة الأقرب لكلمة البحث ثم الأكثر مبيعاً
        var nearCat = Buyer.categoryForQuery(q);
        var alts = nearCat
          ? Buyer.activeProducts().filter(function (p) { return p.category === nearCat; }).slice(0, 4)
          : Buyer.bestSellers(4);

        box.innerHTML =
          '<div class="by-suggest-empty">لا توجد نتائج مطابقة لـ «' + esc(q) + '» — جرّب هذه بدلاً منها</div>' +
          alts.map(function (p) {
            return '<a class="by-suggest-item" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '">' +
              '<img src="' + esc(p.img) + '" alt="" />' +
              '<span class="by-suggest-body"><strong>' + esc(p.name) + '</strong>' +
              '<small>' + fmt(effectivePrice(p)) + ' ر.س / ' + esc(p.unit || 'وحدة') + '</small></span></a>';
          }).join('') +
          '<a class="by-suggest-item" href="buyer-market.html">' +
            '<span class="by-suggest-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            TYPE_ICON.category + '</svg></span>' +
            '<span class="by-suggest-body"><strong>تصفّح كل المنتجات</strong><small>عرض السوق كاملاً</small></span></a>';
        box.hidden = false;
        return;
      }

      box.innerHTML = items.map(function (it) {
        var visual = it.img
          ? '<img src="' + esc(it.img) + '" alt="" />'
          : '<span class="by-suggest-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            (TYPE_ICON[it.type] || TYPE_ICON.category) + '</svg></span>';

        // اقتراح المنتج يعرض سعره ووحدته، وغيره يعرض وصفه المختصر
        var sub = (it.type === 'product' && it.price !== undefined)
          ? '<strong style="color:var(--primary-600);">' + fmt(it.price) + ' ر.س</strong> / ' + esc(it.unit) + ' — ' + esc(it.sub)
          : esc(it.sub);

        return '<a class="by-suggest-item" href="' + esc(it.href) + '">' + visual +
          '<span class="by-suggest-body"><strong>' + esc(it.label) + '</strong><small>' + sub + '</small></span></a>';
      }).join('');
      box.hidden = false;
    }

    input.addEventListener('input', renderSuggest);
    input.addEventListener('focus', renderSuggest);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { box.hidden = true; go(); }
      if (e.key === 'Escape') box.hidden = true;
    });

    var btn = $('#bhSearchBtn');
    if (btn) btn.addEventListener('click', go);

    document.addEventListener('click', function (e) {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
  }

  /* ---------------- قائمة الحساب ---------------- */
  function initAccountMenu() {
    var btn = $('#bhAccountBtn');
    var menu = $('#bhAccountMenu');
    if (!btn || !menu) return;

    var profile = Buyer.profile();
    var nameEl = $('#bhMenuName');
    var mailEl = $('#bhMenuEmail');
    if (nameEl) nameEl.textContent = profile.name;
    if (mailEl) mailEl.textContent = profile.email || 'حساب مشترٍ';

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { menu.hidden = true; });

    var logout = $('#bhLogoutBtn');
    if (logout) {
      logout.addEventListener('click', function () {
        if (!window.confirm('هل تريد تسجيل الخروج من حسابك؟')) return;
        ['ammar_account_type', 'ammar_user_name', 'ammar_buyer_id'].forEach(function (k) {
          try { localStorage.removeItem(k); } catch (err) { /* ignore */ }
        });
        window.location.href = 'login.html';
      });
    }
  }

  /* ---------------- الثيم ---------------- */
  function applyTheme() {
    var theme = 'light';
    try { theme = localStorage.getItem('ammar_theme') || 'light'; } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }
  applyTheme();

  return {
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_ICONS: CATEGORY_ICONS,
    AVAIL: AVAIL,
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_ICONS: CATEGORY_ICONS,
    fmt: fmt,
    esc: esc,
    toast: toast,
    starsHtml: starsHtml,
    supplierLogoHtml: supplierLogoHtml,
    effectivePrice: effectivePrice,
    productCard: productCard,
    renderProducts: renderProducts,
    emptyState: emptyState,
    skeleton: skeleton,
    bindCardActions: bindCardActions,
    refreshChrome: refreshChrome,
    initHeader: initHeader,

    CITIES: CITIES,
    getCity: getCity,
    setCity: setCity,
    defaultAddress: defaultAddress,
    tierOf: tierOf,
    deliveryOf: deliveryOf,
    openCartDrawer: openCartDrawer,
    closeCartDrawer: closeCartDrawer
  };
})();

// المكوّنات المشتركة تنادي Shell.toast — وجّهها لتوست المتجر
window.Shell = window.Shell || { toast: ByUI.toast };
