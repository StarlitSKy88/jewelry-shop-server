const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.sqlpub' });

const BATCH_SIZE = 1000; // 每批处理的记录数
const MAX_RETRIES = 3;   // 最大重试次数

async function createSourceConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

async function createTargetConnection() {
  return mysql.createConnection({
    host: process.env.SQLPUB_HOST,
    user: process.env.SQLPUB_USER,
    password: process.env.SQLPUB_PASSWORD,
    database: process.env.SQLPUB_DATABASE,
    port: process.env.SQLPUB_PORT
  });
}

async function retryOperation(operation, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`操作失败，${retries - i - 1}次重试机会...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}

function getColumnDefinition(column) {
  let def = `${column.Field} ${column.Type}`;
  
  if (column.Null === 'NO') {
    def += ' NOT NULL';
  }
  
  if (column.Default !== null) {
    if (column.Default === 'CURRENT_TIMESTAMP') {
      def += ' DEFAULT CURRENT_TIMESTAMP';
    } else {
      def += ` DEFAULT '${column.Default}'`;
    }
  }
  
  if (column.Extra) {
    if (column.Extra.includes('auto_increment')) {
      def += ' AUTO_INCREMENT';
    }
    if (column.Extra.includes('on update CURRENT_TIMESTAMP')) {
      def += ' ON UPDATE CURRENT_TIMESTAMP';
    }
  }
  
  return def;
}

async function disableForeignKeyChecks(conn) {
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
}

async function enableForeignKeyChecks(conn) {
  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
}

async function syncTable(sourceConn, targetConn, tableName) {
  console.log(`正在同步表 ${tableName}...`);
  
  try {
    // 禁用外键检查
    await disableForeignKeyChecks(targetConn);
    
    // 获取表结构
    const [columns] = await sourceConn.execute(`SHOW COLUMNS FROM ${tableName}`);
    const [keys] = await sourceConn.execute(`SHOW KEYS FROM ${tableName} WHERE Key_name = 'PRIMARY'`);
    
    // 获取外键约束
    const [fkeys] = await sourceConn.execute(`
      SELECT 
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME 
      FROM 
        information_schema.KEY_COLUMN_USAGE 
      WHERE 
        TABLE_SCHEMA = ? AND 
        TABLE_NAME = ? AND 
        REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME, tableName]);
    
    // 构建创建表的SQL
    let createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    createTableSQL += columns.map(col => '  ' + getColumnDefinition(col)).join(',\n');
    
    // 添加主键
    if (keys.length > 0) {
      createTableSQL += `,\n  PRIMARY KEY (${keys.map(key => key.Column_name).join(', ')})`;
    }
    
    // 添加外键
    if (fkeys.length > 0) {
      for (const fkey of fkeys) {
        createTableSQL += `,\n  FOREIGN KEY (${fkey.COLUMN_NAME}) REFERENCES ${fkey.REFERENCED_TABLE_NAME}(${fkey.REFERENCED_COLUMN_NAME})`;
      }
    }
    
    createTableSQL += '\n)';
    
    // 获取记录总数
    const [countResult] = await sourceConn.execute(`SELECT COUNT(*) as total FROM ${tableName}`);
    const totalRecords = countResult[0].total;
    
    // 在目标数据库创建表
    await targetConn.execute(`DROP TABLE IF EXISTS ${tableName}`);
    await targetConn.execute(createTableSQL);
    console.log(`表 ${tableName} 结构创建成功`);
    
    // 分批处理数据
    const batches = Math.ceil(totalRecords / BATCH_SIZE);
    console.log(`总记录数: ${totalRecords}, 分${batches}批处理`);
    
    for (let i = 0; i < batches; i++) {
      const offset = i * BATCH_SIZE;
      const [rows] = await sourceConn.execute(
        `SELECT * FROM ${tableName} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      );
      
      if (rows.length > 0) {
        const fields = Object.keys(rows[0]).join(', ');
        const placeholders = Array(Object.keys(rows[0]).length).fill('?').join(', ');
        const sql = `INSERT INTO ${tableName} (${fields}) VALUES (${placeholders})`;
        
        await retryOperation(async () => {
          for (const row of rows) {
            await targetConn.execute(sql, Object.values(row));
          }
        });
        
        console.log(`表 ${tableName} 完成第 ${i + 1}/${batches} 批同步，处理 ${rows.length} 条记录`);
      }
    }
    
    // 验证同步结果
    const [targetCount] = await targetConn.execute(`SELECT COUNT(*) as total FROM ${tableName}`);
    console.log(`表 ${tableName} 同步完成，源表: ${totalRecords} 条记录，目标表: ${targetCount[0].total} 条记录`);
    
    if (totalRecords !== targetCount[0].total) {
      console.warn(`警告：表 ${tableName} 的记录数不匹配！`);
    }
    
  } catch (error) {
    console.error(`同步表 ${tableName} 时出错:`, error);
    throw error;
  } finally {
    // 启用外键检查
    await enableForeignKeyChecks(targetConn);
  }
}

async function syncData() {
  console.log('开始数据同步...');
  console.log('同步时间:', new Date().toLocaleString());
  
  const sourceConn = await createSourceConnection();
  const targetConn = await createTargetConnection();
  
  try {
    const tables = process.env.SYNC_TABLES.split(',');
    
    for (const table of tables) {
      await retryOperation(() => syncTable(sourceConn, targetConn, table.trim()));
    }
    
    console.log('所有表同步完成');
    console.log('完成时间:', new Date().toLocaleString());
  } catch (error) {
    console.error('同步过程出错:', error);
  } finally {
    await sourceConn.end();
    await targetConn.end();
  }
}

// 设置定时同步任务
function setupSyncSchedule() {
  if (process.env.SYNC_ENABLED !== 'true') {
    console.log('同步功能未启用');
    return;
  }

  const interval = parseInt(process.env.SYNC_INTERVAL) || 5000;
  console.log(`设置定时同步任务，间隔: ${interval}ms`);
  
  // 立即执行一次同步
  syncData();
  
  // 设置定时任务
  setInterval(() => {
    console.log('执行定期同步...');
    syncData();
  }, interval);
}

// 启动同步任务
setupSyncSchedule(); 