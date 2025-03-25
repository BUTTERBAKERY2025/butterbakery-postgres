/**
 * ButterBakery OPS - ملف إعداد قاعدة بيانات Render
 * يستخدم هذا الملف لإعداد الجداول الضرورية في قاعدة البيانات عند التشغيل الأول
 */

const { query, testConnection, backupDatabase } = require('./db-connect');
const fs = require('fs');
const path = require('path');

// متغيرات البيئة
const BACKUP_DIR = './db-backups';

/**
 * التحقق من البيانات قبل التحديث
 * يستخدم لحفظ إحصائيات الجداول قبل أي تغييرات
 */
async function verifyDataBeforeDeploy() {
  try {
    console.log('🔍 التحقق من وجود بيانات قبل التحديث...');
    
    // عمل نسخة احتياطية قبل أي تغييرات
    const backupFile = await backupDatabase();
    if (backupFile) {
      console.log(`✅ تم إنشاء نسخة احتياطية قبل التحديث: ${backupFile}`);
    }
    
    // الحصول على قائمة الجداول
    const tablesResult = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    if (tables.length === 0) {
      console.log('⚠️ لا توجد جداول في قاعدة البيانات للتحقق منها');
      return false;
    }
    
    console.log(`📋 تم العثور على ${tables.length} جدول للتحقق`);
    
    // حفظ إحصائيات كل جدول
    const tableStats = {};
    
    for (const table of tables) {
      const countResult = await query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countResult.rows[0].count);
      tableStats[table] = count;
      console.log(`📊 جدول ${table}: ${count} سجل`);
    }
    
    // حفظ الإحصائيات في ملف مؤقت
    const statsFile = path.join(BACKUP_DIR, 'pre_deploy_stats.json');
    fs.writeFileSync(statsFile, JSON.stringify(tableStats, null, 2));
    console.log(`✅ تم حفظ إحصائيات ما قبل التحديث في: ${statsFile}`);
    
    return true;
  } catch (err) {
    console.error('❌ خطأ في التحقق من البيانات قبل التحديث:', err.message);
    return false;
  }
}

/**
 * التحقق من البيانات بعد التحديث
 * يستخدم للتأكد من عدم فقدان البيانات بعد التحديث
 */
async function verifyDataAfterDeploy() {
  try {
    console.log('🔍 التحقق من وجود بيانات بعد التحديث...');
    
    // قراءة إحصائيات ما قبل التحديث
    const statsFile = path.join(BACKUP_DIR, 'pre_deploy_stats.json');
    
    if (!fs.existsSync(statsFile)) {
      console.log('⚠️ لم يتم العثور على إحصائيات ما قبل التحديث');
      return false;
    }
    
    const prevStats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    const prevTables = Object.keys(prevStats);
    
    if (prevTables.length === 0) {
      console.log('⚠️ لا توجد إحصائيات سابقة للمقارنة');
      return false;
    }
    
    // الحصول على الإحصائيات الحالية
    let dataLossDetected = false;
    
    for (const table of prevTables) {
      try {
        const countResult = await query(`SELECT COUNT(*) FROM "${table}"`);
        const currentCount = parseInt(countResult.rows[0].count);
        const prevCount = prevStats[table];
        
        console.log(`📊 جدول ${table}: ${currentCount} سجل (سابقاً: ${prevCount})`);
        
        if (currentCount < prevCount) {
          console.error(`⚠️ تنبيه: تم فقدان بيانات في جدول ${table}! قبل: ${prevCount}, بعد: ${currentCount}`);
          dataLossDetected = true;
        }
      } catch (err) {
        console.error(`❌ خطأ في التحقق من جدول ${table}:`, err.message);
      }
    }
    
    if (dataLossDetected) {
      console.error('⚠️ تم اكتشاف فقدان بيانات! يجب استعادة النسخة الاحتياطية');
      return false;
    }
    
    console.log('✅ تم التحقق من البيانات بنجاح، لم يتم فقدان أي بيانات');
    
    // حذف ملف الإحصائيات المؤقت
    fs.unlinkSync(statsFile);
    console.log('🗑️ تم حذف ملف إحصائيات ما قبل التحديث');
    
    return true;
  } catch (err) {
    console.error('❌ خطأ في التحقق من البيانات بعد التحديث:', err.message);
    return false;
  }
}

/**
 * إنشاء الجداول الضرورية إذا لم تكن موجودة
 */
