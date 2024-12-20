const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.sqlpub' });

// 检查环境变量
console.log('环境变量:', {
  SQLPUB_HOST: process.env.SQLPUB_HOST,
  SQLPUB_PORT: process.env.SQLPUB_PORT,
  SQLPUB_USER: process.env.SQLPUB_USER,
  SQLPUB_PASSWORD: process.env.SQLPUB_PASSWORD,
  SQLPUB_DATABASE: process.env.SQLPUB_DATABASE
});

const createTables = async (connection) => {
  try {
    // 创建用户表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // 创建产品表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        category VARCHAR(50),
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // 创建订单表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // 创建订单详情表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT,
        product_id INT,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // 创建页面内容表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS page_contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        page_name VARCHAR(50) NOT NULL,
        section_name VARCHAR(50) NOT NULL,
        content TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY page_section (page_name, section_name)
      );
    `);

    console.log('所有表创建成功');
  } catch (err) {
    console.error('创建表时出错:', err);
    throw err;
  }
};

const initDatabase = async () => {
  let connection;
  try {
    // 使用sqlpub���置创建连接
    connection = await mysql.createConnection({
      host: process.env.SQLPUB_HOST || 'mysql.sqlpub.com',
      user: process.env.SQLPUB_USER,
      password: process.env.SQLPUB_PASSWORD,
      database: process.env.SQLPUB_DATABASE,
      port: process.env.SQLPUB_PORT || 3306
    });

    // 创建表
    await createTables(connection);
    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = {
  createTables,
  initDatabase
}; 