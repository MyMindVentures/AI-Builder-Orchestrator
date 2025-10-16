import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseManager {
  constructor() {
    this.db = null;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()],
    });
  }

  async initialize() {
    try {
      // Create database file in the project root
      const dbPath = join(__dirname, '../../data/orchestrator.db');
      
      // Ensure data directory exists
      const fs = await import('fs');
      const dataDir = join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      await this.createTables();
      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    // AI Builder Agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        capabilities TEXT, -- JSON array
        configuration TEXT, -- JSON object
        last_heartbeat DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT UNIQUE NOT NULL,
        agent_id INTEGER,
        task_type TEXT NOT NULL,
        task_description TEXT NOT NULL,
        project_context TEXT, -- JSON object
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        progress INTEGER DEFAULT 0,
        result TEXT, -- JSON object
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (agent_id) REFERENCES ai_agents (id)
      )
    `);

    // Autonomous workflows table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS autonomous_workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        triggers TEXT NOT NULL, -- JSON array
        actions TEXT NOT NULL, -- JSON array
        conditions TEXT, -- JSON object
        is_active BOOLEAN DEFAULT true,
        last_executed DATETIME,
        execution_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project integrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_integrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        project_path TEXT,
        integration_type TEXT NOT NULL,
        configuration TEXT, -- JSON object
        is_active BOOLEAN DEFAULT true,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Chatbot integrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chatbot_integrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        webhook_url TEXT,
        configuration TEXT, -- JSON object
        is_active BOOLEAN DEFAULT true,
        last_message DATETIME,
        message_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task execution logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        agent_id INTEGER,
        action TEXT NOT NULL,
        details TEXT, -- JSON object
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks (id),
        FOREIGN KEY (agent_id) REFERENCES ai_agents (id)
      )
    `);

    // Performance metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        context TEXT, -- JSON object
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES ai_agents (id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON ai_agents(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_active ON autonomous_workflows(is_active);
      CREATE INDEX IF NOT EXISTS idx_integrations_active ON project_integrations(is_active);
      CREATE INDEX IF NOT EXISTS idx_chatbot_active ON chatbot_integrations(is_active);
    `);
  }

  // AI Agent management methods
  async registerAgent(agentData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_agents (name, type, status, capabilities, configuration, last_heartbeat)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const capabilities = JSON.stringify(agentData.capabilities || []);
    const configuration = JSON.stringify(agentData.configuration || {});

    const result = stmt.run(
      agentData.name,
      agentData.type,
      agentData.status || 'active',
      capabilities,
      configuration
    );

    return {
      id: result.lastInsertRowid,
      message: 'Agent registered successfully'
    };
  }

  async updateAgentHeartbeat(agentName) {
    const stmt = this.db.prepare(`
      UPDATE ai_agents SET last_heartbeat = CURRENT_TIMESTAMP WHERE name = ?
    `);
    stmt.run(agentName);
  }

  async getAllAgents() {
    const stmt = this.db.prepare(`
      SELECT id, name, type, status, capabilities, configuration, last_heartbeat, created_at
      FROM ai_agents 
      ORDER BY last_heartbeat DESC
    `);
    return stmt.all();
  }

  async getAgentByName(name) {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_agents WHERE name = ?
    `);
    return stmt.get(name);
  }

  // Task management methods
  async createTask(taskData) {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (task_id, agent_id, task_type, task_description, project_context, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const projectContext = JSON.stringify(taskData.project_context || {});
    const result = stmt.run(
      taskData.task_id,
      taskData.agent_id,
      taskData.task_type,
      taskData.task_description,
      projectContext,
      taskData.priority || 'medium'
    );

    return {
      id: result.lastInsertRowid,
      task_id: taskData.task_id,
      message: 'Task created successfully'
    };
  }

  async updateTaskStatus(taskId, status, progress = null, result = null, errorMessage = null) {
    let sql = 'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [status];

    if (progress !== null) {
      sql += ', progress = ?';
      params.push(progress);
    }

    if (result !== null) {
      sql += ', result = ?';
      params.push(JSON.stringify(result));
    }

    if (errorMessage !== null) {
      sql += ', error_message = ?';
      params.push(errorMessage);
    }

    if (status === 'in_progress') {
      sql += ', started_at = CURRENT_TIMESTAMP';
    } else if (status === 'completed' || status === 'failed') {
      sql += ', completed_at = CURRENT_TIMESTAMP';
    }

    sql += ' WHERE task_id = ?';
    params.push(taskId);

    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  async getTask(taskId) {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE task_id = ?
    `);
    return stmt.get(taskId);
  }

  async getAllTasks(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT t.*, a.name as agent_name 
      FROM tasks t 
      LEFT JOIN ai_agents a ON t.agent_id = a.id
      ORDER BY t.created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  // Autonomous workflow methods
  async createAutonomousWorkflow(workflowData) {
    const stmt = this.db.prepare(`
      INSERT INTO autonomous_workflows (name, description, triggers, actions, conditions)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      workflowData.name,
      workflowData.description || '',
      JSON.stringify(workflowData.triggers),
      JSON.stringify(workflowData.actions),
      JSON.stringify(workflowData.conditions || {})
    );

    return {
      id: result.lastInsertRowid,
      message: 'Autonomous workflow created successfully'
    };
  }

  async getAllWorkflows() {
    const stmt = this.db.prepare(`
      SELECT * FROM autonomous_workflows 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  // Project integration methods
  async createProjectIntegration(integrationData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_integrations (project_id, project_name, project_path, integration_type, configuration)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      integrationData.project_id,
      integrationData.project_name,
      integrationData.project_path,
      integrationData.integration_type,
      JSON.stringify(integrationData.configuration || {})
    );

    return {
      id: result.lastInsertRowid,
      message: 'Project integration created successfully'
    };
  }

  async getAllProjectIntegrations() {
    const stmt = this.db.prepare(`
      SELECT * FROM project_integrations 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  // Chatbot integration methods
  async createChatbotIntegration(integrationData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chatbot_integrations (platform, webhook_url, configuration)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      integrationData.platform,
      integrationData.webhook_url,
      JSON.stringify(integrationData.configuration || {})
    );

    return {
      id: result.lastInsertRowid,
      message: 'Chatbot integration created successfully'
    };
  }

  async getAllChatbotIntegrations() {
    const stmt = this.db.prepare(`
      SELECT * FROM chatbot_integrations 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  // Logging methods
  async logTaskExecution(taskId, agentId, action, details) {
    const stmt = this.db.prepare(`
      INSERT INTO task_execution_logs (task_id, agent_id, action, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(taskId, agentId, action, JSON.stringify(details || {}));
  }

  async recordPerformanceMetric(agentId, metricType, metricValue, context = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO performance_metrics (agent_id, metric_type, metric_value, context)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(agentId, metricType, metricValue, JSON.stringify(context));
  }

  // Analytics methods
  async getAnalytics() {
    const totalAgents = this.db.prepare('SELECT COUNT(*) as count FROM ai_agents').get();
    const activeAgents = this.db.prepare("SELECT COUNT(*) as count FROM ai_agents WHERE status = 'active'").get();
    const totalTasks = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    const completedTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
    const totalWorkflows = this.db.prepare('SELECT COUNT(*) as count FROM autonomous_workflows WHERE is_active = true').get();
    
    const recentTasks = this.db.prepare(`
      SELECT t.*, a.name as agent_name 
      FROM tasks t 
      LEFT JOIN ai_agents a ON t.agent_id = a.id
      ORDER BY t.created_at DESC 
      LIMIT 10
    `).all();

    const agentPerformance = this.db.prepare(`
      SELECT a.name, COUNT(t.id) as task_count, 
             AVG(CASE WHEN t.status = 'completed' THEN 1.0 ELSE 0.0 END) as success_rate
      FROM ai_agents a 
      LEFT JOIN tasks t ON a.id = t.agent_id 
      GROUP BY a.id, a.name
    `).all();

    return {
      totalAgents: totalAgents.count,
      activeAgents: activeAgents.count,
      totalTasks: totalTasks.count,
      completedTasks: completedTasks.count,
      totalWorkflows: totalWorkflows.count,
      recentTasks,
      agentPerformance
    };
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
