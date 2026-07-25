(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var ICONS = {
    order: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    stock: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.7" r="1.2"/>',
    review: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'
  };

  var notifications = [
    { id: 1, type: 'order', title: 'طلب جديد #1024', desc: 'شركة البناء الحديث طلبت 100 كيس أسمنت بورتلاندي', time: 'قبل 10 دقائق', unread: true },
    { id: 2, type: 'stock', title: 'تنبيه مخزون منخفض', desc: 'أسمنت بورتلاندي عادي — باقي 8 كيس فقط', time: 'قبل 32 دقيقة', unread: true },
    { id: 3, type: 'message', title: 'رسالة جديدة من مؤسسة الإعمار المتحدة', desc: '"هل يمكن تسريع تسليم الطلب #1023؟"', time: 'قبل ساعة', unread: true },
    { id: 4, type: 'review', title: 'تقييم جديد', desc: 'شركة الرياض للمقاولات قيّمت طلبك بـ 5 نجوم', time: 'قبل 3 ساعات', unread: false },
    { id: 5, type: 'order', title: 'تم تأكيد استلام الطلب #1021', desc: 'مجموعة التطوير العقاري أكدت استلام الشحنة', time: 'اليوم 09:15', unread: false },
    { id: 6, type: 'stock', title: 'نفاد مخزون منتج', desc: 'طوب أسمنتي مصمت 20سم — نفد المخزون بالكامل', time: 'أمس', unread: false },
    { id: 7, type: 'message', title: 'رسالة جديدة من مقاولات الخليج', desc: '"هل يتوفر توصيل إلى الخبر؟"', time: 'أمس', unread: false },
    { id: 8, type: 'review', title: 'تقييم جديد', desc: 'مؤسسة النخبة للمقاولات قيّمت خدمتك بـ 4 نجوم', time: 'قبل يومين', unread: false }
  ];

  var currentFilter = '';

  function renderList() {
    var list = currentFilter ? notifications.filter(function (n) { return n.type === currentFilter; }) : notifications;
    $('#notifEmpty').hidden = list.length > 0;
    $('#notifList').hidden = list.length === 0;

    $('#notifList').innerHTML = list.map(function (n) {
      return '<div class="notif-item' + (n.unread ? ' is-unread' : '') + '" data-id="' + n.id + '">' +
        (n.unread ? '<span class="notif-dot"></span>' : '<span style="width:8px;flex-shrink:0;"></span>') +
        '<span class="notif-icon ' + n.type + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[n.type] + '</svg></span>' +
        '<div class="notif-body"><div class="notif-title">' + n.title + '</div><div class="notif-desc">' + n.desc + '</div></div>' +
        '<span class="notif-time">' + n.time + '</span>' +
      '</div>';
    }).join('');

    $all('.notif-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var n = notifications.find(function (x) { return x.id === parseInt(el.getAttribute('data-id'), 10); });
        if (n && n.unread) { n.unread = false; renderList(); }
      });
    });
  }

  function initTabs() {
    $all('#notifTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#notifTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentFilter = btn.getAttribute('data-type');
        renderList();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    renderList();

    $('#notifMarkAllBtn').addEventListener('click', function () {
      notifications.forEach(function (n) { n.unread = false; });
      renderList();
      if (window.Shell) Shell.toast('تم تحديد جميع الإشعارات كمقروءة', 'success');
    });
  });
})();
