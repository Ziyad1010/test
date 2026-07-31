(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = ByUI.esc;
  var search = '';

  function render() {
    var q = search.trim().toLowerCase();
    var list = Buyer.suppliers().filter(function (s) {
      return !q || s.name.toLowerCase().indexOf(q) !== -1;
    });

    if (!list.length) {
      $('#bsupGrid').innerHTML = ByUI.emptyState('لم نجد مورداً مطابقاً لبحثك.', 'لا توجد نتائج');
      return;
    }

    $('#bsupGrid').innerHTML = list.map(function (s) {
      return '<a class="by-supplier" href="buyer-supplier.html?name=' + encodeURIComponent(s.name) + '">' +
        '<span class="by-supplier-logo">' + esc(s.name.trim().charAt(0)) + '</span>' +
        '<strong>' + esc(s.name) + '</strong>' +
        '<span class="by-card-rating" style="justify-content:center;">' +
          ByUI.starsHtml(s.rating) + '<span style="font-size:0.76rem;color:var(--muted);">' + s.rating + '</span>' +
        '</span>' +
        '<small>' + s.products + ' منتج — ' + s.categories.length + ' فئة</small>' +
        '<span class="pd-tag" style="margin-top:4px;">' +
          s.categories.map(function (c) { return ByUI.CATEGORY_LABELS[c] || c; }).slice(0, 2).join('، ') +
        '</span>' +
      '</a>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    $('#bsupSearch').addEventListener('input', function () { search = this.value; render(); });
    render();
    Store.subscribe(render);
  });
})();
