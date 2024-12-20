const { execSync } = require('child_process');
const path = require('path');

function getCurrentDateTime() {
  return new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    hour12: false 
  });
}

function syncToGithub() {
  try {
    console.log(`开始同步到GitHub... 时间: ${getCurrentDateTime()}`);
    
    // 添加所有更改
    execSync('git add .', { stdio: 'inherit' });
    
    // 提交更改
    const commitMessage = `自动同步更新 - ${getCurrentDateTime()}`;
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    // 强制推送到远程仓库
    execSync('git push -f origin main', { stdio: 'inherit' });
    
    console.log('GitHub同步完成');
  } catch (error) {
    console.error('GitHub同步失败:', error.message);
  }
}

// 设置定时任务
const SYNC_INTERVAL = 2 * 60 * 60 * 1000; // 2小时
console.log(`设置GitHub同步任务，间隔: ${SYNC_INTERVAL}ms`);

// 立即执行一次同步
syncToGithub();

// 设置定时执行
setInterval(syncToGithub, SYNC_INTERVAL); 