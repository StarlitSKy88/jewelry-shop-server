const db = require('../models/db');
const logger = require('../utils/logger');

// 创建权限
exports.createPermission = async (req, res) => {
    try {
        const { name, description, module, operation } = req.body;

        if (!name || !module || !operation) {
            return res.status(400).json({ message: '权限名称、模块和操作类型为必填项' });
        }

        // 检查权限名是否已存在
        const [existingPermission] = await db.query(
            'SELECT id FROM permissions WHERE name = ?',
            [name]
        );

        if (existingPermission.length > 0) {
            return res.status(400).json({ message: '权限名称已存在' });
        }

        // 创建权限
        const [result] = await db.query(
            'INSERT INTO permissions (name, description, module, operation) VALUES (?, ?, ?, ?)',
            [name, description, module, operation]
        );

        logger.info(`新权限创建成功: ${name}`);
        res.status(201).json({
            message: '权限创建成功',
            permissionId: result.insertId
        });
    } catch (error) {
        logger.error('创建权限失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取权限列表
exports.getPermissions = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, module } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT id, name, description, module, operation, created_at FROM permissions';
        let countQuery = 'SELECT COUNT(*) as total FROM permissions';
        let params = [];
        let conditions = [];

        if (search) {
            conditions.push('(name LIKE ? OR description LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
        }

        if (module) {
            conditions.push('module = ?');
            params.push(module);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [permissions] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, params.slice(0, -2));

        // 获取每个权限被分配的角色数量
        for (let permission of permissions) {
            const [roleCount] = await db.query(
                'SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = ?',
                [permission.id]
            );
            permission.roleCount = roleCount[0].count;
        }

        res.json({
            permissions,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取权限列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取单个权限信息
exports.getPermission = async (req, res) => {
    try {
        const { id } = req.params;

        const [permission] = await db.query(
            'SELECT id, name, description, module, operation, created_at FROM permissions WHERE id = ?',
            [id]
        );

        if (permission.length === 0) {
            return res.status(404).json({ message: '权限不存在' });
        }

        // 获取拥有该权限的角色列表
        const [roles] = await db.query(
            `SELECT r.* FROM roles r 
            JOIN role_permissions rp ON r.id = rp.role_id 
            WHERE rp.permission_id = ?`,
            [id]
        );

        permission[0].roles = roles;
        res.json(permission[0]);
    } catch (error) {
        logger.error('获取权限信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新权限信息
exports.updatePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, module, operation } = req.body;

        if (!name || !module || !operation) {
            return res.status(400).json({ message: '权限名称、模块和操作类型为必填项' });
        }

        // 检查权限是否存在
        const [permission] = await db.query('SELECT id FROM permissions WHERE id = ?', [id]);
        if (permission.length === 0) {
            return res.status(404).json({ message: '权限不存在' });
        }

        // 检查新名称是否与其他权限重复
        const [existingPermission] = await db.query(
            'SELECT id FROM permissions WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existingPermission.length > 0) {
            return res.status(400).json({ message: '权限名称已存在' });
        }

        await db.query(
            'UPDATE permissions SET name = ?, description = ?, module = ?, operation = ? WHERE id = ?',
            [name, description, module, operation, id]
        );

        logger.info(`权限信息更新成功: ${id}`);
        res.json({ message: '权限信息更新成功' });
    } catch (error) {
        logger.error('更新权限信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除权限
exports.deletePermission = async (req, res) => {
    try {
        const { id } = req.params;

        // 检查权限是否存在
        const [permission] = await db.query('SELECT id FROM permissions WHERE id = ?', [id]);
        if (permission.length === 0) {
            return res.status(404).json({ message: '权限不存在' });
        }

        // 检查是否有角色正在使用该权限
        const [roles] = await db.query(
            'SELECT role_id FROM role_permissions WHERE permission_id = ?',
            [id]
        );

        if (roles.length > 0) {
            return res.status(400).json({ 
                message: '无法删除权限，该权限已被角色使用',
                roleCount: roles.length
            });
        }

        await db.query('DELETE FROM permissions WHERE id = ?', [id]);

        logger.info(`权限删除成功: ${id}`);
        res.json({ message: '权限删除成功' });
    } catch (error) {
        logger.error('删除权限失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取权限模块列表
exports.getModules = async (req, res) => {
    try {
        const [modules] = await db.query(
            'SELECT DISTINCT module FROM permissions ORDER BY module'
        );

        res.json(modules.map(m => m.module));
    } catch (error) {
        logger.error('获取权限模块列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取模块下的操作类型列表
exports.getOperations = async (req, res) => {
    try {
        const { module } = req.params;

        const [operations] = await db.query(
            'SELECT DISTINCT operation FROM permissions WHERE module = ? ORDER BY operation',
            [module]
        );

        res.json(operations.map(o => o.operation));
    } catch (error) {
        logger.error('获取操作类型列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 