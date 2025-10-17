import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export class TaskQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.completed = new Map();
    this.failed = new Map();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()],
    });
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    this.logger.info('Task queue started');
    
    // Start processing loop
    this.processQueue();
  }

  async stop() {
    this.isRunning = false;
    this.logger.info('Task queue stopped');
  }

  async addTask(taskData) {
    const task = {
      id: uuidv4(),
      ...taskData,
      status: 'queued',
      createdAt: new Date(),
      priority: taskData.priority || 'medium'
    };

    this.queue.push(task);
    this.logger.info(`Task added to queue: ${task.id}`);
    
    return task;
  }

  async processQueue() {
    while (this.isRunning) {
      try {
        // Sort queue by priority
        this.queue.sort((a, b) => {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        // Process next task if available and not at capacity
        if (this.queue.length > 0 && this.processing.size < 10) {
          const task = this.queue.shift();
          this.processing.add(task.id);
          
          // Process task asynchronously
          this.processTask(task).catch(error => {
            this.logger.error(`Error processing task ${task.id}:`, error);
            this.failed.set(task.id, { task, error: error.message });
            this.processing.delete(task.id);
          });
        }

        // Wait before next iteration
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error('Error in queue processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processTask(task) {
    try {
      this.logger.info(`Processing task: ${task.id}`);
      
      // Update task status
      task.status = 'processing';
      task.startedAt = new Date();

      // Simulate task processing
      await this.executeTask(task);

      // Mark as completed
      task.status = 'completed';
      task.completedAt = new Date();
      this.completed.set(task.id, task);
      this.processing.delete(task.id);

      this.logger.info(`Task completed: ${task.id}`);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.failedAt = new Date();
      this.failed.set(task.id, { task, error: error.message });
      this.processing.delete(task.id);

      this.logger.error(`Task failed: ${task.id}`, error);
      throw error;
    }
  }

  async executeTask(task) {
    // This would integrate with actual task execution logic
    // For now, we'll simulate different types of tasks
    
    switch (task.type) {
      case 'build':
        await this.simulateBuildTask(task);
        break;
      case 'test':
        await this.simulateTestTask(task);
        break;
      case 'deploy':
        await this.simulateDeployTask(task);
        break;
      case 'analyze':
        await this.simulateAnalyzeTask(task);
        break;
      default:
        await this.simulateGenericTask(task);
    }
  }

  async simulateBuildTask(task) {
    this.logger.info(`Simulating build task: ${task.id}`);
    
    // Simulate build process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    task.result = {
      success: true,
      buildTime: '2m 15s',
      filesBuilt: 45,
      warnings: 3,
      errors: 0
    };
  }

  async simulateTestTask(task) {
    this.logger.info(`Simulating test task: ${task.id}`);
    
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    task.result = {
      success: true,
      testsRun: 127,
      testsPassed: 125,
      testsFailed: 2,
      coverage: 87.5
    };
  }

  async simulateDeployTask(task) {
    this.logger.info(`Simulating deploy task: ${task.id}`);
    
    // Simulate deployment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    task.result = {
      success: true,
      deploymentUrl: 'https://example-app.vercel.app',
      deploymentTime: '3m 45s',
      environment: 'production'
    };
  }

  async simulateAnalyzeTask(task) {
    this.logger.info(`Simulating analyze task: ${task.id}`);
    
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    task.result = {
      success: true,
      issuesFound: 5,
      securityIssues: 1,
      performanceIssues: 2,
      codeQualityScore: 82
    };
  }

  async simulateGenericTask(task) {
    this.logger.info(`Simulating generic task: ${task.id}`);
    
    // Simulate generic processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    task.result = {
      success: true,
      processedAt: new Date().toISOString(),
      message: 'Task completed successfully'
    };
  }

  async getAllTasks() {
    return {
      queued: this.queue,
      processing: Array.from(this.processing).map(id => ({ id, status: 'processing' })),
      completed: Array.from(this.completed.values()),
      failed: Array.from(this.failed.values()).map(item => item.task),
      stats: {
        totalQueued: this.queue.length,
        totalProcessing: this.processing.size,
        totalCompleted: this.completed.size,
        totalFailed: this.failed.size
      }
    };
  }

  async getTaskStatus(taskId) {
    // Check if task is in queue
    const queuedTask = this.queue.find(task => task.id === taskId);
    if (queuedTask) {
      return { ...queuedTask, status: 'queued' };
    }

    // Check if task is processing
    if (this.processing.has(taskId)) {
      return { id: taskId, status: 'processing' };
    }

    // Check if task is completed
    const completedTask = this.completed.get(taskId);
    if (completedTask) {
      return { ...completedTask, status: 'completed' };
    }

    // Check if task failed
    const failedTask = this.failed.get(taskId);
    if (failedTask) {
      return { ...failedTask.task, status: 'failed' };
    }

    return null;
  }

  async cancelTask(taskId) {
    // Remove from queue if queued
    const queueIndex = this.queue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.status = 'cancelled';
      this.logger.info(`Task cancelled: ${taskId}`);
      return task;
    }

    // Cannot cancel processing tasks
    if (this.processing.has(taskId)) {
      throw new Error('Cannot cancel task that is currently processing');
    }

    throw new Error(`Task ${taskId} not found`);
  }

  async retryTask(taskId) {
    const failedTask = this.failed.get(taskId);
    if (!failedTask) {
      throw new Error(`Failed task ${taskId} not found`);
    }

    // Remove from failed and add back to queue
    this.failed.delete(taskId);
    const task = failedTask.task;
    task.status = 'queued';
    task.retryCount = (task.retryCount || 0) + 1;
    task.error = null;
    task.failedAt = null;

    this.queue.push(task);
    this.logger.info(`Task retried: ${taskId}`);
    
    return task;
  }

  async clearCompleted() {
    const count = this.completed.size;
    this.completed.clear();
    this.logger.info(`Cleared ${count} completed tasks`);
    return count;
  }

  async clearFailed() {
    const count = this.failed.size;
    this.failed.clear();
    this.logger.info(`Cleared ${count} failed tasks`);
    return count;
  }

  async getQueueStats() {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      completedCount: this.completed.size,
      failedCount: this.failed.size,
      isRunning: this.isRunning,
      uptime: process.uptime()
    };
  }
}
