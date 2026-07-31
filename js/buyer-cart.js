(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  function render() {
    var lines = Buyer.cartLines();
    var wrap = $('#bcartContent');

    if (!lines.length) {
      $('#bcartSub').textContent = 'سلتك فارغة حالياً';
      wrap.innerHTML =
        '<div class="by-empty">' +
          '<span class="by-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></span>' +
          '<strong>سلة التسوق فارغة</strong>' +
          '<p>تصفّح المنتجات وأضف ما تحتاجه لمشروعك، وستجده هنا جاهزاً للطلب.</p>' +
          '<a class="ob-btn-primary" href="buyer-market.html" style="text-decoration:none;margin-top:6px;">تصفّح السوق</a>' +
        '</div>';
      return;
    }

    var subtotal = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
    var vat = subtotal * Store.VAT_RATE / (1 + Store.VAT_RATE);
    var count = lines.reduce(function (s, l) { return s + l.qty; }, 0);

    $('#bcartSub').textContent = count + ' منتج في سلتك';

    wrap.innerHTML =
      '<div class="ord-detail-grid">' +
        '<div>' +
          '<div class="ord-card">' +
            '<div class="ord-card-head">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
              '<h3>منتجات السلة</h3>' +
              '<button type="button" class="pd-bulk-btn danger" id="bcartClear">إفراغ السلة</button>' +
            '</div>' +
            '<div style="overflow-x:auto;"><table class="ord-items-table">' +
              '<thead><tr><th>المنتج</th><th>سعر الوحدة</th><th>الكمية</th><th>الإجمالي</th><th></th></tr></thead>' +
              '<tbody>' + lines.map(function (l) {
                return '<tr>' +
                  '<td><div class="ord-item-name">' +
                    '<img src="' + esc(l.product.img) + '" alt="' + esc(l.product.name) + '" />' +
                    '<a class="ord-link" href="buyer-product.html?id=' + encodeURIComponent(l.product.id) + '">' + esc(l.product.name) + '</a>' +
                  '</div></td>' +
                  '<td>' + fmt(l.unitPrice) + ' ر.س<br /><small style="color:var(--muted);">/ ' + esc(l.product.unit || 'وحدة') + '</small></td>' +
                  '<td><input type="text" class="pd-inline" data-qty="' + esc(l.product.id) + '" value="' + l.qty + '" inputmode="numeric" style="width:70px;" /></td>' +
                  '<td><strong>' + fmt(l.lineTotal) + ' ر.س</strong></td>' +
                  '<td><button type="button" class="pd-tier-remove" data-del="' + esc(l.product.id) + '" aria-label="حذف">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                  '</button></td>' +
                '</tr>';
              }).join('') + '</tbody>' +
            '</table></div>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="ord-card">' +
            '<div class="ord-card-head">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
              '<h3>ملخص الطلب</h3>' +
            '</div>' +
            '<div class="ord-totals" style="margin-top:0;border-top:none;padding-top:0;">' +
              '<div class="ord-total-row"><span>عدد المنتجات</span><span>' + count + '</span></div>' +
              '<div class="ord-total-row"><span>المجموع قبل الضريبة</span><span>' + fmt(subtotal - vat) + ' ر.س</span></div>' +
              '<div class="ord-total-row"><span>ضريبة القيمة المضافة (15%)</span><span>' + fmt(vat) + ' ر.س</span></div>' +
              '<div class="ord-total-row grand"><span>الإجمالي</span><span>' + fmt(subtotal) + ' ر.س</span></div>' +
            '</div>' +
            '<div class="ord-actions" style="margin-top:16px;">' +
              '<button type="button" class="ord-action-btn primary" id="bcartCheckout">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
                'إتمام الشراء</button>' +
              '<a class="ord-action-btn" href="buyer-market.html" style="text-decoration:none;">متابعة التسوّق</a>' +
            '</div>' +
          '</div>' +

          '<div class="ord-card">' +
            '<div class="ord-card-head">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
              '<h3>عنوان التوصيل</h3>' +
            '</div>' +
            '<div class="ord-info-list" id="bcartAddress"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    renderAddress();
    bind();
  }

  function renderAddress() {
    var list = Buyer.addresses();
    var def = list.filter(function (a) { return a.isDefault; })[0] || list[0];

    $('#bcartAddress').innerHTML = def
      ? '<div class="ord-info-row"><span>' + esc(def.label) + '</span><span>' + esc(def.recipient) + '</span></div>' +
        '<div class="ord-info-row"><span>العنوان</span><span>' +
          esc([def.city, def.district, def.street].filter(Boolean).join(' - ')) + '</span></div>' +
        '<div class="ord-info-row"><span>الجوال</span><span dir="ltr">' + esc(def.phone) + '</span></div>' +
        '<div class="ord-info-row"><span></span><a class="ord-link" href="buyer-addresses.html">تغيير العنوان</a></div>'
      : '<p style="font-size:0.85rem;color:var(--muted);line-height:1.8;">لم تُضف عنوان شحن بعد — ' +
        '<a class="ord-link" href="buyer-addresses.html">أضف عنواناً الآن</a>.</p>';
  }

  function bind() {
    $all('[data-qty]').forEach(function (input) {
      input.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
      input.addEventListener('blur', function () {
        var qty = parseInt(this.value, 10);
        if (isNaN(qty) || qty < 1) qty = 1;
        Buyer.setCartQty(input.getAttribute('data-qty'), qty);
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') this.blur(); });
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

    $('#bcartCheckout').addEventListener('click', function () {
      var addresses = Buyer.addresses();
      if (!addresses.length) {
        ByUI.toast('أضف عنوان شحن أولاً قبل إتمام الشراء', 'danger');
        setTimeout(function () { window.location.href = 'buyer-addresses.html'; }, 900);
        return;
      }

      // إتمام الشراء الحقيقي يحتاج بوابة دفع وخادماً خلفياً؛ هنا يُسجَّل الطلب
      // في نفس متجر البيانات المشترك فيظهر فوراً لدى المورد وفي "طلباتي".
      var def = addresses.filter(function (a) { return a.isDefault; })[0] || addresses[0];
      var lines = Buyer.cartLines();
      var profile = Buyer.profile();
      var today = new Date().toISOString().slice(0, 10);

      var order = {
        id: 'ORD-' + Date.now().toString().slice(-6),
        date: today,
        createdAt: today + 'T' + new Date().toTimeString().slice(0, 5),
        city: def.city,
        district: def.district || '',
        address: [def.city, def.district, def.street].filter(Boolean).join(' - '),
        customerId: Buyer.buyerId(),
        customer: profile.name,
        email: profile.email || '',
        phone: def.phone || profile.phone || '',
        payment: (Buyer.payments()[0] || {}).brand || 'تحويل بنكي',
        paymentStatus: 'paid',
        status: 'pending',
        items: lines.map(function (l) {
          return {
            productId: l.product.id, name: l.product.name, qty: l.qty,
            price: l.product.price, unit: l.product.unit || '', fulfilled: l.qty
          };
        }),
        total: Math.round(lines.reduce(function (s, l) { return s + l.lineTotal; }, 0) * 100) / 100,
        notes: '',
        expectedShipDate: today,
        tracking: null,
        cancelReason: '',
        returnRequest: null
      };

      Store.placeOrder(order);
      Buyer.clearCart();

      ByUI.toast('تم إرسال طلبك بنجاح — رقم الطلب ' + order.id, 'success');
      setTimeout(function () {
        window.location.href = 'buyer-order-details.html?id=' + encodeURIComponent(order.id);
      }, 1100);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    render();
    Store.subscribe(function () { render(); ByUI.refreshChrome(); });
  });
})();
