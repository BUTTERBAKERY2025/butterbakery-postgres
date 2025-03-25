/**
 * ButterBakery OPS - فحص اتصال قاعدة بيانات Render
 * هذا الملف يستخدم لفحص حالة الاتصال بقاعدة البيانات والتحقق من توفر البيانات
 */

require('dotenv').config();
const { Pool } = require('pg');

// ضبط اتصال قاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDatabaseConnection() {
  console.log('جاري فحص الاتصال بقاعدة البيانات...');
  
  try {
    // التحقق من الاتصال
    const client = await pool.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
    
    // الحصول على قائمة الجداول
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nالجداول الموجودة في قاعدة البيانات:');
    if (tablesResult.rows.length === 0) {
      console.log('❌ لا توجد جداول في قاعدة البيانات!');
    } else {
      tablesResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
    }
    
    // فحص بيانات كل جدول
    console.log('\nإحصائيات الجداول:');
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
      const count = parseInt(countResult.rows[0].count);
      
      console.log(`- ${tableName}: ${count} صف`);
    }
    
    // إغلاق الاتصال
    client.release();
    console.log('\n✅ تم إكمال عملية الفحص بنجاح');
    
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n🔍 سبب المشكلة: جدول غير موجود في قاعدة البيانات');
      console.log('💡 الحل: قم بتشغيل الخادم مع وضع إنشاء الجداول التلقائي');
    } else if (error.message.includes('connecting')) {
      console.log('\n🔍 سبب المشكلة: فشل في الاتصال بقاعدة البيانات');
      console.log('💡 الحل: تأكد من صحة رابط الاتصال DATABASE_URL وأن قاعدة البيانات متاحة');
    }
  } finally {
    pool.end();
  }
}

// تشغيل الفحص
checkDatabaseConnection();