(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = ByUI.esc;

  function render() {
    var cats = Buyer.categories();

    $('#bcList').innerHTML = cats.map(function (c) {
      var products = Buyer.activeProducts().filter(function (p) { return p.category === c.key; });
      var subs = {};
      products.forEach(function (p) { if (p.subcategory) subs[p.subcategory] = true; });
      var subList = Object.keys(subs);

      return '<div class="ord-card" style="margin-bottom:16px;">' +
        '<div class="ord-card-head">' +
          '<span class="by-cat-circle-ico" style="width:44px;height:44px;border-radius:13px;">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            (ByUI.CATEGORY_ICONS[c.key] || ByUI.CATEGORY_ICONS.tools) + '</svg></span>' +
          '<h3>' + esc(c.label) + '</h3>' +
          '<a class="by-see-all" href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' +
            'تصفّح القسم' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</a>' +
        '</div>' +
        '<p style="font-size:0.84rem;color:var(--muted);margin-bottom:12px;">' + c.count + ' منتج متاح من ' +
          new Set(products.map(function (p) { return p.brand; })).size + ' مورد</p>' +
        (subList.length
          ? '<div class="offer-meta">' + subList.map(function (s) {
              return '<a class="pd-tag" href="buyer-market.html?category=' + encodeURIComponent(c.key) +
                '&q=' + encodeURIComponent(s) + '">' + esc(s) + '</a>';
            }).join('') + '</div>'
          : '<p style="font-size:0.82rem;color:var(--muted);">لا توجد تصنيفات فرعية في هذا القسم بعد.</p>') +
      '</div>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    render();
    Store.subscribe(render);
  });
})();
