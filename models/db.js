const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../utils/logger');

// 创建数据库连接池
const pool = mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00'
});

// 测试数据库连接
pool.getConnection()
    .then(connection => {
        logger.info('数据库连接成功');
        connection.release();
    })
    .catch(error => {
        logger.error('数据库连接失败:', error);
        process.exit(1);
    });

// 扩展连接池，添加事务支持
const db = {
    // 执行SQL查询
    query: async (sql, params) => {
        try {
            const result = await pool.execute(sql, params);
            return result;
        } catch (error) {
            logger.error('SQL查询错误:', error);
            throw error;
        }
    },

    // 开始事务
    beginTransaction: async () => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        return connection;
    },

    // 提交事务
    commit: async (connection) => {
        try {
            await connection.commit();
        } finally {
            connection.release();
        }
    },

    // 回滚事务
    rollback: async (connection) => {
        try {
            await connection.rollback();
        } finally {
            connection.release();
        }
    },

    // 在事务中执行查询
    queryWithTransaction: async (connection, sql, params) => {
        try {
            const result = await connection.execute(sql, params);
            return result;
        } catch (error) {
            logger.error('事务查询错误:', error);
            throw error;
        }
    },

    // 批量执行SQL查询
    batchQuery: async (queries) => {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const results = [];
            
            for (const query of queries) {
                const result = await connection.execute(query.sql, query.params);
                results.push(result);
            }
            
            await connection.commit();
            return results;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    // 执行带有分页的查询
    queryWithPagination: async (sql, countSql, params = [], page = 1, limit = 10) => {
        const offset = (page - 1) * limit;
        const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
        const paginatedParams = [...params, limit, offset];

        try {
            const [rows] = await pool.execute(paginatedSql, paginatedParams);
            const [countResult] = await pool.execute(countSql, params);
            const total = countResult[0].total;

            return {
                data: rows,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('分页查询错误:', error);
            throw error;
        }
    }
};

module.exports = db; 