(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  var order = null;

  function orderId() {
    return new URLSearchParams(window.location.search).get('id') || '';
  }

  function arDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ---------------- الترويسة ---------------- */
  function renderHero() {
    $('#cfOrderNo').textContent = order.id;
    $('#cfTrack').href = 'buyer-order-details.html?id=' + encodeURIComponent(order.id);

    // لا خادم بريد أو رسائل هنا؛ نذكر الوجهة بدل ادّعاء إرسال لم يحدث
    var targets = [];
    if (order.phone) targets.push('رسالة نصية على <span dir="ltr">' + esc(order.phone) + '</span>');
    if (order.email) targets.push('بريد إلكتروني إلى <span dir="ltr">' + esc(order.email) + '</span>');

    $('#cfSent').innerHTML = targets.length
      ? 'سيصلك تأكيد الطلب عبر ' + targets.join(' و') + '.'
      : 'أضف بريدك أو جوالك في إعدادات الحساب ليصلك تأكيد الطلبات القادمة.';

    if (order.paymentStatus === 'pending') {
      $('#cfLead').textContent = order.payment === 'الدفع عند الاستلام'
        ? 'طلبك قيد التجهيز — جهّز المبلغ عند وصول المندوب.'
        : 'طلبك محجوز — سيبدأ التجهيز فور تأكيد التحويل البنكي.';
    }
  }

  /* ---------------- الموعد والمسار ---------------- */
  function renderEta() {
    var eta = order.expectedDelivery || order.expectedShipDate;

    $('#cfEta').innerHTML =
      '<strong>' + esc(arDate(eta)) + '</strong>' +
      '<small>سنُبلغك برقم الشحنة فور خروجها من المستودع</small>';

    var steps = [
      { label: 'تم استلام الطلب', done: true },
      { label: 'قيد التجهيز', done: false },
      { label: 'خرج للتوصيل', done: false },
      { label: 'تم التسليم', done: false }
    ];

    $('#cfTimeline').innerHTML = steps.map(function (s, i) {
      return '<div class="by-tl-step' + (s.done ? ' is-done' : '') + '">' +
        '<span class="by-tl-dot">' + (s.done
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : (i + 1)) + '</span>' +
        '<span class="by-tl-label">' + esc(s.label) + '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------------- المنتجات والإجماليات ---------------- */
  function renderItems() {
    $('#cfItems').innerHTML = (order.items || []).map(function (it) {
      var p = Store.getProduct(it.productId);
      return '<div class="by-summary-item">' +
        (p ? '<img src="' + esc(p.img) + '" alt="" />' : '') +
        '<span><b>' + esc(it.name) + '</b><small>' + fmt(it.qty) + ' ' + esc(it.unit || 'وحدة') +
          ' × ' + fmt(it.price) + ' ر.س</small></span>' +
        '<em>' + fmt(it.qty * it.price) + ' ر.س</em>' +
      '</div>';
    }).join('');

    var rows = '';
    if (order.subtotal) rows += '<div class="by-total-row"><span>المجموع</span><span>' + fmt(order.subtotal) + ' ر.س</span></div>';
    if (order.discount) rows += '<div class="by-total-row save"><span>خصم ' + esc(order.promoCode || '') + '</span><span>-' + fmt(order.discount) + ' ر.س</span></div>';
    if (order.shipping !== undefined) rows += '<div class="by-total-row"><span>الشحن</span><span>' + (order.shipping ? fmt(order.shipping) + ' ر.س' : 'مجاني') + '</span></div>';
    if (order.vat) rows += '<div class="by-total-row muted"><span>منها ضريبة القيمة المضافة</span><span>' + fmt(order.vat) + ' ر.س</span></div>';
    rows += '<div class="by-total-row grand"><span>الإجمالي المدفوع</span><span>' + fmt(order.total) + ' ر.س</span></div>';

    $('#cfTotals').innerHTML = rows;
  }

  function renderDetails() {
    var paid = order.paymentStatus === 'paid';

    $('#cfDetails').innerHTML =
      '<div class="by-kv"><span>المستلم</span><b>' + esc(order.customer) + '</b></div>' +
      '<div class="by-kv"><span>الجوال</span><b dir="ltr">' + esc(order.phone || '—') + '</b></div>' +
      '<div class="by-kv"><span>العنوان</span><b>' + esc(order.address || order.city) + '</b></div>' +
      (order.notes ? '<div class="by-kv"><span>ملاحظات</span><b>' + esc(order.notes) + '</b></div>' : '') +
      '<div class="by-kv"><span>طريقة الدفع</span><b>' + esc(order.payment) + '</b></div>' +
      '<div class="by-kv"><span>حالة الدفع</span>' +
        '<b class="' + (paid ? 'is-paid' : 'is-pending') + '">' + (paid ? 'مدفوع' : 'بانتظار الدفع') + '</b></div>' +
      '<a class="by-btn by-btn-outline" href="buyer-invoices.html" style="margin-top:14px;">عرض الفاتورة</a>';
  }

  /* ---------------- دعوة إنشاء الحساب ---------------- */
  function renderNudge() {
    var registered = false;
    try { registered = localStorage.getItem('ammar_user_name') !== null; } catch (e) { /* ignore */ }
    if (registered) return;

    $('#cfNudge').hidden = false;

    $('#cfCreate').addEventListener('click', function () {
      Buyer.saveProfile({ name: order.customer, email: order.email, phone: order.phone, city: order.city });
      ByUI.toast('تم إنشاء حسابك وربط طلبك به', 'success');
      $('#cfNudge').hidden = true;
    });

    $('#cfSkip').addEventListener('click', function () { $('#cfNudge').hidden = true; });
  }

  function renderRelated() {
    var first = (order.items || [])[0];
    if (!first) return;

    var list = Buyer.relatedTo(first.productId, 4);
    if (!list.length) return;

    $('#cfRelatedWrap').hidden = false;
    ByUI.renderProducts($('#cfRelated'), list);
  }

  document.addEventListener('DOMContentLoaded', function () {
    order = Store.getOrder(orderId());

    if (!order) { $('#cfNotFound').hidden = false; return; }

    $('#cfContent').hidden = false;
    renderHero();
    renderEta();
    renderItems();
    renderDetails();
    renderNudge();
    renderRelated();
  });
})();
