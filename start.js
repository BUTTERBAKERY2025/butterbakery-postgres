/**
 * ButterBakery OPS - ملف بدء التشغيل الرئيسي
 * هذا الملف هو نقطة الدخول للتطبيق على Render.com
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إنشاء تطبيق Express
const app = express();
const PORT = process.env.PORT || 5000; // استخدام المنفذ 5000 للتوافق مع إعدادات Replit

// إعداد middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// تكوين الاتصال بقاعدة البيانات (إذا كان متاحاً)
let pool;
let dbConnected = false;

// عرض معلومات عن الملفات في المجلد الحالي
app.get('/', (req, res) => {
  try {
    const currentTime = new Date().toISOString().replace('T', ' ').substr(0, 19);
    const environment = process.env.NODE_ENV || 'development';
    const currentDir = process.cwd();
    
    // قراءة محتويات المجلد
    const files = fs.readdirSync(currentDir).filter(file => !file.startsWith('.'));
    
    // بناء HTML للصفحة الرئيسية
    let html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>منصة عمليات ButterBakery - الخادم الاحتياطي</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            direction: rtl;
            text-align: right;
            background-color: #f9f9f9;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          h1 {
            color: #e67e22;
            text-align: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
          }
          .info-box {
            background-color: #f5f5f5;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          h2 {
            margin-top: 30px;
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
          }
          ul {
            list-style-type: none;
            padding: 0;
          }
          li {
            padding: 8px 0;
            border-bottom: 1px dashed #eee;
          }
          .error-box {
            background-color: #fff8f8;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin-top: 20px;
            color: #333;
          }
          .db-status {
            color: ${dbConnected ? '#27ae60' : '#e74c3c'};
            font-weight: bold;
          }
          a {
            color: #3498db;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>منصة عمليات ButterBakery - الخادم الاحتياطي</h1>
          
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">الوقت الحالي:</span>
              <span>${currentTime}</span>
            </div>
            <div class="info-row">
              <span class="info-label">بيئة التشغيل:</span>
              <span>${environment}</span>
            </div>
            <div class="info-row">
              <span class="info-label">المسار الحالي:</span>
              <span>${currentDir}</span>
            </div>
            <div class="info-row">
              <span class="info-label">إصدار Node.js:</span>
              <span>${process.version}</span>
            </div>
          </div>
          
          <h2>محتويات المجلد الحالي</h2>
          <ul>
            ${files.map(file => `<li>${file}</li>`).join('')}
          </ul>
          
          <h2>حالة الاتصال بقاعدة البيانات</h2>
          <p>حالة الاتصال: <span class="db-status">${dbConnected ? 'متصل' : 'غير متصل'}</span></p>
          <p>للتحقق من حالة قاعدة البيانات: <a href="/api/db/status">/api/db/status</a></p>
          
          <div class="error-box">
            <h2>ملاحظة هامة</h2>
            <p>هذا هو خادم الطوارئ الاحتياطي. لاستخدام التطبيق الكامل، يرجى التحقق من إعدادات التشغيل.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`حدث خطأ: ${error.message}`);
  }
});

// نقطة نهاية للتحقق من صحة الخادم
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    database_connected: dbConnected,
    timestamp: new Date().toISOString()
  });
});

// نقطة نهاية للتحقق من حالة قاعدة البيانات
app.get('/api/db/status', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({
      status: 'غير متصل',
      message: 'لم يتم تكوين متغير DATABASE_URL',
      error: 'يرجى تكوين متغير البيئة DATABASE_URL',
      timestamp: new Date().toISOString()
    });
  }

  // محاولة الاتصال بقاعدة البيانات إذا لم نكن متصلين بالفعل
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    } catch (error) {
      return res.status(500).json({
        status: 'خطأ',
        message: 'حدث خطأ أثناء إنشاء اتصال قاعدة البيانات',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    const dbTime = result.rows[0].time;
    client.release();
    
    dbConnected = true;
    
    res.json({
      status: 'متصل',
      message: 'تم الاتصال بقاعدة البيانات بنجاح',
      database_time: dbTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'غير متصل',
      message: 'فشل الاتصال بقاعدة البيانات',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`📊 يمكنك التحقق من حالة قاعدة البيانات على /api/db/status`);
});

// التقاط الأخطاء غير المعالجة
process.on('uncaughtException', (err) => {
  console.error('❌ خطأ غير معالج:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ وعد مرفوض غير معالج:', reason);
});
