import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export class AgentManager {
  constructor() {
    this.agents = new Map();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()],
    });
  }

  async initialize() {
    // Register default AI Builder agents
    await this.registerDefaultAgents();
    this.logger.info('Agent manager initialized with default agents');
  }

  async registerDefaultAgents() {
    const defaultAgents = [
      {
        name: 'devin',
        type: 'ai_builder',
        capabilities: [
          'full_stack_development',
          'code_generation',
          'testing',
          'debugging',
          'deployment',
          'documentation',
          'refactoring',
          'architecture_design'
        ],
        configuration: {
          api_endpoint: process.env.DEVIN_API_ENDPOINT || 'https://api.devin.ai',
          max_concurrent_tasks: 3,
          preferred_languages: ['javascript', 'typescript', 'python', 'go', 'rust'],
          specializations: ['web_development', 'api_development', 'microservices']
        }
      },
      {
        name: 'cursor',
        type: 'ai_editor',
        capabilities: [
          'code_completion',
          'code_generation',
          'refactoring',
          'documentation',
          'testing',
          'debugging',
          'code_review'
        ],
        configuration: {
          api_endpoint: process.env.CURSOR_API_ENDPOINT || 'https://api.cursor.sh',
          max_concurrent_tasks: 5,
          preferred_languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
          specializations: ['ide_integration', 'real_time_coding', 'context_aware_editing']
        }
      },
      {
        name: 'claude',
        type: 'ai_assistant',
        capabilities: [
          'code_generation',
          'code_review',
          'documentation',
          'planning',
          'analysis',
          'problem_solving',
          'architecture_design'
        ],
        configuration: {
          api_endpoint: process.env.ANTHROPIC_API_ENDPOINT || 'https://api.anthropic.com',
          max_concurrent_tasks: 10,
          preferred_languages: ['javascript', 'typescript', 'python', 'go', 'rust', 'java'],
          specializations: ['reasoning', 'planning', 'complex_problem_solving']
        }
      },
      {
        name: 'gpt-4',
        type: 'ai_assistant',
        capabilities: [
          'code_generation',
          'code_review',
          'documentation',
          'testing',
          'debugging',
          'planning',
          'analysis'
        ],
        configuration: {
          api_endpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com',
          max_concurrent_tasks: 10,
          preferred_languages: ['javascript', 'typescript', 'python', 'java', 'csharp', 'go'],
          specializations: ['general_coding', 'rapid_prototyping', 'code_explanation']
        }
      },
      {
        name: 'github-copilot',
        type: 'ai_copilot',
        capabilities: [
          'code_completion',
          'code_generation',
          'documentation',
          'testing',
          'code_suggestions'
        ],
        configuration: {
          api_endpoint: process.env.GITHUB_COPILOT_API_ENDPOINT || 'https://api.github.com',
          max_concurrent_tasks: 15,
          preferred_languages: ['javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust'],
          specializations: ['inline_suggestions', 'context_aware_completion', 'multi_language_support']
        }
      }
    ];

    for (const agentData of defaultAgents) {
      await this.registerAgent(agentData);
    }
  }

  async registerAgent(agentData) {
    const agent = {
      id: uuidv4(),
      name: agentData.name,
      type: agentData.type,
      status: 'active',
      capabilities: agentData.capabilities || [],
      configuration: agentData.configuration || {},
      currentTasks: 0,
      maxConcurrentTasks: agentData.configuration?.max_concurrent_tasks || 5,
      lastHeartbeat: new Date(),
      performance: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageExecutionTime: 0,
        successRate: 0
      },
      createdAt: new Date()
    };

    this.agents.set(agent.name, agent);
    this.logger.info(`Registered agent: ${agent.name} (${agent.type})`);
    
    return agent;
  }

  async getAllAgents() {
    return Array.from(this.agents.values());
  }

  async getAgentByName(name) {
    return this.agents.get(name);
  }

  async getAvailableAgents() {
    return Array.from(this.agents.values()).filter(agent => 
      agent.status === 'active' && 
      agent.currentTasks < agent.maxConcurrentTasks
    );
  }

  async selectBestAgent(task, projectContext = {}) {
    const availableAgents = await this.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      throw new Error('No available agents found');
    }

    // Score agents based on task requirements
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;
      
      // Base score from success rate
      score += agent.performance.successRate * 100;
      
      // Bonus for matching capabilities
      const requiredCapabilities = this.extractRequiredCapabilities(task, projectContext);
      const matchingCapabilities = requiredCapabilities.filter(cap => 
        agent.capabilities.includes(cap)
      );
      score += (matchingCapabilities.length / requiredCapabilities.length) * 50;
      
      // Bonus for preferred languages
      const preferredLanguages = projectContext.technology_stack || [];
      const matchingLanguages = preferredLanguages.filter(lang => 
        agent.configuration.preferred_languages?.includes(lang)
      );
      score += (matchingLanguages.length / Math.max(preferredLanguages.length, 1)) * 30;
      
      // Bonus for specializations
      const taskType = this.determineTaskType(task, projectContext);
      if (agent.configuration.specializations?.includes(taskType)) {
        score += 20;
      }
      
      // Penalty for current load
      const loadRatio = agent.currentTasks / agent.maxConcurrentTasks;
      score -= loadRatio * 20;
      
      return { agent, score };
    });

    // Sort by score and return the best agent
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }

  extractRequiredCapabilities(task, projectContext) {
    const capabilities = [];
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('build') || taskLower.includes('compile')) {
      capabilities.push('code_generation', 'testing');
    }
    
    if (taskLower.includes('test') || taskLower.includes('testing')) {
      capabilities.push('testing');
    }
    
    if (taskLower.includes('deploy') || taskLower.includes('deployment')) {
      capabilities.push('deployment');
    }
    
    if (taskLower.includes('debug') || taskLower.includes('fix')) {
      capabilities.push('debugging');
    }
    
    if (taskLower.includes('refactor') || taskLower.includes('optimize')) {
      capabilities.push('refactoring');
    }
    
    if (taskLower.includes('document') || taskLower.includes('readme')) {
      capabilities.push('documentation');
    }
    
    if (taskLower.includes('architecture') || taskLower.includes('design')) {
      capabilities.push('architecture_design');
    }
    
    if (taskLower.includes('review') || taskLower.includes('analyze')) {
      capabilities.push('code_review', 'analysis');
    }
    
    // Default capabilities for general tasks
    if (capabilities.length === 0) {
      capabilities.push('code_generation', 'problem_solving');
    }
    
    return capabilities;
  }

  determineTaskType(task, projectContext) {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('web') || taskLower.includes('frontend') || taskLower.includes('react') || taskLower.includes('vue')) {
      return 'web_development';
    }
    
    if (taskLower.includes('api') || taskLower.includes('backend') || taskLower.includes('server')) {
      return 'api_development';
    }
    
    if (taskLower.includes('microservice') || taskLower.includes('service')) {
      return 'microservices';
    }
    
    if (taskLower.includes('mobile') || taskLower.includes('app')) {
      return 'mobile_development';
    }
    
    if (taskLower.includes('data') || taskLower.includes('ml') || taskLower.includes('ai')) {
      return 'data_science';
    }
    
    return 'general_development';
  }

  async assignTaskToAgent(agentName, taskId) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }
    
    if (agent.currentTasks >= agent.maxConcurrentTasks) {
      throw new Error(`Agent ${agentName} is at maximum capacity`);
    }
    
    agent.currentTasks++;
    agent.lastHeartbeat = new Date();
    
    this.logger.info(`Assigned task ${taskId} to agent ${agentName}`);
    return agent;
  }

  async releaseTaskFromAgent(agentName, taskId, success = true) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      this.logger.warn(`Agent ${agentName} not found when releasing task ${taskId}`);
      return;
    }
    
    agent.currentTasks = Math.max(0, agent.currentTasks - 1);
    agent.lastHeartbeat = new Date();
    
    // Update performance metrics
    agent.performance.totalTasks++;
    if (success) {
      agent.performance.completedTasks++;
    } else {
      agent.performance.failedTasks++;
    }
    
    agent.performance.successRate = agent.performance.completedTasks / agent.performance.totalTasks;
    
    this.logger.info(`Released task ${taskId} from agent ${agentName} (success: ${success})`);
  }

  async updateAgentHeartbeat(agentName) {
    const agent = this.agents.get(agentName);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  async getAgentStatus(agentName = null) {
    if (agentName) {
      const agent = this.agents.get(agentName);
      return agent ? this.formatAgentStatus(agent) : null;
    }
    
    return Array.from(this.agents.values()).map(agent => this.formatAgentStatus(agent));
  }

  formatAgentStatus(agent) {
    return {
      name: agent.name,
      type: agent.type,
      status: agent.status,
      currentTasks: agent.currentTasks,
      maxConcurrentTasks: agent.maxConcurrentTasks,
      loadPercentage: (agent.currentTasks / agent.maxConcurrentTasks) * 100,
      capabilities: agent.capabilities,
      performance: agent.performance,
      lastHeartbeat: agent.lastHeartbeat,
      isAvailable: agent.status === 'active' && agent.currentTasks < agent.maxConcurrentTasks
    };
  }

  async getAgentCapabilities(agentName) {
    const agent = this.agents.get(agentName);
    return agent ? agent.capabilities : [];
  }

  async getAgentConfiguration(agentName) {
    const agent = this.agents.get(agentName);
    return agent ? agent.configuration : null;
  }

  async updateAgentConfiguration(agentName, newConfiguration) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }
    
    agent.configuration = { ...agent.configuration, ...newConfiguration };
    agent.lastHeartbeat = new Date();
    
    this.logger.info(`Updated configuration for agent ${agentName}`);
    return agent.configuration;
  }

  async deactivateAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }
    
    agent.status = 'inactive';
    agent.lastHeartbeat = new Date();
    
    this.logger.info(`Deactivated agent ${agentName}`);
  }

  async activateAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }
    
    agent.status = 'active';
    agent.lastHeartbeat = new Date();
    
    this.logger.info(`Activated agent ${agentName}`);
  }
}
