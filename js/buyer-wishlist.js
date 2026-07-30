(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function render() {
    var list = Buyer.wishlistProducts();

    $('#bwLoading').hidden = true;
    $('#bwGrid').hidden = list.length === 0;
    $('#bwEmpty').hidden = list.length > 0;
    if (!list.length) return;

    $('#bwGrid').innerHTML = list.map(function (p) {
      var eff = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
      var avail = Store.deriveAvailability(p);
      var availLabel = { in_stock: 'متوفر', limited: 'كمية محدودة', out_of_stock: 'غير متوفر', on_demand: 'عند الطلب' }[avail];

      return '<div class="pd-card">' +
        '<div class="pd-card-img-wrap">' +
          '<img class="pd-card-img" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" />' +
          '<span class="pd-card-status active">' + esc(p.brand || 'عام') + '</span>' +
          '<button type="button" class="by-fav-btn is-on" data-remove="' + esc(p.id) + '" aria-label="إزالة من المفضلة">' +
            '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="pd-card-body">' +
          '<a class="pd-card-name" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '" style="color:inherit;text-decoration:none;display:block;">' + esc(p.name) + '</a>' +
          '<div class="pd-card-tags" style="margin-top:8px;"><span class="pd-avail ' + avail + '">' + availLabel + '</span></div>' +
          '<div class="pd-card-price-row">' +
            '<span class="pd-price">' + fmt(eff) + ' ر.س</span>' +
            '<span class="pd-card-sku">/ ' + esc(p.unit || 'وحدة') + '</span>' +
          '</div>' +
          '<a class="btn-full" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '" style="display:block;text-align:center;text-decoration:none;margin-top:6px;">عرض التفاصيل</a>' +
        '</div>' +
      '</div>';
    }).join('');

    $all('[data-remove]', $('#bwGrid')).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        Buyer.toggleWishlist(btn.getAttribute('data-remove'));
        toast('أُزيل من المفضلة', 'danger');
        render();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      render();
      Store.subscribe(render);
    }, 220);
  });
})();
