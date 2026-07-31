(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var esc = ByUI.esc;

  var state = { q: '', category: '', supplier: '', avail: '', sort: 'relevance', filter: '' };

  var FILTER_TITLES = {
    deals: { title: 'عروض اليوم', sub: 'خصومات سارية الآن' },
    featured: { title: 'منتجات مميزة', sub: 'الأكثر مشاهدةً على المنصة' },
    best: { title: 'الأكثر مبيعاً', sub: 'الأعلى طلباً من المقاولين' },
    'new': { title: 'وصل حديثاً', sub: 'أحدث ما أضافه الموردون' }
  };

  function baseList() {
    if (state.filter === 'deals') return Buyer.flashDeals(100);
    if (state.filter === 'featured') return Buyer.featured(100);
    if (state.filter === 'best') return Buyer.bestSellers(100);
    if (state.filter === 'new') return Buyer.newArrivals(100);
    return Buyer.activeProducts();
  }

  function results() {
    var q = state.q.trim().toLowerCase();

    var list = baseList().filter(function (p) {
      if (state.category && p.category !== state.category) return false;
      if (state.supplier && (p.brand || 'عام') !== state.supplier) return false;
      if (state.avail && Store.deriveAvailability(p) !== state.avail) return false;
      if (q) {
        var hay = (p.name + ' ' + (p.brand || '') + ' ' + (p.subcategory || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (state.sort === 'price-asc') {
      list.sort(function (a, b) { return ByUI.effectivePrice(a) - ByUI.effectivePrice(b); });
    } else if (state.sort === 'price-desc') {
      list.sort(function (a, b) { return ByUI.effectivePrice(b) - ByUI.effectivePrice(a); });
    } else if (state.sort === 'rating') {
      list.sort(function (a, b) { return Buyer.ratingOf(b.id).value - Buyer.ratingOf(a.id).value; });
    } else if (state.sort === 'new') {
      list.sort(function (a, b) { return b.id - a.id; });
    }

    return list;
  }

  function render() {
    var list = results();
    $('#bmCount').textContent = list.length + ' منتج';

    ByUI.renderProducts($('#bmGrid'), list,
      'لم نجد منتجات مطابقة. جرّب توسيع البحث أو إزالة بعض الفلاتر.');
  }

  function fillFilters() {
    $('#bmCategory').innerHTML = '<option value="">كل الفئات</option>' +
      Buyer.categories().map(function (c) {
        return '<option value="' + esc(c.key) + '"' + (c.key === state.category ? ' selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');

    $('#bmSupplier').innerHTML = '<option value="">كل الموردين</option>' +
      Buyer.suppliers().map(function (s) {
        return '<option value="' + esc(s.name) + '"' + (s.name === state.supplier ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('');
  }

  function applyTitle() {
    var meta = FILTER_TITLES[state.filter];
    if (meta) {
      $('#bmTitle').textContent = meta.title;
      $('#bmSub').textContent = meta.sub;
      return;
    }

    if (state.category) {
      $('#bmTitle').textContent = ByUI.CATEGORY_LABELS[state.category] || 'السوق';
      $('#bmSub').textContent = 'كل منتجات هذا القسم';
      return;
    }

    if (state.q) {
      $('#bmTitle').textContent = 'نتائج البحث';
      $('#bmSub').textContent = 'عن «' + state.q + '»';
      return;
    }

    $('#bmTitle').textContent = 'السوق';
    $('#bmSub').textContent = 'كل منتجات المنصة';
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();

    var params = new URLSearchParams(window.location.search);
    state.q = params.get('q') || '';
    state.category = params.get('category') || '';
    state.supplier = params.get('supplier') || '';
    state.filter = params.get('filter') || '';

    $('#bmSearch').value = state.q;
    fillFilters();
    applyTitle();

    $('#bmSearch').addEventListener('input', function () { state.q = this.value; render(); });
    $('#bmCategory').addEventListener('change', function () { state.category = this.value; applyTitle(); render(); });
    $('#bmSupplier').addEventListener('change', function () { state.supplier = this.value; render(); });
    $('#bmAvail').addEventListener('change', function () { state.avail = this.value; render(); });
    $('#bmSort').addEventListener('change', function () { state.sort = this.value; render(); });

    ByUI.skeleton($('#bmGrid'), 8);

    setTimeout(function () {
      render();
      Store.subscribe(render);
    }, 320);
  });
})();
