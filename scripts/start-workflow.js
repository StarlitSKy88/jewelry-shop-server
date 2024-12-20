const WorkflowManager = require('./workflow');

async function main() {
    const workflow = new WorkflowManager();
    const command = process.argv[2];

    try {
        switch (command) {
            case 'start':
                await workflow.run();
                break;
            case 'list':
                await workflow.init();
                console.log('\n待完成的任务:');
                workflow.currentTasks.forEach(task => {
                    console.log(`- [${task.section}] ${task.name}`);
                });
                console.log('\n已完成的任务:');
                workflow.completedTasks.forEach(task => {
                    console.log(`- [${task.section} (${task.completionDate})] ${task.name}`);
                });
                break;
            case 'complete':
                const taskName = process.argv.slice(3).join(' ');
                await workflow.init();
                const task = workflow.currentTasks.find(t => t.name === taskName);
                if (task) {
                    await workflow.executeTask(task);
                } else {
                    console.log('未找到指定的任务');
                }
                break;
            default:
                console.log('请指定要执行的命令: start, list, complete');
        }
    } catch (error) {
        console.error('执行出错:', error);
        process.exit(1);
    }
}

main(); 