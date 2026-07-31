(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  // الصفوف التي تُقارن — القيمة تُشتق من المنتج
  var ROWS = [
    { label: 'السعر', get: function (p) { return '<strong style="color:var(--primary-600);">' + fmt(ByUI.effectivePrice(p)) + ' ر.س</strong> / ' + esc(p.unit || 'وحدة'); } },
    { label: 'العلامة التجارية', get: function (p) { return esc(p.brand || 'عام'); } },
    { label: 'الفئة', get: function (p) { return esc(ByUI.CATEGORY_LABELS[p.category] || p.category); } },
    { label: 'التقييم', get: function (p) { var r = Buyer.ratingOf(p.id); return ByUI.starsHtml(r.value) + ' ' + r.value; } },
    { label: 'التوفر', get: function (p) {
        var a = ByUI.AVAIL[Store.deriveAvailability(p)];
        return '<span class="pd-avail ' + a.tone + '">' + a.label + '</span>';
      } },
    { label: 'الكمية المتاحة', get: function (p) { return p.stock + ' ' + esc(p.unit || ''); } },
    { label: 'الحد الأدنى للطلب', get: function (p) { return (p.moq || 1) + ' ' + esc(p.unit || ''); } },
    { label: 'الوزن', get: function (p) { return p.weight ? esc(p.weight + ' ' + (p.weightUnit || '')) : '—'; } },
    { label: 'بلد المنشأ', get: function (p) { return esc(p.origin || '—'); } },
    { label: 'المستودع', get: function (p) { return esc(p.warehouse || '—'); } },
    { label: 'خصم الكمية', get: function (p) { return (p.tiers && p.tiers.length) ? 'متاح (' + p.tiers.length + ' شريحة)' : '—'; } }
  ];

  function render() {
    var list = Buyer.compareProducts();
    var wrap = $('#bcmpContent');

    if (list.length < 2) {
      wrap.innerHTML =
        '<div class="by-empty">' +
          '<span class="by-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>' +
          '<strong>' + (list.length === 0 ? 'لم تختر أي منتج للمقارنة' : 'اختر منتجاً آخر على الأقل') + '</strong>' +
          '<p>اضغط على أيقونة المقارنة في بطاقة أي منتج لإضافته هنا — يمكنك مقارنة حتى 4 منتجات معاً.</p>' +
          '<a class="ob-btn-primary" href="buyer-market.html" style="text-decoration:none;margin-top:6px;">تصفّح السوق</a>' +
        '</div>';
      return;
    }

    // جميع الخلايا مبنية من نفس مكوّنات الجداول في لوحة التحكم
    wrap.innerHTML =
      '<div class="pd-table-wrap"><table class="pd-table" style="min-width:' + (200 + list.length * 220) + 'px;">' +
        '<thead><tr><th style="width:190px;">المواصفة</th>' +
          list.map(function (p) {
            return '<th style="min-width:200px;">' +
              '<a href="buyer-product.html?id=' + encodeURIComponent(p.id) + '" style="display:block;text-align:center;">' +
                '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" style="width:100%;max-width:150px;height:96px;object-fit:cover;border-radius:10px;margin:0 auto 8px;display:block;" />' +
                '<span style="color:var(--primary-600);font-weight:700;font-size:0.86rem;">' + esc(p.name) + '</span>' +
              '</a>' +
              '<button type="button" class="pd-bulk-btn danger" data-drop="' + esc(p.id) + '" style="margin-top:8px;width:100%;">إزالة</button>' +
            '</th>';
          }).join('') +
        '</tr></thead>' +
        '<tbody>' +
          ROWS.map(function (r) {
            return '<tr><td><strong>' + esc(r.label) + '</strong></td>' +
              list.map(function (p) { return '<td>' + r.get(p) + '</td>'; }).join('') +
            '</tr>';
          }).join('') +
          '<tr><td><strong>الإجراء</strong></td>' +
            list.map(function (p) {
              var soldOut = Store.deriveAvailability(p) === 'out_of_stock';
              return '<td><button type="button" class="by-add-btn" data-cart="' + esc(p.id) + '"' + (soldOut ? ' disabled' : '') + '>' +
                (soldOut ? 'غير متوفر' : 'أضف للسلة') + '</button></td>';
            }).join('') +
          '</tr>' +
        '</tbody>' +
      '</table></div>';

    $all('[data-drop]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        Buyer.toggleCompare(btn.getAttribute('data-drop'));
        ByUI.toast('أُزيل من المقارنة', 'danger');
      });
    });

    ByUI.bindCardActions(wrap);
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();

    $('#bcmpClear').addEventListener('click', function () {
      Buyer.clearCompare();
      ByUI.toast('تم مسح قائمة المقارنة', 'danger');
    });

    render();
    Store.subscribe(function () { render(); ByUI.refreshChrome(); });
  });
})();
