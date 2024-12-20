const db = require('../models/db');
const logger = require('../utils/logger');
const { validateAmount } = require('../utils/validators');
const config = require('../config');

// 创建商品
exports.createProduct = async (req, res) => {
    try {
        const {
            category_id, name, subtitle, description, price, original_price,
            cost_price, stock, sku, weight, size, color, material,
            is_featured, is_new, is_hot, specs, images, attributes, tags
        } = req.body;

        // 参数验证
        if (!category_id || !name || !price || !sku) {
            return res.status(400).json({ message: '分类、名称、价格和SKU为必填项' });
        }

        if (!validateAmount(price) || (original_price && !validateAmount(original_price)) || 
            (cost_price && !validateAmount(cost_price))) {
            return res.status(400).json({ message: '价格格式不正确' });
        }

        // 检查分类是否存在
        const [category] = await db.query(
            'SELECT id FROM product_categories WHERE id = ?',
            [category_id]
        );

        if (category.length === 0) {
            return res.status(400).json({ message: '商品分类不存在' });
        }

        // 检查SKU是否已存在
        const [existingSku] = await db.query(
            'SELECT id FROM products WHERE sku = ?',
            [sku]
        );

        if (existingSku.length > 0) {
            return res.status(400).json({ message: 'SKU已存在' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 创建商品基本信息
            const [result] = await db.query(
                `INSERT INTO products (
                    category_id, name, subtitle, description, price, original_price,
                    cost_price, stock, sku, weight, size, color, material,
                    is_featured, is_new, is_hot
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    category_id, name, subtitle, description, price, original_price,
                    cost_price, stock || 0, sku, weight, size, color, material,
                    is_featured || false, is_new || false, is_hot || false
                ]
            );

            const productId = result.insertId;

            // 添加商品规格
            if (specs && Array.isArray(specs)) {
                for (const spec of specs) {
                    await db.query(
                        'INSERT INTO product_specs (product_id, name, value, sort_order) VALUES (?, ?, ?, ?)',
                        [productId, spec.name, spec.value, spec.sort_order || 0]
                    );
                }
            }

            // 添加商品图片
            if (images && Array.isArray(images)) {
                for (const image of images) {
                    await db.query(
                        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?)',
                        [productId, image.url, image.is_primary || false, image.sort_order || 0]
                    );
                }
            }

            // 添加商品属性
            if (attributes && Array.isArray(attributes)) {
                for (const attr of attributes) {
                    await db.query(
                        'INSERT INTO product_attribute_values (product_id, attribute_id, value) VALUES (?, ?, ?)',
                        [productId, attr.attribute_id, attr.value]
                    );
                }
            }

            // 添加商品标签
            if (tags && Array.isArray(tags)) {
                for (const tagId of tags) {
                    await db.query(
                        'INSERT INTO product_tag_relations (product_id, tag_id) VALUES (?, ?)',
                        [productId, tagId]
                    );
                }
            }

            await db.commit();
            logger.info(`新商品创建成功: ${name}`);
            res.status(201).json({
                message: '商品创建成功',
                productId
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('创建商品失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取商品列表
exports.getProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category_id,
            search,
            min_price,
            max_price,
            status,
            sort_by = 'created_at',
            sort_order = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        let conditions = [];
        let params = [];

        // 构建查询条件
        if (category_id) {
            conditions.push('p.category_id = ?');
            params.push(category_id);
        }

        if (search) {
            conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (min_price) {
            conditions.push('p.price >= ?');
            params.push(min_price);
        }

        if (max_price) {
            conditions.push('p.price <= ?');
            params.push(max_price);
        }

        if (status) {
            conditions.push('p.status = ?');
            params.push(status);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // 构建排序
        const allowedSortFields = ['created_at', 'price', 'sales_count', 'view_count'];
        const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
        const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // 查询商品列表
        const query = `
            SELECT 
                p.*,
                c.name as category_name,
                (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            ${whereClause}
            ORDER BY p.${sortField} ${sortDirection}
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            ${whereClause}
        `;

        params.push(parseInt(limit), offset);

        const [products] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, params.slice(0, -2));

        // 获取每个商品的标签
        for (let product of products) {
            const [tags] = await db.query(
                `SELECT t.* FROM product_tags t
                JOIN product_tag_relations ptr ON t.id = ptr.tag_id
                WHERE ptr.product_id = ?`,
                [product.id]
            );
            product.tags = tags;
        }

        res.json({
            products,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取商品列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取商品详情
exports.getProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // 获取商品基本信息
        const [product] = await db.query(
            `SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE p.id = ?`,
            [id]
        );

        if (product.length === 0) {
            return res.status(404).json({ message: '商品不存在' });
        }

        // 获取商品图片
        const [images] = await db.query(
            'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order',
            [id]
        );
        product[0].images = images;

        // 获取商品规格
        const [specs] = await db.query(
            'SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort_order',
            [id]
        );
        product[0].specs = specs;

        // 获取商品属性
        const [attributes] = await db.query(
            `SELECT pa.name, pav.value
            FROM product_attribute_values pav
            JOIN product_attributes pa ON pav.attribute_id = pa.id
            WHERE pav.product_id = ?`,
            [id]
        );
        product[0].attributes = attributes;

        // 获取商品标签
        const [tags] = await db.query(
            `SELECT t.* FROM product_tags t
            JOIN product_tag_relations ptr ON t.id = ptr.tag_id
            WHERE ptr.product_id = ?`,
            [id]
        );
        product[0].tags = tags;

        // 记录商品浏览
        if (userId) {
            await db.query(
                'INSERT INTO product_view_logs (product_id, user_id, ip, user_agent) VALUES (?, ?, ?, ?)',
                [id, userId, req.ip, req.headers['user-agent']]
            );

            // 更新商品浏览次数
            await db.query(
                'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
                [id]
            );
        }

        res.json(product[0]);
    } catch (error) {
        logger.error('获取商品详情失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新商品
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            category_id, name, subtitle, description, price, original_price,
            cost_price, stock, weight, size, color, material,
            is_featured, is_new, is_hot, status, specs, images, attributes, tags
        } = req.body;

        // 检查商品是否存在
        const [product] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
        if (product.length === 0) {
            return res.status(404).json({ message: '商品不存在' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 更新商品基本信息
            await db.query(
                `UPDATE products SET
                    category_id = ?, name = ?, subtitle = ?, description = ?,
                    price = ?, original_price = ?, cost_price = ?, stock = ?,
                    weight = ?, size = ?, color = ?, material = ?,
                    is_featured = ?, is_new = ?, is_hot = ?, status = ?
                WHERE id = ?`,
                [
                    category_id, name, subtitle, description,
                    price, original_price, cost_price, stock,
                    weight, size, color, material,
                    is_featured, is_new, is_hot, status,
                    id
                ]
            );

            // 更新商品规格
            if (specs) {
                await db.query('DELETE FROM product_specs WHERE product_id = ?', [id]);
                for (const spec of specs) {
                    await db.query(
                        'INSERT INTO product_specs (product_id, name, value, sort_order) VALUES (?, ?, ?, ?)',
                        [id, spec.name, spec.value, spec.sort_order]
                    );
                }
            }

            // 更新商品图片
            if (images) {
                await db.query('DELETE FROM product_images WHERE product_id = ?', [id]);
                for (const image of images) {
                    await db.query(
                        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?)',
                        [id, image.url, image.is_primary, image.sort_order]
                    );
                }
            }

            // 更新商品属性
            if (attributes) {
                await db.query('DELETE FROM product_attribute_values WHERE product_id = ?', [id]);
                for (const attr of attributes) {
                    await db.query(
                        'INSERT INTO product_attribute_values (product_id, attribute_id, value) VALUES (?, ?, ?)',
                        [id, attr.attribute_id, attr.value]
                    );
                }
            }

            // 更新商品标签
            if (tags) {
                await db.query('DELETE FROM product_tag_relations WHERE product_id = ?', [id]);
                for (const tagId of tags) {
                    await db.query(
                        'INSERT INTO product_tag_relations (product_id, tag_id) VALUES (?, ?)',
                        [id, tagId]
                    );
                }
            }

            await db.commit();
            logger.info(`商品更新成功: ${id}`);
            res.json({ message: '商品更新成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('更新商品失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除商品
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // 检查商品是否存在
        const [product] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
        if (product.length === 0) {
            return res.status(404).json({ message: '商品不存在' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 删除商品相关数据
            await db.query('DELETE FROM product_specs WHERE product_id = ?', [id]);
            await db.query('DELETE FROM product_images WHERE product_id = ?', [id]);
            await db.query('DELETE FROM product_attribute_values WHERE product_id = ?', [id]);
            await db.query('DELETE FROM product_tag_relations WHERE product_id = ?', [id]);
            await db.query('DELETE FROM product_view_logs WHERE product_id = ?', [id]);
            await db.query('DELETE FROM products WHERE id = ?', [id]);

            await db.commit();
            logger.info(`商品删除成功: ${id}`);
            res.json({ message: '商品删除成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('删除商品失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 批量更新商品状态
exports.batchUpdateStatus = async (req, res) => {
    try {
        const { productIds, status } = req.body;

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ message: '无效的商品ID列表' });
        }

        await db.query(
            'UPDATE products SET status = ? WHERE id IN (?)',
            [status, productIds]
        );

        logger.info(`批量更新商品状态成功: ${productIds.join(',')}`);
        res.json({ message: '商品状态更新成功' });
    } catch (error) {
        logger.error('批量更新商品状态失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 