const db = require('../models/db');
const logger = require('../utils/logger');

// 创建标签
exports.createTag = async (req, res) => {
    try {
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({ message: '标签名称为必填项' });
        }

        // 检查标签名是否已存在
        const [existingTag] = await db.query(
            'SELECT id FROM product_tags WHERE name = ?',
            [name]
        );

        if (existingTag.length > 0) {
            return res.status(400).json({ message: '标签名称已存在' });
        }

        // 创建标签
        const [result] = await db.query(
            'INSERT INTO product_tags (name, color) VALUES (?, ?)',
            [name, color]
        );

        logger.info(`新商品标签创建成功: ${name}`);
        res.status(201).json({
            message: '商品标签创建成功',
            tagId: result.insertId
        });
    } catch (error) {
        logger.error('创建商品标签失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取标签���表
exports.getTags = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM product_tags';
        let countQuery = 'SELECT COUNT(*) as total FROM product_tags';
        let params = [];

        if (search) {
            query += ' WHERE name LIKE ?';
            countQuery += ' WHERE name LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [tags] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, search ? [params[0]] : []);

        // 获取每个标签关联的商品数量
        for (let tag of tags) {
            const [productCount] = await db.query(
                'SELECT COUNT(*) as count FROM product_tag_relations WHERE tag_id = ?',
                [tag.id]
            );
            tag.productCount = productCount[0].count;
        }

        res.json({
            tags,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取商品标签列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取单个标签
exports.getTag = async (req, res) => {
    try {
        const { id } = req.params;

        const [tag] = await db.query(
            'SELECT * FROM product_tags WHERE id = ?',
            [id]
        );

        if (tag.length === 0) {
            return res.status(404).json({ message: '标签不存在' });
        }

        // 获取标签关联的商品
        const [products] = await db.query(
            `SELECT p.* FROM products p
            JOIN product_tag_relations ptr ON p.id = ptr.product_id
            WHERE ptr.tag_id = ?
            ORDER BY p.created_at DESC`,
            [id]
        );

        tag[0].products = products;

        res.json(tag[0]);
    } catch (error) {
        logger.error('获取商品标签信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新标签
exports.updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({ message: '标签名称为必填项' });
        }

        // 检查标签是否存在
        const [tag] = await db.query('SELECT id FROM product_tags WHERE id = ?', [id]);
        if (tag.length === 0) {
            return res.status(404).json({ message: '标签不存在' });
        }

        // 检查新名称是否与其他标签重复
        const [existingTag] = await db.query(
            'SELECT id FROM product_tags WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existingTag.length > 0) {
            return res.status(400).json({ message: '标签名称已存在' });
        }

        await db.query(
            'UPDATE product_tags SET name = ?, color = ? WHERE id = ?',
            [name, color, id]
        );

        logger.info(`商品标签更新成功: ${id}`);
        res.json({ message: '商品标签更新成功' });
    } catch (error) {
        logger.error('更新商品标签失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除标签
exports.deleteTag = async (req, res) => {
    try {
        const { id } = req.params;

        // 检查标签是否存在
        const [tag] = await db.query('SELECT id FROM product_tags WHERE id = ?', [id]);
        if (tag.length === 0) {
            return res.status(404).json({ message: '标签不存在' });
        }

        // 检查是否有商品使用该标签
        const [products] = await db.query(
            'SELECT product_id FROM product_tag_relations WHERE tag_id = ?',
            [id]
        );

        if (products.length > 0) {
            return res.status(400).json({
                message: '无法删除标签，该标签下还有商品',
                productCount: products.length
            });
        }

        await db.query('DELETE FROM product_tags WHERE id = ?', [id]);

        logger.info(`商品标签删除成功: ${id}`);
        res.json({ message: '商品标签删除成功' });
    } catch (error) {
        logger.error('删除商品标签失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 批量为商品添加标签
exports.batchAddTags = async (req, res) => {
    try {
        const { productIds, tagIds } = req.body;

        if (!Array.isArray(productIds) || !Array.isArray(tagIds) || 
            productIds.length === 0 || tagIds.length === 0) {
            return res.status(400).json({ message: '无效的商品ID或标签ID列表' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            for (const productId of productIds) {
                for (const tagId of tagIds) {
                    // 检查关联是否已存在
                    const [existing] = await db.query(
                        'SELECT 1 FROM product_tag_relations WHERE product_id = ? AND tag_id = ?',
                        [productId, tagId]
                    );

                    if (existing.length === 0) {
                        await db.query(
                            'INSERT INTO product_tag_relations (product_id, tag_id) VALUES (?, ?)',
                            [productId, tagId]
                        );
                    }
                }
            }

            await db.commit();
            logger.info(`批量添加商品标签成功: 商品[${productIds.join(',')}], 标签[${tagIds.join(',')}]`);
            res.json({ message: '商品标签添加成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('批量添加商品标签失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 