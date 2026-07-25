(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var faqs = [
    { q: 'كيف أضيف منتجاً جديداً؟', a: 'من صفحة "المنتجات" اضغط على زر "إضافة منتج"، ثم أكمل بيانات المنتج عبر التبويبات الأربعة (معلومات أساسية، التسعير والمخزون، التوصيل والوسائط، خيارات إضافية) واضغط "نشر المنتج".' },
    { q: 'متى يتم تحويل مستحقاتي المالية؟', a: 'يتم تحويل المستحقات أسبوعياً إلى الحساب البنكي المسجل في الإعدادات > الدفع، بعد خصم عمولة المنصة والضريبة المطبقة.' },
    { q: 'كيف أرفع السجل التجاري للتحقق؟', a: 'من صفحة الشركة أو عبر الرابط المباشر لخطوة "السجل التجاري" في التسجيل، ارفع نسخة PDF أو صورة واضحة، وسيتم التحقق خلال 24 ساعة عمل.' },
    { q: 'هل يمكن إضافة أكثر من مستودع؟', a: 'نعم، يمكنك إضافة عدد غير محدود من المستودعات من صفحة "المستودعات"، مع تحديد مستودع رئيسي واحد فقط.' },
    { q: 'كيف أدعو أعضاء فريقي؟', a: 'من صفحة "المستخدمين والصلاحيات" اضغط "دعوة مستخدم"، أدخل البريد الإلكتروني والدور المناسب (مدير، مبيعات، مستودعات، مالية، قراءة فقط).' }
  ];

  var tickets = [
    { id: 'TCK-2041', subject: 'تأخر في مراجعة السجل التجاري', category: 'استفسار عن الفواتير', status: 'open', date: '2026-07-24' },
    { id: 'TCK-2038', subject: 'مشكلة في رفع صور المنتج', category: 'مشكلة تقنية', status: 'resolved', date: '2026-07-20' }
  ];
  var nextTicketId = 2042;

  function renderFaqs() {
    $('#faqList').innerHTML = faqs.map(function (f, i) {
      return '<div class="faq-item" data-index="' + i + '">' +
        '<div class="faq-question">' + f.q + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>' +
        '<div class="faq-answer"><div class="faq-answer-inner">' + f.a + '</div></div>' +
      '</div>';
    }).join('');

    $all('.faq-question').forEach(function (q) {
      q.addEventListener('click', function () { q.closest('.faq-item').classList.toggle('is-open'); });
    });
  }

  function renderTickets() {
    $('#ticketList').innerHTML = tickets.map(function (t) {
      return '<div class="cert-card" style="margin-bottom:10px;">' +
        '<span class="cert-icon" style="background:' + (t.status === 'open' ? 'var(--warning-bg)' : 'var(--success-bg)') + ';color:' + (t.status === 'open' ? 'var(--warning)' : 'var(--success)') + ';">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '</span>' +
        '<div class="cert-info"><strong>' + t.subject + '</strong><small>' + t.id + ' · ' + t.category + ' · ' + t.date + '</small></div>' +
        '<span class="pd-status-pill ' + (t.status === 'open' ? 'draft' : 'active') + '">' + (t.status === 'open' ? 'مفتوحة' : 'تم الحل') + '</span>' +
      '</div>';
    }).join('');
  }

  function initModal() {
    $('#helpNewTicketBtn').addEventListener('click', function () { $('#ticketModalOverlay').hidden = false; });
    $('#ticketModalClose').addEventListener('click', closeModal);
    $('#ticketCancelBtn').addEventListener('click', closeModal);
    $('#ticketModalOverlay').addEventListener('click', function (e) { if (e.target === $('#ticketModalOverlay')) closeModal(); });

    $('#ticketSubmitBtn').addEventListener('click', function () {
      var subject = $('#tkSubject').value.trim();
      var message = $('#tkMessage').value.trim();
      if (!subject || !message) {
        if (window.Shell) Shell.toast('يرجى تعبئة الموضوع وتفاصيل المشكلة', 'danger');
        return;
      }
      tickets.unshift({ id: 'TCK-' + (nextTicketId++), subject: subject, category: $('#tkCategory').value, status: 'open', date: new Date().toISOString().slice(0, 10) });
      renderTickets();
      closeModal();
      if (window.Shell) Shell.toast('تم إرسال التذكرة، سيتواصل معك فريق الدعم قريباً', 'success');
    });
  }

  function closeModal() {
    $('#ticketModalOverlay').hidden = true;
    $('#tkSubject').value = ''; $('#tkMessage').value = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderFaqs();
    renderTickets();
    initModal();

    $('#helpChatBtn').addEventListener('click', function () {
      if (window.Shell) Shell.toast('الدردشة المباشرة غير متاحة في هذه النسخة التجريبية — جرّب "فتح تذكرة جديدة" بدلاً من ذلك');
    });
    $('#helpCallBtn').addEventListener('click', function () {
      if (window.Shell) Shell.toast('يرجى الاتصال على 8001234567 لتحدث مباشرة مع فريق الدعم');
    });
  });
})();
