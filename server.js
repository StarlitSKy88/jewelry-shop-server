require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./models/db');

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
    logger.error('未捕获的异常:', err);
    process.exit(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (err) => {
    logger.error('未处理的Promise拒绝:', err);
    process.exit(1);
});

// 启动服务器
const server = app.listen(config.server.port, () => {
    logger.info(`服务器已启动，运行在 ${config.server.env} 模式下`);
    logger.info(`监听端口: ${config.server.port}`);
    logger.info(`API地址: http://localhost:${config.server.port}${config.server.apiPrefix}`);
});

// 优雅关闭
const gracefulShutdown = async () => {
    logger.info('正在关闭服务器...');
    
    server.close(async () => {
        logger.info('HTTP服务器已关闭');
        
        try {
            // 关闭数据库连接
            await db.end();
            logger.info('数据库连接已关闭');
            process.exit(0);
        } catch (error) {
            logger.error('关闭数据库连接时出错:', error);
            process.exit(1);
        }
    });

    // 如果15秒内没有完成关闭，则强制退出
    setTimeout(() => {
        logger.error('无法正常关闭服务器，强制退出');
        process.exit(1);
    }, 15000);
};

// 监听终止信号
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown); 