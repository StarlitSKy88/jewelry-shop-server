import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/db';

export interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: '请先登录' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await prisma.user.findUnique({
      where: { id: (decoded as any).id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: '认证失败' });
  }
}; 