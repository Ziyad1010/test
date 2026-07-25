(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };

  var REPORT_TITLES = { sales: 'تقرير المبيعات', inventory: 'تقرير المخزون', orders: 'تقرير الطلبات', customers: 'تقرير العملاء' };

  var REPORT_DATA = {
    sales: {
      head: ['المنتج', 'الكمية المباعة', 'الإيراد', 'نسبة من الإجمالي'],
      rows: [
        ['حديد تسليح سعودي 12مم', '38 طن', '52,400 ر.س', '28%'],
        ['أسمنت بورتلاندي عادي', '96 كيس', '41,200 ر.س', '22%'],
        ['خرسانة جاهزة C30', '21 م³', '33,800 ر.س', '18%'],
        ['بلاط بورسلين مطفي', '64 م²', '21,500 ر.س', '12%'],
        ['طوب أسمنتي مصمت', '12 قطعة', '15,300 ر.س', '8%']
      ]
    },
    inventory: {
      head: ['المنتج', 'المستودع', 'الكمية الحالية', 'الحالة'],
      rows: [
        ['حديد تسليح سعودي 12مم', 'مستودع الرياض الرئيسي', '50 طن', 'متوفر'],
        ['أسمنت بورتلاندي عادي', 'مستودع الرياض الرئيسي', '8 كيس', 'منخفض'],
        ['خرسانة جاهزة C30', 'مستودع جدة', 'يُصنّع عند الطلب', 'متوفر'],
        ['بلاط بورسلين مطفي', 'مستودع الدمام', '320 م²', 'متوفر'],
        ['طوب أسمنتي مصمت', 'مستودع الرياض الرئيسي', '0 قطعة', 'نفد المخزون']
      ]
    },
    orders: {
      head: ['رقم الطلب', 'العميل', 'المبلغ', 'الحالة'],
      rows: [
        ['#1024', 'شركة البناء الحديث', '2,850 ر.س', 'يتم التجهيز'],
        ['#1023', 'مؤسسة الإعمار المتحدة', '12,250 ر.س', 'قيد المراجعة'],
        ['#1022', 'شركة الرياض للمقاولات', '4,900 ر.س', 'تم الشحن'],
        ['#1021', 'مجموعة التطوير العقاري', '11,340 ر.س', 'تم التسليم'],
        ['#1020', 'مقاولات الخليج المحدودة', '3,200 ر.س', 'ملغي']
      ]
    },
    customers: {
      head: ['العميل', 'عدد الطلبات', 'إجمالي الإنفاق', 'آخر طلب'],
      rows: [
        ['شركة البناء الحديث للمقاولات', '14', '38,450 ر.س', '2026-07-20'],
        ['مؤسسة الإعمار المتحدة', '9', '27,900 ر.س', '2026-07-19'],
        ['شركة الرياض للمقاولات العامة', '11', '31,200 ر.س', '2026-07-18'],
        ['مجموعة التطوير العقاري', '6', '22,600 ر.س', '2026-07-17'],
        ['مقاولات الخليج المحدودة', '3', '8,900 ر.س', '2026-07-16']
      ]
    }
  };

  function currentReport() {
    var type = $('#repType').value;
    return { type: type, data: REPORT_DATA[type], title: REPORT_TITLES[type] };
  }

  function renderReport() {
    var r = currentReport();
    var from = $('#repFrom').value;
    var to = $('#repTo').value;

    $('#repTitle').textContent = r.title;
    $('#repRange').textContent = 'من ' + from + ' إلى ' + to;
    $('#repTableHead').innerHTML = '<tr>' + r.data.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
    $('#repTableBody').innerHTML = r.data.rows.map(function (row) {
      return '<tr>' + row.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }).join('');

    $('#repResult').hidden = false;
    if (window.Shell) Shell.toast('تم إنشاء ' + r.title + ' بنجاح', 'success');
  }

  function exportCsv() {
    var r = currentReport();
    var lines = [r.data.head.join(',')].concat(r.data.rows.map(function (row) { return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }));
    var csv = '﻿' + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = r.type + '-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.Shell) Shell.toast('تم تنزيل ملف CSV بنجاح', 'success');
  }

  function exportPdf() {
    var r = currentReport();
    var win = window.open('', '_blank');
    if (!win) {
      if (window.Shell) Shell.toast('يرجى السماح بالنوافذ المنبثقة للتصدير', 'danger');
      return;
    }
    var rowsHtml = r.data.rows.map(function (row) { return '<tr>' + row.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
    var headHtml = r.data.head.map(function (h) { return '<th>' + h + '</th>'; }).join('');
    win.document.write(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + r.title + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:36px;color:#0f172a;}h1{font-size:1.3rem;margin-bottom:4px;}' +
      '.muted{color:#64748b;font-size:0.85rem;margin-bottom:20px;}table{width:100%;border-collapse:collapse;}' +
      'th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:0.88rem;}th{background:#f8fafc;}</style></head><body>' +
      '<h1>' + r.title + '</h1><div class="muted">من ' + $('#repFrom').value + ' إلى ' + $('#repTo').value + '</div>' +
      '<table><thead><tr>' + headHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></body></html>'
    );
    win.document.close();
    setTimeout(function () { win.print(); }, 400);
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#repGenerateBtn').addEventListener('click', renderReport);
    $('#repExportCsv').addEventListener('click', exportCsv);
    $('#repExportPdf').addEventListener('click', exportPdf);
  });
})();
