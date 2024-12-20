const winston = require('winston');
const path = require('path');
const config = require('../config');

// 定义日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// 创建日志目录
const logDir = path.join(__dirname, '../logs');

// 创建日志记录器
const logger = winston.createLogger({
    level: config.log.level,
    format: logFormat,
    defaultMeta: { service: 'jewelry-shop' },
    transports: [
        // 错误日志文件
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // 所有日志文件
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

// 在开发环境下添加控制台输出
if (config.server.env !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// 添加请求日志中间件
logger.middleware = (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);

    // 记录请求开始
    logger.info('Request started', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });

    // 响应完成时记录
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Request completed', {
            requestId,
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`
        });
    });

    // 发生错误时记录
    res.on('error', (error) => {
        logger.error('Request error', {
            requestId,
            method: req.method,
            url: req.url,
            error: error.message,
            stack: error.stack
        });
    });

    next();
};

// 添加错误日志方法
logger.logError = (error, req = null) => {
    const errorLog = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    };

    if (req) {
        errorLog.request = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            query: req.query,
            body: req.body
        };
    }

    logger.error('Application error', errorLog);
};

// 添加审计日志方法
logger.audit = (action, user, details) => {
    logger.info('Audit log', {
        action,
        user: user ? {
            id: user.id,
            username: user.username,
            role: user.role
        } : null,
        details,
        timestamp: new Date().toISOString()
    });
};

// 添加性能日志方法
logger.performance = (operation, duration, details = {}) => {
    logger.info('Performance log', {
        operation,
        duration: `${duration}ms`,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// 添加安全日志方法
logger.security = (event, details) => {
    logger.warn('Security event', {
        event,
        ...details,
        timestamp: new Date().toISOString()
    });
};

module.exports = logger; 