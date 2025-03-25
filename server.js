/**
 * ButterBakery OPS - خادم بسيط للتأكد من عمل النشر على Render.com
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import { pool, testConnection, query, getDatabaseInfo } from './db-connect-esm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// إنشاء تطبيق Express
const app = express();
const PORT = process.env.PORT || 5000; // استخدام المنفذ 5000 كاحتياطي للتوافق مع Replit

// إعداد middleware
app.use(cors());
app.use(express.json());

// الصفحة الرئيسية
app.get('/', (req, res) => {
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
      <title>منصة عمليات ButterBakery - خادم قاعدة البيانات</title>
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
        .db-status {
          color: #e74c3c;
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
        <h1>منصة عمليات ButterBakery - خادم قاعدة البيانات</h1>
        
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
        
        <h2>API Endpoints</h2>
        <ul>
          <li><a href="/health">/health</a> - التحقق من صحة الخادم</li>
          <li><a href="/api/docs">/api/docs</a> - وثائق API</li>
          <li><a href="/api/db/status">/api/db/status</a> - حالة الاتصال بقاعدة البيانات</li>
        </ul>
        
        <h2>محتويات المجلد الحالي</h2>
        <ul>
          ${files.map(file => `<li>${file}</li>`).join('')}
        </ul>
        
      </div>
    </body>
    </html>
  `;
  
  res.send(html);
});

// نقطة نهاية للتحقق من صحة الخادم
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// نقطة نهاية للوثائق
app.get('/api/docs', (req, res) => {
  res.json({
    description: 'وثائق API الخاصة بخدمة ButterBakery PostgreSQL',
    endpoints: [
      { method: 'GET', path: '/', description: 'الصفحة الرئيسية' },
      { method: 'GET', path: '/health', description: 'التحقق من صحة الخادم' },
      { method: 'GET', path: '/api/docs', description: 'وثائق API' },
      { method: 'GET', path: '/api/db/status', description: 'حالة الاتصال بقاعدة البيانات' }
    ]
  });
});

// نقطة نهاية للتحقق من حالة قاعدة البيانات
app.get('/api/db/status', async (req, res) => {
  try {
    // فحص الاتصال بقاعدة البيانات
    const isConnected = await testConnection();
    
    if (isConnected) {
      // الحصول على بعض المعلومات الإضافية حول قاعدة البيانات
      try {
        const dbInfo = await getDatabaseInfo();
        
        res.json({
          status: 'success',
          connected: true,
          message: 'تم الاتصال بقاعدة البيانات بنجاح',
          database_info: {
            name: dbInfo.database_name,
            user: dbInfo.database_user,
            tables_count: dbInfo.tables_count
          },
          tables: dbInfo.tables.map(t => ({
            name: t.name,
            records: t.records
          }))
        });
      } catch (infoError) {
        res.json({
          status: 'success',
          connected: true,
          message: 'تم الاتصال بقاعدة البيانات، لكن لا يمكن الحصول على معلومات إضافية',
          error: infoError.message
        });
      }
    } else {
      res.status(500).json({
        status: 'error',
        connected: false,
        message: 'فشل الاتصال بقاعدة البيانات'
      });
    }
  } catch (err) {
    res.status(500).json({
      status: 'error',
      connected: false,
      message: 'حدث خطأ أثناء محاولة الاتصال بقاعدة البيانات',
      error: err.message
    });
  }
});

// التعامل مع المسارات غير الموجودة
app.use((req, res) => {
  const path = req.path;
  res.status(404).send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>الصفحة غير موجودة - ButterBakery</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          direction: rtl;
          text-align: center;
          background-color: #f8f9fa;
          padding: 40px 20px;
          margin: 0;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          padding: 30px;
        }
        h1 {
          color: #e67e22;
          margin-bottom: 20px;
        }
        p {
          font-size: 18px;
          line-height: 1.6;
        }
        .path {
          font-family: monospace;
          background-color: #f5f5f5;
          padding: 8px 12px;
          border-radius: 4px;
          margin: 10px 0;
          display: inline-block;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background-color: #e67e22;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 20px;
          transition: background-color 0.3s;
        }
        .btn:hover {
          background-color: #d35400;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>الصفحة غير موجودة 404</h1>
        <p>عذراً، المسار الذي طلبته غير موجود:</p>
        <div class="path">${path}</div>
        <p>يمكنك العودة إلى الصفحة الرئيسية أو التحقق من عنوان URL.</p>
        <a href="/" class="btn">العودة للصفحة الرئيسية</a>
      </div>
    </body>
    </html>
  `);
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`📊 يمكنك التحقق من حالة الخادم على /health`);
});