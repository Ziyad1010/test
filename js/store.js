/* ============================================================
   عمار — طبقة البيانات المشتركة (Store)
   ------------------------------------------------------------
   مصدر واحد للحقيقة لكل من: المنتجات، الطلبات، العملاء، الإشعارات، الزيارات.
   كل الأرقام في لوحة التحكم (البطاقات والرسوم) تُحسب من هنا بدل أن تكون
   مكتوبة يدوياً، وتتحدث تلقائياً عبر subscribe — وأيضاً بين تبويبات
   المتصفح المفتوحة عبر حدث storage.

   حدود هذه النسخة: لا يوجد خادم خلفي، فالتخزين في localStorage داخل هذا
   المتصفح فقط. لربطها بقاعدة بيانات حقيقية يُستبدل جسم read/write بنداءات
   API دون تغيير أي كود يستهلك الـ Store.
   ============================================================ */

window.Store = (function () {
  'use strict';

  var K_PRODUCTS = 'ammar_products';
  var K_ORDERS = 'ammar_orders';
  var K_VISITS = 'ammar_visits';
  var K_NOTIFS = 'ammar_notifications';
  // نسخة البذرة — رفعها يُعيد توليد البيانات التجريبية بالحقول الجديدة
  var K_SEEDED = 'ammar_store_seeded_v2';

  var listeners = [];

  /* ---------------- حالات الطلب ---------------- */
  var STATUS_META = {
    pending: { label: 'قيد الانتظار', tone: 'warn' },
    processing: { label: 'قيد المعالجة', tone: 'info' },
    ready: { label: 'جاهز للشحن', tone: 'info' },
    shipping: { label: 'قيد التوصيل', tone: 'info' },
    delivered: { label: 'تم التسليم', tone: 'ok' },
    cancelled: { label: 'ملغي', tone: 'bad' },
    returned: { label: 'مرتجع', tone: 'bad' }
  };

  // المسار الطبيعي للطلب — يُستخدم لرسم سجل الحالة (Timeline)
  var STATUS_FLOW = ['pending', 'processing', 'ready', 'shipping', 'delivered'];

  // الحالات التي تُحتسب ضمن الإيراد
  var REVENUE_STATUSES = ['processing', 'ready', 'shipping', 'delivered'];

  /* ---------------- شركات الشحن ----------------
     روابط التتبع هي صفحات التتبع العامة لكل شركة، ويُستبدل {n} برقم البوليصة. */
  var CARRIERS = [
    { key: 'smsa', name: 'سمسا إكسبريس (SMSA)', url: 'https://www.smsaexpress.com/track?tracknumbers={n}' },
    { key: 'aramex', name: 'أرامكس (Aramex)', url: 'https://www.aramex.com/sa/en/track/shipments?ShipmentNumber={n}' },
    { key: 'naqel', name: 'ناقل إكسبريس (Naqel)', url: 'https://www.naqelexpress.com/track?awb={n}' },
    { key: 'spl', name: 'البريد السعودي (سبل)', url: 'https://splonline.com.sa/en/track-shipment/?trackingNumber={n}' },
    { key: 'dhl', name: 'دي إتش إل (DHL)', url: 'https://www.dhl.com/sa-en/home/tracking.html?tracking-id={n}' },
    { key: 'zajil', name: 'زاجل (Zajil)', url: 'https://www.zajil-express.com/track?awb={n}' }
  ];

  function carrierByKey(key) {
    var found = null;
    CARRIERS.forEach(function (c) { if (c.key === key) found = c; });
    return found;
  }

  function trackingUrl(tracking) {
    if (!tracking || !tracking.number) return '';
    var c = carrierByKey(tracking.carrier);
    return c ? c.url.replace('{n}', encodeURIComponent(tracking.number)) : '';
  }

  /* ---------------- منخفض المستوى ---------------- */
  function read(key, fallback) {
    var raw;
    try { raw = localStorage.getItem(key); } catch (e) { return fallback; }
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ممتلئ أو محظور */ }
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* لا تُسقط بقية المشتركين */ }
    });
  }

  /* ---------------- أدوات التاريخ ---------------- */
  var MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isoTime(d) { return iso(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function daysAgo(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }
  function addDays(dateStr, n) {
    var d = parseISO(dateStr);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function todayISO() { return iso(new Date()); }

  function seededRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  /* ---------------- البيانات الأولية ---------------- */
  var SEED_PRODUCTS = [
    { id: 1, name: 'حديد تسليح سعودي 12مم', sku: 'STL-RJ-012', category: 'steel', subcategory: 'حديد تسليح',
      brand: 'حديد الراجحي', price: 2450, unit: 'طن', discount: 0, stock: 50, lowStock: 15, moq: 1,
      weight: 1000, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'auto',
      views: 1240, status: 'active', img: 'assets/images/cat-steel.jpg' },
    { id: 2, name: 'أسمنت بورتلاندي عادي (50كجم)', sku: 'CEM-YM-050', category: 'cement', subcategory: 'أسمنت بورتلاندي',
      brand: 'أسمنت اليمامة', price: 18.5, unit: 'كيس', discount: 5, stock: 8, lowStock: 15, moq: 20,
      weight: 50, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'auto',
      views: 2140, status: 'active', img: 'assets/images/cat-cement.jpg' },
    { id: 3, name: 'خرسانة جاهزة C30', sku: 'RMX-SR-030', category: 'concrete', subcategory: 'خرسانة جاهزة',
      brand: 'الخرسانة السعودية', price: 245, unit: 'م³', discount: 0, stock: 999, lowStock: 0, moq: 6,
      weight: 2400, weightUnit: 'كجم', warehouse: 'مستودع جدة', availability: 'on_demand',
      views: 860, status: 'active', img: 'assets/images/cat-concrete.jpg' },
    { id: 4, name: 'بلاط بورسلين مطفي 60×60', sku: 'TIL-SC-060', category: 'finishing', subcategory: 'بلاط وسيراميك',
      brand: 'الخزف السعودي', price: 42, unit: 'م²', discount: 10, stock: 320, lowStock: 30, moq: 10,
      weight: 18, weightUnit: 'كجم', warehouse: 'مستودع الدمام', availability: 'auto',
      views: 1580, status: 'active', img: 'assets/images/prod-porcelain.jpg' },
    { id: 5, name: 'طوب أسمنتي مصمت 20سم', sku: 'BLK-FZ-020', category: 'blocks', subcategory: 'طوب أسمنتي',
      brand: 'الفوزان لمواد البناء', price: 3.2, unit: 'حبة', discount: 0, stock: 0, lowStock: 500, moq: 500,
      weight: 16, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'auto',
      views: 410, status: 'active', img: 'assets/images/cat-blocks.jpg' },
    { id: 6, name: 'خلاطة خرسانة كهربائية 350 لتر', sku: 'TL-MX-350', category: 'tools', subcategory: 'معدات ثقيلة',
      brand: 'عام', price: 3850, unit: 'حبة', discount: 0, stock: 6, lowStock: 5, moq: 1,
      weight: 210, weightUnit: 'كجم', warehouse: 'مستودع جدة', availability: 'auto',
      views: 320, status: 'active', img: 'assets/images/prod-mixer.jpg' },
    { id: 7, name: 'حديد تسليح سعودي 16مم', sku: 'STL-RJ-016', category: 'steel', subcategory: 'حديد تسليح',
      brand: 'حديد الراجحي', price: 2520, unit: 'طن', discount: 0, stock: 22, lowStock: 15, moq: 1,
      weight: 1000, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'auto',
      views: 980, status: 'active', img: 'assets/images/cat-steel.jpg' },
    { id: 8, name: 'أسمنت مقاوم للكبريتات', sku: 'CEM-AR-SRC', category: 'cement', subcategory: 'أسمنت مقاوم للكبريتات',
      brand: 'أسمنت العربية', price: 21, unit: 'كيس', discount: 0, stock: 0, lowStock: 15, moq: 20,
      weight: 50, weightUnit: 'كجم', warehouse: 'مستودع الدمام', availability: 'auto',
      views: 145, status: 'draft', img: 'assets/images/cat-cement.jpg' }
  ];

  var SEED_CITIES = [
    { name: 'الرياض', weight: 34, districts: ['حي الملز', 'حي النرجس', 'حي العليا', 'حي الياسمين'] },
    { name: 'جدة', weight: 24, districts: ['حي الروضة', 'حي السلامة', 'حي الشاطئ', 'حي النعيم'] },
    { name: 'الدمام', weight: 15, districts: ['حي الفيصلية', 'حي الشاطئ', 'حي النور'] },
    { name: 'مكة المكرمة', weight: 10, districts: ['حي العزيزية', 'حي الشوقية', 'حي النسيم'] },
    { name: 'الخبر', weight: 8, districts: ['حي العقربية', 'حي الثقبة', 'حي الراكة'] },
    { name: 'المدينة المنورة', weight: 5, districts: ['حي قباء', 'حي العوالي', 'حي الخالدية'] },
    { name: 'أبها', weight: 4, districts: ['حي المنسك', 'حي الخالدية', 'حي السد'] }
  ];

  var SEED_BUYERS = [
    { id: 'CUS-1', name: 'مؤسسة الإعمار للمقاولات', email: 'orders@aleamar.sa' },
    { id: 'CUS-2', name: 'شركة البناء المتين', email: 'purchase@almateen.sa' },
    { id: 'CUS-3', name: 'مقاولات الخليج', email: 'info@gulfcon.sa' },
    { id: 'CUS-4', name: 'شركة تعمير الحديثة', email: 'buy@taameer.sa' },
    { id: 'CUS-5', name: 'مؤسسة الأساس الثابت', email: 'contact@alasas.sa' },
    { id: 'CUS-6', name: 'شركة الديار للتطوير', email: 'procurement@aldiyar.sa' },
    { id: 'CUS-7', name: 'مقاولات النخبة', email: 'orders@alnokhba.sa' },
    { id: 'CUS-8', name: 'شركة رواسي البناء', email: 'info@rawasi.sa' }
  ];

  var SEED_PAYMENTS = ['مدى', 'تحويل بنكي', 'Apple Pay', 'فيزا', 'ماستركارد'];

  var SEED_NOTES = [
    '', '', '', '',
    'يرجى التوصيل في الفترة الصباحية قبل الساعة 11.',
    'الرجاء التنسيق مع مهندس الموقع قبل الوصول.',
    'المطلوب فاتورة ضريبية باسم المؤسسة.',
    'يوجد ممر ضيق — يفضّل شاحنة صغيرة.',
    'الرجاء تغليف المنتج جيداً لتفادي التلف.'
  ];

  var CANCEL_REASONS_SEED = ['نفاذ الكمية من المستودع', 'مشكلة في التسعير', 'تعذّر التواصل مع العميل'];
  var RETURN_REASONS_SEED = [
    'المنتج وصل تالفاً',
    'الكمية المستلمة أقل من المطلوبة',
    'المنتج لا يطابق المواصفات المطلوبة',
    'تأخر التوصيل عن الموعد المتفق عليه'
  ];

  function pickWeighted(rnd, list) {
    var total = list.reduce(function (s, x) { return s + x.weight; }, 0);
    var r = rnd() * total;
    for (var i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  // يبني سجل الحالة من تاريخ الطلب حتى حالته النهائية
  function buildHistory(finalStatus, startDate, rnd) {
    var chain;
    if (finalStatus === 'cancelled') chain = ['pending', 'cancelled'];
    else if (finalStatus === 'returned') chain = ['pending', 'processing', 'ready', 'shipping', 'delivered', 'returned'];
    else chain = STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(finalStatus) + 1);

    var d = parseISO(startDate);
    d.setHours(9 + Math.floor(rnd() * 6), Math.floor(rnd() * 60));

    return chain.map(function (s, i) {
      if (i > 0) {
        d = new Date(d.getTime());
        d.setDate(d.getDate() + (rnd() < 0.6 ? 1 : 2));
        d.setHours(9 + Math.floor(rnd() * 8), Math.floor(rnd() * 60));
      }
      return { status: s, at: isoTime(d), note: '' };
    });
  }

  function buildSeedOrders(products) {
    var rnd = seededRandom(20260727);
    var orders = [];
    var counter = 2100;
    var sellable = products.filter(function (p) { return p.status === 'active'; });

    for (var back = 179; back >= 0; back--) {
      var day = daysAgo(back);
      var growth = 0.6 + (179 - back) / 179 * 0.9;
      var weekday = day.getDay();
      var weekendFactor = (weekday === 5 || weekday === 6) ? 0.45 : 1;
      var perDay = Math.round((rnd() * 3 + 1) * growth * weekendFactor);

      for (var i = 0; i < perDay; i++) {
        var itemCount = 1 + Math.floor(rnd() * 3);
        var items = [];
        var total = 0;
        for (var j = 0; j < itemCount; j++) {
          var p = sellable[Math.floor(rnd() * sellable.length)];
          var qty = 1 + Math.floor(rnd() * (p.price > 1000 ? 4 : 60));
          total += p.price * (1 - (p.discount || 0) / 100) * qty;
          items.push({ productId: p.id, name: p.name, qty: qty, price: p.price, unit: p.unit, fulfilled: qty });
        }

        var status;
        if (back <= 1) status = 'pending';
        else if (back <= 3) status = rnd() < 0.5 ? 'processing' : 'ready';
        else if (back <= 6) status = 'shipping';
        else if (rnd() < 0.05) status = 'cancelled';
        else if (rnd() < 0.04) status = 'returned';
        else status = 'delivered';

        var cityRow = pickWeighted(rnd, SEED_CITIES);
        var district = cityRow.districts[Math.floor(rnd() * cityRow.districts.length)];
        var buyer = SEED_BUYERS[Math.floor(rnd() * SEED_BUYERS.length)];
        var dateStr = iso(day);

        // نسبة صغيرة من الطلبات تفشل بسبب الدفع لتغذية تبويب "الطلبات الفاشلة"
        var payFailed = rnd() < 0.03 && status === 'pending';

        var order = {
          id: 'ORD-' + (counter++),
          date: dateStr,
          createdAt: isoTime(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9 + Math.floor(rnd() * 8), Math.floor(rnd() * 60))),
          city: cityRow.name,
          district: district,
          address: cityRow.name + ' - ' + district + ' - شارع رقم ' + (10 + Math.floor(rnd() * 80)),
          customerId: buyer.id,
          customer: buyer.name,
          email: buyer.email,
          phone: '+9665' + String(10000000 + Math.floor(rnd() * 89999999)).slice(0, 8),
          payment: SEED_PAYMENTS[Math.floor(rnd() * SEED_PAYMENTS.length)],
          paymentStatus: payFailed ? 'failed' : (status === 'pending' ? (rnd() < 0.3 ? 'pending' : 'paid') : 'paid'),
          status: status,
          statusHistory: buildHistory(status, dateStr, rnd),
          items: items,
          total: Math.round(total * 100) / 100,
          notes: SEED_NOTES[Math.floor(rnd() * SEED_NOTES.length)],
          expectedShipDate: addDays(dateStr, 2),
          tracking: null,
          cancelReason: status === 'cancelled' ? CANCEL_REASONS_SEED[Math.floor(rnd() * CANCEL_REASONS_SEED.length)] : '',
          returnRequest: null,
          seen: back > 2
        };

        if (status === 'shipping' || status === 'delivered' || status === 'returned') {
          var carrier = CARRIERS[Math.floor(rnd() * CARRIERS.length)];
          order.tracking = { carrier: carrier.key, number: String(100000000 + Math.floor(rnd() * 899999999)) };
        }

        if (status === 'returned') {
          order.returnRequest = {
            reason: RETURN_REASONS_SEED[Math.floor(rnd() * RETURN_REASONS_SEED.length)],
            at: order.statusHistory[order.statusHistory.length - 1].at,
            status: 'pending',
            decision: ''
          };
        }

        orders.push(order);
      }
    }
    return orders;
  }

  function buildSeedVisits() {
    var rnd = seededRandom(88117);
    var visits = {};
    for (var back = 29; back >= 0; back--) {
      var day = daysAgo(back);
      var base = (day.getDay() === 5) ? 180 : 320;
      visits[iso(day)] = Math.round(base + rnd() * 260);
    }
    return visits;
  }

  function ensureSeeded() {
    var seeded = false;
    try { seeded = localStorage.getItem(K_SEEDED) === 'true'; } catch (e) { /* ignore */ }
    if (seeded) return;

    write(K_PRODUCTS, SEED_PRODUCTS);
    write(K_ORDERS, buildSeedOrders(SEED_PRODUCTS));
    write(K_VISITS, buildSeedVisits());
    write(K_NOTIFS, []);
    try { localStorage.setItem(K_SEEDED, 'true'); } catch (e) { /* ignore */ }
  }

  /* ---------------- المنتجات ---------------- */
  function getProducts() { return read(K_PRODUCTS, []); }

  function saveProducts(list) {
    write(K_PRODUCTS, list);
    emit();
  }

  function getProduct(id) {
    var found = null;
    getProducts().forEach(function (p) { if (String(p.id) === String(id)) found = p; });
    return found;
  }

  function nextProductId() {
    var max = 0;
    getProducts().forEach(function (p) { if (p.id > max) max = p.id; });
    return max + 1;
  }

  function deriveAvailability(p) {
    if (p.availability === 'on_demand') return 'on_demand';
    if (!p.stock || p.stock <= 0) return 'out_of_stock';
    if (p.lowStock && p.stock <= p.lowStock) return 'limited';
    return 'in_stock';
  }

  /* ---------------- الطلبات ---------------- */
  function getOrders() { return read(K_ORDERS, []); }
  function saveOrders(list) { write(K_ORDERS, list); emit(); }

  function getOrder(id) {
    var found = null;
    getOrders().forEach(function (o) { if (o.id === id) found = o; });
    return found;
  }

  function updateOrder(id, patch) {
    var orders = getOrders();
    var target = null;
    orders.forEach(function (o) { if (o.id === id) { Object.assign(o, patch); target = o; } });
    if (target) saveOrders(orders);
    return target;
  }

  // طلب معلّق على المخزون: أحد أصنافه كميته المطلوبة أكبر من المتاح
  function isStockHeld(order) {
    if (['delivered', 'cancelled', 'returned'].indexOf(order.status) !== -1) return false;
    var products = getProducts();
    return (order.items || []).some(function (it) {
      var p = null;
      products.forEach(function (x) { if (x.id === it.productId) p = x; });
      if (!p) return false;
      if (deriveAvailability(p) === 'on_demand') return false;
      return (p.stock || 0) < (it.qty || 0);
    });
  }

  // تنفيذ جزئي: بعض الأصناف لم تُجهَّز كاملة
  function isPartial(order) {
    return (order.items || []).some(function (it) {
      return it.fulfilled !== undefined && it.fulfilled < it.qty;
    });
  }

  function isOverdue(order) {
    if (['pending', 'processing', 'ready'].indexOf(order.status) === -1) return false;
    return !!order.expectedShipDate && order.expectedShipDate < todayISO();
  }

  function setOrderStatus(id, status, meta) {
    meta = meta || {};
    var orders = getOrders();
    var target = null;

    orders.forEach(function (o) {
      if (o.id !== id) return;
      target = o;
      o.status = status;
      o.statusHistory = o.statusHistory || [];
      o.statusHistory.push({
        status: status,
        at: isoTime(new Date()),
        note: meta.note || ''
      });
      if (status === 'cancelled' && meta.reason) o.cancelReason = meta.reason;
      if (meta.tracking) o.tracking = meta.tracking;
      if (status !== 'pending') o.seen = true;
    });

    if (!target) return null;
    write(K_ORDERS, orders);

    // إشعار العميل مُسجَّل في سجل الطلب. لا يوجد إرسال بريد/رسالة فعلي
    // بدون خادم خلفي — يتطلب ربط بمزوّد رسائل عند الإطلاق.
    addNotification({
      type: 'status',
      title: 'تحديث حالة الطلب ' + id,
      body: 'تم إشعار العميل «' + target.customer + '» بتغيير الحالة إلى: ' + (STATUS_META[status] ? STATUS_META[status].label : status),
      orderId: id
    });

    emit();
    return target;
  }

  function setTracking(id, carrierKey, number) {
    return updateOrder(id, { tracking: { carrier: carrierKey, number: number } });
  }

  function markOrderSeen(id) {
    var orders = getOrders();
    var changed = false;
    orders.forEach(function (o) { if (o.id === id && !o.seen) { o.seen = true; changed = true; } });
    if (changed) saveOrders(orders);
  }

  function decideReturn(id, decision, reason) {
    var orders = getOrders();
    var target = null;
    orders.forEach(function (o) {
      if (o.id !== id || !o.returnRequest) return;
      target = o;
      o.returnRequest.status = decision;
      o.returnRequest.decision = reason || '';
      o.statusHistory = o.statusHistory || [];
      o.statusHistory.push({
        status: o.status,
        at: isoTime(new Date()),
        note: (decision === 'approved' ? 'تمت الموافقة على طلب الإرجاع' : 'تم رفض طلب الإرجاع') + (reason ? ' — ' + reason : '')
      });
    });
    if (!target) return null;

    write(K_ORDERS, orders);
    addNotification({
      type: 'return',
      title: (decision === 'approved' ? 'قبول' : 'رفض') + ' إرجاع الطلب ' + id,
      body: 'تم إشعار العميل «' + target.customer + '» بالقرار.',
      orderId: id
    });
    emit();
    return target;
  }

  // تسجيل طلب جديد + خصم الكميات من المخزون (مزامنة المخزون)
  function placeOrder(order) {
    var orders = getOrders();
    var products = getProducts();

    (order.items || []).forEach(function (item) {
      var p = null;
      products.forEach(function (x) { if (x.id === item.productId) p = x; });
      if (!p) return;
      p.stock = Math.max(0, (p.stock || 0) - (item.qty || 0));
    });

    order.statusHistory = order.statusHistory || [{ status: order.status || 'pending', at: isoTime(new Date()), note: '' }];
    order.seen = false;
    orders.push(order);

    write(K_ORDERS, orders);
    write(K_PRODUCTS, products);
    addNotification({ type: 'order_new', title: 'طلب جديد ' + order.id, body: 'من ' + order.customer, orderId: order.id });
    emit();
    return order;
  }

  /* ---------------- العملاء ---------------- */
  function getCustomers() {
    var map = {};
    getOrders().forEach(function (o) {
      var key = o.customerId || o.customer;
      if (!map[key]) {
        map[key] = {
          id: o.customerId || key, name: o.customer, email: o.email || '', phone: o.phone || '',
          city: o.city, orders: 0, spend: 0, lastOrder: ''
        };
      }
      var c = map[key];
      c.orders++;
      if (REVENUE_STATUSES.indexOf(o.status) !== -1) c.spend += o.total || 0;
      if (!c.lastOrder || o.date > c.lastOrder) {
        c.lastOrder = o.date;
        c.phone = o.phone || c.phone;
        c.city = o.city || c.city;
      }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function getCustomer(id) {
    var found = null;
    getCustomers().forEach(function (c) { if (c.id === id) found = c; });
    return found;
  }

  function ordersOfCustomer(id) {
    return getOrders().filter(function (o) { return (o.customerId || o.customer) === id; });
  }

  /* ---------------- الإشعارات ---------------- */
  function getNotifications() { return read(K_NOTIFS, []); }

  function addNotification(n) {
    var list = getNotifications();
    list.unshift({
      id: 'N-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: n.type, title: n.title, body: n.body || '', orderId: n.orderId || '',
      at: isoTime(new Date()), read: false
    });
    write(K_NOTIFS, list.slice(0, 100));
  }

  function unseenOrdersCount() {
    return getOrders().filter(function (o) { return !o.seen && o.status === 'pending'; }).length;
  }

  function overdueOrdersCount() {
    return getOrders().filter(isOverdue).length;
  }

  /* ---------------- الزيارات ---------------- */
  function getVisits() { return read(K_VISITS, {}); }

  function recordVisit() {
    var visits = getVisits();
    var today = todayISO();
    visits[today] = (visits[today] || 0) + 1;

    var cutoff = iso(daysAgo(90));
    Object.keys(visits).forEach(function (d) { if (d < cutoff) delete visits[d]; });

    write(K_VISITS, visits);
    emit();
  }

  /* ---------------- مقاييس مشتقة ---------------- */
  function isRevenue(o) { return REVENUE_STATUSES.indexOf(o.status) !== -1; }

  function ordersBetween(fromDate, toDate) {
    var from = iso(fromDate);
    var to = iso(toDate);
    return getOrders().filter(function (o) { return o.date >= from && o.date <= to; });
  }

  function sumTotal(list) {
    return list.reduce(function (s, o) { return s + (o.total || 0); }, 0);
  }

  function pctChange(current, previous) {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  function kpis() {
    var today = new Date();
    var thisWeek = ordersBetween(daysAgo(6), today).filter(isRevenue);
    var prevWeek = ordersBetween(daysAgo(13), daysAgo(7)).filter(isRevenue);

    var all = getOrders();
    var products = getProducts();
    var weeklySales = sumTotal(thisWeek);
    var newOrders = all.filter(function (o) { return o.status === 'pending'; }).length;

    return {
      weeklySales: weeklySales,
      weeklySalesChange: pctChange(weeklySales, sumTotal(prevWeek)),
      newOrders: newOrders,
      newOrdersChange: pctChange(newOrders, prevWeek.length),
      inDelivery: all.filter(function (o) { return o.status === 'shipping'; }).length,
      stockAlerts: products.filter(function (p) {
        return p.status !== 'archived' && (p.stock <= 0 || (p.lowStock > 0 && p.stock <= p.lowStock));
      }).length,
      totalOrders: all.length
    };
  }

  function monthlyRevenue(months) {
    months = months || 6;
    var now = new Date();
    var buckets = [];

    for (var i = months - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTHS_AR[d.getMonth()], total: 0 });
    }

    getOrders().filter(isRevenue).forEach(function (o) {
      var d = parseISO(o.date);
      if (!d) return;
      for (var i = 0; i < buckets.length; i++) {
        if (buckets[i].year === d.getFullYear() && buckets[i].month === d.getMonth()) {
          buckets[i].total += o.total || 0;
          return;
        }
      }
    });

    var last = buckets[buckets.length - 1];
    var prev = buckets[buckets.length - 2];

    return {
      labels: buckets.map(function (b) { return b.label; }),
      values: buckets.map(function (b) { return Math.round(b.total); }),
      total: Math.round(buckets.reduce(function (s, b) { return s + b.total; }, 0)),
      change: pctChange(last ? last.total : 0, prev ? prev.total : 0)
    };
  }

  function topProducts(days, limit) {
    days = days || 30;
    limit = limit || 5;

    var totals = {};
    ordersBetween(daysAgo(days - 1), new Date()).filter(isRevenue).forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (!totals[it.productId]) totals[it.productId] = { name: it.name, revenue: 0, qty: 0 };
        totals[it.productId].revenue += (it.price || 0) * (it.qty || 0);
        totals[it.productId].qty += it.qty || 0;
      });
    });

    var rows = Object.keys(totals).map(function (k) { return totals[k]; });
    rows.sort(function (a, b) { return b.revenue - a.revenue; });
    rows = rows.slice(0, limit);

    return {
      labels: rows.map(function (r) { return r.name; }),
      values: rows.map(function (r) { return Math.round(r.revenue); })
    };
  }

  function ordersByCity(days, limit) {
    days = days || 30;
    limit = limit || 6;

    var counts = {};
    ordersBetween(daysAgo(days - 1), new Date()).forEach(function (o) {
      if (!o.city) return;
      counts[o.city] = (counts[o.city] || 0) + 1;
    });

    var rows = Object.keys(counts).map(function (c) { return { city: c, count: counts[c] }; });
    rows.sort(function (a, b) { return b.count - a.count; });
    rows = rows.slice(0, limit);

    return {
      labels: rows.map(function (r) { return r.city; }),
      values: rows.map(function (r) { return r.count; })
    };
  }

  function visitors(days) {
    days = days || 7;
    var visits = getVisits();
    var labels = [];
    var values = [];

    for (var i = days - 1; i >= 0; i--) {
      var d = daysAgo(i);
      labels.push(DAYS_AR[d.getDay()]);
      values.push(visits[iso(d)] || 0);
    }
    return { labels: labels, values: values, total: values.reduce(function (s, v) { return s + v; }, 0) };
  }

  /* ---------------- الاشتراك ---------------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  window.addEventListener('storage', function (e) {
    if ([K_PRODUCTS, K_ORDERS, K_VISITS, K_NOTIFS].indexOf(e.key) !== -1) emit();
  });

  ensureSeeded();

  return {
    STATUS_META: STATUS_META,
    STATUS_FLOW: STATUS_FLOW,
    CARRIERS: CARRIERS,
    carrierByKey: carrierByKey,
    trackingUrl: trackingUrl,

    getProducts: getProducts,
    getProduct: getProduct,
    saveProducts: saveProducts,
    nextProductId: nextProductId,
    deriveAvailability: deriveAvailability,

    getOrders: getOrders,
    getOrder: getOrder,
    updateOrder: updateOrder,
    setOrderStatus: setOrderStatus,
    setTracking: setTracking,
    markOrderSeen: markOrderSeen,
    decideReturn: decideReturn,
    placeOrder: placeOrder,
    isStockHeld: isStockHeld,
    isPartial: isPartial,
    isOverdue: isOverdue,

    getCustomers: getCustomers,
    getCustomer: getCustomer,
    ordersOfCustomer: ordersOfCustomer,

    getNotifications: getNotifications,
    addNotification: addNotification,
    unseenOrdersCount: unseenOrdersCount,
    overdueOrdersCount: overdueOrdersCount,

    recordVisit: recordVisit,

    kpis: kpis,
    monthlyRevenue: monthlyRevenue,
    topProducts: topProducts,
    ordersByCity: ordersByCity,
    visitors: visitors,

    subscribe: subscribe,
    emit: emit,

    clearAll: function () {
      write(K_PRODUCTS, []);
      write(K_ORDERS, []);
      write(K_VISITS, {});
      write(K_NOTIFS, []);
      emit();
    }
  };
})();
