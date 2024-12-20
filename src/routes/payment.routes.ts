import express from 'express';
import {
  createPayment,
  getPaymentStatus,
  handleStripeWebhook,
} from '../controllers/payment.controller';
import { auth } from '../middleware/auth';

const router = express.Router();

// 创建支付
router.post('/', auth, createPayment);

// 获取支付状态
router.get('/:paymentId/status', auth, getPaymentStatus);

// Stripe Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router; 