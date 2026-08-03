(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = ByUI.esc;

  var CAT_IMAGES = {
    steel: 'assets/images/cat-steel.jpg',
    cement: 'assets/images/cat-cement.jpg',
    concrete: 'assets/images/cat-concrete.jpg',
    finishing: 'assets/images/cat-finishing.jpg',
    blocks: 'assets/images/cat-blocks.jpg',
    tools: 'assets/images/cat-tools.jpg'
  };

  // نفس إيقاع الصفحة الرئيسية: صناديق بأحجام متفاوتة لا شبكة رتيبة
  var SHAPES = ['sf-tile--lg', 'sf-tile--wide', '', '', 'sf-tile--wide', 'sf-tile--wide'];

  function render() {
    var cats = Buyer.categories().slice().sort(function (a, b) { return b.count - a.count; });
    var products = Buyer.activeProducts();

    $('#bcList').innerHTML = cats.map(function (c, i) {
      var mine = products.filter(function (p) { return p.category === c.key; });

      var subs = [];
      var brands = {};
      mine.forEach(function (p) {
        if (p.subcategory && subs.indexOf(p.subcategory) === -1) subs.push(p.subcategory);
        if (p.brand) brands[p.brand] = true;
      });

      var supplierCount = Object.keys(brands).length;
      var shown = subs.slice(0, 3);
      var extra = subs.length - shown.length;

      return '<a class="sf-tile has-media ' + SHAPES[i % SHAPES.length] + '" ' +
        'href="buyer-market.html?category=' + encodeURIComponent(c.key) + '">' +
        '<span class="sf-tile-bg"><img src="' + esc(CAT_IMAGES[c.key] || CAT_IMAGES.tools) + '" alt="" loading="lazy" /></span>' +
        '<span class="sf-tile-ico" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          (ByUI.CATEGORY_ICONS[c.key] || ByUI.CATEGORY_ICONS.tools) + '</svg></span>' +
        '<span class="sf-tile-body">' +
          '<strong>' + esc(c.label) + '</strong>' +
          '<small>' + c.count + ' منتج من ' + supplierCount + ' مورد</small>' +
          (shown.length
            ? '<span class="sf-tile-tags">' +
                shown.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') +
                (extra > 0 ? '<span>+' + extra + '</span>' : '') +
              '</span>'
            : '') +
        '</span>' +
      '</a>';
    }).join('');

    if (window.SF) SF.stagger($('#bcList'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    render();
    Store.subscribe(render);
  });
})();
