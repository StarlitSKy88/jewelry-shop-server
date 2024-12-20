const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const config = require('../config');
const logger = require('../utils/logger');

// 用户注册
const register = async (req, res) => {
    try {
        const { username, email, password, real_name, phone } = req.body;

        // 检查用户名是否已存在
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: '用户名或邮箱已被使用' });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);

        // 创建用户
        const [result] = await db.query(
            `INSERT INTO users (username, email, password, real_name, phone, role, status)
             VALUES (?, ?, ?, ?, ?, 'user', 'active')`,
            [username, email, hashedPassword, real_name, phone]
        );

        // 创建JWT令牌
        const token = jwt.sign(
            { userId: result.insertId },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.status(201).json({
            message: '注册成功',
            token,
            user: {
                id: result.insertId,
                username,
                email,
                real_name,
                phone,
                role: 'user'
            }
        });
    } catch (error) {
        logger.error('用户注册失败:', error);
        res.status(500).json({ message: '注册失败，请稍后重试' });
    }
};

// 用户登录
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 查找用户
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        const user = users[0];

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: '账号已被禁用' });
        }

        // 更新最后登录时间
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // 创建JWT令牌
        const token = jwt.sign(
            { userId: user.id },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                real_name: user.real_name,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        logger.error('用户登录失败:', error);
        res.status(500).json({ message: '登录失败，请稍后重试' });
    }
};

// 刷新令牌
const refreshToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: '未提供令牌' });
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const [users] = await db.query(
            'SELECT id, username, email, role FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: '用户不存在' });
        }

        const user = users[0];
        const newToken = jwt.sign(
            { userId: user.id },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            message: '令牌刷新成功',
            token: newToken
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '令牌已过期' });
        }
        logger.error('令牌刷新失败:', error);
        res.status(500).json({ message: '令牌刷新失败' });
    }
};

// 创建新用户（管理员）
const createUser = async (req, res) => {
    try {
        const { username, email, password, real_name, phone, role } = req.body;

        // 检查用户名和邮箱是否已存在
        const [existingUser] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ message: '用户名或邮箱已存在' });
        }

        // 密码加密
        const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);

        // 创建用户
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, real_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, real_name, phone, role || 'user']
        );

        logger.info(`新用户创建成功: ${username}`);
        res.status(201).json({
            message: '用户创建成功',
            userId: result.insertId
        });
    } catch (error) {
        logger.error('创建用户失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取用户列表
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT id, username, email, real_name, phone, role, status, last_login, created_at FROM users';
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        let params = [];

        if (search) {
            query += ' WHERE username LIKE ? OR email LIKE ? OR real_name LIKE ?';
            countQuery += ' WHERE username LIKE ? OR email LIKE ? OR real_name LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam, searchParam];
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [users] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, search ? params.slice(0, 3) : []);

        res.json({
            users,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取用户列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取单个用户信息
const getUser = async (req, res) => {
    try {
        const { id } = req.params;

        const [user] = await db.query(
            'SELECT id, username, email, real_name, phone, role, status, last_login, created_at FROM users WHERE id = ?',
            [id]
        );

        if (user.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        // 获取用户角色
        const [roles] = await db.query(
            'SELECT r.* FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?',
            [id]
        );

        user[0].roles = roles;
        res.json(user[0]);
    } catch (error) {
        logger.error('获取用户信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新用户信息
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { real_name, phone, status, role } = req.body;

        const [user] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
        if (user.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        await db.query(
            'UPDATE users SET real_name = ?, phone = ?, status = ?, role = ? WHERE id = ?',
            [real_name, phone, status, role, id]
        );

        logger.info(`用户信息更新成功: ${id}`);
        res.json({ message: '用户信息更新成功' });
    } catch (error) {
        logger.error('更新用户信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除用户
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const [user] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
        if (user.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        await db.query('DELETE FROM users WHERE id = ?', [id]);

        logger.info(`用户删除成功: ${id}`);
        res.json({ message: '用户删除成功' });
    } catch (error) {
        logger.error('删除用户失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 分配用户角色
const assignRole = async (req, res) => {
    try {
        const { userId, roleIds } = req.body;

        // 验证用户是否存在
        const [user] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (user.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        // 验证角色是否存在
        const [roles] = await db.query(
            'SELECT id FROM roles WHERE id IN (?)',
            [roleIds]
        );

        if (roles.length !== roleIds.length) {
            return res.status(400).json({ message: '存在无效的角色ID' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 删除用户现有角色
            await db.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

            // 分配新角色
            for (const roleId of roleIds) {
                await db.query(
                    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                    [userId, roleId]
                );
            }

            await db.commit();
            logger.info(`用户角色分配成功: ${userId}`);
            res.json({ message: '角色分配成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('分配用户角色失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 修改密码
const changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { oldPassword, newPassword } = req.body;

        // 验证用户是否存在
        const [user] = await db.query(
            'SELECT password FROM users WHERE id = ?',
            [id]
        );

        if (user.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        // 验证旧密码
        const isMatch = await bcrypt.compare(oldPassword, user[0].password);
        if (!isMatch) {
            return res.status(400).json({ message: '旧密码不正确' });
        }

        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

        // 更新密码
        await db.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );

        logger.info(`用户密码修改成功: ${id}`);
        res.json({ message: '密码修改成功' });
    } catch (error) {
        logger.error('修改密码失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    createUser,
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    assignRole,
    changePassword
}; 