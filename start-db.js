/**
 * ButterBakery OPS - ملف بدء التشغيل الرئيسي
 * هذا الملف هو نقطة الدخول للتطبيق على Render.com
 * يقوم بإعداد قاعدة البيانات قبل بدء تشغيل التطبيق
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 بدء تشغيل خادم ButterBakery...');
console.log('📂 المسار الحالي:', process.cwd());

// التحقق من متغير البيئة DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error(`
⚠️ لم يتم العثور على متغير البيئة DATABASE_URL!
  يجب إضافة متغير البيئة DATABASE_URL في إعدادات Render.com.
  انتقل إلى: Dashboard > [اسم التطبيق] > Environment > Add Environment Variable
  `);
} else {
  console.log('✅ تم العثور على متغير البيئة DATABASE_URL');
}

// تشغيل الخادم الرئيسي مباشرة بدون إعداد قاعدة البيانات
startServer();

/**
 * تشغيل الخادم الرئيسي
 */
async function startServer() {
  try {
    console.log('🚀 جاري تشغيل الخادم الرئيسي...');
    // استخدام dynamic import في ESM
    const serverModule = await import('./start.js');
  } catch (error) {
    console.error('❌ خطأ في تشغيل الخادم الرئيسي:', error.message);
    process.exit(1);
  }
}