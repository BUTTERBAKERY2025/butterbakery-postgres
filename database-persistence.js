/**
 * نظام الحفاظ على قاعدة البيانات عند تحديث التطبيق
 * يستخدم هذا الملف للتأكد من عدم فقدان البيانات عند نشر تحديثات على Render.com
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// قراءة متغيرات البيئة أو استخدام قيم افتراضية
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_PERSISTENCE_DIR = process.env.DATA_PERSISTENCE_DIR || './data-persistence';

/**
 * التأكد من وجود مجلد حفظ البيانات
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_PERSISTENCE_DIR)) {
    console.log(`🔄 إنشاء مجلد حفظ البيانات: ${DATA_PERSISTENCE_DIR}`);
    fs.mkdirSync(DATA_PERSISTENCE_DIR, { recursive: true });
  }
}

/**
 * الاتصال بقاعدة البيانات
 */
async function connectToDatabase() {
  if (!DATABASE_URL) {
    console.error('❌ لم يتم تحديد DATABASE_URL في متغيرات البيئة');
    return null;
  }

  try {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
    return client;
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    return null;
  }
}

/**
 * النسخ الاحتياطي لقاعدة البيانات قبل التحديث
 */
async function backupDatabase() {
  ensureDataDirectory();
  
  console.log('🔄 جاري النسخ الاحتياطي لقاعدة البيانات...');
  
  const client = await connectToDatabase();
  if (!client) return false;
  
  try {
    // الحصول على قائمة الجداول
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📋 تم العثور على ${tables.length} جدول في قاعدة البيانات`);
    
    // النسخ الاحتياطي لكل جدول
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {};
    
    for (const table of tables) {
      const dataResult = await client.query(`SELECT * FROM "${table}"`);
      backupData[table] = dataResult.rows;
      console.log(`📦 تم نسخ ${dataResult.rows.length} سجل من جدول ${table}`);
    }
    
    // حفظ البيانات في ملف
    const backupFilePath = path.join(DATA_PERSISTENCE_DIR, `backup-${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    
    console.log(`✅ تم النسخ الاحتياطي بنجاح إلى: ${backupFilePath}`);
    
    await client.end();
    return backupFilePath;
  } catch (error) {
    console.error('❌ خطأ في النسخ الاحتياطي:', error.message);
    if (client) await client.end();
    return false;
  }
}

/**
 * استعادة قاعدة البيانات بعد التحديث
 */
async function restoreDatabaseIfEmpty(backupFilePath) {
  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    // البحث عن أحدث نسخة احتياطية
    ensureDataDirectory();
    const backupFiles = fs.readdirSync(DATA_PERSISTENCE_DIR)
      .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      console.log('⚠️ لا توجد نسخ احتياطية للاستعادة');
      return false;
    }
    
    backupFilePath = path.join(DATA_PERSISTENCE_DIR, backupFiles[0]);
  }
  
  console.log(`🔄 جاري التحقق من حالة قاعدة البيانات واستعادتها إذا لزم الأمر...`);
  
  const client = await connectToDatabase();
  if (!client) return false;
  
  try {
    // التحقق مما إذا كانت قاعدة البيانات فارغة
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // التحقق مما إذا كانت الجداول فارغة
    let isEmpty = true;
    for (const table of tables) {
      const countResult = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      if (parseInt(countResult.rows[0].count) > 0) {
        isEmpty = false;
        break;
      }
    }
    
    // إذا كانت قاعدة البيانات غير فارغة، لا تقم بالاستعادة
    if (!isEmpty && tables.length > 0) {
      console.log('✅ قاعدة البيانات تحتوي على بيانات، لا حاجة للاستعادة');
      await client.end();
      return true;
    }
    
    // استعادة البيانات من النسخة الاحتياطية
    console.log(`🔄 جاري استعادة البيانات من: ${backupFilePath}`);
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    // التأكد من وجود الجداول وإنشاؤها إذا لزم الأمر (هذا مبسط ويحتاج إلى تعديل حسب هيكل قاعدة البيانات)
    // هنا يجب إضافة رمز إنشاء الجداول إذا لم تكن موجودة
    
    // استعادة البيانات لكل جدول
    for (const table in backupData) {
      if (backupData[table].length > 0) {
        // تنظيف الجدول قبل الاستعادة
        await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
        
        // استخراج أسماء الأعمدة من أول صف
        const columns = Object.keys(backupData[table][0]);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        
        // إدراج البيانات
        for (const row of backupData[table]) {
          const values = columns.map(col => {
            const value = row[col];
            return value === null ? 'NULL' : 
                   typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : 
                   value;
          }).join(', ');
          
          await client.query(`INSERT INTO "${table}" (${columnNames}) VALUES (${values})`);
        }
        
        console.log(`📦 تم استعادة ${backupData[table].length} سجل إلى جدول ${table}`);
      }
    }
    
    console.log('✅ تم استعادة قاعدة البيانات بنجاح');
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ خطأ في استعادة البيانات:', error.message);
    if (client) await client.end();
    return false;
  }
}

/**
 * التحقق من صحة الجداول وإنشاؤها إذا لم تكن موجودة
 * هذه الدالة تستخدم لضمان وجود بنية قاعدة البيانات حتى إذا لم تكن هناك بيانات لاستعادتها
 */
async function ensureDatabaseSchema() {
  console.log('🔄 التحقق من هيكل قاعدة البيانات...');
  
  const client = await connectToDatabase();
  if (!client) return false;
  
  try {
    // تنفيذ استعلامات SQL لإنشاء الجداول إذا لم تكن موجودة
    // هذا مثال، يجب تعديله حسب هيكل قاعدة البيانات الخاصة بك
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        branchId INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // إضافة المزيد من الجداول حسب احتياجاتك...
    
    console.log('✅ تم التحقق من هيكل قاعدة البيانات بنجاح');
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ خطأ في التحقق من هيكل قاعدة البيانات:', error.message);
    if (client) await client.end();
    return false;
  }
}

/**
 * العملية الكاملة للحفاظ على البيانات عند التحديث
 */
async function maintainDataPersistence() {
  try {
    console.log('🚀 بدء عملية الحفاظ على البيانات...');
    
    // 1. النسخ الاحتياطي لقاعدة البيانات قبل التحديث
    const backupFilePath = await backupDatabase();
    
    // 2. التأكد من صحة هيكل قاعدة البيانات
    await ensureDatabaseSchema();
    
    // 3. استعادة البيانات إذا كانت قاعدة البيانات فارغة
    await restoreDatabaseIfEmpty(backupFilePath);
    
    console.log('✅ تمت عملية الحفاظ على البيانات بنجاح');
    return true;
  } catch (error) {
    console.error('❌ خطأ في عملية الحفاظ على البيانات:', error.message);
    return false;
  }
}

// تصدير الدوال للاستخدام في ملفات أخرى
module.exports = {
  backupDatabase,
  restoreDatabaseIfEmpty,
  ensureDatabaseSchema,
  maintainDataPersistence
};

// إذا تم تشغيل هذا الملف مباشرة
if (require.main === module) {
  // تنفيذ العملية الكاملة
  maintainDataPersistence().then(success => {
    if (success) {
      console.log('✅ تمت العملية بنجاح');
    } else {
      console.error('❌ فشلت العملية');
      process.exit(1);
    }
  });
}