#!/usr/bin/env node

import { AIKnowledgeExtractor } from '../services/ai-knowledge-extractor.js';
import winston from 'winston';

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
  ],
});

class KnowledgeExtractionJob {
  constructor() {
    this.extractor = new AIKnowledgeExtractor();
    this.toolsToExtract = process.env.EXTRACTION_TOOLS?.split(',') || [
      'NorthFlank',
      'React',
      'Docker',
      'Node.js',
      'Express',
      'MongoDB',
      'Redis',
      'PostgreSQL',
      'Neo4j',
      'FAISS',
      'Vite',
      'Tailwind CSS',
      'PWA',
      'WebSocket',
      'MCP',
      'GitHub Actions',
      'Kubernetes',
      'Nginx'
    ];
  }

  async run() {
    logger.info('🚀 Starting AI Knowledge Extraction Job');
    logger.info(`📋 Tools to extract: ${this.toolsToExtract.join(', ')}`);

    try {
      const results = [];
      const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS) || 3;

      // Process tools in batches to avoid overwhelming the system
      for (let i = 0; i < this.toolsToExtract.length; i += maxConcurrent) {
        const batch = this.toolsToExtract.slice(i, i + maxConcurrent);
        logger.info(`🔄 Processing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.join(', ')}`);

        const batchPromises = batch.map(async (tool) => {
          try {
            logger.info(`🔍 Extracting knowledge for: ${tool}`);
            const result = await this.extractor.extractKnowledgeFromTool(tool, {
              include_community: true,
              include_best_practices: true,
              include_optimization: true,
              max_sources: 20
            });
            
            logger.info(`✅ Completed extraction for ${tool}: ${result.status}`);
            return result;
          } catch (error) {
            logger.error(`❌ Failed extraction for ${tool}:`, error.message);
            return {
              toolName: tool,
              status: 'failed',
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Wait between batches to be respectful to external APIs
        if (i + maxConcurrent < this.toolsToExtract.length) {
          logger.info('⏳ Waiting 30 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }

      // Generate summary report
      const summary = this.generateSummary(results);
      logger.info('📊 Extraction Summary:', summary);

      // Log final results
      const successful = results.filter(r => r.status === 'completed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      
      logger.info(`🎯 Job completed: ${successful} successful, ${failed} failed`);

      if (failed === 0) {
        logger.info('🎉 All extractions completed successfully!');
        process.exit(0);
      } else {
        logger.warn(`⚠️  ${failed} extractions failed`);
        process.exit(1);
      }

    } catch (error) {
      logger.error('💥 Job failed with error:', error);
      process.exit(1);
    }
  }

  generateSummary(results) {
    const summary = {
      total: results.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      tools: {}
    };

    results.forEach(result => {
      summary.tools[result.toolName || result.tool_name] = {
        status: result.status,
        progress: result.progress || 0,
        error: result.error || null,
        completedAt: result.completedAt || null
      };
    });

    return summary;
  }

  async runSingleTool(toolName) {
    logger.info(`🔍 Running single tool extraction for: ${toolName}`);
    
    try {
      const result = await this.extractor.extractKnowledgeFromTool(toolName, {
        include_community: true,
        include_best_practices: true,
        include_optimization: true,
        max_sources: 25
      });
      
      logger.info(`✅ Single tool extraction completed: ${result.status}`);
      return result;
    } catch (error) {
      logger.error(`❌ Single tool extraction failed:`, error.message);
      throw error;
    }
  }

  async runCustomExtraction(tools, options = {}) {
    logger.info(`🔍 Running custom extraction for: ${tools.join(', ')}`);
    
    try {
      const results = await this.extractor.extractMultipleTools(tools, options);
      
      logger.info(`✅ Custom extraction completed: ${results.length} tools processed`);
      return results;
    } catch (error) {
      logger.error(`❌ Custom extraction failed:`, error.message);
      throw error;
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const job = new KnowledgeExtractionJob();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const command = args[0];
    
    switch (command) {
      case 'single':
        if (args[1]) {
          job.runSingleTool(args[1])
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
        } else {
          logger.error('❌ Please provide a tool name for single extraction');
          process.exit(1);
        }
        break;
        
      case 'custom':
        if (args[1]) {
          const tools = args[1].split(',');
          const options = args[2] ? JSON.parse(args[2]) : {};
          job.runCustomExtraction(tools, options)
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
        } else {
          logger.error('❌ Please provide comma-separated tool names for custom extraction');
          process.exit(1);
        }
        break;
        
      default:
        logger.error(`❌ Unknown command: ${command}`);
        logger.info('Available commands: single <tool>, custom <tools>, or run without arguments for full extraction');
        process.exit(1);
    }
  } else {
    // Run full extraction job
    job.run();
  }
}

export default KnowledgeExtractionJob;
