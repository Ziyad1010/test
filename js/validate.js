/* ============================================================
   عمار — التحقق الفوري من صحة الحقول (Real-time Validation)
   ------------------------------------------------------------
   الاستخدام:
     Validate.attach(document.getElementById('mainMobile'), 'mobileSA');
     Validate.attach(el, 'text', { required: true, label: 'اسم الشركة' });
     Validate.attachAll(scopeEl);   // يقرأ data-validate من الـ HTML
     Validate.isValid(scopeEl);     // يتحقق من كل الحقول ويُظهر الأخطاء

   يعرض رسالة الخطأ أسفل الحقل مباشرة أثناء الكتابة، ويمنع إدخال
   المحارف غير المسموح بها في الحقول الرقمية بدل رفضها لاحقاً.
   ============================================================ */

window.Validate = (function () {
  'use strict';

  /* ---------------- القواعد ---------------- */
  var RULES = {
    // جوال سعودي: 05XXXXXXXX (10 أرقام) أو 5XXXXXXXX (9 أرقام) بعد مفتاح +966
    mobileSA: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 10); },
      test: function (v) { return /^(05\d{8}|5\d{8})$/.test(v); },
      message: 'أدخل رقم جوال سعودي صحيح (مثال: 512345678 أو 0512345678)'
    },

    // هاتف أرضي سعودي: مفتاح المدينة + 7 أرقام
    landlineSA: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 10); },
      test: function (v) { return /^(0?1[1-7]\d{7})$/.test(v); },
      message: 'أدخل رقم هاتف أرضي صحيح (مثال: 112345678)'
    },

    email: {
      sanitize: function (v) { return v.replace(/\s/g, ''); },
      test: function (v) { return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v); },
      message: 'صيغة البريد الإلكتروني غير صحيحة (مثال: info@example.sa)'
    },

    // السجل التجاري السعودي: 10 أرقام
    crNumber: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 10); },
      test: function (v) { return /^\d{10}$/.test(v); },
      message: 'رقم السجل التجاري يجب أن يتكوّن من 10 أرقام'
    },

    // الرقم الضريبي (ضريبة القيمة المضافة): 15 رقماً يبدأ وينتهي بـ 3
    vatNumber: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 15); },
      test: function (v) { return /^3\d{13}3$/.test(v); },
      message: 'الرقم الضريبي يجب أن يتكوّن من 15 رقماً ويبدأ وينتهي بالرقم 3'
    },

    // الرمز البريدي السعودي: 5 أرقام
    postalCode: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 5); },
      test: function (v) { return /^\d{5}$/.test(v); },
      message: 'الرمز البريدي يجب أن يتكوّن من 5 أرقام'
    },

    // رقم المبنى: 4 أرقام حسب العنوان الوطني
    buildingNo: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 4); },
      test: function (v) { return /^\d{4}$/.test(v); },
      message: 'رقم المبنى يجب أن يتكوّن من 4 أرقام'
    },

    // نص عام: حروف عربية/إنجليزية وأرقام ومسافات وعلامات ترقيم بسيطة فقط.
    // النطاق ؀-ۿ يغطي الكتلة العربية كاملة (ومنها الفاصلة العربية ،)
    // ومكتوب بترميز يونيكود صريح لضمان التوافق مع كل المحرّكات.
    text: {
      sanitize: function (v) { return v.replace(/[^\u0600-\u06FFa-zA-Z0-9\s\-_.,()&\/]/g, ''); },
      test: function (v) { return v.length >= 2; },
      message: 'أدخل نصاً صحيحاً (حرفان على الأقل، بدون رموز غير مسموح بها)'
    },

    // عدد صحيح موجب
    integer: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, ''); },
      test: function (v) { return /^\d+$/.test(v); },
      message: 'أدخل رقماً صحيحاً موجباً'
    },

    // رقم عشري (السعر، الكمية، الوزن) — أرقام وفاصلة عشرية واحدة فقط
    decimal: {
      sanitize: function (v) {
        var cleaned = v.replace(/[^0-9.]/g, '');
        var parts = cleaned.split('.');
        return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
      },
      test: function (v) { return /^\d+(\.\d{1,3})?$/.test(v) && parseFloat(v) >= 0; },
      message: 'أدخل رقماً صحيحاً (أرقام وفاصلة عشرية فقط)'
    },

    // باركود / GTIN: 8 إلى 14 رقماً
    barcode: {
      sanitize: function (v) { return v.replace(/[^0-9]/g, '').slice(0, 14); },
      test: function (v) { return /^\d{8,14}$/.test(v); },
      message: 'الباركود يجب أن يتكوّن من 8 إلى 14 رقماً'
    },

    // رمز SKU / MPN: حروف وأرقام وشرطات
    code: {
      sanitize: function (v) { return v.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase().slice(0, 32); },
      test: function (v) { return /^[A-Z0-9\-_]{2,32}$/.test(v); },
      message: 'الرمز يقبل حروفاً إنجليزية وأرقاماً وشرطات فقط'
    }
  };

  /* ---------------- عرض الخطأ ---------------- */
  function fieldWrap(input) {
    return input.closest('.ob-field, .pd-field') || input.parentNode;
  }

  function errorEl(input, create) {
    var wrap = fieldWrap(input);
    if (!wrap) return null;
    var el = wrap.querySelector('.field-error');
    if (!el && create) {
      el = document.createElement('span');
      el.className = 'field-error';
      wrap.appendChild(el);
    }
    return el;
  }

  function showError(input, message) {
    var el = errorEl(input, true);
    if (el) el.textContent = message;
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    var el = errorEl(input, false);
    if (el) el.textContent = '';
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  }

  /* ---------------- المنطق ---------------- */
  function check(input, silent) {
    var ruleName = input.getAttribute('data-validate');
    var rule = RULES[ruleName];
    if (!rule) return true;

    var required = input.hasAttribute('data-required') || input.hasAttribute('required');
    var value = (input.value || '').trim();

    if (!value) {
      if (required) {
        if (!silent) showError(input, 'هذا الحقل مطلوب');
        return false;
      }
      clearError(input);
      return true; // حقل اختياري فارغ = صحيح
    }

    if (!rule.test(value)) {
      if (!silent) showError(input, input.getAttribute('data-message') || rule.message);
      return false;
    }

    clearError(input);
    return true;
  }

  function attach(input, ruleName, opts) {
    if (!input) return;
    opts = opts || {};
    if (ruleName) input.setAttribute('data-validate', ruleName);
    if (opts.required) input.setAttribute('data-required', '');
    if (opts.message) input.setAttribute('data-message', opts.message);
    if (input.getAttribute('data-validate-bound') === 'true') return;
    input.setAttribute('data-validate-bound', 'true');

    var rule = RULES[input.getAttribute('data-validate')];

    input.addEventListener('input', function () {
      // امنع المحارف غير المسموح بها أثناء الكتابة بدل رفضها بعد الإرسال
      if (rule && rule.sanitize) {
        var cleaned = rule.sanitize(input.value);
        if (cleaned !== input.value) {
          var pos = input.selectionStart;
          var removed = input.value.length - cleaned.length;
          input.value = cleaned;
          try { input.setSelectionRange(Math.max(0, pos - removed), Math.max(0, pos - removed)); } catch (e) { /* ignore */ }
        }
      }
      // لا تُزعج المستخدم بخطأ قبل أن يُكمل الكتابة — أظهره فقط إن كان الحقل
      // معلّماً كخطأ أصلاً، أو صار صالحاً الآن.
      if (input.classList.contains('is-invalid')) check(input);
      else if (check(input, true)) clearError(input);
    });

    input.addEventListener('blur', function () { check(input); });
  }

  function attachAll(scope) {
    var root = scope || document;
    Array.prototype.slice.call(root.querySelectorAll('[data-validate]')).forEach(function (input) {
      attach(input, null, {});
    });
  }

  function isValid(scope) {
    var root = scope || document;
    var inputs = Array.prototype.slice.call(root.querySelectorAll('[data-validate]'));
    var ok = true;
    var first = null;

    inputs.forEach(function (input) {
      // تجاهل الحقول المخفية (تبويب غير معروض مثلاً) إن كانت اختيارية وفارغة
      if (!check(input)) {
        ok = false;
        if (!first) first = input;
      }
    });

    if (first && first.focus) {
      try { first.focus(); } catch (e) { /* ignore */ }
    }
    return ok;
  }

  return {
    rules: RULES,
    attach: attach,
    attachAll: attachAll,
    check: check,
    isValid: isValid,
    showError: showError,
    clearError: clearError
  };
})();
