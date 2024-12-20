import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { PaymentStatus } from '@prisma/client';
import { stripe } from '../utils/stripe';

export const createPayment = async (req: Request, res: Response) => {
  try {
    const { orderId, amount } = req.body;

    // 创建 Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe 使用最小货币单位（分）
      currency: 'cny',
      metadata: { orderId },
    });

    // 创建支付记录
    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount,
        status: PaymentStatus.PENDING,
        paymentIntentId: paymentIntent.id,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ message: '创建支付失败' });
  }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return res.status(404).json({ message: '支付记录不存在' });
    }

    res.json({
      status: payment.status,
      amount: payment.amount,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ message: '获取支付状态失败' });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      endpointSecret as string
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { orderId } = paymentIntent.metadata;

      // 更新支付状态
      await prisma.payment.updateMany({
        where: { paymentIntentId: paymentIntent.id },
        data: { status: PaymentStatus.SUCCESS },
      });

      // 更新订单状态
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;

      await prisma.payment.updateMany({
        where: { paymentIntentId: paymentIntent.id },
        data: { status: PaymentStatus.FAILED },
      });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ message: 'Webhook Error' });
  }
}; 