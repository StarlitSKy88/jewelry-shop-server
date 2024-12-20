import express from 'express';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import { auth } from '../middleware/auth';

const router = express.Router();

// 获取地址列表
router.get('/', auth, getAddresses);

// 创建地址
router.post('/', auth, createAddress);

// 更新地址
router.put('/:id', auth, updateAddress);

// 删除地址
router.delete('/:id', auth, deleteAddress);

// 设置默认地址
router.put('/:id/default', auth, setDefaultAddress);

export default router; 