import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middleware/auth';

// 获取地址列表
export const getAddresses = async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await prisma.address.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        isDefault: 'desc',
      },
    });

    res.json(addresses);
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ message: '获取地址列表失败' });
  }
};

// 创建地址
export const createAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, address, city, state, postcode, isDefault } = req.body;

    // 如果设置为默认地址，先将其他地址设置为非默认
    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: req.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId: req.user.id,
        name,
        phone,
        address,
        city,
        state,
        postcode,
        isDefault,
      },
    });

    res.status(201).json(newAddress);
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ message: '创建地址失败' });
  }
};

// 更新地址
export const updateAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, address, city, state, postcode, isDefault } = req.body;

    // 验证地址所有权
    const existingAddress = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!existingAddress) {
      return res.status(404).json({ message: '地址不存在' });
    }

    // 如果设置为默认地址，先将其他地址设置为非默认
    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: req.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        name,
        phone,
        address,
        city,
        state,
        postcode,
        isDefault,
      },
    });

    res.json(updatedAddress);
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ message: '更新地址失败' });
  }
};

// 删除地址
export const deleteAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 验证地址所有权
    const existingAddress = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!existingAddress) {
      return res.status(404).json({ message: '地址不存在' });
    }

    await prisma.address.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ message: '删除地址失败' });
  }
};

// 设置默认地址
export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 验证地址所有权
    const existingAddress = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!existingAddress) {
      return res.status(404).json({ message: '地址不存在' });
    }

    // 将其他地址设置为非默认
    await prisma.address.updateMany({
      where: {
        userId: req.user.id,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // 设置新的默认地址
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        isDefault: true,
      },
    });

    res.json(updatedAddress);
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ message: '设置默认地址失败' });
  }
}; 