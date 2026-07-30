(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.STATUS_META;
  var city = '';
  var from = '';
  var to = '';
  var orders = [];

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function load() {
    orders = Store.getOrders().filter(function (o) {
      if (o.city !== city) return false;
      if (from && o.date < from) return false;
      if (to && o.date > to) return false;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  function render() {
    var revenueOrders = orders.filter(function (o) {
      return ['processing', 'ready', 'shipping', 'delivered'].indexOf(o.status) !== -1;
    });
    var revenue = revenueOrders.reduce(function (s, o) { return s + (o.total || 0); }, 0);

    var customerSet = {};
    orders.forEach(function (o) { customerSet[o.customerId || o.customer] = true; });

    $('#coOrders').textContent = fmt(orders.length);
    $('#coRevenue').textContent = fmt(revenue) + ' ر.س';
    $('#coAov').textContent = fmt(revenueOrders.length ? revenue / revenueOrders.length : 0) + ' ر.س';
    $('#coCustomers').textContent = fmt(Object.keys(customerSet).length);

    // جدول الطلبات — كل صف يفتح تفاصيل الطلب
    $('#coOrdersBody').innerHTML = orders.map(function (o) {
      var meta = S[o.status] || S.pending;
      return '<tr class="ord-row" data-open="' + esc(o.id) + '" tabindex="0">' +
        '<td><span class="ord-id">' + esc(o.id) + '</span></td>' +
        '<td dir="ltr">' + esc(o.date) + '</td>' +
        '<td>' + esc(o.customer) + '</td>' +
        '<td>' + esc(o.district || '—') + '</td>' +
        '<td class="ord-amount">' + fmt(o.total) + ' ر.س</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    $all('#coOrdersBody [data-open]').forEach(function (row) {
      function open() { window.location.href = 'order-details.html?id=' + encodeURIComponent(row.getAttribute('data-open')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // أكثر الأصناف طلباً — كل صنف يفتح صفحة المنتج
    var tally = {};
    revenueOrders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (!tally[it.productId]) tally[it.productId] = { id: it.productId, name: it.name, qty: 0 };
        tally[it.productId].qty += it.qty || 0;
      });
    });

    var topProducts = Object.keys(tally).map(function (k) { return tally[k]; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);

    $('#coTopProducts').innerHTML = topProducts.length
      ? topProducts.map(function (p) {
        var exists = Store.getProduct(p.id);
        var name = exists
          ? '<a class="ord-link" href="product-details.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a>'
          : '<span>' + esc(p.name) + '</span>';
        return '<div class="ord-info-row"><span>' + p.qty + ' وحدة</span>' + name + '</div>';
      }).join('')
      : '<p style="font-size:0.84rem;color:var(--muted);">لا توجد أصناف مسجّلة.</p>';

    // عملاء المدينة — كل عميل يفتح ملفه
    var custTally = {};
    orders.forEach(function (o) {
      var key = o.customerId || o.customer;
      if (!custTally[key]) custTally[key] = { id: key, name: o.customer, orders: 0, spend: 0 };
      custTally[key].orders += 1;
      if (['processing', 'ready', 'shipping', 'delivered'].indexOf(o.status) !== -1) {
        custTally[key].spend += o.total || 0;
      }
    });

    var topCustomers = Object.keys(custTally).map(function (k) { return custTally[k]; })
      .sort(function (a, b) { return b.spend - a.spend; }).slice(0, 6);

    $('#coTopCustomers').innerHTML = topCustomers.map(function (c) {
      return '<div class="ord-info-row"><span>' + c.orders + ' طلب</span>' +
        '<a class="ord-link" href="customer.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.name) + '</a></div>';
    }).join('');
  }

  function exportExcel() {
    var cols = [
      { key: 'id', label: 'رقم الطلب' }, { key: 'date', label: 'التاريخ' },
      { key: 'customer', label: 'العميل' }, { key: 'district', label: 'الحي' },
      { key: 'phone', label: 'الجوال' }, { key: 'payment', label: 'الدفع' },
      { key: 'status', label: 'الحالة' }, { key: 'total', label: 'القيمة' }
    ];

    var header = cols.map(function (c) { return c.label; }).join(',');
    var rows = orders.map(function (o) {
      return cols.map(function (c) {
        var v = c.key === 'status' ? (S[o.status] ? S[o.status].label : o.status) : o[c.key];
        var s = String(v === undefined || v === null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    });

    var blob = new Blob(['﻿' + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'طلبات-' + city + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    toast('تم تصدير ' + orders.length + ' طلب', 'success');
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();

    var params = new URLSearchParams(window.location.search);
    city = params.get('city') || '';
    from = params.get('from') || '';
    to = params.get('to') || '';

    $('#coExportBtn').addEventListener('click', exportExcel);

    setTimeout(function () {
      load();
      $('#coLoading').hidden = true;

      $('#coTitle').textContent = 'طلبات ' + (city || 'المدينة');
      $('#coSubtitle').textContent = (from && to)
        ? 'الفترة من ' + from + ' إلى ' + to
        : 'كل الطلبات المسجّلة';

      if (!orders.length) {
        $('#coEmpty').hidden = false;
        return;
      }

      $('#coContent').hidden = false;
      $('#coExportBtn').hidden = false;
      render();

      Store.subscribe(function () { load(); render(); });
    }, 220);
  });
})();
