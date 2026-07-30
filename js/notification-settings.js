(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var TYPES = [
    { key: 'order', label: 'طلبات جديدة', desc: 'عند وصول طلب جديد أو تأخر شحن طلب قائم' },
    { key: 'status', label: 'تحديثات الطلبات', desc: 'عند تغيير حالة أي طلب (معالجة، شحن، تسليم)' },
    { key: 'stock', label: 'تنبيهات المخزون', desc: 'عند انخفاض كمية منتج أو نفادها بالكامل' },
    { key: 'invoice', label: 'فواتير مستحقة', desc: 'عند تحصيل فاتورة أو تجاوزها تاريخ الاستحقاق' },
    { key: 'return', label: 'طلبات الإرجاع', desc: 'عند تقديم العميل طلب إرجاع أو البت فيه' },
    { key: 'offer', label: 'تحديثات العروض', desc: 'عند اقتراب انتهاء عرض أو تغيّر أدائه' },
    { key: 'admin', label: 'رسائل إدارية من المنصة', desc: 'تحديثات السياسات والإعلانات الرسمية' }
  ];

  var CHANNELS = [
    { key: 'platform', label: 'داخل المنصة فقط' },
    { key: 'email', label: 'بريد إلكتروني فقط' },
    { key: 'both', label: 'داخل المنصة + بريد إلكتروني' }
  ];

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function render() {
    var settings = Store.getNotificationSettings();

    $('#nsList').innerHTML = TYPES.map(function (t) {
      var s = settings[t.key] || { enabled: true, channel: 'platform' };
      return '<div class="nt-setting-row">' +
        '<div class="nt-setting-info">' +
          '<strong>' + esc(t.label) + '</strong>' +
          '<small>' + esc(t.desc) + '</small>' +
        '</div>' +
        '<div class="nt-setting-controls">' +
          '<select class="pd-filter nt-channel-select" data-channel="' + t.key + '"' + (s.enabled ? '' : ' disabled') + '>' +
            CHANNELS.map(function (c) {
              return '<option value="' + c.key + '"' + (c.key === s.channel ? ' selected' : '') + '>' + esc(c.label) + '</option>';
            }).join('') +
          '</select>' +
          '<label class="ob-toggle">' +
            '<input type="checkbox" data-toggle="' + t.key + '"' + (s.enabled ? ' checked' : '') + ' />' +
            '<span class="ob-toggle-switch"></span>' +
          '</label>' +
        '</div>' +
      '</div>';
    }).join('');

    $all('[data-toggle]', $('#nsList')).forEach(function (box) {
      box.addEventListener('change', function () {
        var key = box.getAttribute('data-toggle');
        var current = Store.getNotificationSettings();
        current[key].enabled = box.checked;
        Store.saveNotificationSettings(current);

        var label = '';
        TYPES.forEach(function (t) { if (t.key === key) label = t.label; });
        toast((box.checked ? 'تم تفعيل ' : 'تم إيقاف ') + '«' + label + '»', box.checked ? 'success' : 'danger');
        render();
      });
    });

    $all('[data-channel]', $('#nsList')).forEach(function (sel) {
      sel.addEventListener('change', function () {
        var key = sel.getAttribute('data-channel');
        var current = Store.getNotificationSettings();
        current[key].channel = sel.value;
        Store.saveNotificationSettings(current);
        toast('تم تحديث طريقة الاستلام', 'success');
      });
    });
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    render();

    $('#nsResetBtn').addEventListener('click', function () {
      if (!window.confirm('استعادة الإعدادات الافتراضية لكل أنواع التنبيهات؟')) return;
      // الحفظ بكائن فارغ يجعل getNotificationSettings يعيد الافتراضيات مدمجة
      Store.saveNotificationSettings({});
      render();
      toast('تمت استعادة الإعدادات الافتراضية', 'success');
    });
  });
})();
