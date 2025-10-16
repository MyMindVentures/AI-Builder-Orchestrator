#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';
import { DatabaseManager } from './database/database.js';
import { OrchestrationService } from './orchestrator/orchestration.js';
import { AgentManager } from './agents/agent-manager.js';
import { TaskQueue } from './services/task-queue.js';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

class AIBuilderOrchestrator {
  constructor() {
    this.server = new Server(
      {
        name: 'ai-builder-orchestrator',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.database = new DatabaseManager();
    this.agentManager = new AgentManager();
    this.orchestrationService = new OrchestrationService(
      this.database,
      this.agentManager
    );
    this.taskQueue = new TaskQueue();

    this.setupHandlers();
    this.setupExpress();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'delegate_to_ai_builder',
            description:
              'Delegate a development task to the best available AI Builder (Devin, Cursor, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'The development task to be executed',
                },
                project_context: {
                  type: 'object',
                  description: 'Context about the project and requirements',
                  properties: {
                    project_type: { type: 'string' },
                    technology_stack: { type: 'array', items: { type: 'string' } },
                    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                    deadline: { type: 'string' },
                    requirements: { type: 'array', items: { type: 'string' } },
                  },
                },
                preferred_agent: {
                  type: 'string',
                  description: 'Preferred AI Builder agent (devin, cursor, claude, gpt-4, auto)',
                  enum: ['devin', 'cursor', 'claude', 'gpt-4', 'auto'],
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'monitor_ai_builder',
            description: 'Monitor the status and progress of AI Builder tasks',
            inputSchema: {
              type: 'object',
              properties: {
                task_id: {
                  type: 'string',
                  description: 'ID of the task to monitor',
                },
                agent_id: {
                  type: 'string',
                  description: 'ID of the AI Builder agent',
                },
              },
              required: ['task_id'],
            },
          },
          {
            name: 'get_ai_builder_status',
            description: 'Get the current status and capabilities of all AI Builder agents',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: {
                  type: 'string',
                  description: 'Specific agent ID to check (optional)',
                },
              },
            },
          },
          {
            name: 'schedule_autonomous_upgrade',
            description: 'Schedule an autonomous upgrade for a project using AI Builders',
            inputSchema: {
              type: 'object',
              properties: {
                project_id: {
                  type: 'string',
                  description: 'ID of the project to upgrade',
                },
                upgrade_type: {
                  type: 'string',
                  description: 'Type of upgrade to perform',
                  enum: ['security', 'performance', 'features', 'dependencies', 'architecture'],
                },
                requirements: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific requirements for the upgrade',
                },
                schedule: {
                  type: 'string',
                  description: 'When to perform the upgrade (immediate, scheduled, or cron expression)',
                },
              },
              required: ['project_id', 'upgrade_type'],
            },
          },
          {
            name: 'create_autonomous_workflow',
            description: 'Create a workflow for autonomous project management',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_name: {
                  type: 'string',
                  description: 'Name of the workflow',
                },
                triggers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Events that trigger the workflow',
                },
                actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Actions to perform in the workflow',
                },
                conditions: {
                  type: 'object',
                  description: 'Conditions for workflow execution',
                },
              },
              required: ['workflow_name', 'triggers', 'actions'],
            },
          },
          {
            name: 'integrate_with_chatbot',
            description: 'Integrate AI Builder Orchestrator with chatbot systems',
            inputSchema: {
              type: 'object',
              properties: {
                chatbot_platform: {
                  type: 'string',
                  description: 'Chatbot platform (discord, slack, telegram, webhook)',
                },
                integration_config: {
                  type: 'object',
                  description: 'Configuration for the chatbot integration',
                },
                webhook_url: {
                  type: 'string',
                  description: 'Webhook URL for receiving chatbot messages',
                },
              },
              required: ['chatbot_platform'],
            },
          },
          {
            name: 'analyze_project_health',
            description: 'Analyze project health and suggest autonomous improvements',
            inputSchema: {
              type: 'object',
              properties: {
                project_path: {
                  type: 'string',
                  description: 'Path to the project to analyze',
                },
                analysis_type: {
                  type: 'string',
                  description: 'Type of analysis to perform',
                  enum: ['security', 'performance', 'code_quality', 'dependencies', 'architecture'],
                },
              },
              required: ['project_path'],
            },
          },
          {
            name: 'deploy_autonomous_system',
            description: 'Deploy an autonomous development system for a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_id: {
                  type: 'string',
                  description: 'ID of the project to deploy autonomous system for',
                },
                deployment_config: {
                  type: 'object',
                  description: 'Configuration for the autonomous deployment',
                  properties: {
                    auto_testing: { type: 'boolean' },
                    auto_deployment: { type: 'boolean' },
                    auto_monitoring: { type: 'boolean' },
                    auto_scaling: { type: 'boolean' },
                  },
                },
              },
              required: ['project_id'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'delegate_to_ai_builder':
            return await this.orchestrationService.delegateToAIBuilder(args);

          case 'monitor_ai_builder':
            return await this.orchestrationService.monitorAIBuilder(args);

          case 'get_ai_builder_status':
            return await this.orchestrationService.getAIBuilderStatus(args);

          case 'schedule_autonomous_upgrade':
            return await this.orchestrationService.scheduleAutonomousUpgrade(args);

          case 'create_autonomous_workflow':
            return await this.orchestrationService.createAutonomousWorkflow(args);

          case 'integrate_with_chatbot':
            return await this.orchestrationService.integrateWithChatbot(args);

          case 'analyze_project_health':
            return await this.orchestrationService.analyzeProjectHealth(args);

          case 'deploy_autonomous_system':
            return await this.orchestrationService.deployAutonomousSystem(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  setupExpress() {
    this.app = express();
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        orchestrator: 'ai-builder-orchestrator',
      });
    });

    // API endpoints for web interface
    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = await this.agentManager.getAllAgents();
        res.json(agents);
      } catch (error) {
        logger.error('Error fetching agents:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/tasks', async (req, res) => {
      try {
        const tasks = await this.taskQueue.getAllTasks();
        res.json(tasks);
      } catch (error) {
        logger.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/delegate', async (req, res) => {
      try {
        const result = await this.orchestrationService.delegateToAIBuilder(req.body);
        res.json(result);
      } catch (error) {
        logger.error('Error delegating task:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/analytics', async (req, res) => {
      try {
        const analytics = await this.orchestrationService.getAnalytics();
        res.json(analytics);
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Webhook endpoint for chatbot integration
    this.app.post('/webhook/chatbot', async (req, res) => {
      try {
        const result = await this.orchestrationService.handleChatbotMessage(req.body);
        res.json(result);
      } catch (error) {
        logger.error('Error handling chatbot message:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  async start() {
    try {
      // Initialize database
      await this.database.initialize();
      logger.info('Database initialized successfully');

      // Initialize agent manager
      await this.agentManager.initialize();
      logger.info('Agent manager initialized successfully');

      // Start task queue
      await this.taskQueue.start();
      logger.info('Task queue started successfully');

      // Start Express server
      const port = process.env.PORT || 3000;
      this.app.listen(port, () => {
        logger.info(`Express server running on port ${port}`);
      });

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('AI Builder Orchestrator started successfully');
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new AIBuilderOrchestrator();
server.start().catch(error => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});
