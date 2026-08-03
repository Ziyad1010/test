(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  var promoMsg = null;   // رسالة الكود الأخيرة تبقى ظاهرة بعد إعادة الرسم

  function limitsOf(p) {
    return {
      moq: Number(p.moq || 1) || 1,
      max: Number(p.maxPerCustomer || 0),
      stock: Store.deriveAvailability(p) === 'on_demand' ? 0 : Number(p.stock || 0)
    };
  }

  function clamp(p, value) {
    var l = limitsOf(p);
    var q = parseInt(value, 10);
    if (isNaN(q) || q < l.moq) q = l.moq;
    if (l.max && q > l.max) q = l.max;
    if (l.stock && q > l.stock) q = l.stock;
    return q;
  }

  /* ---------------- الحالة الفارغة ---------------- */
  function renderEmpty() {
    $('#bcartSub').textContent = 'سلتك فارغة حالياً';

    $('#bcartContent').innerHTML =
      '<div class="by-empty" style="margin-bottom:26px;">' +
        '<span class="by-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></span>' +
        '<strong>سلة التسوق فارغة</strong>' +
        '<p>تصفّح المنتجات وأضف ما تحتاجه لمشروعك، وستجده هنا محفوظاً حتى لو أغلقت المتصفح.</p>' +
        '<a class="by-btn by-btn-primary" href="buyer-market.html" style="flex:none;">تصفّح السوق</a>' +
      '</div>' +
      '<div class="by-section-head"><div><h2 style="font-size:1.05rem;">قد تحتاج هذه</h2>' +
        '<p>الأكثر طلباً من المقاولين هذا الشهر</p></div></div>' +
      '<div class="by-products" id="bcartSuggest"></div>';

    ByUI.renderProducts($('#bcartSuggest'), Buyer.bestSellers(4));
  }

  /* ---------------- سطر منتج ---------------- */
  function lineHtml(l) {
    var p = l.product;
    var lim = limitsOf(p);
    var avail = Store.deriveAvailability(p);
    var base = ByUI.effectivePrice(p);
    var tiered = l.unitPrice < base;

    var warn = '';
    if (avail === 'out_of_stock') warn = '<span class="by-line-warn is-bad">نفدت الكمية — احذفه لإتمام الطلب</span>';
    else if (lim.stock && l.qty >= lim.stock) warn = '<span class="by-line-warn is-warn">وصلت للحد المتوفر (' + fmt(lim.stock) + ')</span>';
    else if (lim.max && l.qty >= lim.max) warn = '<span class="by-line-warn is-warn">الحد الأقصى لكل عميل ' + fmt(lim.max) + '</span>';

    return '<div class="by-cart-line" data-line="' + esc(p.id) + '">' +
      '<a href="buyer-product.html?id=' + encodeURIComponent(p.id) + '">' +
        '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" />' +
      '</a>' +

      '<div class="by-cart-info">' +
        '<a class="by-cart-name" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a>' +
        '<small>' + esc(p.brand || 'عام') + ' — ' + fmt(l.unitPrice) + ' ر.س / ' + esc(p.unit || 'وحدة') +
          (tiered ? ' <b class="by-tier-save">سعر جملة</b>' : '') + '</small>' +
        warn +
      '</div>' +

      '<div class="by-stepper">' +
        '<button type="button" data-dec="' + esc(p.id) + '" aria-label="إنقاص">−</button>' +
        '<input type="text" data-qty="' + esc(p.id) + '" value="' + l.qty + '" inputmode="numeric" aria-label="كمية ' + esc(p.name) + '" />' +
        '<button type="button" data-inc="' + esc(p.id) + '" aria-label="زيادة">+</button>' +
      '</div>' +

      '<span class="by-cart-line-total">' + fmt(l.lineTotal) + ' ر.س</span>' +

      '<button type="button" class="by-cart-remove" data-del="' + esc(p.id) + '" aria-label="حذف ' + esc(p.name) + '" title="حذف">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
    '</div>';
  }

  /* ---------------- الملخص ---------------- */
  function summaryHtml(sum, city) {
    var promo = Buyer.getPromo();

    return '<div class="by-panel by-summary">' +
      '<h3 class="by-panel-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        'ملخص الطلب' +
      '</h3>' +

      // كود الخصم
      (promo
        ? '<div class="by-promo-applied"><span><b>' + esc(promo.code) + '</b> — ' + esc(promo.label) + '</span>' +
          '<button type="button" id="bcartPromoClear">إزالة</button></div>'
        : '<div class="by-promo">' +
            '<input type="text" id="bcartPromo" placeholder="كود الخصم" dir="ltr" aria-label="كود الخصم" />' +
            '<button type="button" id="bcartPromoApply">تطبيق</button>' +
          '</div>' +
          '<p class="by-promo-hint">جرّب <code>SAVE15</code> أو <code>SHIP0</code></p>') +
      (promoMsg ? '<p class="by-promo-msg ' + (promoMsg.ok ? 'ok' : 'bad') + '">' + esc(promoMsg.text) + '</p>' : '') +

      // تقدير الشحن
      '<div class="by-ship-est">' +
        '<label for="bcartCity">تقدير الشحن إلى</label>' +
        '<select id="bcartCity" aria-label="مدينة التوصيل">' +
          ByUI.CITIES.map(function (c) {
            return '<option value="' + esc(c) + '"' + (c === city ? ' selected' : '') + '>' + esc(c) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="by-totals">' +
        '<div class="by-total-row"><span>المجموع (' + fmt(sum.count) + ' وحدة)</span><span>' + fmt(sum.subtotal) + ' ر.س</span></div>' +
        (sum.discount ? '<div class="by-total-row save"><span>خصم الكود</span><span>-' + fmt(sum.discount) + ' ر.س</span></div>' : '') +
        '<div class="by-total-row"><span>الشحن</span><span>' +
          (sum.shippingFree ? 'مجاني' : fmt(sum.shipping) + ' ر.س') + '</span></div>' +
        (sum.shippingNote ? '<div class="by-total-row muted"><span>' + esc(sum.shippingNote) + '</span><span></span></div>' : '') +
        '<div class="by-total-row muted"><span>منها ضريبة القيمة المضافة ' + (Store.VAT_RATE * 100) + '%</span><span>' + fmt(sum.vat) + ' ر.س</span></div>' +
        '<div class="by-total-row grand"><span>الإجمالي</span><span>' + fmt(sum.total) + ' ر.س</span></div>' +
      '</div>' +

      '<button type="button" class="by-btn by-btn-primary" id="bcartCheckout" style="width:100%;margin-top:16px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>' +
        'إتمام الشراء' +
      '</button>' +
      '<a class="by-btn by-btn-outline" href="buyer-market.html" style="width:100%;margin-top:10px;">متابعة التسوّق</a>' +

      '<div class="by-trust" style="margin-top:16px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        '<span>الدفع مشفّر بالكامل — لا نحتفظ ببيانات بطاقتك</span>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- الرسم ---------------- */
  function render() {
    var lines = Buyer.cartLines();

    if (!lines.length) { renderEmpty(); renderSticky(null); return; }

    var city = ByUI.getCity() || (ByUI.defaultAddress() || {}).city || ByUI.CITIES[0];
    var sum = Buyer.orderSummary(city);

    $('#bcartSub').textContent = fmt(sum.count) + ' وحدة في سلتك — محفوظة تلقائياً';

    $('#bcartContent').innerHTML =
      '<div class="by-cart-grid">' +
        '<div>' +
          '<div class="by-panel">' +
            '<h3 class="by-panel-title">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
              'منتجات السلة' +
              '<button type="button" class="by-link-danger" id="bcartClear" style="margin-inline-start:auto;">إفراغ السلة</button>' +
            '</h3>' +
            lines.map(lineHtml).join('') +
          '</div>' +

          '<div class="by-section-head" style="margin-top:26px;">' +
            '<div><h2 style="font-size:1.02rem;">أضِف قبل أن تُنهي طلبك</h2>' +
            '<p>منتجات يطلبها المقاولون عادةً مع ما في سلتك</p></div>' +
          '</div>' +
          '<div class="by-products" id="bcartCross"></div>' +
        '</div>' +

        summaryHtml(sum, city) +
      '</div>';

    renderCross(lines);
    bind();
    renderSticky(sum);
  }

  // اقتراحات مبنية على أقسام ما في السلة فعلاً
  function renderCross(lines) {
    var inCart = {};
    lines.forEach(function (l) { inCart[l.product.id] = true; });

    var pool = [];
    lines.forEach(function (l) {
      Buyer.relatedTo(l.product.id, 6).forEach(function (p) {
        if (!inCart[p.id] && pool.indexOf(p) === -1) pool.push(p);
      });
    });

    if (!pool.length) pool = Buyer.bestSellers(4);
    ByUI.renderProducts($('#bcartCross'), pool.slice(0, 4));
  }

  function renderSticky(sum) {
    var bar = $('#bcartSticky');
    if (!bar) return;
    bar.hidden = !sum || !sum.count;
    if (!sum || !sum.count) return;
    $('#bcartStickyTotal').textContent = fmt(sum.total) + ' ر.س';
    $('#bcartStickyCount').textContent = fmt(sum.count) + ' وحدة';
  }

  /* ---------------- الأحداث ---------------- */
  function setQty(id, value) {
    var p = Store.getProduct(id);
    if (!p) return;

    var wanted = parseInt(value, 10);
    var next = clamp(p, value);

    if (!isNaN(wanted) && wanted !== next) {
      var l = limitsOf(p);
      if (l.stock && wanted > l.stock) ByUI.toast('المتوفر من هذا المنتج ' + fmt(l.stock) + ' فقط', 'warn');
      else if (l.max && wanted > l.max) ByUI.toast('الحد الأقصى ' + fmt(l.max) + ' لكل عميل', 'warn');
      else if (wanted < l.moq) ByUI.toast('أقل كمية للطلب ' + fmt(l.moq), 'warn');
    }

    Buyer.setCartQty(id, next);   // يستدعي Store.emit فيُعاد الرسم
  }

  function bind() {
    $all('[data-qty]').forEach(function (input) {
      input.addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
      // change وحده يكفي: يُطلق عند المغادرة أو Enter، وإعادة الرسم تُتلف العنصر
      input.addEventListener('change', function () { setQty(input.getAttribute('data-qty'), this.value); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') this.blur(); });
    });

    $all('[data-inc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-inc');
        var current = parseInt($('[data-qty="' + id + '"]').value, 10) || 1;
        setQty(id, current + 1);
      });
    });

    $all('[data-dec]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-dec');
        var current = parseInt($('[data-qty="' + id + '"]').value, 10) || 1;
        setQty(id, current - 1);
      });
    });

    $all('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Buyer.removeFromCart(btn.getAttribute('data-del'));
        ByUI.toast('أُزيل المنتج من السلة', 'danger');
      });
    });

    $('#bcartClear').addEventListener('click', function () {
      if (!window.confirm('إفراغ السلة بالكامل؟')) return;
      Buyer.clearCart();
      ByUI.toast('تم إفراغ السلة', 'danger');
    });

    var applyBtn = $('#bcartPromoApply');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var res = Buyer.applyPromo($('#bcartPromo').value);
        promoMsg = { ok: res.ok, text: res.message };
        if (!res.ok) render();          // الكود المرفوض لا يُطلق حدث المتجر
      });
      $('#bcartPromo').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') applyBtn.click();
      });
    }

    var clearPromoBtn = $('#bcartPromoClear');
    if (clearPromoBtn) {
      clearPromoBtn.addEventListener('click', function () {
        promoMsg = null;
        Buyer.clearPromo();
      });
    }

    $('#bcartCity').addEventListener('change', function () {
      ByUI.setCity(this.value);
      render();
    });

    $('#bcartCheckout').addEventListener('click', goCheckout);
  }

  function goCheckout() {
    var blocked = Buyer.cartLines().filter(function (l) {
      return Store.deriveAvailability(l.product) === 'out_of_stock';
    });

    if (blocked.length) {
      ByUI.toast('احذف المنتجات غير المتوفرة قبل إتمام الشراء', 'danger');
      return;
    }

    window.location.href = 'buyer-checkout.html';
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    render();

    var sticky = $('#bcartStickyBtn');
    if (sticky) sticky.addEventListener('click', goCheckout);

    Store.subscribe(function () { render(); ByUI.refreshChrome(); });
  });
})();
