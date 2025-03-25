/**
 * ملف الاتصال بقاعدة بيانات PostgreSQL
 * يستخدم لإنشاء وإدارة الاتصال بقاعدة البيانات في Render.com
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// متغيرات البيئة
const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = './db-backups';

// إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 تم إنشاء مجلد النسخ الاحتياطية: ${BACKUP_DIR}`);
}

// تكوين الاتصال بقاعدة البيانات
let pool;
try {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // مطلوب لـ Render.com
    }
  });
  console.log('✅ تم تكوين الاتصال بقاعدة البيانات');
} catch (err) {
  console.error('❌ خطأ في تكوين الاتصال بقاعدة البيانات:', err.message);
}

/**
 * اختبار الاتصال بقاعدة البيانات
 * @returns {Promise<boolean>} نجاح أو فشل الاتصال
 */
async function testConnection() {
  console.log('🔄 اختبار الاتصال بقاعدة البيانات...');
  
  if (!pool) {
    console.error('❌ لم يتم تكوين الاتصال بقاعدة البيانات!');
    return false;
  }
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
    
    const res = await client.query('SELECT NOW() as time, current_database() as db_name');
    console.log(`📊 قاعدة البيانات: ${res.rows[0].db_name}`);
    console.log(`⏰ وقت الخادم: ${res.rows[0].time}`);
    
    return true;
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
    return false;
  } finally {
    if (client) client.release();
  }
}

/**
 * تنفيذ استعلام SQL على قاعدة البيانات
 * @param {string} text نص الاستعلام
 * @param {Array} params معلمات الاستعلام (اختياري)
 * @returns {Promise<any>} نتيجة الاستعلام
 */
async function query(text, params = []) {
  if (!pool) {
    throw new Error('لم يتم تكوين الاتصال بقاعدة البيانات!');
  }
  
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // طباعة معلومات حول الاستعلام للتصحيح
    if (text.trim().toLowerCase().startsWith('select')) {
      console.log(`🔍 استعلام (${duration}ms): ${text.slice(0, 50)}... | ${result.rowCount} سجل`);
    } else {
      console.log(`📝 تنفيذ (${duration}ms): ${text.slice(0, 50)}...`);
    }
    
    return result;
  } catch (err) {
    console.error(`❌ خطأ في الاستعلام: ${text.slice(0, 50)}...`);
    console.error(err.message);
    throw err;
  }
}

/**
 * الحصول على اتصال منفصل من المجمع
 * مفيد للمعاملات التي تتطلب أكثر من استعلام
 * @returns {Promise<any>} عميل الاتصال
 */
async function getClient() {
  if (!pool) {
    throw new Error('لم يتم تكوين الاتصال بقاعدة البيانات!');
  }
  
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);
  
  // تسجيل وقت تحرير الاتصال
  client.release = () => {
    client.query = originalQuery;
    client.release = release;
    console.log('🔄 تم إعادة اتصال إلى المجمع');
    release();
  };
  
  // تسجيل وقت وتفاصيل الاستعلامات
  client.query = async (text, params = []) => {
    const start = Date.now();
    try {
      const result = await originalQuery(text, params);
      const duration = Date.now() - start;
      
      if (text.trim().toLowerCase().startsWith('select')) {
        console.log(`🔍 استعلام العميل (${duration}ms): ${text.slice(0, 50)}... | ${result.rowCount} سجل`);
      } else {
        console.log(`📝 تنفيذ العميل (${duration}ms): ${text.slice(0, 50)}...`);
      }
      
      return result;
    } catch (err) {
      console.error(`❌ خطأ في استعلام العميل: ${text.slice(0, 50)}...`);
      console.error(err.message);
      throw err;
    }
  };
  
  return client;
}

/**
 * إنشاء نسخة احتياطية من قاعدة البيانات
 * @returns {Promise<string|null>} مسار ملف النسخة الاحتياطية أو null في حالة الفشل
 */
