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
  var K_NOTIF_SETTINGS = 'ammar_notification_settings';
  var K_INVOICES = 'ammar_invoices';
  var K_REPORT_HISTORY = 'ammar_report_history';
  var K_REPORT_SCHEDULES = 'ammar_report_schedules';
  var K_COMPANY = 'ammar_company_profile';
  var K_DOCUMENTS = 'ammar_company_documents';
  var K_AUDIT = 'ammar_audit_log';
  var K_USERS = 'ammar_users';
  var K_ROLES = 'ammar_custom_roles';
  var K_ACTIVITY = 'ammar_user_activity';
  var K_SETTINGS = 'ammar_settings';
  var K_BANKS = 'ammar_bank_accounts';
  // نسخة البذرة — رفعها يُعيد توليد البيانات التجريبية بالحقول الجديدة
  var K_SEEDED = 'ammar_store_seeded_v3';

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
    write(K_INVOICES, []);

    // إشعارات مبدئية للأنواع التي لا تُولَّد تلقائياً من حالة البيانات
    write(K_NOTIFS, [
      { id: 'N-seed-3', type: 'admin', title: 'تحديث سياسة العمولة', priority: 'normal',
        body: 'تم تحديث جدول عمولات المنصة اعتباراً من الشهر القادم — راجع التفاصيل في مركز المساعدة.',
        link: 'help.html', at: isoTime(daysAgo(2)), read: false },
      { id: 'N-seed-2', type: 'offer', title: 'انتهاء عرض قريباً', priority: 'normal',
        body: 'عرض "خصم كميات الجملة" ينتهي خلال 3 أيام — جدّده أو أنشئ عرضاً بديلاً.',
        link: 'offers.html', at: isoTime(daysAgo(1)), read: false },
      { id: 'N-seed-1', type: 'admin', title: 'اكتمل توثيق حسابك كمورد', priority: 'normal',
        body: 'تهانينا! أصبح حسابك موثقاً ويظهر بشارة "مورد موثّق" للمشترين.',
        link: 'company.html', at: isoTime(daysAgo(5)), read: true }
    ]);

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

  /* ---------------- الفواتير ----------------
     تُولَّد تلقائياً من الطلبات: كل طلب تجاوز مرحلة "قيد الانتظار" تُصدر له
     فاتورة. الفواتير تُحفظ بشكل مستقل حتى لا تُفقد إجراءات البائع عليها
     (تحصيل، تذكير، إشعار دائن) عند إعادة المزامنة. */
  var INVOICE_STATUS = {
    paid: { label: 'مدفوعة', tone: 'ok' },
    pending: { label: 'معلقة', tone: 'warn' },
    overdue: { label: 'متأخرة', tone: 'bad' },
    cancelled: { label: 'ملغاة', tone: 'bad' }
  };

  var INVOICE_TERMS_DAYS = 7;   // مهلة السداد من تاريخ الإصدار
  var VAT_RATE = 0.15;

  function getInvoicesRaw() { return read(K_INVOICES, []); }
  function saveInvoices(list) { write(K_INVOICES, list); }

  function invoiceStatusFor(inv, order) {
    if (inv.statusOverride) return inv.statusOverride;
    if (order && order.status === 'cancelled') return 'cancelled';
    if (order && order.paymentStatus === 'paid' && ['delivered', 'shipping'].indexOf(order.status) !== -1) return 'paid';
    if (inv.due < todayISO()) return 'overdue';
    return 'pending';
  }

  // ينشئ الفواتير الناقصة ويحدّث حالاتها المشتقة من الطلبات
  function ensureInvoices() {
    var orders = getOrders();
    var invoices = getInvoicesRaw();
    var byOrder = {};
    invoices.forEach(function (i) { byOrder[i.orderId] = i; });

    var counter = 3000 + invoices.length;
    var changed = false;

    orders.forEach(function (o) {
      if (o.status === 'pending') return;           // لم يُقبل الطلب بعد
      if (byOrder[o.id]) return;

      var inv = {
        id: 'INV-' + (counter++),
        orderId: o.id,
        customerId: o.customerId || o.customer,
        customer: o.customer,
        email: o.email || '',
        phone: o.phone || '',
        address: o.address || '',
        city: o.city || '',
        taxNo: '31' + String(o.id).replace(/\D/g, '').padStart(13, '0'),
        issue: o.date,
        due: addDays(o.date, INVOICE_TERMS_DAYS),
        amount: o.total,
        payment: o.payment,
        items: (o.items || []).map(function (it) {
          return { name: it.name, qty: it.qty, price: it.price, unit: it.unit || '', productId: it.productId };
        }),
        statusOverride: '',
        sentAt: isoTime(parseISO(o.date) || new Date()),
        reminders: [],
        creditNotes: []
      };
      invoices.push(inv);
      byOrder[o.id] = inv;
      changed = true;
    });

    if (changed) saveInvoices(invoices);
    return invoices;
  }

  function getInvoices() {
    var orders = {};
    getOrders().forEach(function (o) { orders[o.id] = o; });

    return ensureInvoices().map(function (inv) {
      var copy = Object.assign({}, inv);
      copy.status = invoiceStatusFor(inv, orders[inv.orderId]);
      copy.creditTotal = (inv.creditNotes || []).reduce(function (s, c) { return s + (c.amount || 0); }, 0);
      copy.netAmount = Math.max(0, inv.amount - copy.creditTotal);
      return copy;
    });
  }

  function getInvoice(id) {
    var found = null;
    getInvoices().forEach(function (i) { if (i.id === id) found = i; });
    return found;
  }

  function updateInvoice(id, patch) {
    var list = getInvoicesRaw();
    var target = null;
    list.forEach(function (i) { if (i.id === id) { Object.assign(i, patch); target = i; } });
    if (target) { saveInvoices(list); emit(); }
    return target;
  }

  function markInvoicePaid(id) {
    var inv = updateInvoice(id, { statusOverride: 'paid' });
    if (inv) {
      addNotification({
        type: 'invoice', title: 'تم تحصيل الفاتورة ' + id,
        body: 'من العميل «' + inv.customer + '»', link: 'invoice-details.html?id=' + id
      });
    }
    return inv;
  }

  function cancelInvoice(id, reason) {
    return updateInvoice(id, { statusOverride: 'cancelled', cancelReason: reason || '' });
  }

  // إشعار دائن — للاسترجاع أو الإلغاء الجزئي لطلب مرتبط بفاتورة سابقة
  function addCreditNote(id, amount, reason) {
    var list = getInvoicesRaw();
    var target = null;
    list.forEach(function (i) {
      if (i.id !== id) return;
      target = i;
      i.creditNotes = i.creditNotes || [];
      i.creditNotes.push({
        id: 'CN-' + (i.creditNotes.length + 1) + '-' + i.id.replace('INV-', ''),
        amount: amount,
        reason: reason || '',
        at: isoTime(new Date())
      });
    });
    if (!target) return null;

    saveInvoices(list);
    addNotification({
      type: 'invoice', title: 'إشعار دائن على الفاتورة ' + id,
      body: 'بقيمة ' + amount + ' ر.س — ' + (reason || 'بدون سبب محدد'),
      link: 'invoice-details.html?id=' + id
    });
    emit();
    return target;
  }

  // تذكير العميل بالسداد. لا يوجد إرسال فعلي بدون خادم خلفي — يُسجَّل هنا فقط.
  function remindInvoice(id) {
    var list = getInvoicesRaw();
    var target = null;
    list.forEach(function (i) {
      if (i.id !== id) return;
      target = i;
      i.reminders = i.reminders || [];
      i.reminders.push({ at: isoTime(new Date()) });
    });
    if (!target) return null;
    saveInvoices(list);
    emit();
    return target;
  }

  function invoiceSummary() {
    var invoices = getInvoices();
    var now = new Date();
    var monthPrefix = now.getFullYear() + '-' + pad(now.getMonth() + 1);

    var issuedThisMonth = invoices.filter(function (i) {
      return i.issue.indexOf(monthPrefix) === 0 && i.status !== 'cancelled';
    });

    return {
      count: invoices.length,
      issuedThisMonth: issuedThisMonth.length,
      issuedThisMonthAmount: issuedThisMonth.reduce(function (s, i) { return s + i.netAmount; }, 0),
      collected: invoices.filter(function (i) { return i.status === 'paid'; })
        .reduce(function (s, i) { return s + i.netAmount; }, 0),
      outstanding: invoices.filter(function (i) { return i.status === 'pending' || i.status === 'overdue'; })
        .reduce(function (s, i) { return s + i.netAmount; }, 0),
      overdueCount: invoices.filter(function (i) { return i.status === 'overdue'; }).length,
      overdueAmount: invoices.filter(function (i) { return i.status === 'overdue'; })
        .reduce(function (s, i) { return s + i.netAmount; }, 0)
    };
  }

  /* ---------------- الإشعارات ---------------- */
  var NOTIFICATION_TYPES = {
    order: { label: 'طلبات جديدة', icon: 'order' },
    stock: { label: 'تنبيهات المخزون', icon: 'stock' },
    invoice: { label: 'فواتير مستحقة', icon: 'invoice' },
    offer: { label: 'تحديثات العروض', icon: 'offer' },
    admin: { label: 'رسائل إدارية', icon: 'admin' },
    status: { label: 'تحديثات الطلبات', icon: 'order' },
    return: { label: 'طلبات الإرجاع', icon: 'order' }
  };

  var DEFAULT_NOTIF_SETTINGS = {
    order: { enabled: true, channel: 'both' },
    stock: { enabled: true, channel: 'both' },
    invoice: { enabled: true, channel: 'email' },
    offer: { enabled: true, channel: 'platform' },
    admin: { enabled: true, channel: 'platform' },
    status: { enabled: true, channel: 'platform' },
    return: { enabled: true, channel: 'both' }
  };

  function getNotificationSettings() {
    var saved = read(K_NOTIF_SETTINGS, null);
    if (!saved) return JSON.parse(JSON.stringify(DEFAULT_NOTIF_SETTINGS));
    var merged = JSON.parse(JSON.stringify(DEFAULT_NOTIF_SETTINGS));
    Object.keys(saved).forEach(function (k) {
      if (merged[k]) merged[k] = Object.assign(merged[k], saved[k]);
    });
    return merged;
  }

  function saveNotificationSettings(settings) {
    write(K_NOTIF_SETTINGS, settings);
    emit();
  }

  function getNotifications() { return read(K_NOTIFS, []); }

  function addNotification(n) {
    // احترم إعدادات البائع — النوع المعطّل لا يُسجَّل أصلاً
    var settings = getNotificationSettings();
    if (settings[n.type] && settings[n.type].enabled === false) return;

    var list = getNotifications();
    list.unshift({
      id: 'N-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: n.type,
      title: n.title,
      body: n.body || '',
      orderId: n.orderId || '',
      link: n.link || (n.orderId ? 'order-details.html?id=' + n.orderId : ''),
      priority: n.priority || 'normal',
      at: isoTime(new Date()),
      read: false
    });
    write(K_NOTIFS, list.slice(0, 200));
  }

  function markNotificationRead(id) {
    var list = getNotifications();
    var changed = false;
    list.forEach(function (n) { if (n.id === id && !n.read) { n.read = true; changed = true; } });
    if (changed) { write(K_NOTIFS, list); emit(); }
  }

  function markAllNotificationsRead() {
    var list = getNotifications();
    list.forEach(function (n) { n.read = true; });
    write(K_NOTIFS, list);
    emit();
  }

  function unreadNotificationsCount() {
    return getNotifications().filter(function (n) { return !n.read; }).length;
  }

  // إشعارات مشتقة من الحالة الحالية (مخزون نافد، فواتير متأخرة، طلبات متأخرة)
  // تُبنى عند الطلب بدل تخزينها حتى تبقى صادقة دائماً مع البيانات.
  function liveAlerts() {
    var settings = getNotificationSettings();
    var out = [];

    if (settings.stock.enabled) {
      getProducts().forEach(function (p) {
        if (p.status === 'archived') return;
        if (p.stock <= 0) {
          out.push({
            id: 'LIVE-stock-out-' + p.id, type: 'stock', priority: 'high',
            title: 'نفاد مخزون: ' + p.name,
            body: 'المنتج غير متاح للبيع حالياً — أعد تعبئة المخزون فوراً.',
            link: 'product-details.html?id=' + p.id, at: isoTime(new Date()), read: false, live: true
          });
        } else if (p.lowStock > 0 && p.stock <= p.lowStock) {
          out.push({
            id: 'LIVE-stock-low-' + p.id, type: 'stock', priority: 'normal',
            title: 'مخزون منخفض: ' + p.name,
            body: 'باقي ' + p.stock + ' ' + (p.unit || 'وحدة') + ' فقط.',
            link: 'product-details.html?id=' + p.id, at: isoTime(new Date()), read: false, live: true
          });
        }
      });
    }

    if (settings.invoice.enabled) {
      getInvoices().forEach(function (i) {
        if (i.status !== 'overdue') return;
        out.push({
          id: 'LIVE-inv-' + i.id, type: 'invoice', priority: 'high',
          title: 'فاتورة متأخرة: ' + i.id,
          body: 'مستحقة على «' + i.customer + '» بقيمة ' + Math.round(i.netAmount) + ' ر.س — تجاوزت تاريخ ' + i.due,
          link: 'invoice-details.html?id=' + i.id, at: isoTime(new Date()), read: false, live: true
        });
      });
    }

    if (settings.order.enabled) {
      getOrders().forEach(function (o) {
        if (isOverdue(o)) {
          out.push({
            id: 'LIVE-late-' + o.id, type: 'order', priority: 'high',
            title: 'تأخر شحن الطلب ' + o.id,
            body: 'تجاوز موعد الشحن المتوقع (' + o.expectedShipDate + ') وما زال «' +
              (STATUS_META[o.status] ? STATUS_META[o.status].label : o.status) + '».',
            link: 'order-details.html?id=' + o.id, at: isoTime(new Date()), read: false, live: true
          });
        } else if (!o.seen && o.status === 'pending') {
          out.push({
            id: 'LIVE-new-' + o.id, type: 'order', priority: 'normal',
            title: 'طلب جديد ' + o.id,
            body: 'من «' + o.customer + '» بقيمة ' + Math.round(o.total) + ' ر.س',
            link: 'order-details.html?id=' + o.id, at: o.createdAt || isoTime(new Date()), read: false, live: true
          });
        }
      });
    }

    return out;
  }

  // كل الإشعارات = المسجّلة + المشتقة، مرتبة بالأحدث
  function allNotifications() {
    var settings = getNotificationSettings();
    var stored = getNotifications().filter(function (n) {
      return !settings[n.type] || settings[n.type].enabled !== false;
    });
    return liveAlerts().concat(stored).sort(function (a, b) {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
    });
  }

  function unreadTotal() {
    return allNotifications().filter(function (n) { return !n.read; }).length;
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

  /* ---------------- تحليلات متقدمة ---------------- */
  function ordersInRange(from, to) {
    return getOrders().filter(function (o) { return o.date >= from && o.date <= to; });
  }

  // مؤشرات فترة كاملة + مقارنة حقيقية مع الفترة السابقة المماثلة في الطول
  function periodStats(from, to) {
    var fromD = parseISO(from), toD = parseISO(to);
    if (!fromD || !toD) return null;

    var days = Math.round((toD - fromD) / 86400000) + 1;
    var prevTo = iso(new Date(fromD.getTime() - 86400000));
    var prevFrom = iso(new Date(fromD.getTime() - days * 86400000));

    function stats(f, t) {
      var all = ordersInRange(f, t);
      var rev = all.filter(isRevenue);
      var sales = sumTotal(rev);
      var customers = {};
      rev.forEach(function (o) { customers[o.customerId || o.customer] = (customers[o.customerId || o.customer] || 0) + 1; });
      var keys = Object.keys(customers);
      var repeat = keys.filter(function (k) { return customers[k] > 1; }).length;

      return {
        sales: sales,
        orders: rev.length,
        allOrders: all.length,
        aov: rev.length ? sales / rev.length : 0,
        customers: keys.length,
        repeatRate: keys.length ? (repeat / keys.length) * 100 : 0
      };
    }

    var cur = stats(from, to);
    var prev = stats(prevFrom, prevTo);

    return {
      from: from, to: to, days: days,
      prevFrom: prevFrom, prevTo: prevTo,
      current: cur, previous: prev,
      change: {
        sales: pctChange(cur.sales, prev.sales),
        orders: pctChange(cur.orders, prev.orders),
        aov: pctChange(cur.aov, prev.aov),
        repeatRate: pctChange(cur.repeatRate, prev.repeatRate)
      }
    };
  }

  // سلسلة مبيعات مجمّعة يومياً أو أسبوعياً أو شهرياً حسب طول الفترة
  function salesSeries(from, to, granularity, filters) {
    filters = filters || {};
    var fromD = parseISO(from), toD = parseISO(to);
    if (!fromD || !toD) return { labels: [], values: [], orders: [] };

    var buckets = {};
    var order = [];

    function keyFor(d) {
      if (granularity === 'month') return d.getFullYear() + '-' + pad(d.getMonth() + 1);
      if (granularity === 'week') {
        var w = new Date(d.getTime());
        w.setDate(w.getDate() - w.getDay());
        return iso(w);
      }
      return iso(d);
    }

    function labelFor(key) {
      if (granularity === 'month') {
        var parts = key.split('-');
        return MONTHS_AR[parseInt(parts[1], 10) - 1];
      }
      var d = parseISO(key);
      return d ? (d.getDate() + '/' + (d.getMonth() + 1)) : key;
    }

    for (var d = new Date(fromD.getTime()); d <= toD; d.setDate(d.getDate() + 1)) {
      var k = keyFor(d);
      if (!buckets[k]) { buckets[k] = { sales: 0, orders: 0 }; order.push(k); }
    }

    ordersInRange(from, to).filter(isRevenue).forEach(function (o) {
      if (filters.city && o.city !== filters.city) return;
      if (filters.category && !orderHasCategory(o, filters.category)) return;
      var od = parseISO(o.date);
      if (!od) return;
      var k = keyFor(od);
      if (!buckets[k]) return;
      buckets[k].sales += o.total || 0;
      buckets[k].orders += 1;
    });

    return {
      labels: order.map(labelFor),
      values: order.map(function (k) { return Math.round(buckets[k].sales); }),
      orders: order.map(function (k) { return buckets[k].orders; })
    };
  }

  function orderHasCategory(order, category) {
    var products = {};
    getProducts().forEach(function (p) { products[p.id] = p; });
    return (order.items || []).some(function (it) {
      var p = products[it.productId];
      return p && p.category === category;
    });
  }

  // أداء المنتجات مرتباً بالإيراد — يُستخدم لأكثر/أقل المنتجات مبيعاً
  function productPerformance(from, to, filters) {
    filters = filters || {};
    var products = {};
    getProducts().forEach(function (p) { products[p.id] = p; });

    var tally = {};
    ordersInRange(from, to).filter(isRevenue).forEach(function (o) {
      if (filters.city && o.city !== filters.city) return;
      (o.items || []).forEach(function (it) {
        var p = products[it.productId];
        if (filters.category && (!p || p.category !== filters.category)) return;
        if (!tally[it.productId]) {
          tally[it.productId] = { id: it.productId, name: it.name, revenue: 0, qty: 0, orders: 0 };
        }
        tally[it.productId].revenue += (it.price || 0) * (it.qty || 0);
        tally[it.productId].qty += it.qty || 0;
        tally[it.productId].orders += 1;
      });
    });

    return Object.keys(tally).map(function (k) { return tally[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; });
  }

  // أداء المدن — الطلبات والإيراد لكل مدينة
  function cityPerformance(from, to, filters) {
    filters = filters || {};
    var tally = {};

    ordersInRange(from, to).filter(isRevenue).forEach(function (o) {
      if (!o.city) return;
      if (filters.category && !orderHasCategory(o, filters.category)) return;
      if (!tally[o.city]) tally[o.city] = { city: o.city, orders: 0, revenue: 0 };
      tally[o.city].orders += 1;
      tally[o.city].revenue += o.total || 0;
    });

    return Object.keys(tally).map(function (k) { return tally[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; });
  }

  // عملاء جدد مقابل متكررين خلال الفترة: العميل "جديد" إذا كان أول طلب له داخلها
  function customerBehaviour(from, to) {
    var firstOrder = {};
    getOrders().filter(isRevenue).forEach(function (o) {
      var key = o.customerId || o.customer;
      if (!firstOrder[key] || o.date < firstOrder[key]) firstOrder[key] = o.date;
    });

    var seen = {};
    var newCount = 0, returningCount = 0;

    ordersInRange(from, to).filter(isRevenue).forEach(function (o) {
      var key = o.customerId || o.customer;
      if (seen[key]) return;
      seen[key] = true;
      if (firstOrder[key] >= from) newCount++; else returningCount++;
    });

    return { newCustomers: newCount, returning: returningCount };
  }

  function topCustomers(from, to, limit) {
    limit = limit || 5;
    var tally = {};

    ordersInRange(from, to).filter(isRevenue).forEach(function (o) {
      var key = o.customerId || o.customer;
      if (!tally[key]) tally[key] = { id: key, name: o.customer, orders: 0, spend: 0 };
      tally[key].orders += 1;
      tally[key].spend += o.total || 0;
    });

    return Object.keys(tally).map(function (k) { return tally[k]; })
      .sort(function (a, b) { return b.spend - a.spend; }).slice(0, limit);
  }

  /* ---------------- التقارير ---------------- */
  function getReportHistory() { return read(K_REPORT_HISTORY, []); }

  function addReportHistory(entry) {
    var list = getReportHistory();
    list.unshift({
      id: 'RPT-' + Date.now(),
      type: entry.type,
      title: entry.title,
      from: entry.from,
      to: entry.to,
      rows: entry.rows || 0,
      format: entry.format || 'preview',
      at: isoTime(new Date())
    });
    write(K_REPORT_HISTORY, list.slice(0, 50));
    emit();
  }

  function getReportSchedules() { return read(K_REPORT_SCHEDULES, []); }

  function addReportSchedule(s) {
    var list = getReportSchedules();
    list.unshift({
      id: 'SCH-' + Date.now(),
      type: s.type, title: s.title, frequency: s.frequency,
      email: s.email, format: s.format,
      nextRun: s.nextRun, createdAt: isoTime(new Date()), active: true
    });
    write(K_REPORT_SCHEDULES, list);
    emit();
  }

  function removeReportSchedule(id) {
    write(K_REPORT_SCHEDULES, getReportSchedules().filter(function (s) { return s.id !== id; }));
    emit();
  }

  function toggleReportSchedule(id) {
    var list = getReportSchedules();
    list.forEach(function (s) { if (s.id === id) s.active = !s.active; });
    write(K_REPORT_SCHEDULES, list);
    emit();
  }

  /* ---------------- ملف الشركة والمستندات ---------------- */
  var DOC_STATUS = {
    verified: { label: 'موثّق', tone: 'ok' },
    review: { label: 'قيد المراجعة', tone: 'warn' },
    rejected: { label: 'مرفوض', tone: 'bad' },
    missing: { label: 'لم يُرفع', tone: 'bad' }
  };

  var DOC_TYPES = [
    { key: 'cr', label: 'السجل التجاري', required: true, hint: 'صورة واضحة من شهادة السجل التجاري سارية المفعول' },
    { key: 'vat', label: 'الشهادة الضريبية', required: true, hint: 'شهادة التسجيل في ضريبة القيمة المضافة من هيئة الزكاة والضريبة والجمارك' },
    { key: 'license', label: 'الرخصة البلدية', required: false, hint: 'رخصة مزاولة النشاط الصادرة من البلدية' },
    { key: 'chamber', label: 'شهادة الغرفة التجارية', required: false, hint: 'شهادة عضوية الغرفة التجارية' },
    { key: 'bank', label: 'خطاب الحساب البنكي (IBAN)', required: false, hint: 'خطاب من البنك يوضح رقم الآيبان باسم المنشأة' }
  ];

  function getCompany() {
    var defaults = {
      nameAr: '', nameEn: '', crNumber: '', vatNumber: '', companyType: '',
      email: '', phone: '', website: '', about: '', logo: '',
      region: '', city: '', district: '', street: '', buildingNo: '', postalCode: '', additionalNo: ''
    };
    var saved = read(K_COMPANY, null);
    return saved ? Object.assign(defaults, saved) : defaults;
  }

  function saveCompany(patch, actor) {
    var before = getCompany();
    var after = Object.assign({}, before, patch);
    write(K_COMPANY, after);

    // سجّل الحقول التي تغيّرت فعلاً فقط
    var changes = [];
    Object.keys(patch).forEach(function (k) {
      if (String(before[k] || '') !== String(after[k] || '')) changes.push(k);
    });
    if (changes.length) addAudit(actor || 'المالك', 'تعديل بيانات الشركة', changes.join('، '));

    emit();
    return after;
  }

  function getDocuments() {
    var saved = read(K_DOCUMENTS, null);
    if (saved) return saved;

    // الحالة الأولية: كل المستندات غير مرفوعة
    var initial = {};
    DOC_TYPES.forEach(function (d) {
      initial[d.key] = { status: 'missing', fileName: '', dataUrl: '', uploadedAt: '', reviewedAt: '', reason: '' };
    });
    return initial;
  }

  function uploadDocument(key, fileName, dataUrl, actor) {
    var docs = getDocuments();
    docs[key] = {
      status: 'review',
      fileName: fileName,
      dataUrl: dataUrl || '',
      uploadedAt: isoTime(new Date()),
      reviewedAt: '',
      reason: ''
    };
    write(K_DOCUMENTS, docs);

    var label = key;
    DOC_TYPES.forEach(function (d) { if (d.key === key) label = d.label; });
    addAudit(actor || 'المالك', 'رفع مستند', label);
    addNotification({
      type: 'admin', title: 'تم استلام ' + label,
      body: 'المستند قيد المراجعة من فريق عمّار وسيتم إشعارك بالنتيجة.',
      link: 'company.html'
    });

    emit();
    return docs[key];
  }

  function removeDocument(key, actor) {
    var docs = getDocuments();
    docs[key] = { status: 'missing', fileName: '', dataUrl: '', uploadedAt: '', reviewedAt: '', reason: '' };
    write(K_DOCUMENTS, docs);

    var label = key;
    DOC_TYPES.forEach(function (d) { if (d.key === key) label = d.label; });
    addAudit(actor || 'المالك', 'حذف مستند', label);
    emit();
  }

  /* ---------------- سجل التدقيق ---------------- */
  function getAudit() { return read(K_AUDIT, []); }

  function addAudit(actor, action, detail) {
    var list = getAudit();
    list.unshift({
      id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      actor: actor, action: action, detail: detail || '', at: isoTime(new Date())
    });
    write(K_AUDIT, list.slice(0, 200));
  }

  /* ---------------- المستخدمون والأدوار ---------------- */
  var PERMISSION_SECTIONS = [
    { key: 'products', label: 'المنتجات والمخزون' },
    { key: 'orders', label: 'الطلبات والشحن' },
    { key: 'offers', label: 'العروض والخصومات' },
    { key: 'invoices', label: 'الفواتير والمدفوعات' },
    { key: 'analytics', label: 'التحليلات والتقارير' },
    { key: 'warehouses', label: 'المستودعات' },
    { key: 'company', label: 'بيانات الشركة' },
    { key: 'users', label: 'المستخدمون والصلاحيات' },
    { key: 'settings', label: 'الإعدادات' }
  ];

  var ACCESS_LEVELS = [
    { key: 'none', label: 'لا وصول' },
    { key: 'view', label: 'عرض فقط' },
    { key: 'edit', label: 'تعديل' }
  ];

  function allPerms(level) {
    var out = {};
    PERMISSION_SECTIONS.forEach(function (s) { out[s.key] = level; });
    return out;
  }

  var SYSTEM_ROLES = [
    {
      id: 'ROLE-admin', name: 'مدير عام', system: true,
      desc: 'صلاحية كاملة على جميع أقسام لوحة التحكم',
      perms: allPerms('edit')
    },
    {
      id: 'ROLE-products', name: 'مسؤول منتجات', system: true,
      desc: 'يدير المنتجات والمخزون والمستودعات فقط',
      perms: Object.assign(allPerms('none'), { products: 'edit', warehouses: 'edit', analytics: 'view' })
    },
    {
      id: 'ROLE-orders', name: 'مسؤول طلبات', system: true,
      desc: 'يدير الطلبات والشحن فقط',
      perms: Object.assign(allPerms('none'), { orders: 'edit', products: 'view', analytics: 'view' })
    },
    {
      id: 'ROLE-accountant', name: 'محاسب', system: true,
      desc: 'يرى الفواتير والتقارير المالية دون تعديل المنتجات',
      perms: Object.assign(allPerms('none'), { invoices: 'edit', analytics: 'view', orders: 'view' })
    }
  ];

  function getRoles() {
    var custom = read(K_ROLES, []);
    return SYSTEM_ROLES.concat(custom);
  }

  function getRole(id) {
    var found = null;
    getRoles().forEach(function (r) { if (r.id === id) found = r; });
    return found;
  }

  function saveRole(role, actor) {
    var custom = read(K_ROLES, []);
    if (role.id) {
      var replaced = false;
      custom = custom.map(function (r) {
        if (r.id === role.id) { replaced = true; return Object.assign({}, r, role); }
        return r;
      });
      if (!replaced) custom.push(role);
      addAudit(actor || 'المالك', 'تعديل دور', role.name);
    } else {
      role.id = 'ROLE-' + Date.now();
      role.system = false;
      custom.push(role);
      addAudit(actor || 'المالك', 'إنشاء دور', role.name);
    }
    write(K_ROLES, custom);
    emit();
    return role;
  }

  function removeRole(id, actor) {
    var role = getRole(id);
    if (!role || role.system) return false;
    write(K_ROLES, read(K_ROLES, []).filter(function (r) { return r.id !== id; }));
    addAudit(actor || 'المالك', 'حذف دور', role.name);
    emit();
    return true;
  }

  var SEED_USERS = [
    { id: 'U-1', name: 'عبدالله الشمري', email: 'abdullah@company.sa', phone: '+966501112233',
      roleId: 'ROLE-admin', status: 'active', lastLogin: '', createdAt: '', owner: true },
    { id: 'U-2', name: 'سارة القحطاني', email: 'sara@company.sa', phone: '+966502223344',
      roleId: 'ROLE-products', status: 'active', lastLogin: '', createdAt: '', owner: false },
    { id: 'U-3', name: 'محمد العتيبي', email: 'mohammed@company.sa', phone: '+966503334455',
      roleId: 'ROLE-orders', status: 'active', lastLogin: '', createdAt: '', owner: false },
    { id: 'U-4', name: 'نورة الدوسري', email: 'noura@company.sa', phone: '+966504445566',
      roleId: 'ROLE-accountant', status: 'disabled', lastLogin: '', createdAt: '', owner: false }
  ];

  function getUsers() {
    var saved = read(K_USERS, null);
    if (saved) return saved;

    var rnd = seededRandom(4471);
    var seeded = SEED_USERS.map(function (u, i) {
      var copy = Object.assign({}, u);
      copy.lastLogin = isoTime(daysAgo(Math.floor(rnd() * 9)));
      copy.createdAt = iso(daysAgo(120 - i * 20));
      return copy;
    });
    write(K_USERS, seeded);
    return seeded;
  }

  function getUser(id) {
    var found = null;
    getUsers().forEach(function (u) { if (u.id === id) found = u; });
    return found;
  }

  function saveUser(user, actor) {
    var list = getUsers();
    if (user.id) {
      list = list.map(function (u) { return u.id === user.id ? Object.assign({}, u, user) : u; });
      addAudit(actor || 'المالك', 'تعديل مستخدم', user.name || user.id);
    } else {
      user.id = 'U-' + Date.now();
      user.status = user.status || 'active';
      user.createdAt = todayISO();
      user.lastLogin = '';
      user.owner = false;
      list.push(user);
      addAudit(actor || 'المالك', 'إضافة مستخدم', user.name);
      addUserActivity(user.id, 'تمت دعوة المستخدم للانضمام إلى الحساب');
    }
    write(K_USERS, list);
    emit();
    return user;
  }

  function setUserStatus(id, status, actor) {
    var user = getUser(id);
    if (!user || user.owner) return null;

    write(K_USERS, getUsers().map(function (u) {
      return u.id === id ? Object.assign({}, u, { status: status }) : u;
    }));

    addAudit(actor || 'المالك', status === 'active' ? 'تفعيل مستخدم' : 'تعطيل مستخدم', user.name);
    addUserActivity(id, status === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
    emit();
    return getUser(id);
  }

  function removeUser(id, actor) {
    var user = getUser(id);
    if (!user || user.owner) return false;
    write(K_USERS, getUsers().filter(function (u) { return u.id !== id; }));
    addAudit(actor || 'المالك', 'حذف مستخدم', user.name);
    emit();
    return true;
  }

  /* ---------------- سجل نشاط المستخدمين ---------------- */
  var SEED_ACTIVITY = [
    'سجّل الدخول إلى لوحة التحكم',
    'حدّث كمية مخزون منتج',
    'قبِل طلباً جديداً وبدأ التجهيز',
    'أصدر فاتورة لطلب مكتمل',
    'أضاف منتجاً جديداً كمسودة',
    'صدّر تقرير المبيعات',
    'عدّل سعر منتج',
    'شحن طلباً وأدخل رقم التتبع'
  ];

  function getUserActivity(userId) {
    var all = read(K_ACTIVITY, null);

    if (!all) {
      // ولّد سجلاً أولياً واقعياً لكل مستخدم
      all = {};
      var rnd = seededRandom(9931);
      getUsers().forEach(function (u) {
        var entries = [];
        var count = 4 + Math.floor(rnd() * 5);
        for (var i = 0; i < count; i++) {
          entries.push({
            id: 'ACT-' + u.id + '-' + i,
            action: SEED_ACTIVITY[Math.floor(rnd() * SEED_ACTIVITY.length)],
            at: isoTime(daysAgo(i * 2 + Math.floor(rnd() * 2)))
          });
        }
        all[u.id] = entries;
      });
      write(K_ACTIVITY, all);
    }

    return userId ? (all[userId] || []) : all;
  }

  function addUserActivity(userId, action) {
    var all = getUserActivity();
    if (!all[userId]) all[userId] = [];
    all[userId].unshift({ id: 'ACT-' + Date.now(), action: action, at: isoTime(new Date()) });
    all[userId] = all[userId].slice(0, 50);
    write(K_ACTIVITY, all);
  }

  /* ---------------- الإعدادات العامة ---------------- */
  var DEFAULT_SETTINGS = {
    language: 'ar',
    currency: 'SAR',
    twoFactor: false,
    loginAlerts: true,
    coverageCities: [],
    carriers: []
  };

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(K_SETTINGS, {}));
  }

  function saveSettings(patch, actor) {
    var next = Object.assign(getSettings(), patch);
    write(K_SETTINGS, next);
    if (actor !== false) addAudit(actor || 'المالك', 'تعديل الإعدادات', Object.keys(patch).join('، '));
    emit();
    return next;
  }

  /* ---------------- الحسابات البنكية ---------------- */
  var SEED_BANKS = [
    { id: 'BNK-1', bank: 'مصرف الراجحي', holder: 'شركة البناء الحديث للمقاولات',
      iban: 'SA0380000000608010167519', primary: true, status: 'verified' }
  ];

  function getBankAccounts() {
    var saved = read(K_BANKS, null);
    if (saved) return saved;
    write(K_BANKS, SEED_BANKS);
    return SEED_BANKS;
  }

  function getBankAccount(id) {
    var found = null;
    getBankAccounts().forEach(function (b) { if (b.id === id) found = b; });
    return found;
  }

  function saveBankAccount(account, actor) {
    var list = getBankAccounts();

    if (account.id) {
      list = list.map(function (b) { return b.id === account.id ? Object.assign({}, b, account) : b; });
      addAudit(actor || 'المالك', 'تعديل حساب بنكي', account.bank || account.id);
    } else {
      account.id = 'BNK-' + Date.now();
      account.status = 'review';
      account.primary = list.length === 0;
      list.push(account);
      addAudit(actor || 'المالك', 'إضافة حساب بنكي', account.bank);
    }

    // حساب رئيسي واحد فقط
    if (account.primary) {
      list = list.map(function (b) {
        return Object.assign({}, b, { primary: b.id === account.id });
      });
    }

    write(K_BANKS, list);
    emit();
    return account;
  }

  function removeBankAccount(id, actor) {
    var acc = getBankAccount(id);
    if (!acc) return false;
    var rest = getBankAccounts().filter(function (b) { return b.id !== id; });
    // إن حُذف الحساب الرئيسي، رقّ الأول المتبقي
    if (acc.primary && rest.length) rest[0].primary = true;
    write(K_BANKS, rest);
    addAudit(actor || 'المالك', 'حذف حساب بنكي', acc.bank);
    emit();
    return true;
  }

  /* ---------------- الاشتراك ---------------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  window.addEventListener('storage', function (e) {
    var watched = [K_PRODUCTS, K_ORDERS, K_VISITS, K_NOTIFS, K_INVOICES,
      K_NOTIF_SETTINGS, K_REPORT_HISTORY, K_REPORT_SCHEDULES];
    if (watched.indexOf(e.key) !== -1) emit();
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

    INVOICE_STATUS: INVOICE_STATUS,
    VAT_RATE: VAT_RATE,
    getInvoices: getInvoices,
    getInvoice: getInvoice,
    markInvoicePaid: markInvoicePaid,
    cancelInvoice: cancelInvoice,
    addCreditNote: addCreditNote,
    remindInvoice: remindInvoice,
    invoiceSummary: invoiceSummary,

    NOTIFICATION_TYPES: NOTIFICATION_TYPES,
    getNotifications: getNotifications,
    allNotifications: allNotifications,
    addNotification: addNotification,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    unreadNotificationsCount: unreadNotificationsCount,
    unreadTotal: unreadTotal,
    getNotificationSettings: getNotificationSettings,
    saveNotificationSettings: saveNotificationSettings,
    unseenOrdersCount: unseenOrdersCount,
    overdueOrdersCount: overdueOrdersCount,

    periodStats: periodStats,
    salesSeries: salesSeries,
    productPerformance: productPerformance,
    cityPerformance: cityPerformance,
    customerBehaviour: customerBehaviour,
    topCustomers: topCustomers,
    ordersInRange: ordersInRange,

    DOC_STATUS: DOC_STATUS,
    DOC_TYPES: DOC_TYPES,
    getCompany: getCompany,
    saveCompany: saveCompany,
    getDocuments: getDocuments,
    uploadDocument: uploadDocument,
    removeDocument: removeDocument,
    getAudit: getAudit,
    addAudit: addAudit,

    PERMISSION_SECTIONS: PERMISSION_SECTIONS,
    ACCESS_LEVELS: ACCESS_LEVELS,
    getRoles: getRoles,
    getRole: getRole,
    saveRole: saveRole,
    removeRole: removeRole,
    getUsers: getUsers,
    getUser: getUser,
    saveUser: saveUser,
    setUserStatus: setUserStatus,
    removeUser: removeUser,
    getUserActivity: getUserActivity,
    addUserActivity: addUserActivity,

    getSettings: getSettings,
    saveSettings: saveSettings,
    getBankAccounts: getBankAccounts,
    getBankAccount: getBankAccount,
    saveBankAccount: saveBankAccount,
    removeBankAccount: removeBankAccount,

    getReportHistory: getReportHistory,
    addReportHistory: addReportHistory,
    getReportSchedules: getReportSchedules,
    addReportSchedule: addReportSchedule,
    removeReportSchedule: removeReportSchedule,
    toggleReportSchedule: toggleReportSchedule,

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
      write(K_INVOICES, []);
      write(K_REPORT_HISTORY, []);
      write(K_REPORT_SCHEDULES, []);
      emit();
    }
  };
})();
