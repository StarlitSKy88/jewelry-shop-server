const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const tagController = require('../controllers/tagController');
const attributeController = require('../controllers/attributeController');

// 商品分类路由
router.post('/categories', [authMiddleware, adminMiddleware], categoryController.createCategory);
router.get('/categories', categoryController.getCategories);
router.get('/categories/tree', categoryController.getCategoryTree);
router.get('/categories/:id', categoryController.getCategory);
router.put('/categories/:id', [authMiddleware, adminMiddleware], categoryController.updateCategory);
router.delete('/categories/:id', [authMiddleware, adminMiddleware], categoryController.deleteCategory);
router.post('/categories/sort', [authMiddleware, adminMiddleware], categoryController.updateCategoriesOrder);

// 商品路由
router.post('/products', [authMiddleware, adminMiddleware], productController.createProduct);
router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProduct);
router.put('/products/:id', [authMiddleware, adminMiddleware], productController.updateProduct);
router.delete('/products/:id', [authMiddleware, adminMiddleware], productController.deleteProduct);
router.post('/products/batch-status', [authMiddleware, adminMiddleware], productController.batchUpdateStatus);

// 商品标签路由
router.post('/tags', [authMiddleware, adminMiddleware], tagController.createTag);
router.get('/tags', tagController.getTags);
router.get('/tags/:id', tagController.getTag);
router.put('/tags/:id', [authMiddleware, adminMiddleware], tagController.updateTag);
router.delete('/tags/:id', [authMiddleware, adminMiddleware], tagController.deleteTag);
router.post('/tags/batch', [authMiddleware, adminMiddleware], tagController.batchAddTags);

// 商品属性路由
router.post('/attributes', [authMiddleware, adminMiddleware], attributeController.createAttribute);
router.get('/attributes', attributeController.getAttributes);
router.get('/attributes/:id', attributeController.getAttribute);
router.put('/attributes/:id', [authMiddleware, adminMiddleware], attributeController.updateAttribute);
router.delete('/attributes/:id', [authMiddleware, adminMiddleware], attributeController.deleteAttribute);
router.post('/attributes/batch', [authMiddleware, adminMiddleware], attributeController.batchSetAttributeValues);

module.exports = router; 