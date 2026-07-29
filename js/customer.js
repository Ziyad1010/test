(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var S = Store.STATUS_META;

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(customer, orders) {
    $('#cuName').textContent = customer.name;
    $('#cuSubtitle').textContent = 'عميل منذ ' + (orders.length ? orders[orders.length - 1].date : '—');

    var revenue = orders.filter(function (o) {
      return ['processing', 'ready', 'shipping', 'delivered'].indexOf(o.status) !== -1;
    });
    var spend = revenue.reduce(function (s, o) { return s + (o.total || 0); }, 0);

    $('#cuOrders').textContent = orders.length;
    $('#cuSpend').textContent = fmt(spend);
    $('#cuAvg').textContent = fmt(revenue.length ? spend / revenue.length : 0);
    $('#cuLast').textContent = orders.length ? orders[0].date : '—';

    $('#cuInfo').innerHTML =
      '<div class="ord-info-row"><span>الاسم</span><span>' + esc(customer.name) + '</span></div>' +
      (customer.phone
        ? '<div class="ord-info-row"><span>الجوال</span><a class="ord-link" href="tel:' + esc(String(customer.phone).replace(/\s/g, '')) + '" dir="ltr">' + esc(customer.phone) + '</a></div>'
        : '') +
      (customer.email
        ? '<div class="ord-info-row"><span>البريد</span><a class="ord-link" href="mailto:' + esc(customer.email) + '" dir="ltr">' + esc(customer.email) + '</a></div>'
        : '') +
      '<div class="ord-info-row"><span>المدينة</span><span>' + esc(customer.city || '—') + '</span></div>';

    // سجل الطلبات — كل صف يفتح تفاصيل الطلب
    $('#cuOrdersBody').innerHTML = orders.map(function (o) {
      var meta = S[o.status] || S.pending;
      return '<tr class="ord-row" data-open="' + esc(o.id) + '" tabindex="0">' +
        '<td><span class="ord-id">' + esc(o.id) + '</span></td>' +
        '<td dir="ltr">' + esc(o.date) + '</td>' +
        '<td>' + (o.items || []).length + '</td>' +
        '<td class="ord-amount">' + fmt(o.total) + ' ر.س</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    Array.prototype.slice.call(document.querySelectorAll('#cuOrdersBody [data-open]')).forEach(function (row) {
      function open() { window.location.href = 'order-details.html?id=' + encodeURIComponent(row.getAttribute('data-open')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // الأصناف الأكثر طلباً لهذا العميل — كل صنف يفتح صفحة المنتج
    var tally = {};
    orders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (!tally[it.productId]) tally[it.productId] = { name: it.name, qty: 0, id: it.productId };
        tally[it.productId].qty += it.qty || 0;
      });
    });

    var top = Object.keys(tally).map(function (k) { return tally[k]; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);

    $('#cuTopItems').innerHTML = top.length
      ? top.map(function (t) {
        var exists = Store.getProduct(t.id);
        var name = exists
          ? '<a class="ord-link" href="product-details.html?id=' + encodeURIComponent(t.id) + '">' + esc(t.name) + '</a>'
          : '<span>' + esc(t.name) + '</span>';
        return '<div class="ord-info-row"><span>' + t.qty + ' وحدة</span>' + name + '</div>';
      }).join('')
      : '<p style="font-size:0.84rem;color:var(--muted);">لا توجد أصناف مسجّلة.</p>';
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    var id = new URLSearchParams(window.location.search).get('id') || '';

    setTimeout(function () {
      var customer = Store.getCustomer(id);
      $('#cuLoading').hidden = true;

      if (!customer) {
        $('#cuNotFound').hidden = false;
        $('#cuSubtitle').textContent = 'العميل غير موجود';
        return;
      }

      var orders = Store.ordersOfCustomer(id).sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });

      $('#cuContent').hidden = false;
      render(customer, orders);
    }, 220);
  });
})();
