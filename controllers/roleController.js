const db = require('../models/db');
const logger = require('../utils/logger');

// 创建角色
exports.createRole = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: '角色名称为必填项' });
        }

        // 检查角色名是否已存在
        const [existingRole] = await db.query(
            'SELECT id FROM roles WHERE name = ?',
            [name]
        );

        if (existingRole.length > 0) {
            return res.status(400).json({ message: '角色名称已存在' });
        }

        // 创建角色
        const [result] = await db.query(
            'INSERT INTO roles (name, description) VALUES (?, ?)',
            [name, description]
        );

        logger.info(`新角色创建成功: ${name}`);
        res.status(201).json({
            message: '角色创建成功',
            roleId: result.insertId
        });
    } catch (error) {
        logger.error('创建角色失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取角色列表
exports.getRoles = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT id, name, description, created_at FROM roles';
        let countQuery = 'SELECT COUNT(*) as total FROM roles';
        let params = [];

        if (search) {
            query += ' WHERE name LIKE ? OR description LIKE ?';
            countQuery += ' WHERE name LIKE ? OR description LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam];
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [roles] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, search ? params.slice(0, 2) : []);

        // 获取每个角色的权限
        for (let role of roles) {
            const [permissions] = await db.query(
                `SELECT p.* FROM permissions p 
                JOIN role_permissions rp ON p.id = rp.permission_id 
                WHERE rp.role_id = ?`,
                [role.id]
            );
            role.permissions = permissions;
        }

        res.json({
            roles,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取角色列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取单个角色信息
exports.getRole = async (req, res) => {
    try {
        const { id } = req.params;

        const [role] = await db.query(
            'SELECT id, name, description, created_at FROM roles WHERE id = ?',
            [id]
        );

        if (role.length === 0) {
            return res.status(404).json({ message: '角色不存在' });
        }

        // 获取角色的权限
        const [permissions] = await db.query(
            `SELECT p.* FROM permissions p 
            JOIN role_permissions rp ON p.id = rp.permission_id 
            WHERE rp.role_id = ?`,
            [id]
        );

        role[0].permissions = permissions;
        res.json(role[0]);
    } catch (error) {
        logger.error('获取角色信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新角色信息
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: '角色名��为必填项' });
        }

        // 检查角色是否存在
        const [role] = await db.query('SELECT id FROM roles WHERE id = ?', [id]);
        if (role.length === 0) {
            return res.status(404).json({ message: '角色不存在' });
        }

        // 检查新名称是否与其他角色重复
        const [existingRole] = await db.query(
            'SELECT id FROM roles WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existingRole.length > 0) {
            return res.status(400).json({ message: '角色名称已存在' });
        }

        await db.query(
            'UPDATE roles SET name = ?, description = ? WHERE id = ?',
            [name, description, id]
        );

        logger.info(`角色信息更新成功: ${id}`);
        res.json({ message: '角色信息更新成功' });
    } catch (error) {
        logger.error('更新角色信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除角色
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        // 检查角色是否存在
        const [role] = await db.query('SELECT id FROM roles WHERE id = ?', [id]);
        if (role.length === 0) {
            return res.status(404).json({ message: '角色不存在' });
        }

        // 检查是否有用户正在使用该角色
        const [users] = await db.query(
            'SELECT user_id FROM user_roles WHERE role_id = ?',
            [id]
        );

        if (users.length > 0) {
            return res.status(400).json({ 
                message: '无法删除角色，该角色下还有用户',
                userCount: users.length
            });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 删除角色的权限关联
            await db.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
            // 删除角色
            await db.query('DELETE FROM roles WHERE id = ?', [id]);

            await db.commit();
            logger.info(`角色删除成功: ${id}`);
            res.json({ message: '角色删除成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('删除角色失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 分配角色权限
exports.assignPermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissionIds } = req.body;

        // 验证角色是否存在
        const [role] = await db.query('SELECT id FROM roles WHERE id = ?', [roleId]);
        if (role.length === 0) {
            return res.status(404).json({ message: '角色不存在' });
        }

        // 验证权限是否存在
        const [permissions] = await db.query(
            'SELECT id FROM permissions WHERE id IN (?)',
            [permissionIds]
        );

        if (permissions.length !== permissionIds.length) {
            return res.status(400).json({ message: '存在无效的权限ID' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 删除现有权限
            await db.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

            // 分配新权限
            for (const permissionId of permissionIds) {
                await db.query(
                    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    [roleId, permissionId]
                );
            }

            await db.commit();
            logger.info(`角色权限分配成功: ${roleId}`);
            res.json({ message: '权限分配成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('分配角色权限失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 