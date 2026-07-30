(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var editingId = '';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function fillCities(keep) {
    var regions = window.SAUDI_REGIONS || [];
    var names = [];
    regions.forEach(function (r) { r.cities.forEach(function (c) { names.push(c.name); }); });

    // بدون ملف المناطق، اعتمد على مدن الطلبات القائمة
    if (!names.length) {
      Store.getOrders().forEach(function (o) { if (o.city && names.indexOf(o.city) === -1) names.push(o.city); });
    }

    $('#baCity').innerHTML = '<option value="">اختر المدينة</option>' +
      names.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    if (keep) $('#baCity').value = keep;
  }

  function render() {
    var list = Buyer.addresses();

    $('#baLoading').hidden = true;
    $('#baGrid').hidden = list.length === 0;
    $('#baEmpty').hidden = list.length > 0;
    if (!list.length) return;

    // كل عنوان قابل للنقر لفتح تفاصيله وتعديله
    $('#baGrid').innerHTML = list.map(function (a) {
      return '<button type="button" class="by-tile' + (a.isDefault ? ' is-default' : '') + '" data-addr="' + esc(a.id) + '">' +
        '<div class="by-tile-head">' +
          '<strong>' + esc(a.label) + '</strong>' +
          (a.isDefault ? '<span class="wh-main-badge">افتراضي</span>' : '') +
        '</div>' +
        '<p>' + esc(a.recipient) + '<br />' +
          esc([a.city, a.district, a.street].filter(Boolean).join(' - ')) +
          (a.buildingNo ? '<br />مبنى ' + esc(a.buildingNo) : '') +
          (a.postalCode ? ' — ' + esc(a.postalCode) : '') +
          '<br /><span dir="ltr">' + esc(a.phone) + '</span></p>' +
      '</button>';
    }).join('');

    $all('[data-addr]', $('#baGrid')).forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(btn.getAttribute('data-addr')); });
    });
  }

  function openModal(id) {
    editingId = id || '';
    var a = id ? Buyer.address(id) : null;

    $('#baModalTitle').textContent = a ? 'تعديل العنوان' : 'إضافة عنوان';
    $('#baLabel').value = a ? a.label : '';
    $('#baRecipient').value = a ? a.recipient : '';
    $('#baPhone').value = a ? a.phone : '';
    $('#baDistrict').value = a ? (a.district || '') : '';
    $('#baStreet').value = a ? (a.street || '') : '';
    $('#baBuildingNo').value = a ? (a.buildingNo || '') : '';
    $('#baPostalCode').value = a ? (a.postalCode || '') : '';
    $('#baDefault').checked = a ? !!a.isDefault : false;
    $('#baDelete').hidden = !a;

    fillCities(a ? a.city : '');

    $('#baLabelError').textContent = '';
    $('#baPhoneError').textContent = '';
    $('#baOverlay').hidden = false;
  }

  function save() {
    var label = $('#baLabel').value.trim();
    var recipient = $('#baRecipient').value.trim();
    var phone = $('#baPhone').value.trim();

    $('#baLabelError').textContent = '';
    $('#baPhoneError').textContent = '';

    if (label.length < 2) { $('#baLabelError').textContent = 'أدخل اسماً للعنوان'; return; }
    if (recipient.length < 3) { toast('أدخل اسم المستلم', 'danger'); return; }
    if (!/^(05\d{8}|5\d{8})$/.test(phone)) {
      $('#baPhoneError').textContent = 'أدخل رقم جوال سعودي صحيح';
      return;
    }
    if (!$('#baCity').value) { toast('اختر المدينة', 'danger'); return; }

    Buyer.saveAddress({
      id: editingId || undefined,
      label: label, recipient: recipient, phone: phone,
      city: $('#baCity').value,
      district: $('#baDistrict').value.trim(),
      street: $('#baStreet').value.trim(),
      buildingNo: $('#baBuildingNo').value.trim(),
      postalCode: $('#baPostalCode').value.trim(),
      isDefault: $('#baDefault').checked
    });

    $('#baOverlay').hidden = true;
    render();
    toast(editingId ? 'تم تحديث العنوان' : 'تمت إضافة العنوان', 'success');
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#baAddBtn').addEventListener('click', function () { openModal(''); });
    $('#baClose').addEventListener('click', function () { $('#baOverlay').hidden = true; });
    $('#baCancel').addEventListener('click', function () { $('#baOverlay').hidden = true; });
    $('#baOverlay').addEventListener('click', function (e) {
      if (e.target === $('#baOverlay')) $('#baOverlay').hidden = true;
    });
    $('#baSave').addEventListener('click', save);

    $('#baPhone').addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
    });

    $('#baDelete').addEventListener('click', function () {
      if (!window.confirm('حذف هذا العنوان؟')) return;
      Buyer.removeAddress(editingId);
      $('#baOverlay').hidden = true;
      render();
      toast('تم حذف العنوان', 'danger');
    });

    setTimeout(function () {
      render();
      Store.subscribe(render);
    }, 220);
  });
})();
