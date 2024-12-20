require('dotenv').config();
const app = require('./app');
const db = require('./models/db');

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        status: 'error',
        message: err.message || '服务器内部错误',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 处理未捕获的Promise拒绝
process.on('unhandledRejection', (err) => {
    console.error('未处理的Promise拒绝:', err);
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

// 数据库连接错误处理
db.on('error', (err) => {
    console.error('数据库连接错误:', err);
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: '请求的资源不存在'
    });
});

// 为了适应 serverless 环境，我们不需要显式监听端口
// Vercel 会自动处理请求转发
module.exports = app; 