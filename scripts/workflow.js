const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class WorkflowManager {
    constructor() {
        this.readmePath = path.join(__dirname, '../../README.md');
        this.serverPath = path.join(__dirname, '..');
        this.currentTasks = [];
        this.completedTasks = [];
    }

    async init() {
        try {
            const content = await fs.readFile(this.readmePath, 'utf8');
            this.content = content;
            await this.parseReadme();
        } catch (error) {
            console.error('初始化失败:', error);
            throw error;
        }
    }

    async parseReadme() {
        const lines = this.content.split('\n');
        let currentSection = '';
        let isTaskSection = false;

        for (const line of lines) {
            if (line.startsWith('### ')) {
                currentSection = line.replace('### ', '').trim();
                isTaskSection = true;
                continue;
            }

            if (isTaskSection && line.startsWith('- [ ]')) {
                const task = {
                    section: currentSection,
                    name: line.replace('- [ ]', '').trim(),
                    status: 'pending'
                };
                this.currentTasks.push(task);
            }

            if (isTaskSection && line.startsWith('- [x]')) {
                const task = {
                    section: currentSection,
                    name: line.replace('- [x]', '').trim(),
                    status: 'completed'
                };
                this.completedTasks.push(task);
            }
        }
    }

    async updateReadme(task) {
        let content = this.content;
        const taskLine = `- [ ] ${task.name}`;
        const completedLine = `- [x] ${task.name}`;
        content = content.replace(taskLine, completedLine);

        // 添加完成时间
        const today = new Date().toISOString().split('T')[0];
        const completionNote = `\n- 完成时间: ${today}`;
        content = content.replace(completedLine, completedLine + completionNote);

        await fs.writeFile(this.readmePath, content, 'utf8');
        this.content = content;
    }

    getNextTask() {
        return this.currentTasks.find(task => task.status === 'pending');
    }

    async executeTask(task) {
        console.log(`开始执行任务: ${task.section} - ${task.name}`);
        
        // 根据任务类型执行不同的操作
        switch(task.section) {
            case '用户认证模块':
                await this.executeAuthTask(task);
                break;
            case '商品模块':
                await this.executeProductTask(task);
                break;
            case '购物车模块':
                await this.executeCartTask(task);
                break;
            case '订单模块':
                await this.executeOrderTask(task);
                break;
            case '收藏模块':
                await this.executeFavoriteTask(task);
                break;
            default:
                console.log(`未知的任务类型: ${task.section}`);
        }

        // 更新任务状态
        task.status = 'completed';
        await this.updateReadme(task);
        console.log(`任务完成: ${task.name}`);

        // 自动执行下一个任务
        const nextTask = this.getNextTask();
        if (nextTask) {
            await this.executeTask(nextTask);
        } else {
            console.log('所有任务已完成');
        }
    }

    async executeAuthTask(task) {
        const taskMap = {
            '用户注册功能': async () => {
                // 重构用户注册相关代码
                await this.optimizeAuthFiles();
            },
            '用户登录功能': async () => {
                // 重构用户登录相关代码
                await this.optimizeLoginFiles();
            },
            'JWT认证中间件': async () => {
                // 重构JWT认证中间件
                await this.optimizeJWTMiddleware();
            }
        };

        if (taskMap[task.name]) {
            await taskMap[task.name]();
        }
    }

    async optimizeAuthFiles() {
        // 重构现有的认证相关文件
        const files = await this.findAuthFiles();
        for (const file of files) {
            await this.optimizeFile(file);
        }
    }

    async optimizeLoginFiles() {
        // 添加登录相关的优化
        const authController = await fs.readFile(path.join(this.serverPath, 'src/controllers/auth.controller.js'), 'utf8');
        
        // 添加登录方法
        const loginMethod = `
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Invalid input data', 400, errors.array()));
    }

    const { email, password } = req.body;

    // 查找用户
    const user = await User.findByEmail(email);
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      }
    });
  } catch (err) {
    next(err);
  }
};`;

        // 添加登录方法到控制器
        const updatedController = authController + loginMethod;
        await fs.writeFile(path.join(this.serverPath, 'src/controllers/auth.controller.js'), updatedController);

        // 更新路由文件添加登录路由
        const authRoutes = await fs.readFile(path.join(this.serverPath, 'src/routes/auth.routes.js'), 'utf8');
        const loginRoute = `
router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .trim()
      .notEmpty()
      .withMessage('Password is required')
  ],
  authController.login
);`;

        const updatedRoutes = authRoutes.replace('module.exports = router;', `${loginRoute}\n\nmodule.exports = router;`);
        await fs.writeFile(path.join(this.serverPath, 'src/routes/auth.routes.js'), updatedRoutes);
    }

    async optimizeJWTMiddleware() {
        // 创建JWT中间件
        const jwtMiddleware = `const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const User = require('../models/user.model');

const auth = async (req, res, next) => {
  try {
    // 获取token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next(new AppError('Please authenticate', 401));
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (err) {
    next(new AppError('Please authenticate', 401));
  }
};

module.exports = auth;`;

        await fs.writeFile(path.join(this.serverPath, 'src/middlewares/auth.js'), jwtMiddleware);
    }

    async findAuthFiles() {
        const { stdout } = await execPromise('find . -type f -name "auth*.js"', {
            cwd: this.serverPath
        });
        return stdout.split('\n').filter(Boolean);
    }

    async optimizeFile(filePath) {
        // 读取文件内容
        const content = await fs.readFile(path.join(this.serverPath, filePath), 'utf8');
        
        // 根据文件类型进行优化
        let optimizedContent = content;
        if (filePath.includes('controller')) {
            optimizedContent = this.optimizeController(content);
        } else if (filePath.includes('route')) {
            optimizedContent = this.optimizeRoute(content);
        } else if (filePath.includes('middleware')) {
            optimizedContent = this.optimizeMiddleware(content);
        }

        // 写回优化后的内容
        await fs.writeFile(path.join(this.serverPath, filePath), optimizedContent);
    }

    optimizeController(content) {
        // 优化控制器代码
        return content
            .replace(/console\.log/g, 'logger.info')
            .replace(/throw new Error/g, 'throw new AppError');
    }

    optimizeRoute(content) {
        // 优化路由代码
        return content
            .replace(/app\.use/g, 'router.use')
            .replace(/app\.(get|post|put|delete)/g, 'router.$1');
    }

    optimizeMiddleware(content) {
        // 优化中间件代码
        return content
            .replace(/next\(error\)/g, 'next(new AppError(error.message, 500))');
    }

    async run() {
        await this.init();
        const nextTask = this.getNextTask();
        
        if (nextTask) {
            await this.executeTask(nextTask);
        } else {
            console.log('所有任务已完成');
        }
    }
}

module.exports = WorkflowManager; 