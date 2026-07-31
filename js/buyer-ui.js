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

    var badges = '';
    if (p.discount > 0) badges += '<span class="by-tag discount">-' + p.discount + '%</span>';
    if (hasTiers) badges += '<span class="by-tag bulk">خصم عند الكمية</span>';

    return '<article class="by-card" data-product="' + esc(p.id) + '">' +
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
        '<button type="button" class="by-quick-btn compare' + (inCmp ? ' is-on' : '') + '" data-compare="' + esc(p.id) + '" aria-label="مقارنة" title="أضف للمقارنة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="by-card-body">' +
        '<a class="by-card-brand" href="buyer-supplier.html?name=' + encodeURIComponent(p.brand || 'عام') + '">' + esc(p.brand || 'عام') + '</a>' +
        '<a class="by-card-name" href="' + href + '">' + esc(p.name) + '</a>' +
        '<div class="by-card-rating">' +
          starsHtml(rating.value) +
          '<a class="by-rating-link" href="' + href + '#reviews">' + rating.value + ' (' + rating.count + ' مراجعة)</a>' +
        '</div>' +
        '<span class="pd-avail ' + avail.tone + '" style="width:fit-content;">' + avail.label + '</span>' +
        '<div class="by-card-price-row">' +
          '<span class="by-price">' + fmt(eff) + ' ر.س</span>' +
          '<span class="by-price-unit">/ ' + esc(p.unit || 'وحدة') + '</span>' +
          (eff < p.price ? '<span class="by-price-old">' + fmt(p.price) + ' ر.س</span>' : '') +
        '</div>' +
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
          toast('أُضيف "' + p.name + '" إلى السلة', 'success');
          refreshChrome();
        } else {
          toast('هذا المنتج غير متوفر حالياً', 'danger');
        }
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

    var sticky = $('#bhStickyCart');
    if (sticky) {
      $('#bhStickyCount').textContent = count + (count === 1 ? ' منتج في سلتك' : ' منتجات في سلتك');
      $('#bhStickyTotal').textContent = 'الإجمالي: ' + fmt(total) + ' ر.س';
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

  function initHeader() {
    // شريط التصنيفات الثانوي
    var catBar = $('#bhCatBar');
    if (catBar) {
      catBar.innerHTML = '<a href="buyer-market.html">كل المنتجات</a>' +
        Buyer.categories().map(function (c) {
          return '<a href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' + esc(c.label) + '</a>';
        }).join('') +
        '<a href="buyer-market.html?filter=deals">عروض اليوم</a>';
    }

    // قائمة أقسام البحث
    var sel = $('#bhSearchCategory');
    if (sel) {
      sel.innerHTML = '<option value="">كل الأقسام</option>' +
        Buyer.categories().map(function (c) {
          return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>';
        }).join('');
    }

    initSearch();
    initAccountMenu();
    refreshChrome();

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
      if (q.length < 1) { box.hidden = true; return; }

      var items = Buyer.suggest(q, 8);
      if (!items.length) {
        box.innerHTML = '<div class="by-suggest-empty">لا توجد نتائج مطابقة لـ «' + esc(q) + '»</div>';
        box.hidden = false;
        return;
      }

      box.innerHTML = items.map(function (it) {
        var visual = it.img
          ? '<img src="' + esc(it.img) + '" alt="" />'
          : '<span class="by-suggest-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            (TYPE_ICON[it.type] || TYPE_ICON.category) + '</svg></span>';

        return '<a class="by-suggest-item" href="' + esc(it.href) + '">' + visual +
          '<span class="by-suggest-body"><strong>' + esc(it.label) + '</strong><small>' + esc(it.sub) + '</small></span></a>';
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
    fmt: fmt,
    esc: esc,
    toast: toast,
    starsHtml: starsHtml,
    effectivePrice: effectivePrice,
    productCard: productCard,
    renderProducts: renderProducts,
    emptyState: emptyState,
    skeleton: skeleton,
    bindCardActions: bindCardActions,
    refreshChrome: refreshChrome,
    initHeader: initHeader
  };
})();

// المكوّنات المشتركة تنادي Shell.toast — وجّهها لتوست المتجر
window.Shell = window.Shell || { toast: ByUI.toast };
