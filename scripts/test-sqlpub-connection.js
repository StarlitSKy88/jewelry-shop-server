const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.sqlpub' });

async function testSQLPubConnection() {
  const connection = await mysql.createConnection({
    host: process.env.SQLPUB_HOST || 'mysql.sqlpub.com',
    user: process.env.SQLPUB_USER,
    password: process.env.SQLPUB_PASSWORD,
    database: process.env.SQLPUB_DATABASE,
    port: process.env.SQLPUB_PORT || 3306
  });

  try {
    // 测试连接
    console.log('正在连接到 SQLPub...');
    await connection.connect();
    console.log('成功连接到 SQLPub!');

    // 测试查询
    console.log('正在执行测试查询...');
    const [rows] = await connection.execute('SHOW TABLES');
    console.log('数据库中的表:');
    console.table(rows);

    // 测试写入权限
    console.log('正在测试写入权限...');
    await connection.execute('CREATE TABLE IF NOT EXISTS test_sync (id INT)');
    await connection.execute('DROP TABLE test_sync');
    console.log('写入权限测试通过');

  } catch (error) {
    console.error('连接或查询出错:', error);
  } finally {
    await connection.end();
    console.log('连接已关闭');
  }
}

testSQLPubConnection(); 