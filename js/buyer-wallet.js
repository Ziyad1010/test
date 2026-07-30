(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var editingId = '';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function renderSummary() {
    var tx = Buyer.transactions();
    var paid = tx.filter(function (t) { return t.status === 'paid'; });
    var refunded = tx.filter(function (t) { return t.status === 'refunded'; });
    var due = Buyer.invoices().filter(function (i) { return i.status === 'pending' || i.status === 'overdue'; });

    $('#bwaTotalPaid').textContent = fmt(paid.reduce(function (s, t) { return s + t.amount; }, 0)) + ' ر.س';
    $('#bwaTxCount').textContent = tx.length;
    $('#bwaDue').textContent = due.length;
    $('#bwaRefunded').textContent = fmt(refunded.reduce(function (s, t) { return s + t.amount; }, 0)) + ' ر.س';
  }

  function renderCards() {
    var list = Buyer.payments();

    $('#bwaCards').hidden = list.length === 0;
    $('#bwaCardsEmpty').hidden = list.length > 0;
    if (!list.length) return;

    // كل بطاقة قابلة للنقر لعرض/تعديل تفاصيلها
    $('#bwaCards').innerHTML = list.map(function (p) {
      return '<button type="button" class="by-tile' + (p.isDefault ? ' is-default' : '') + '" data-card="' + esc(p.id) + '">' +
        '<div class="by-tile-head">' +
          '<span class="by-card-brand">' + esc(p.brand) + '</span>' +
          '<strong dir="ltr">•••• ' + esc(p.last4) + '</strong>' +
          (p.isDefault ? '<span class="wh-main-badge">افتراضية</span>' : '') +
        '</div>' +
        '<p>' + esc(p.holder) + (p.expiry ? '<br />تنتهي في <span dir="ltr">' + esc(p.expiry) + '</span>' : '') + '</p>' +
      '</button>';
    }).join('');

    $all('[data-card]', $('#bwaCards')).forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(btn.getAttribute('data-card')); });
    });
  }

  function renderTransactions() {
    var tx = Buyer.transactions();

    $('#bwaTxEmpty').hidden = tx.length > 0;
    if (!tx.length) { $('#bwaTx').innerHTML = ''; return; }

    var STATUS = {
      paid: { label: 'مدفوعة', tone: 'ok' },
      refunded: { label: 'مستردّة', tone: 'bad' }
    };

    // كل معاملة قابلة للنقر لعرض تفاصيل الطلب المرتبط بها
    $('#bwaTx').innerHTML = tx.map(function (t) {
      var st = STATUS[t.status] || STATUS.paid;
      return '<tr class="ord-row" data-tx="' + esc(t.orderId) + '" tabindex="0">' +
        '<td><span class="ord-id">' + esc(t.id) + '</span></td>' +
        '<td dir="ltr">' + esc(t.date) + '</td>' +
        '<td><span class="ord-link" dir="ltr">' + esc(t.orderId) + '</span></td>' +
        '<td>' + esc(t.method) + '</td>' +
        '<td class="ord-amount">' + fmt(t.amount) + ' ر.س</td>' +
        '<td><span class="ord-status ' + st.tone + '">' + st.label + '</span></td>' +
      '</tr>';
    }).join('');

    $all('[data-tx]', $('#bwaTx')).forEach(function (row) {
      function open() { window.location.href = 'buyer-order-details.html?id=' + encodeURIComponent(row.getAttribute('data-tx')); }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function openModal(id) {
    editingId = id || '';
    var c = id ? Buyer.payment(id) : null;

    $('#bwaModalTitle').textContent = c ? 'تفاصيل البطاقة' : 'إضافة بطاقة';
    $('#bwaBrand').value = c ? c.brand : '';
    $('#bwaLast4').value = c ? c.last4 : '';
    $('#bwaHolder').value = c ? c.holder : '';
    $('#bwaExpiry').value = c ? (c.expiry || '') : '';
    $('#bwaDefault').checked = c ? !!c.isDefault : false;
    $('#bwaDelete').hidden = !c;
    $('#bwaError').textContent = '';
    $('#bwaOverlay').hidden = false;
  }

  function save() {
    var brand = $('#bwaBrand').value;
    var last4 = $('#bwaLast4').value.trim();
    var holder = $('#bwaHolder').value.trim();

    $('#bwaError').textContent = '';

    if (!brand) { toast('اختر نوع البطاقة', 'danger'); return; }
    if (!/^\d{4}$/.test(last4)) { $('#bwaError').textContent = 'أدخل آخر 4 أرقام'; return; }
    if (holder.length < 3) { toast('أدخل اسم حامل البطاقة', 'danger'); return; }

    Buyer.savePayment({
      id: editingId || undefined,
      brand: brand, last4: last4, holder: holder,
      expiry: $('#bwaExpiry').value.trim(),
      isDefault: $('#bwaDefault').checked
    });

    $('#bwaOverlay').hidden = true;
    render();
    toast(editingId ? 'تم تحديث البطاقة' : 'تمت إضافة البطاقة', 'success');
  }

  function render() {
    renderSummary();
    renderCards();
    renderTransactions();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#bwaAddBtn').addEventListener('click', function () { openModal(''); });
    $('#bwaClose').addEventListener('click', function () { $('#bwaOverlay').hidden = true; });
    $('#bwaCancel').addEventListener('click', function () { $('#bwaOverlay').hidden = true; });
    $('#bwaOverlay').addEventListener('click', function (e) {
      if (e.target === $('#bwaOverlay')) $('#bwaOverlay').hidden = true;
    });
    $('#bwaSave').addEventListener('click', save);

    $('#bwaLast4').addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
    });

    $('#bwaDelete').addEventListener('click', function () {
      if (!window.confirm('حذف طريقة الدفع هذه؟')) return;
      Buyer.removePayment(editingId);
      $('#bwaOverlay').hidden = true;
      render();
      toast('تم حذف البطاقة', 'danger');
    });

    setTimeout(function () {
      $('#bwaLoading').hidden = true;
      $('#bwaContent').hidden = false;
      render();
      Store.subscribe(render);
    }, 220);
  });
})();