async function backupDatabase() {
  console.log('🔄 جاري إنشاء نسخة احتياطية من قاعدة البيانات...');
  
  try {
    // الحصول على قائمة الجداول
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    if (tables.rows.length === 0) {
      console.log('⚠️ لا توجد جداول في قاعدة البيانات للنسخ الاحتياطي');
      return null;
    }
    
    console.log(`📋 تم العثور على ${tables.rows.length} جدول للنسخ الاحتياطي`);
    
    // جمع البيانات من كل جدول
    const backup = {};
    
    for (const tableRow of tables.rows) {
      const tableName = tableRow.table_name;
      const data = await query(`SELECT * FROM "${tableName}"`);
      backup[tableName] = data.rows;
      console.log(`📦 تم نسخ ${data.rowCount} سجل من جدول ${tableName}`);
    }
    
    // حفظ البيانات في ملف
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`✅ تم إنشاء نسخة احتياطية بنجاح: ${backupFile}`);
    
    return backupFile;
  } catch (err) {
    console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', err.message);
    return null;
  }
}

/**
 * استعادة قاعدة البيانات من نسخة احتياطية
 * @param {string} backupFile مسار ملف النسخة الاحتياطية
 * @returns {Promise<boolean>} نجاح أو فشل الاستعادة
 */
async function restoreDatabase(backupFile) {
  console.log(`🔄 جاري استعادة قاعدة البيانات من: ${backupFile}`);
  
  try {
    if (!fs.existsSync(backupFile)) {
      console.error(`❌ ملف النسخة الاحتياطية غير موجود: ${backupFile}`);
      return false;
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const tables = Object.keys(backupData);
    
    if (tables.length === 0) {
      console.log('⚠️ لا توجد بيانات في ملف النسخة الاحتياطية');
      return false;
    }
    
    console.log(`📋 جاري استعادة ${tables.length} جدول...`);
    
    // استعادة كل جدول
    for (const tableName of tables) {
      const records = backupData[tableName];
      
      if (records.length === 0) {
        console.log(`⏩ تخطي جدول ${tableName} (لا توجد سجلات)`);
        continue;
      }
      
      // حذف البيانات الموجودة في الجدول
      await query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      
      // استعادة السجلات
      for (const record of records) {
        const columns = Object.keys(record);
        const values = columns.map(col => record[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        await query(
          `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
      
      console.log(`✅ تم استعادة ${records.length} سجل إلى جدول ${tableName}`);
    }
    
    console.log('✅ تم استعادة قاعدة البيانات بنجاح');
    return true;
  } catch (err) {
    console.error('❌ خطأ في استعادة قاعدة البيانات:', err.message);
    return false;
  }
}

/**
 * الحصول على قائمة الجداول في قاعدة البيانات
 * @returns {Promise<string[]>} قائمة أسماء الجداول
 */
async function getTables() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    return result.rows.map(row => row.table_name);
  } catch (err) {
    console.error('❌ خطأ في الحصول على قائمة الجداول:', err.message);
    return [];
  }
}

/**
 * الحصول على معلومات حول قاعدة البيانات
 * @returns {Promise<Object>} معلومات قاعدة البيانات
 */
async function getDatabaseInfo() {
  try {
    const dbInfo = await query(`
      SELECT current_database() as db_name,
             current_schema() as schema,
             current_user as user,
             version() as version
    `);
    
    const tablesInfo = await query(`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tablesCount = await getTables();
    
    const tables = {};
    for (const table of tablesInfo.rows) {
      const countResult = await query(`SELECT COUNT(*) FROM "${table.table_name}"`);
      tables[table.table_name] = {
        name: table.table_name,
        columns: parseInt(table.columns_count),
        records: parseInt(countResult.rows[0].count)
      };
    }
    
    return {
      database: dbInfo.rows[0],
      tables,
      tables_count: tablesCount.length
    };
  } catch (err) {
    console.error('❌ خطأ في الحصول على معلومات قاعدة البيانات:', err.message);
    return { error: err.message };
  }
}

// تصدير الدوال
module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  backupDatabase,
  restoreDatabase,
  getTables,
  getDatabaseInfo
};