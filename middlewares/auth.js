const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db');

// 验证JWT token
const auth = async (req, res, next) => {
  try {
    // 从请求头获取token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }

    // 验证token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // 从数据库获取用户信息
    const [rows] = await pool.query(
      'SELECT id, username, email, role, status FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      throw new Error();
    }

    const user = rows[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(401).json({ message: '账户已被禁用' });
    }

    // 将用户信息添加到请求对象
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 验证管理员权限
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '没有访问权限' });
  }
  next();
};

module.exports = {
  auth,
  isAdmin
}; 