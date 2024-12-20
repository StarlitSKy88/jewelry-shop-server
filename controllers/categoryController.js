const db = require('../models/db');
const logger = require('../utils/logger');

// 创建商品分类
exports.createCategory = async (req, res) => {
    try {
        const { name, parent_id, level, sort_order, icon, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: '分类名称为必填项' });
        }

        // 检查分类名是否已存在
        const [existingCategory] = await db.query(
            'SELECT id FROM product_categories WHERE name = ?',
            [name]
        );

        if (existingCategory.length > 0) {
            return res.status(400).json({ message: '分类名称已存在' });
        }

        // 如果有父分类，检查父分类是否存在
        if (parent_id) {
            const [parentCategory] = await db.query(
                'SELECT id FROM product_categories WHERE id = ?',
                [parent_id]
            );

            if (parentCategory.length === 0) {
                return res.status(400).json({ message: '父分类不存在' });
            }
        }

        // 创建分类
        const [result] = await db.query(
            'INSERT INTO product_categories (name, parent_id, level, sort_order, icon, description) VALUES (?, ?, ?, ?, ?, ?)',
            [name, parent_id, level || 1, sort_order || 0, icon, description]
        );

        logger.info(`新商品分类创建成功: ${name}`);
        res.status(201).json({
            message: '商品分类创建成功',
            categoryId: result.insertId
        });
    } catch (error) {
        logger.error('创建商品分类失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取分类列表
exports.getCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10, parent_id, search } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM product_categories';
        let countQuery = 'SELECT COUNT(*) as total FROM product_categories';
        let params = [];
        let conditions = [];

        if (parent_id) {
            conditions.push('parent_id = ?');
            params.push(parent_id);
        }

        if (search) {
            conditions.push('name LIKE ?');
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [categories] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, params.slice(0, -2));

        // 获取每个分类的子分类数量和商品数量
        for (let category of categories) {
            const [subCategories] = await db.query(
                'SELECT COUNT(*) as count FROM product_categories WHERE parent_id = ?',
                [category.id]
            );
            const [products] = await db.query(
                'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
                [category.id]
            );
            category.subCategoryCount = subCategories[0].count;
            category.productCount = products[0].count;
        }

        res.json({
            categories,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取商品分类列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取分类树
exports.getCategoryTree = async (req, res) => {
    try {
        // 获���所有分类
        const [categories] = await db.query(
            'SELECT * FROM product_categories ORDER BY sort_order ASC'
        );

        // 构建分类树
        const buildTree = (parentId = null) => {
            return categories
                .filter(category => category.parent_id === parentId)
                .map(category => ({
                    ...category,
                    children: buildTree(category.id)
                }));
        };

        const categoryTree = buildTree();
        res.json(categoryTree);
    } catch (error) {
        logger.error('获取商品分类树失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取单个分类
exports.getCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const [category] = await db.query(
            'SELECT * FROM product_categories WHERE id = ?',
            [id]
        );

        if (category.length === 0) {
            return res.status(404).json({ message: '分类不存在' });
        }

        // 获取子分类
        const [subCategories] = await db.query(
            'SELECT * FROM product_categories WHERE parent_id = ?',
            [id]
        );

        // 获取分类下的商品数量
        const [productCount] = await db.query(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [id]
        );

        category[0].subCategories = subCategories;
        category[0].productCount = productCount[0].count;

        res.json(category[0]);
    } catch (error) {
        logger.error('获取商品分类信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新分类
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id, level, sort_order, icon, description, status } = req.body;

        if (!name) {
            return res.status(400).json({ message: '分类名称为必填项' });
        }

        // 检查分类是否存在
        const [category] = await db.query(
            'SELECT * FROM product_categories WHERE id = ?',
            [id]
        );

        if (category.length === 0) {
            return res.status(404).json({ message: '分类不存在' });
        }

        // 检查新名称是否与其他分类重复
        const [existingCategory] = await db.query(
            'SELECT id FROM product_categories WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existingCategory.length > 0) {
            return res.status(400).json({ message: '分类名称已存在' });
        }

        // 如果更改了父分类，检查是否形成循环
        if (parent_id && parent_id !== category[0].parent_id) {
            let currentParent = parent_id;
            while (currentParent) {
                if (currentParent === parseInt(id)) {
                    return res.status(400).json({ message: '不能将分类设置为自己的子分类' });
                }
                const [parent] = await db.query(
                    'SELECT parent_id FROM product_categories WHERE id = ?',
                    [currentParent]
                );
                currentParent = parent[0]?.parent_id;
            }
        }

        await db.query(
            `UPDATE product_categories 
            SET name = ?, parent_id = ?, level = ?, sort_order = ?, 
                icon = ?, description = ?, status = ?
            WHERE id = ?`,
            [name, parent_id, level, sort_order, icon, description, status, id]
        );

        logger.info(`商品分类更新成功: ${id}`);
        res.json({ message: '商品分类更新成功' });
    } catch (error) {
        logger.error('更新商品分类失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除分类
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // 检查分类是否存在
        const [category] = await db.query(
            'SELECT id FROM product_categories WHERE id = ?',
            [id]
        );

        if (category.length === 0) {
            return res.status(404).json({ message: '分类不存在' });
        }

        // 检查是否有子分类
        const [subCategories] = await db.query(
            'SELECT id FROM product_categories WHERE parent_id = ?',
            [id]
        );

        if (subCategories.length > 0) {
            return res.status(400).json({
                message: '无法删除分类，该分类下还有子分类',
                subCategoryCount: subCategories.length
            });
        }

        // 检查分类下是否有商品
        const [products] = await db.query(
            'SELECT id FROM products WHERE category_id = ?',
            [id]
        );

        if (products.length > 0) {
            return res.status(400).json({
                message: '无法删除分类，该分类下还有商品',
                productCount: products.length
            });
        }

        await db.query('DELETE FROM product_categories WHERE id = ?', [id]);

        logger.info(`商品分类删除成功: ${id}`);
        res.json({ message: '商品分类删除成功' });
    } catch (error) {
        logger.error('删除商品分类失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 批量更新分类排序
exports.updateCategoriesOrder = async (req, res) => {
    try {
        const { categories } = req.body;

        if (!Array.isArray(categories)) {
            return res.status(400).json({ message: '无效的请求数据' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            for (const category of categories) {
                await db.query(
                    'UPDATE product_categories SET sort_order = ? WHERE id = ?',
                    [category.sort_order, category.id]
                );
            }

            await db.commit();
            logger.info('商品分类排序更新成功');
            res.json({ message: '商品分类排序更新成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('更新商品分类排序失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 