const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middlewares/validation');

// 注册
router.post('/register', validateRegistration, authController.register);

// 登录
router.post('/login', validateLogin, authController.login);

// 刷新token
router.post('/refresh-token', authController.refreshToken);

// 忘记密码
router.post('/forgot-password', authController.forgotPassword);

// 重置密码
router.post('/reset-password', authController.resetPassword);

// 验证邮箱
router.get('/verify-email/:token', authController.verifyEmail);

module.exports = router; 