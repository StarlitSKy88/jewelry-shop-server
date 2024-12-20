const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// 加载sqlpub配置
dotenv.config({ path: '.env.sqlpub' });

const pool = mysql.createPool({
  host: process.env.SQLPUB_HOST || 'mysql.sqlpub.com',
  port: process.env.SQLPUB_PORT || 3306,
  user: process.env.SQLPUB_USER || 'dianshang',
  password: process.env.SQLPUB_PASSWORD || 'bU8xhiTcnRzalKAT',
  database: process.env.SQLPUB_DATABASE || 'dianshang',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: true
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}; 