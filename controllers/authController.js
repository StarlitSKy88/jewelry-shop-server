const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

// 用户注册
const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 检查邮箱是否已存在
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: '该邮箱已被注册' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 生成验证令牌
    const verificationToken = jwt.sign(
      { email },
      config.jwt.verificationSecret,
      { expiresIn: '24h' }
    );

    // 创建用户
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, verification_token, status) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, verificationToken, 'pending']
    );

    // ���送验证邮件
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message: '注册成功，请查收验证邮件',
      userId: result.insertId
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
};

// 用户登录
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 查找用户
    const [users] = await pool.query(
      'SELECT id, username, email, password, status, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    // 检查账户状态
    if (user.status === 'pending') {
      return res.status(403).json({ message: '请先验证邮箱' });
    }
    if (user.status === 'disabled') {
      return res.status(403).json({ message: '账户已被禁用' });
    }

    // 生成访问令牌
    const accessToken = jwt.sign(
      { userId: user.id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // 生成刷新令牌
    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.refreshSecret,
      { expiresIn: '7d' }
    );

    // 保存刷新令牌
    await pool.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [refreshToken, user.id]
    );

    // 返回用户信息和令牌
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
};

// 刷新访问令牌
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: '刷新令牌是必需的' });
  }

  try {
    // 验证刷新令牌
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

    // 检查刷新令牌是否存在于数据库
    const [users] = await pool.query(
      'SELECT id, refresh_token FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0 || users[0].refresh_token !== refreshToken) {
      return res.status(401).json({ message: '无效的刷新���牌' });
    }

    // 生成新的访问令牌
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({ accessToken });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '无效的刷新令牌' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '刷新令牌已过期' });
    }
    console.error('刷新令牌错误:', error);
    res.status(500).json({ message: '刷新令牌失败，请稍后重试' });
  }
};

// 验证邮箱
const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    // 验证令牌
    const decoded = jwt.verify(token, config.jwt.verificationSecret);

    // 更新用户状态
    const [result] = await pool.query(
      'UPDATE users SET status = ?, verification_token = NULL WHERE email = ? AND verification_token = ?',
      ['active', decoded.email, token]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: '无效的验证链接' });
    }

    res.json({ message: '邮箱验证成功' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: '无效的验证��接' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: '验证链接已过期' });
    }
    console.error('邮箱验证错误:', error);
    res.status(500).json({ message: '邮箱验证失败，请稍后重试' });
  }
};

// 忘记密码
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // 检查用户是否存在
    const [users] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: '该邮箱未注册' });
    }

    // 生成密码重置令牌
    const resetToken = jwt.sign(
      { userId: users[0].id },
      config.jwt.resetSecret,
      { expiresIn: '1h' }
    );

    // 保存密码重置令牌
    await pool.query(
      'UPDATE users SET reset_token = ? WHERE id = ?',
      [resetToken, users[0].id]
    );

    // 发送密码重置邮件
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: '密码重置邮件已发送' });
  } catch (error) {
    console.error('忘记密码错误:', error);
    res.status(500).json({ message: '发送重置邮件失败，请稍后重试' });
  }
};

// 重置密码
const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    // 验证令牌
    const decoded = jwt.verify(token, config.jwt.resetSecret);

    // 加密新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 更新密码
    const [result] = await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL WHERE id = ? AND reset_token = ?',
      [hashedPassword, decoded.userId, token]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: '无效的重置链接' });
    }

    res.json({ message: '密码重置成功' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: '无效的重置链接' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: '重置链接已过期' });
    }
    console.error('重置密码错误:', error);
    res.status(500).json({ message: '重置密码失败，请稍后重试' });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword
}; 