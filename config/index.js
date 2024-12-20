require('dotenv').config();

const config = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        apiPrefix: '/api/v1'
    },

    // 数据库配置
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'jewelry_shop',
        debug: process.env.DB_DEBUG === 'true'
    },

    // JWT配置
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },

    // 密码加密配置
    bcrypt: {
        saltRounds: 10
    },

    // 跨域配置
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    },

    // 日志配置
    log: {
        level: process.env.LOG_LEVEL || 'info',
        filename: process.env.LOG_FILE || 'app.log'
    },

    // 文件上传配置
    upload: {
        maxSize: process.env.UPLOAD_MAX_SIZE || 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        uploadDir: process.env.UPLOAD_DIR || 'uploads/'
    },

    // 缓存配置
    cache: {
        ttl: process.env.CACHE_TTL || 3600, // 1小时
        checkPeriod: process.env.CACHE_CHECK_PERIOD || 600 // 10分钟
    },

    // 邮件配置
    mail: {
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT || 587,
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        },
        from: process.env.MAIL_FROM || 'noreply@example.com'
    },

    // 短信配置
    sms: {
        accessKeyId: process.env.SMS_ACCESS_KEY_ID,
        accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
        signName: process.env.SMS_SIGN_NAME,
        templateCode: process.env.SMS_TEMPLATE_CODE
    },

    // 分页配置
    pagination: {
        defaultPage: 1,
        defaultLimit: 10,
        maxLimit: 100
    },

    // 安全配置
    security: {
        // XSS防护
        xss: {
            enabled: true,
            whiteList: {} // 允许的HTML标签和属性
        },
        // CSRF防护
        csrf: {
            enabled: process.env.CSRF_ENABLED === 'true',
            secret: process.env.CSRF_SECRET || 'csrf-secret'
        },
        // 请求限制
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 100 // 限制每个IP在windowMs内最多100个请求
        }
    }
};

module.exports = config; 