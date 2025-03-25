/**
 * ButterBakery OPS - ملف بدء محسن لـ Render.com
 * يتعامل مع مشاكل الاتصال بقاعدة البيانات ويوفر معلومات أفضل للتشخيص
 */

import { createServer } from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { query, testConnection, getDatabaseInfo, getTables } from './db-connect-esm.js';

// تحميل متغيرات البيئة من ملف .env إن وجد
dotenv.config();

// الحصول على المسار الحالي
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إنشاء تطبيق Express
const app = express();

// إعدادات الوسائط
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('common'));

// صفحة الترحيب
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ButterBakery Database - حالة خدمة قاعدة البيانات</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f9f7f0;
          color: #5c4a36;
          line-height: 1.6;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: #fff;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #826644;
          margin-top: 0;
          border-bottom: 2px solid #f0e6d5;
          padding-bottom: 10px;
        }
        h2 {
          color: #826644;
          margin-top: 20px;
        }
        .status-box {
          padding: 15px;
          border-radius: 5px;
          margin: 15px 0;
          border: 1px solid #ddd;
        }
        .endpoints {
          background-color: #f0e6d5;
          padding: 15px;
          border-radius: 5px;
          margin: 15px 0;
        }
        .endpoint {
          margin-bottom: 10px;
        }
        code {
          background-color: #f6f2ea;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        .button {
          display: inline-block;
          padding: 10px 15px;
          background-color: #826644;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          margin-top: 10px;
        }
        ul {
          padding-right: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>خدمة قاعدة بيانات ButterBakery</h1>
        
        <div class="status-box">
          <h2>حالة الخدمة</h2>
          <p>✅ الخادم يعمل بشكل صحيح</p>
        </div>
        
        <div class="endpoints">
          <h2>نقاط النهاية المتاحة</h2>
          
          <div class="endpoint">
            <code>/api/db/status</code> - التحقق من حالة اتصال قاعدة البيانات
          </div>
          
          <div class="endpoint">
            <code>/api/db/info</code> - عرض معلومات قاعدة البيانات
          </div>
          
          <div class="endpoint">
            <code>/api/db/tables</code> - عرض جداول قاعدة البيانات
          </div>
          
          <div class="endpoint">
            <code>/health</code> - التحقق من حالة الخدمة
          </div>
        </div>
        
        <h2>معلومات إضافية</h2>
        <ul>
          <li>المنفذ: ${process.env.PORT || 5000}</li>
          <li>بيئة التشغيل: ${process.env.NODE_ENV || 'development'}</li>
        </ul>
        
        <a href="/api/db/status" class="button">التحقق من حالة قاعدة البيانات</a>
      </div>
    </body>
    </html>
  `);
});

// التحقق من الصحة
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// نقاط نهاية قاعدة البيانات
app.get('/api/db/status', async (req, res) => {
  try {
    // التحقق من وجود متغير البيئة DATABASE_URL
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        status: 'error',
        message: 'متغير البيئة DATABASE_URL غير محدد',
        timestamp: new Date().toISOString()
      });
    }

    // محاولة الاتصال بقاعدة البيانات
    const connected = await testConnection();
    
    // إرجاع حالة الاتصال
    return res.json({
      status: connected ? 'connected' : 'disconnected',
      message: connected ? 'تم الاتصال بقاعدة البيانات بنجاح' : 'فشل الاتصال بقاعدة البيانات',
      timestamp: new Date().toISOString(),
      databaseUrl: process.env.DATABASE_URL ? 
        process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'غير محدد'
    });
  } catch (error) {
    console.error('خطأ في التحقق من حالة قاعدة البيانات:', error);
    return res.status(500).json({
      status: 'error',
      message: 'خطأ أثناء التحقق من حالة قاعدة البيانات',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// معلومات قاعدة البيانات
app.get('/api/db/info', async (req, res) => {
  try {
    const info = await getDatabaseInfo();
    return res.json({
      status: 'success',
      info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('خطأ في الحصول على معلومات قاعدة البيانات:', error);
    return res.status(500).json({
      status: 'error',
      message: 'خطأ أثناء الحصول على معلومات قاعدة البيانات',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// جداول قاعدة البيانات
app.get('/api/db/tables', async (req, res) => {
  try {
    const tables = await getTables();
    return res.json({
      status: 'success',
      tables,
      count: tables.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('خطأ في الحصول على جداول قاعدة البيانات:', error);
    return res.status(500).json({
      status: 'error',
      message: 'خطأ أثناء الحصول على جداول قاعدة البيانات',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// معالجة المسارات غير الموجودة
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `المسار ${req.originalUrl} غير موجود`,
    timestamp: new Date().toISOString()
  });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error('خطأ غير متوقع:', err);
  res.status(500).json({
    status: 'error',
    message: 'خطأ غير متوقع في الخادم',
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

// تحديد المنفذ
const PORT = process.env.PORT || 5000;

// بدء الخادم
const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`📊 يمكنك التحقق من حالة قاعدة البيانات على /api/db/status`);
});

// معالجة إنهاء العملية بشكل أنيق
process.on('SIGTERM', () => {
  console.log('تم استلام SIGTERM، إغلاق الخادم بشكل أنيق...');
  server.close(() => {
    console.log('تم إغلاق الخادم.');
    process.exit(0);
  });
});

// معلومات التشخيص
console.log('✅ تم العثور على متغير البيئة DATABASE_URL:', !!process.env.DATABASE_URL);
console.log('📂 المسار الحالي:', __dirname);

export default app;