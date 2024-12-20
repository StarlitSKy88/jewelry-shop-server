require('dotenv').config();
const app = require('./app');
const db = require('./models/db');

// 简单的错误处理
process.on('unhandledRejection', (err) => {
    console.error('未处理的Promise拒绝:', err);
});

process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

// 为了适应 serverless 环境，我们不需要显式监听端口
// Vercel 会自动处理请求转发
module.exports = app; 