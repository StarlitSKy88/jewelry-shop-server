const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

async function initializeDatabase() {
    try {
        // 创建数据库连接
        const connection = await mysql.createConnection({
            host: config.db.host,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
            multipleStatements: true
        });

        console.log('数据库连接成功');

        // 读取SQL文件
        const sqlFile = path.join(__dirname, '../create-tables.sql');
        const sqlContent = await fs.readFile(sqlFile, 'utf8');

        // 执行SQL语句
        await connection.query(sqlContent);
        console.log('数据库表创建成功');

        // 关闭连接
        await connection.end();
        console.log('数据库连接已关闭');
        process.exit(0);
    } catch (error) {
        console.error('初始化数据库失败:', error);
        process.exit(1);
    }
}

initializeDatabase(); 