import type { Request, Response } from 'express';
import { pool } from '../config/db';

export const getAbout = async (req: Request, res: Response) => {
  try {
    // 这里暂时返回静态数据，实际项目中应该从数据库获取
    const aboutData = {
      title: '珠宝之美，源于匠心',
      description: '我们是一家专注于提供高品质珠宝的企业，致力于为每一位顾客带来独特而精致的珠宝体验。从选料到设计，从加工到展示，我们始终坚持最高标准，只为带给您最完美的珠宝艺术品。',
      image: '/images/about-hero.jpg',
      history: [
        {
          year: 2010,
          title: '品牌创立',
          description: '公司在深圳成立，开始专注于珠宝设计与销售。'
        },
        {
          year: 2015,
          title: '全国扩张',
          description: '成功开设100家连锁店，覆盖全国主要城市。'
        },
        {
          year: 2018,
          title: '国际认证',
          description: '获得国际珠宝品质认证，产品质量达到国际标准。'
        },
        {
          year: 2020,
          title: '数字化转型',
          description: '推出线上商城，实现线上线下一体化服务。'
        },
        {
          year: 2023,
          title: '创新突破',
          description: '推出AI珠宝定制服务，开创行业新模式。'
        }
      ]
    };

    res.json(aboutData);
  } catch (error) {
    console.error('Error in getAbout:', error);
    res.status(500).json({ error: '获取关于页面数据失败' });
  }
}; 