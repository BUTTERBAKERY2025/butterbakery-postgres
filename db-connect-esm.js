/**
 * ملف الاتصال بقاعدة بيانات PostgreSQL
 * يستخدم لإنشاء وإدارة الاتصال بقاعدة البيانات في Render.com
 * نسخة ESM (ES Modules)
 */

import pg from 'pg';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// مجلد النسخ الاحتياطية
const BACKUP_DIR = './db-backups';

// التأكد من وجود مجلد النسخ الاحتياطية
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// إنشاء مجمع اتصالات قاعدة البيانات
let pool;

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    console.log('✅ تم تكوين مجمع اتصالات قاعدة البيانات');
  } else {
    console.warn('⚠️ متغير البيئة DATABASE_URL غير محدد، لن يتم إنشاء الاتصال بقاعدة البيانات');
  }
} catch (err) {
  console.error('❌ خطأ في إنشاء مجمع اتصالات قاعدة البيانات:', err.message);
}

/**
 * اختبار الاتصال بقاعدة البيانات
 * @returns {Promise<boolean>} نجاح أو فشل الاتصال
 */
async function testConnection() {
  if (!pool) {
    console.error('❌ مجمع الاتصالات غير محدد');
    return false;
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    const now = result.rows[0].now;
    client.release();
    
    console.log(`✅ تم الاتصال بقاعدة البيانات بنجاح (وقت الخادم: ${now})`);
    return true;
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
    return false;
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
    throw new Error('مجمع الاتصالات غير محدد');
  }

  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log(`🔍 استعلام SQL (${duration}ms)`, { text, params });
    
    return result;
  } catch (err) {
    console.error('❌ خطأ في استعلام SQL:', err.message);
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
    throw new Error('مجمع الاتصالات غير محدد');
  }

  const client = await pool.connect();
  const originalRelease = client.release;
  
  // تعديل دالة release للمساعدة في تتبع الاتصالات
  client.release = () => {
    console.log('🔄 إعادة عميل إلى المجمع');
    return originalRelease.apply(client);
  };
  
  return client;
}

/**
 * إنشاء نسخة احتياطية من قاعدة البيانات
 * @returns {Promise<string|null>} مسار ملف النسخة الاحتياطية أو null في حالة الفشل
 */
