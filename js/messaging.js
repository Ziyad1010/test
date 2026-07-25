(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var conversations = [
    {
      id: 1, name: 'شركة البناء الحديث للمقاولات', online: true, unread: 2,
      messages: [
        { mine: false, text: 'مرحباً، هل يتوفر لديكم حديد تسليح 16مم بكميات كبيرة؟', time: '09:12' },
        { mine: true, text: 'أهلاً بك، نعم متوفر لدينا حالياً 22 طن جاهزة للتسليم.', time: '09:15' },
        { mine: false, text: 'ممتاز، هل يمكن تسريع تسليم الطلب #1023؟', time: '09:20' }
      ]
    },
    {
      id: 2, name: 'مؤسسة الإعمار المتحدة', online: false, unread: 0,
      messages: [
        { mine: false, text: 'شكراً لكم على سرعة التوصيل في الطلب الأخير.', time: 'أمس' },
        { mine: true, text: 'يسعدنا خدمتكم دائماً، بانتظار طلباتكم القادمة.', time: 'أمس' }
      ]
    },
    {
      id: 3, name: 'شركة الرياض للمقاولات العامة', online: true, unread: 1,
      messages: [
        { mine: false, text: 'هل السعر شامل الضريبة أم لا؟', time: '11:40' }
      ]
    },
    {
      id: 4, name: 'مقاولات الخليج المحدودة', online: false, unread: 0,
      messages: [
        { mine: false, text: 'هل يتوفر توصيل إلى الخبر؟', time: 'الاثنين' },
        { mine: true, text: 'نعم، التوصيل متاح لجميع مناطق الشرقية.', time: 'الاثنين' }
      ]
    }
  ];

  var activeId = 1;

  function initials(name) { return name.trim().charAt(0); }

  function renderList() {
    var q = $('#chatSearch').value.trim().toLowerCase();
    var list = conversations.filter(function (c) { return c.name.toLowerCase().indexOf(q) !== -1; });

    $('#chatListItems').innerHTML = list.map(function (c) {
      var last = c.messages[c.messages.length - 1];
      return '<div class="chat-item' + (c.id === activeId ? ' is-active' : '') + '" data-id="' + c.id + '">' +
        '<span class="chat-avatar">' + initials(c.name) + '</span>' +
        '<div class="chat-item-info"><div class="chat-item-name">' + c.name + '</div><div class="chat-item-preview">' + (last ? last.text : '') + '</div></div>' +
        '<div class="chat-item-meta"><span class="chat-item-time">' + (last ? last.time : '') + '</span>' +
        (c.unread ? '<span class="chat-unread">' + c.unread + '</span>' : '') + '</div>' +
      '</div>';
    }).join('');

    $all('.chat-item').forEach(function (el) {
      el.addEventListener('click', function () {
        activeId = parseInt(el.getAttribute('data-id'), 10);
        var convo = conversations.find(function (c) { return c.id === activeId; });
        if (convo) convo.unread = 0;
        renderList();
        renderThread();
      });
    });
  }

  function renderThread() {
    var convo = conversations.find(function (c) { return c.id === activeId; });
    if (!convo) return;

    $('#chatMainHead').innerHTML =
      '<span class="chat-avatar">' + initials(convo.name) + '</span>' +
      '<div><strong>' + convo.name + '</strong><span>' + (convo.online ? 'متصل الآن' : 'غير متصل') + '</span></div>';

    $('#chatMessages').innerHTML = convo.messages.map(function (m) {
      return '<div class="chat-bubble ' + (m.mine ? 'mine' : 'theirs') + '">' + m.text + '<time>' + m.time + '</time></div>';
    }).join('');

    var box = $('#chatMessages');
    box.scrollTop = box.scrollHeight;
  }

  function sendMessage() {
    var input = $('#chatInput');
    var text = input.value.trim();
    if (!text) return;

    var convo = conversations.find(function (c) { return c.id === activeId; });
    if (!convo) return;

    var now = new Date();
    var timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    convo.messages.push({ mine: true, text: text, time: timeStr });
    input.value = '';
    renderThread();
    renderList();

    // Lightweight simulated reply so the thread doesn't feel like a dead end.
    setTimeout(function () {
      convo.messages.push({ mine: false, text: 'تم الاستلام، سنرد عليكم في أقرب وقت. شكراً لتواصلكم مع عمّار.', time: timeStr });
      if (convo.id === activeId) renderThread();
      renderList();
    }, 1200);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderList();
    renderThread();

    $('#chatSearch').addEventListener('input', renderList);
    $('#chatSendBtn').addEventListener('click', sendMessage);
    $('#chatInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendMessage(); });

    $all('[data-attach]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-attach');
        var label = kind === 'image' ? 'إرفاق صورة' : kind === 'file' ? 'إرفاق ملف' : 'تسجيل رسالة صوتية';
        if (window.Shell) Shell.toast(label + ' غير مفعّل في هذه النسخة التجريبية');
      });
    });
  });
})();
