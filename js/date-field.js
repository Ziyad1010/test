/* ============================================================
   عمار — حقل تاريخ عربي (يوم / شهر / سنة)
   ------------------------------------------------------------
   لماذا لا نستخدم <input type="date"> الأصلي؟
   المتصفح يرسم تسميات خاناته الداخلية ("يوم/شهر/سنة") داخل Shadow DOM
   لا يخضع لتشكيل الحروف العربية بشكل صحيح على كل الأنظمة، فتظهر الحروف
   معكوسة هكذا: "ةنس/رهش/موي". الحقول النصية العادية في نفس الصفحة تُرسم
   بشكل سليم، لذلك بُني هذا المكوّن من ثلاث خانات نصية عادية.

   الاستخدام:
     <div class="ob-date-group" data-date-for="crIssue">
       <input data-part="day"   ... placeholder="يوم" />
       <span class="ob-date-sep">/</span>
       <input data-part="month" ... placeholder="شهر" />
       <span class="ob-date-sep">/</span>
       <input data-part="year"  ... placeholder="سنة" />
       <input type="hidden" id="crIssue" />
     </div>

   الحقل المخفي يحمل القيمة بصيغة YYYY-MM-DD تماماً كما كان يفعل
   <input type="date">، فلا يحتاج أي كود قائم يقرأ ‎.value إلى تعديل.
   ============================================================ */

(function () {
  'use strict';

  var MAX_LEN = { day: 2, month: 2, year: 4 };
  var MAX_VAL = { day: 31, month: 12 };

  function groups() {
    return Array.prototype.slice.call(document.querySelectorAll('.ob-date-group'));
  }

  function partsOf(group) {
    return {
      day: group.querySelector('[data-part="day"]'),
      month: group.querySelector('[data-part="month"]'),
      year: group.querySelector('[data-part="year"]'),
      hidden: document.getElementById(group.getAttribute('data-date-for'))
    };
  }

  function pad(value, len) {
    var s = String(value);
    while (s.length < len) s = '0' + s;
    return s;
  }

  // A real calendar check, so 30/02 or 31/04 are rejected rather than stored.
  function isRealDate(y, m, d) {
    var dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function compose(group) {
    var p = partsOf(group);
    if (!p.hidden) return;

    var d = parseInt(p.day.value, 10);
    var m = parseInt(p.month.value, 10);
    var y = parseInt(p.year.value, 10);

    var complete = p.year.value.length === 4 && !isNaN(d) && !isNaN(m) && !isNaN(y) && isRealDate(y, m, d);
    var next = complete ? (pad(y, 4) + '-' + pad(m, 2) + '-' + pad(d, 2)) : '';
    if (next === p.hidden.value) return;

    p.hidden.value = next;
    // Surface it as an ordinary field change so existing autosave/validation
    // wiring reacts exactly as it did with the native date input.
    p.hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function split(group) {
    var p = partsOf(group);
    if (!p.hidden) return;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.hidden.value || '');
    if (!m) {
      p.day.value = '';
      p.month.value = '';
      p.year.value = '';
      return;
    }
    p.year.value = m[1];
    p.month.value = String(parseInt(m[2], 10));
    p.day.value = String(parseInt(m[3], 10));
  }

  function wire(group) {
    var p = partsOf(group);
    // Right-to-left reading order: day, then month, then year.
    var order = [p.day, p.month, p.year].filter(Boolean);

    order.forEach(function (input, idx) {
      var part = input.getAttribute('data-part');

      input.addEventListener('input', function () {
        var digits = input.value.replace(/[^0-9]/g, '').slice(0, MAX_LEN[part]);
        if (digits !== input.value) input.value = digits;

        compose(group);

        // Hop to the next box once this one is full, so the whole date can be
        // typed without touching the keyboard's arrow keys.
        if (digits.length === MAX_LEN[part] && idx < order.length - 1) {
          order[idx + 1].focus();
          order[idx + 1].select();
        }
      });

      input.addEventListener('blur', function () {
        var v = parseInt(input.value, 10);
        if (isNaN(v)) {
          input.value = '';
        } else if (MAX_VAL[part]) {
          input.value = String(Math.min(Math.max(v, 1), MAX_VAL[part]));
        }
        compose(group);
      });
    });
  }

  function init() {
    groups().forEach(function (group) {
      wire(group);
      split(group); // pick up any value pre-set on the hidden input
    });
  }

  window.DateField = {
    // Re-read every hidden input and refill its three boxes. Call after
    // restoring saved form state.
    refresh: function () { groups().forEach(split); },

    // Empty a date field by the id of its hidden input.
    clear: function (hiddenId) {
      var el = document.getElementById(hiddenId);
      if (el) el.value = '';
      var group = document.querySelector('.ob-date-group[data-date-for="' + hiddenId + '"]');
      if (group) split(group);
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