async function backupDatabase() {
  if (!pool) {
    console.error('❌ مجمع الاتصالات غير محدد');
    return null;
  }

  try {
    console.log('🔄 بدء عملية النسخ الاحتياطي لقاعدة البيانات...');
    
    // الحصول على قائمة الجداول
    const tablesResult = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    if (tables.length === 0) {
      console.log('⚠️ لا توجد جداول للنسخ الاحتياطي');
      return null;
    }
    
    console.log(`📋 عدد الجداول للنسخ الاحتياطي: ${tables.length}`);
    
    // البيانات للنسخ الاحتياطي
    const backupData = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    // استخراج البيانات من كل جدول
    for (const table of tables) {
      const dataResult = await query(`SELECT * FROM "${table}"`);
      backupData.tables[table] = dataResult.rows;
      console.log(`📊 تم نسخ جدول ${table} (${dataResult.rows.length} سجل)`);
    }
    
    // حفظ البيانات في ملف
    const backupFileName = `backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    
    await fs.writeJson(backupFilePath, backupData, { spaces: 2 });
    console.log(`✅ تم حفظ النسخة الاحتياطية في: ${backupFilePath}`);
    
    return backupFilePath;
  } catch (err) {
    console.error('❌ خطأ في عملية النسخ الاحتياطي:', err.message);
    return null;
  }
}

/**
 * استعادة قاعدة البيانات من نسخة احتياطية
 * @param {string} backupFile مسار ملف النسخة الاحتياطية
 * @returns {Promise<boolean>} نجاح أو فشل الاستعادة
 */
async function restoreDatabase(backupFile) {
  if (!pool) {
    console.error('❌ مجمع الاتصالات غير محدد');
    return false;
  }

  try {
    console.log(`🔄 بدء استعادة قاعدة البيانات من: ${backupFile}`);
    
    // التحقق من وجود ملف النسخة الاحتياطية
    if (!fs.existsSync(backupFile)) {
      console.error(`❌ ملف النسخة الاحتياطية غير موجود: ${backupFile}`);
      return false;
    }
    
    // قراءة بيانات النسخة الاحتياطية
    const backupData = await fs.readJson(backupFile);
    
    if (!backupData.tables) {
      console.error('❌ بنية ملف النسخة الاحتياطية غير صالحة');
      return false;
    }
    
    const tables = Object.keys(backupData.tables);
    console.log(`📋 عدد الجداول للاستعادة: ${tables.length}`);
    
    // الحصول على اتصال منفصل للمعاملة
    const client = await getClient();
    
    try {
      // بدء معاملة لضمان تكامل البيانات
      await client.query('BEGIN');
      
      // استعادة البيانات لكل جدول
      for (const table of tables) {
        const tableData = backupData.tables[table];
        
        if (tableData.length > 0) {
          // حذف البيانات الحالية من الجدول
          await client.query(`DELETE FROM "${table}"`);
          console.log(`🗑️ تم حذف البيانات الحالية من جدول ${table}`);
          
          // إعادة إدخال البيانات المستعادة
          for (const row of tableData) {
            const columns = Object.keys(row);
            const values = Object.values(row);
            
            if (columns.length > 0) {
              const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
              
              const query = `
                INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')})
                VALUES (${placeholders})
              `;
              
              await client.query(query, values);
            }
          }
          
          console.log(`✅ تم استعادة جدول ${table} (${tableData.length} سجل)`);
        } else {
          console.log(`⚠️ جدول ${table} فارغ في النسخة الاحتياطية`);
        }
      }
      
      // تثبيت المعاملة
      await client.query('COMMIT');
      console.log('✅ تم استعادة قاعدة البيانات بنجاح');
      
      return true;
    } catch (err) {
      // التراجع عن المعاملة في حالة حدوث خطأ
      await client.query('ROLLBACK');
      console.error('❌ خطأ أثناء استعادة قاعدة البيانات:', err.message);
      return false;
    } finally {
      // إعادة الاتصال إلى المجمع
      client.release();
    }
  } catch (err) {
    console.error('❌ خطأ في عملية استعادة قاعدة البيانات:', err.message);
    return false;
  }
}

/**
 * الحصول على قائمة الجداول في قاعدة البيانات
 * @returns {Promise<string[]>} قائمة أسماء الجداول
 */
async function getTables() {
  if (!pool) {
    throw new Error('مجمع الاتصالات غير محدد');
  }

  const result = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  
  return result.rows.map(row => row.table_name);
}

/**
 * الحصول على معلومات حول قاعدة البيانات
 * @returns {Promise<Object>} معلومات قاعدة البيانات
 */
async function getDatabaseInfo() {
  if (!pool) {
    throw new Error('مجمع الاتصالات غير محدد');
  }

  // الحصول على قائمة الجداول
  const tables = await getTables();
  
  // الحصول على عدد السجلات في كل جدول
  const tablesInfo = [];
  
  for (const table of tables) {
    const countResult = await query(`SELECT COUNT(*) FROM "${table}"`);
    const count = parseInt(countResult.rows[0].count);
    
    tablesInfo.push({
      name: table,
      records: count
    });
  }
  
  // معلومات قاعدة البيانات
  const dbInfoResult = await query(`
    SELECT current_database() as db_name,
           current_user as db_user,
           version() as version
  `);
  
  const dbInfo = dbInfoResult.rows[0];
  
  return {
    tables_count: tables.length,
    database_name: dbInfo.db_name,
    database_user: dbInfo.db_user,
    database_version: dbInfo.version,
    tables: tablesInfo
  };
}

// تصدير الدوال
export {
  pool,
  testConnection,
  query,
  getClient,
  backupDatabase,
  restoreDatabase,
  getTables,
  getDatabaseInfo
};