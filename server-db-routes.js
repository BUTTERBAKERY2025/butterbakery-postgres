/**
 * ButterBakery OPS - نقاط نهاية قاعدة البيانات
 * هذا الملف يحتوي على نقاط نهاية إضافية للتحقق من حالة قاعدة البيانات واستعراض المعلومات
 */

const { getDatabaseInfo, backupDatabase, restoreDatabase, query } = require('./db-connect');

/**
 * إضافة نقاط نهاية قاعدة البيانات إلى التطبيق
 * @param {Express} app تطبيق Express
 */
function addDatabaseRoutes(app) {
  console.log('🔄 إضافة نقاط نهاية قاعدة البيانات...');
  
  // نقطة نهاية للتحقق من صحة قاعدة البيانات
  app.get('/api/db-status', async (req, res) => {
    try {
      console.log('🔍 طلب حالة قاعدة البيانات');
      
      // التحقق من الاتصال بقاعدة البيانات
      const result = await query('SELECT NOW() as time, current_database() as db_name, current_user as db_user');
      
      // الحصول على معلومات حول قاعدة البيانات (عدد الجداول والسجلات)
      const dbInfo = await getDatabaseInfo();
      
      res.json({
        status: 'success',
        connected: true,
        database_info: {
          name: result.rows[0].db_name,
          user: result.rows[0].db_user,
          server_time: result.rows[0].time,
          tables_count: dbInfo.tables_count,
        },
        tables: dbInfo.tables,
        message: 'تم الاتصال بقاعدة البيانات بنجاح'
      });
    } catch (err) {
      console.error('❌ خطأ في التحقق من حالة قاعدة البيانات:', err.message);
      
      res.status(500).json({
        status: 'error',
        connected: false,
        message: 'فشل الاتصال بقاعدة البيانات: ' + err.message
      });
    }
  });
  
  // نقطة نهاية لعرض محتويات جدول معين (للمشرفين فقط)
  app.get('/api/db-table/:tableName', async (req, res) => {
    try {
      // هنا يمكن إضافة التحقق من صلاحيات المستخدم
      // if (!req.user || req.user.role !== 'admin') {
      //   return res.status(403).json({ 
      //     status: 'error', 
      //     message: 'غير مصرح بالوصول'
      //   });
      // }
      
      const { tableName } = req.params;
      const limit = req.query.limit || 100;
      const offset = req.query.offset || 0;
      
      // التحقق من تصفية اسم الجدول لتجنب SQL Injection
      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      
      if (safeTableName !== tableName) {
        return res.status(400).json({
          status: 'error',
          message: 'اسم جدول غير صالح'
        });
      }
      
      // التحقق من وجود الجدول
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists
      `, [safeTableName]);
      
      if (!tableCheck.rows[0].exists) {
        return res.status(404).json({
          status: 'error',
          message: `الجدول ${safeTableName} غير موجود`
        });
      }
      
      // الحصول على عدد السجلات الإجمالي
      const countResult = await query(`SELECT COUNT(*) FROM "${safeTableName}"`);
      const totalCount = parseInt(countResult.rows[0].count);
      
      // الحصول على السجلات
      const result = await query(`SELECT * FROM "${safeTableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
      
      res.json({
        status: 'success',
        table: safeTableName,
        rows: result.rows,
        count: result.rowCount,
        total: totalCount,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (err) {
      console.error('❌ خطأ في استعلام قاعدة البيانات:', err.message);
      
      res.status(500).json({
        status: 'error',
        message: 'خطأ في استعلام قاعدة البيانات: ' + err.message
      });
    }
  });
  
  // نقطة نهاية لعمل نسخة احتياطية من قاعدة البيانات (للمشرفين فقط)
  app.post('/api/db-backup', async (req, res) => {
    try {
      // التحقق من صلاحيات المستخدم (مثال)
      // if (!req.user || req.user.role !== 'admin') {
      //   return res.status(403).json({ 
      //     status: 'error', 
      //     message: 'غير مصرح بالوصول'
      //   });
      // }
      
      const backupFilePath = await backupDatabase();
      
      if (backupFilePath) {
        res.json({
          status: 'success',
          message: 'تم إنشاء نسخة احتياطية بنجاح',
          backup_file: backupFilePath
        });
      } else {
        res.status(500).json({
          status: 'error',
          message: 'فشل إنشاء النسخة الاحتياطية'
        });
      }
    } catch (err) {
      console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', err.message);
      
      res.status(500).json({
        status: 'error',
        message: 'خطأ في إنشاء النسخة الاحتياطية: ' + err.message
      });
    }
  });
  
  // نقطة نهاية لاستعادة قاعدة البيانات من نسخة احتياطية (للمشرفين فقط)
  app.post('/api/db-restore', async (req, res) => {
    try {
      // التحقق من صلاحيات المستخدم (مثال)
      // if (!req.user || req.user.role !== 'admin') {
      //   return res.status(403).json({ 
      //     status: 'error', 
      //     message: 'غير مصرح بالوصول'
      //   });
      // }
      
      const { backupFile } = req.body;
      
      if (!backupFile) {
        return res.status(400).json({
          status: 'error',
          message: 'لم يتم تحديد ملف النسخة الاحتياطية'
        });
      }
      
      const success = await restoreDatabase(backupFile);
      
      if (success) {
        res.json({
          status: 'success',
          message: 'تم استعادة قاعدة البيانات بنجاح'
        });
      } else {
        res.status(500).json({
          status: 'error',
          message: 'فشل استعادة قاعدة البيانات'
        });
      }
    } catch (err) {
      console.error('❌ خطأ في استعادة قاعدة البيانات:', err.message);
      
      res.status(500).json({
        status: 'error',
        message: 'خطأ في استعادة قاعدة البيانات: ' + err.message
      });
    }
  });
  
  // نقطة نهاية للحصول على قائمة النسخ الاحتياطية المتاحة
  app.get('/api/db-backups', (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const BACKUP_DIR = './db-backups';
      
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({
          status: 'success',
          backups: []
        });
      }
      
      const backupFiles = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created_at: stats.mtime
          };
        })
        .sort((a, b) => b.created_at - a.created_at); // ترتيب تنازلي حسب تاريخ الإنشاء
      
      res.json({
        status: 'success',
        backups: backupFiles
      });
    } catch (err) {
      console.error('❌ خطأ في الحصول على قائمة النسخ الاحتياطية:', err.message);
      
      res.status(500).json({
        status: 'error',
        message: 'خطأ في الحصول على قائمة النسخ الاحتياطية: ' + err.message
      });
    }
  });
  
  console.log('✅ تم إضافة نقاط نهاية قاعدة البيانات بنجاح');
}

module.exports = addDatabaseRoutes;