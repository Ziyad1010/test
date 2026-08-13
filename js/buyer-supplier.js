(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = ByUI.esc;
  var name = '';

  function render() {
    var s = Buyer.supplier(name);

    if (!s) {
      $('#bspHeader').innerHTML = ByUI.emptyState(
        'لم نعثر على هذا المورد — ربما لم يعد لديه منتجات معروضة.', 'المورد غير موجود');
      $('#bspGrid').innerHTML = '';
      $('#bspProductsTitle').textContent = '';
      $('#bspProductsSub').textContent = '';
      return;
    }

    var products = Buyer.supplierProducts(name);
    var totalViews = products.reduce(function (a, p) { return a + (p.views || 0); }, 0);

    $('#bspHeader').innerHTML =
      '<div class="ord-card">' +
        '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">' +
          ByUI.supplierLogoHtml(s.name, 'by-supplier-logo is-lg') +
          '<div style="flex:1;min-width:180px;">' +
            '<h2 style="font-size:1.3rem;font-weight:800;margin-bottom:6px;">' + esc(s.name) + '</h2>' +
            '<div class="by-card-rating" style="margin-bottom:6px;">' +
              ByUI.starsHtml(s.rating) +
              '<span style="font-size:0.8rem;color:var(--muted);">' + s.rating + ' — مورد موثّق</span>' +
            '</div>' +
            '<div class="offer-meta">' +
              s.categories.map(function (c) {
                return '<a class="pd-tag" href="buyer-market.html?supplier=' + encodeURIComponent(s.name) +
                  '&category=' + encodeURIComponent(c) + '">' + esc(ByUI.CATEGORY_LABELS[c] || c) + '</a>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<a class="ord-action-btn primary" href="messaging.html" style="width:auto;text-decoration:none;">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
            'تواصل مع المورد</a>' +
        '</div>' +
        '<div class="fin-summary" style="margin-top:20px;margin-bottom:0;">' +
          '<div class="fin-card"><div class="fin-card-label">عدد المنتجات</div><div class="fin-card-value">' + s.products + '</div></div>' +
          '<div class="fin-card"><div class="fin-card-label">الفئات</div><div class="fin-card-value">' + s.categories.length + '</div></div>' +
          '<div class="fin-card"><div class="fin-card-label">التقييم</div><div class="fin-card-value">' + s.rating + ' / 5</div></div>' +
          '<div class="fin-card"><div class="fin-card-label">المشاهدات</div><div class="fin-card-value">' + ByUI.fmt(totalViews) + '</div></div>' +
        '</div>' +
      '</div>';

    $('#bspProductsTitle').textContent = 'منتجات ' + s.name;
    $('#bspProductsSub').textContent = products.length + ' منتج متاح';
    ByUI.renderProducts($('#bspGrid'), products, 'لا توجد منتجات معروضة من هذا المورد حالياً.');
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    name = new URLSearchParams(window.location.search).get('name') || '';

    ByUI.skeleton($('#bspGrid'), 4);

    setTimeout(function () {
      render();
      Store.subscribe(render);
    }, 300);
  });
})();