async function createTables() {
  try {
    console.log('🔄 جاري التحقق من وجود الجداول وإنشاؤها إذا لزم الأمر...');
    
    // جدول المستخدمين
    await query(`
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
    console.log('✅ تم التحقق من جدول users');
    
    // جدول الفروع
    await query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ تم التحقق من جدول branches');
    
    // جدول الأهداف الشهرية
    await query(`
      CREATE TABLE IF NOT EXISTS monthly_targets (
        id SERIAL PRIMARY KEY,
        branchId INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        targetAmount DECIMAL(10, 2) NOT NULL,
        currentAmount DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ تم التحقق من جدول monthly_targets');
    
    // جدول المبيعات اليومية
    await query(`
      CREATE TABLE IF NOT EXISTS daily_sales (
        id SERIAL PRIMARY KEY,
        branchId INTEGER NOT NULL,
        cashierId INTEGER NOT NULL,
        date DATE NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        cash DECIMAL(10, 2) NOT NULL,
        card DECIMAL(10, 2) NOT NULL,
        transactions INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        consolidatedId INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ تم التحقق من جدول daily_sales');
    
    // جدول المبيعات المجمعة
    await query(`
      CREATE TABLE IF NOT EXISTS consolidated_daily_sales (
        id SERIAL PRIMARY KEY,
        branchId INTEGER NOT NULL,
        date DATE NOT NULL,
        totalSales DECIMAL(10, 2) NOT NULL,
        totalCash DECIMAL(10, 2) NOT NULL,
        totalCard DECIMAL(10, 2) NOT NULL,
        totalTransactions INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        closedBy INTEGER,
        transferredBy INTEGER,
        closedAt TIMESTAMP,
        transferredAt TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ تم التحقق من جدول consolidated_daily_sales');
    
    // جدول الأنشطة
    await query(`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        branchId INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ تم التحقق من جدول activities');
    
    // جدول الإشعارات
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        userId INTEGER,
        title VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        isRead BOOLEAN DEFAULT FALSE,
        type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ تم التحقق من جدول notifications');
    
    // يمكن إضافة المزيد من الجداول حسب احتياجك
    
    console.log('✅ تم التحقق من وجود جميع الجداول بنجاح');
    return true;
  } catch (err) {
    console.error('❌ خطأ في إنشاء الجداول:', err.message);
    return false;
  }
}

/**
 * التحقق من وجود البيانات الأولية وإضافتها إذا لزم الأمر
 */
async function seedInitialData() {
  try {
    console.log('🔄 جاري التحقق من وجود البيانات الأولية...');
    
    // التحقق من وجود مستخدم مدير على الأقل
    const adminResult = await query(`
      SELECT COUNT(*) FROM users WHERE role = 'admin'
    `);
    
    if (parseInt(adminResult.rows[0].count) === 0) {
      console.log('⚙️ لا يوجد مستخدم مدير، جاري إنشاء مستخدم افتراضي...');
      
      // كلمة المرور هنا هي "admin" مشفرة
      // في الإنتاج يجب تغييرها
      await query(`
        INSERT INTO users (username, name, password_hash, role)
        VALUES ('admin', 'مدير النظام', '$2b$10$6jFJe0/XeQxcmjpOeNUFSOj8ReBPYZiGb4L5o/7N1rOGkFTk9hBpO', 'admin')
      `);
      
      console.log('✅ تم إنشاء مستخدم مدير افتراضي');
    } else {
      console.log('✅ يوجد مستخدم مدير بالفعل');
    }
    
    // التحقق من وجود فرع واحد على الأقل
    const branchResult = await query(`
      SELECT COUNT(*) FROM branches
    `);
    
    if (parseInt(branchResult.rows[0].count) === 0) {
      console.log('⚙️ لا توجد فروع، جاري إنشاء فرع افتراضي...');
      
      await query(`
        INSERT INTO branches (name, location)
        VALUES ('الفرع الرئيسي', 'الرياض')
      `);
      
      console.log('✅ تم إنشاء فرع افتراضي');
    } else {
      console.log('✅ توجد فروع بالفعل');
    }
    
    // يمكن إضافة المزيد من البيانات الأولية حسب الحاجة
    
    console.log('✅ تم التحقق من البيانات الأولية بنجاح');
    return true;
  } catch (err) {
    console.error('❌ خطأ في إعداد البيانات الأولية:', err.message);
    return false;
  }
}

/**
 * الدالة الرئيسية لإعداد قاعدة البيانات
 */
async function setupDatabase() {
  try {
    console.log('🚀 بدء إعداد قاعدة البيانات...');
    
    // اختبار الاتصال بقاعدة البيانات
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ تعذر الاتصال بقاعدة البيانات! تأكد من ضبط متغير البيئة DATABASE_URL بشكل صحيح.');
      return false;
    }
    
    // التحقق من البيانات قبل إجراء أي تغييرات
    await verifyDataBeforeDeploy();
    
    // إنشاء الجداول إذا لم تكن موجودة
    const tablesCreated = await createTables();
    if (!tablesCreated) {
      console.error('❌ فشل إنشاء الجداول!');
      return false;
    }
    
    // إضافة البيانات الأولية إذا لزم الأمر
    const dataSeed = await seedInitialData();
    if (!dataSeed) {
      console.error('❌ فشل إضافة البيانات الأولية!');
      return false;
    }
    
    // التحقق من البيانات بعد التغييرات
    await verifyDataAfterDeploy();
    
    console.log('✅ تم إعداد قاعدة البيانات بنجاح');
    return true;
  } catch (err) {
    console.error('❌ خطأ في إعداد قاعدة البيانات:', err.message);
    return false;
  }
}

// تنفيذ إعداد قاعدة البيانات إذا تم تشغيل هذا الملف مباشرة
if (require.main === module) {
  setupDatabase()
    .then(success => {
      if (success) {
        console.log('✅ تم إكمال إعداد قاعدة البيانات بنجاح');
      } else {
        console.error('❌ فشل إعداد قاعدة البيانات');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('❌ خطأ غير متوقع أثناء إعداد قاعدة البيانات:', err.message);
      process.exit(1);
    });
}

// تصدير الدوال
module.exports = {
  setupDatabase,
  createTables,
  seedInitialData,
  verifyDataBeforeDeploy,
  verifyDataAfterDeploy
};