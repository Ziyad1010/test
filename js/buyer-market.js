(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  // الحالة كاملة في الرابط، فالرجوع للخلف يستعيد الفلاتر كما كانت
  var state = {
    q: '', categories: [], suppliers: [], avail: [],
    minRating: 0, min: '', max: '', sort: 'relevance', filter: ''
  };

  var FILTER_TITLES = {
    deals: { title: 'عروض اليوم', sub: 'خصومات سارية الآن' },
    featured: { title: 'منتجات مميزة', sub: 'الأكثر مشاهدةً على المنصة' },
    best: { title: 'الأكثر مبيعاً', sub: 'الأعلى طلباً من المقاولين' },
    'new': { title: 'وصل حديثاً', sub: 'أحدث ما أضافه الموردون' },
    bulk: { title: 'أسعار الجملة', sub: 'منتجات عليها خصم كميات معلن من المورد' }
  };

  var PRICE_BANDS = [
    { label: 'أقل من 100', min: '', max: '100' },
    { label: '100 – 500', min: '100', max: '500' },
    { label: '500 – 2,500', min: '500', max: '2500' },
    { label: 'أكثر من 2,500', min: '2500', max: '' }
  ];

  var AVAIL_OPTIONS = [
    { key: 'in_stock', label: 'متوفر' },
    { key: 'limited', label: 'كمية محدودة' },
    { key: 'on_demand', label: 'عند الطلب' }
  ];

  /* ---------------- المصدر والتصفية ---------------- */
  function baseList() {
    if (state.filter === 'deals') return Buyer.flashDeals(200);
    if (state.filter === 'featured') return Buyer.featured(200);
    if (state.filter === 'best') return Buyer.bestSellers(200);
    if (state.filter === 'new') return Buyer.newArrivals(200);
    if (state.filter === 'bulk') {
      return Buyer.activeProducts().filter(function (p) { return p.tiers && p.tiers.length; });
    }
    // البحث يمرّ عبر التوحيد والمرادفات
    return state.q ? Buyer.search(state.q) : Buyer.activeProducts();
  }

  function passes(p) {
    if (state.categories.length && state.categories.indexOf(p.category) === -1) return false;
    if (state.suppliers.length && state.suppliers.indexOf(p.brand || 'عام') === -1) return false;
    if (state.avail.length && state.avail.indexOf(Store.deriveAvailability(p)) === -1) return false;

    var price = ByUI.effectivePrice(p);
    if (state.min !== '' && price < parseFloat(state.min)) return false;
    if (state.max !== '' && price > parseFloat(state.max)) return false;

    if (state.minRating && Buyer.ratingOf(p.id).value < state.minRating) return false;
    return true;
  }

  function results() {
    var list = baseList().filter(passes);

    if (state.sort === 'price-asc') list.sort(function (a, b) { return ByUI.effectivePrice(a) - ByUI.effectivePrice(b); });
    else if (state.sort === 'price-desc') list.sort(function (a, b) { return ByUI.effectivePrice(b) - ByUI.effectivePrice(a); });
    else if (state.sort === 'rating') list.sort(function (a, b) { return Buyer.ratingOf(b.id).value - Buyer.ratingOf(a.id).value; });
    else if (state.sort === 'new') list.sort(function (a, b) { return b.id - a.id; });

    return list;
  }

  function activeCount() {
    return state.categories.length + state.suppliers.length + state.avail.length +
      (state.minRating ? 1 : 0) + (state.min !== '' || state.max !== '' ? 1 : 0);
  }

  /* ---------------- بناء الفلاتر ---------------- */
  function checkRow(checked, label, count, attr, value) {
    return '<label class="by-check' + (checked ? ' is-on' : '') + '">' +
      '<input type="checkbox" ' + attr + '="' + esc(value) + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + esc(label) + '</span>' +
      (count !== null ? '<small>' + count + '</small>' : '') +
    '</label>';
  }

  function renderFilters() {
    // العدّادات تُحسب من القائمة الأساسية لا من النتائج، فتبقى ثابتة ومفيدة
    var base = baseList();

    $('#bmCategoryList').innerHTML = Buyer.categories().map(function (c) {
      var n = base.filter(function (p) { return p.category === c.key; }).length;
      return checkRow(state.categories.indexOf(c.key) !== -1, c.label, n, 'data-cat', c.key);
    }).join('');

    $('#bmSupplierList').innerHTML = Buyer.suppliers().map(function (s) {
      var n = base.filter(function (p) { return (p.brand || 'عام') === s.name; }).length;
      if (!n) return '';
      return checkRow(state.suppliers.indexOf(s.name) !== -1, s.name, n, 'data-sup', s.name);
    }).join('');

    $('#bmAvailList').innerHTML = AVAIL_OPTIONS.map(function (a) {
      var n = base.filter(function (p) { return Store.deriveAvailability(p) === a.key; }).length;
      return checkRow(state.avail.indexOf(a.key) !== -1, a.label, n, 'data-avail', a.key);
    }).join('');

    $('#bmRatingList').innerHTML = [4, 3, 2].map(function (r) {
      return '<label class="by-check' + (state.minRating === r ? ' is-on' : '') + '">' +
        '<input type="radio" name="bmRating" data-rating="' + r + '"' + (state.minRating === r ? ' checked' : '') + ' />' +
        '<span>' + ByUI.starsHtml(r) + ' فأعلى</span></label>';
    }).join('') +
      '<label class="by-check' + (!state.minRating ? ' is-on' : '') + '">' +
        '<input type="radio" name="bmRating" data-rating="0"' + (!state.minRating ? ' checked' : '') + ' />' +
        '<span>كل التقييمات</span></label>';

    $('#bmPriceChips').innerHTML = PRICE_BANDS.map(function (b, i) {
      var on = state.min === b.min && state.max === b.max;
      return '<button type="button" class="by-chip' + (on ? ' is-on' : '') + '" data-band="' + i + '">' + esc(b.label) + '</button>';
    }).join('');

    $('#bmMinPrice').value = state.min;
    $('#bmMaxPrice').value = state.max;

    var n = activeCount();
    $('#bmActiveCount').hidden = n === 0;
    $('#bmActiveCount').textContent = n;

    bindFilterEvents();
  }

  function bindFilterEvents() {
    $all('[data-cat]').forEach(function (el) {
      el.addEventListener('change', function () {
        toggleIn(state.categories, el.getAttribute('data-cat'), el.checked);
        apply();
      });
    });
    $all('[data-sup]').forEach(function (el) {
      el.addEventListener('change', function () {
        toggleIn(state.suppliers, el.getAttribute('data-sup'), el.checked);
        apply();
      });
    });
    $all('[data-avail]').forEach(function (el) {
      el.addEventListener('change', function () {
        toggleIn(state.avail, el.getAttribute('data-avail'), el.checked);
        apply();
      });
    });
    $all('[data-rating]').forEach(function (el) {
      el.addEventListener('change', function () {
        state.minRating = parseInt(el.getAttribute('data-rating'), 10);
        apply();
      });
    });
    $all('[data-band]').forEach(function (el) {
      el.addEventListener('click', function () {
        var b = PRICE_BANDS[parseInt(el.getAttribute('data-band'), 10)];
        var on = state.min === b.min && state.max === b.max;
        state.min = on ? '' : b.min;
        state.max = on ? '' : b.max;
        apply();
      });
    });
  }

  function toggleIn(arr, value, on) {
    var i = arr.indexOf(value);
    if (on && i === -1) arr.push(value);
    if (!on && i !== -1) arr.splice(i, 1);
  }

  /* ---------------- شرائح الفلاتر النشطة ---------------- */
  function renderChips() {
    var chips = [];

    state.categories.forEach(function (c) {
      chips.push({ label: ByUI.CATEGORY_LABELS[c] || c, kind: 'cat', value: c });
    });
    state.suppliers.forEach(function (s) { chips.push({ label: s, kind: 'sup', value: s }); });
    state.avail.forEach(function (a) {
      var found = AVAIL_OPTIONS.filter(function (o) { return o.key === a; })[0];
      chips.push({ label: found ? found.label : a, kind: 'avail', value: a });
    });
    if (state.minRating) chips.push({ label: state.minRating + ' نجوم فأعلى', kind: 'rating', value: '' });
    if (state.min !== '' || state.max !== '') {
      chips.push({
        label: 'السعر ' + (state.min || '0') + ' – ' + (state.max || '∞') + ' ر.س',
        kind: 'price', value: ''
      });
    }

    $('#bmChips').innerHTML = chips.map(function (c) {
      return '<span class="by-active-chip">' + esc(c.label) +
        '<button type="button" data-chip="' + c.kind + '" data-chip-value="' + esc(c.value) + '" aria-label="إزالة">×</button></span>';
    }).join('');

    $all('[data-chip]', $('#bmChips')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-chip');
        var value = btn.getAttribute('data-chip-value');

        if (kind === 'cat') toggleIn(state.categories, value, false);
        else if (kind === 'sup') toggleIn(state.suppliers, value, false);
        else if (kind === 'avail') toggleIn(state.avail, value, false);
        else if (kind === 'rating') state.minRating = 0;
        else if (kind === 'price') { state.min = ''; state.max = ''; }

        apply();
      });
    });
  }

  /* ---------------- النتائج ---------------- */
  function renderResults() {
    var list = results();
    $('#bmCount').textContent = list.length + ' منتج' + (state.q ? ' لـ «' + state.q + '»' : '');

    var grid = $('#bmGrid');
    var none = $('#bmNoResults');

    if (list.length) {
      none.hidden = true;
      grid.hidden = false;
      ByUI.renderProducts(grid, list);
      return;
    }

    // لا نتائج: اقترح بدائل حقيقية بدل صفحة فارغة
    grid.hidden = true;
    none.hidden = false;

    var nearCat = state.q ? Buyer.categoryForQuery(state.q) : '';
    var alts = nearCat
      ? Buyer.activeProducts().filter(function (p) { return p.category === nearCat; }).slice(0, 4)
      : Buyer.bestSellers(4);

    none.innerHTML =
      '<div class="by-empty" style="margin-bottom:22px;">' +
        '<span class="by-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>' +
        '<strong>لم نجد منتجات مطابقة</strong>' +
        '<p>' + (activeCount() ? 'جرّب تخفيف الفلاتر المطبّقة أو ' : '') + 'ابحث بكلمة أعم مثل «أسمنت» أو «حديد».</p>' +
        (activeCount() ? '<button type="button" class="by-btn by-btn-outline" id="bmResetInline" style="flex:none;margin-top:6px;">مسح كل الفلاتر</button>' : '') +
      '</div>' +
      '<div class="by-section-head"><div><h2 style="font-size:1.05rem;">' +
        (nearCat ? 'قد يناسبك من قسم ' + esc(ByUI.CATEGORY_LABELS[nearCat] || '') : 'الأكثر مبيعاً على المنصة') +
      '</h2></div></div>' +
      '<div class="by-products" id="bmAlts"></div>' +
      '<div class="by-section-head" style="margin-top:22px;"><div><h2 style="font-size:1.05rem;">تصفّح الأقسام</h2></div></div>' +
      '<div class="by-chip-row">' +
        Buyer.categories().map(function (c) {
          return '<a class="by-chip" href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' +
            esc(c.label) + ' (' + c.count + ')</a>';
        }).join('') +
      '</div>';

    ByUI.renderProducts($('#bmAlts'), alts);

    var inlineReset = $('#bmResetInline');
    if (inlineReset) inlineReset.addEventListener('click', resetAll);
  }

  /* ---------------- المزامنة مع الرابط ---------------- */
  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.filter) p.set('filter', state.filter);
    if (state.categories.length) p.set('category', state.categories.join(','));
    if (state.suppliers.length) p.set('supplier', state.suppliers.join(','));
    if (state.avail.length) p.set('avail', state.avail.join(','));
    if (state.minRating) p.set('rating', state.minRating);
    if (state.min !== '') p.set('min', state.min);
    if (state.max !== '') p.set('max', state.max);
    if (state.sort !== 'relevance') p.set('sort', state.sort);

    var qs = p.toString();
    // replaceState يبقي زر الرجوع على الصفحة السابقة لا على كل تغيير فلتر
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function readUrl() {
    var p = new URLSearchParams(window.location.search);
    state.q = p.get('q') || '';
    state.filter = p.get('filter') || '';
    state.categories = (p.get('category') || '').split(',').filter(Boolean);
    state.suppliers = (p.get('supplier') || '').split(',').filter(Boolean);
    state.avail = (p.get('avail') || '').split(',').filter(Boolean);
    state.minRating = parseInt(p.get('rating'), 10) || 0;
    state.min = p.get('min') || '';
    state.max = p.get('max') || '';
    state.sort = p.get('sort') || 'relevance';
  }

  function applyTitle() {
    var meta = FILTER_TITLES[state.filter];
    if (meta) { $('#bmTitle').textContent = meta.title; $('#bmSub').textContent = meta.sub; return; }

    if (state.q) {
      $('#bmTitle').textContent = 'نتائج البحث';
      $('#bmSub').textContent = 'عن «' + state.q + '»';
      return;
    }
    if (state.categories.length === 1) {
      $('#bmTitle').textContent = ByUI.CATEGORY_LABELS[state.categories[0]] || 'السوق';
      $('#bmSub').textContent = 'كل منتجات هذا القسم';
      return;
    }
    $('#bmTitle').textContent = 'السوق';
    $('#bmSub').textContent = 'كل منتجات المنصة';
  }

  // تحديث فوري بلا إعادة تحميل
  function apply() {
    syncUrl();
    applyTitle();
    renderFilters();
    renderChips();
    renderResults();
  }

  function resetAll() {
    state.categories = [];
    state.suppliers = [];
    state.avail = [];
    state.minRating = 0;
    state.min = '';
    state.max = '';
    apply();
  }

  /* ---------------- التهيئة ---------------- */
  function initControls() {
    var searchInput = $('#bmSearch');
    var timer = null;

    searchInput.addEventListener('input', function () {
      state.q = this.value;
      clearTimeout(timer);
      timer = setTimeout(apply, 180);
    });

    $('#bmSort').addEventListener('change', function () { state.sort = this.value; apply(); });
    $('#bmReset').addEventListener('click', resetAll);

    ['#bmMinPrice', '#bmMaxPrice'].forEach(function (sel) {
      var el = $(sel);
      var t = null;
      el.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        state[sel === '#bmMinPrice' ? 'min' : 'max'] = this.value;
        clearTimeout(t);
        t = setTimeout(function () { syncUrl(); renderChips(); renderResults(); }, 300);
      });
    });

    // درج الفلاتر على الشاشات الصغيرة
    var toggle = $('#bmFilterToggle');
    toggle.addEventListener('click', function () { $('#bmFilters').classList.toggle('is-open'); });
    document.addEventListener('click', function (e) {
      var panel = $('#bmFilters');
      if (!panel.classList.contains('is-open')) return;
      if (!panel.contains(e.target) && !toggle.contains(e.target)) panel.classList.remove('is-open');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    readUrl();

    $('#bmSearch').value = state.q;
    $('#bmSort').value = state.sort;

    initControls();
    ByUI.skeleton($('#bmGrid'), 8);

    setTimeout(function () {
      apply();
      Store.subscribe(function () { renderFilters(); renderResults(); });
    }, 300);
  });
})();
