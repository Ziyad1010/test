/* ============================================================
   عمّار — طبقة التحديث اللحظي
   ------------------------------------------------------------
   تحديث حقيقي بلا خادم وبلا إعادة تحميل: أي تغيير يجريه المورد
   في تبويب لوحة التحكم يصل إلى تبويب المشتري خلال أجزاء من
   الثانية عبر BroadcastChannel (ويرتد إلى حدث storage في
   المتصفحات التي لا تدعمه).

   ما يُبثّ هو إشعار بالتغيير فقط؛ البيانات نفسها تُقرأ من
   localStorage المشترك، فلا تتضارب النسخ.
   ============================================================ */

window.Live = (function () {
  'use strict';

  var CHANNEL = 'ammar_live';
  var K_SEEN = 'ammar_live_seen';

  var channel = null;
  var listeners = [];
  var lastOrderState = {};

  try {
    if ('BroadcastChannel' in window) channel = new BroadcastChannel(CHANNEL);
  } catch (e) { channel = null; }

  /* ---------------- البثّ والاستقبال ---------------- */
  function broadcast(type, payload) {
    var msg = { type: type, payload: payload, at: Date.now() };

    if (channel) {
      try { channel.postMessage(msg); } catch (e) { /* ignore */ }
    }

    // الارتداد: الكتابة في localStorage تُطلق حدث storage في بقية التبويبات
    try { localStorage.setItem(K_SEEN, JSON.stringify(msg)); } catch (e) { /* ignore */ }
  }

  function dispatch(msg) {
    if (!msg || !msg.type) return;
    listeners.forEach(function (fn) {
      try { fn(msg); } catch (e) { /* لا يُسقط مستمع واحد البقية */ }
    });
  }

  if (channel) {
    channel.onmessage = function (e) { dispatch(e.data); };
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== K_SEEN || !e.newValue) return;
    try { dispatch(JSON.parse(e.newValue)); } catch (err) { /* ignore */ }
  });

  function on(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  /* ---------------- مراقبة طلبات هذا المشتري ----------------
     تلتقط تغيّر الحالة أو رقم التتبّع وتُصدر حدثاً غنياً يمكن
     للصفحة أن تعرضه فوراً. */
  function snapshotOrders() {
    var map = {};
    if (!window.Buyer) return map;

    try {
      Buyer.orders().forEach(function (o) {
        map[o.id] = { status: o.status, tracking: o.tracking ? o.tracking.number : '' };
      });
    } catch (e) { /* ignore */ }

    return map;
  }

  function diffOrders() {
    var next = snapshotOrders();
    var changes = [];

    Object.keys(next).forEach(function (id) {
      var before = lastOrderState[id];
      if (!before) return;                       // طلب جديد لا يُعدّ تغييراً

      if (before.status !== next[id].status) {
        changes.push({ id: id, kind: 'status', from: before.status, to: next[id].status });
      } else if (before.tracking !== next[id].tracking && next[id].tracking) {
        changes.push({ id: id, kind: 'tracking', to: next[id].tracking });
      }
    });

    lastOrderState = next;
    return changes;
  }

  /* ---------------- إشعار منزلق ---------------- */
  function popup(html, href) {
    var el = document.createElement(href ? 'a' : 'div');
    el.className = 'sm-live-toast';
    if (href) el.href = href;
    el.innerHTML =
      '<span class="sm-live-ico">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '</span>' +
      '<span class="sm-live-body">' + html + '</span>' +
      '<span class="sm-live-badge">مباشر</span>';

    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-open'); });

    setTimeout(function () {
      el.classList.remove('is-open');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 6000);
  }

  function statusLabel(status) {
    var meta = Store.STATUS_META && Store.STATUS_META[status];
    return meta ? meta.label : status;
  }

  /* ---------------- التشغيل ---------------- */
  var started = false;

  function start(options) {
    // قد تستدعيها الصفحة وطبقة الهيدر معاً — مستمع واحد يكفي
    if (started) return;
    started = true;

    var opts = options || {};
    lastOrderState = snapshotOrders();

    // أي تغيير في المتجر — من هذا التبويب أو غيره — يُفحص فوراً
    Store.subscribe(function () {
      var changes = diffOrders();
      if (!changes.length) return;

      changes.forEach(function (ch) {
        if (opts.silent) return;

        if (ch.kind === 'status') {
          popup('طلبك <b dir="ltr">' + ch.id + '</b> أصبح: <b>' + statusLabel(ch.to) + '</b>',
            'buyer-order-details.html?id=' + encodeURIComponent(ch.id));
        } else {
          popup('صدر رقم شحنة لطلبك <b dir="ltr">' + ch.id + '</b>',
            'buyer-order-details.html?id=' + encodeURIComponent(ch.id));
        }
      });

      dispatch({ type: 'orders', payload: changes, at: Date.now() });
      broadcast('orders', changes);
    });

    // الوسم الحيّ يؤكد للمستخدم أن الصفحة تستمع فعلاً
    var badge = document.getElementById('bdLive') || document.getElementById('bhLive');
    if (badge) badge.hidden = false;
  }

  return {
    supported: !!channel,
    on: on,
    broadcast: broadcast,
    popup: popup,
    start: start
  };
})();
