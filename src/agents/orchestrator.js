import { promises as fs } from 'fs';
import planningAgent from './planningAgent.js';
import developmentAgent from './developmentAgent.js';
import fixAgent from './fixAgent.js';
import fileAgent from './fileAgent.js';
import projectAnalysisAgent from './projectAnalysisAgent.js';
import applicationTester from './applicationTester.js';
import projectGenerator from './projectGenerator.js';
import documentManager from '../utils/documentManager.js';

class Orchestrator {
    constructor() {
      this.currentTask = null;
      this.taskHistory = [];
    }
  
    async initialize() {
      try {
        // Create necessary directories
        await this.createDirectoryStructure();
        
        // Initialize document manager
        await documentManager.initialize();
        
        // Run initial project analysis
        await this.analyzeCurrentProject();
      } catch (error) {
        console.error('Initialization error:', error);
        // Continue initialization even if there are errors
      }
    }
  
    async createDirectoryStructure() {
      const directories = [
        'src/components',
        'src/analysis',
        'src/patterns',
        'src/test-results',
        'src/preview'
      ];
  
      for (const dir of directories) {
        try {
          await fs.mkdir(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        } catch (error) {
          console.error(`Error creating directory ${dir}:`, error);
          // Continue with other directories even if one fails
        }
      }
    }

  async analyzeCurrentProject() {
    const analysis = await projectAnalysisAgent.analyzeProject();
    console.log('Project Analysis Complete:', analysis);
    return analysis;
  }

  async processFeatureRequest(request) {
    try {
      console.log('Starting feature request processing:', request);
      
      // Step 1: Planning Phase with Context
      console.log('Planning Phase Started');
      const planningResult = await planningAgent.analyzeFeaturesAndCreatePlan(request);
      
      if (!planningResult.success) {
        throw new Error('Planning failed: ' + planningResult.error);
      }

      this.currentTask = {
        id: Date.now(),
        request,
        plan: planningResult.plan,
        status: 'in_progress',
        steps: []
      };

      // Step 2: Development Phase
      console.log('Development Phase Started');
      const implementationResults = [];
      
      for (const step of planningResult.plan.implementationSteps) {
        console.log('Implementing step:', step);
        
        const codeResult = await developmentAgent.generateCode(request, step);
        implementationResults.push({
          step: step.description,
          code: codeResult.code,
          explanation: codeResult.explanation,
          files: step.files,
          fullImplementation: codeResult.fullImplementation
        });
        
        this.currentTask.steps.push({
          type: 'development',
          status: 'completed',
          result: codeResult
        });
      }

      // Step 3: Fix Phase
      console.log('Fix Phase Started');
      const fixResult = await fixAgent.analyzeAndFix(
        implementationResults, 
        request,
        planningResult.plan
      );

      if (fixResult.fixed) {
        console.log('Fixes applied:', fixResult.changes.length);
        this.currentTask.steps.push({
          type: 'fix',
          status: 'completed',
          changes: fixResult.changes
        });
      }

      // Step 4: File Management Phase
      console.log('File Management Phase Started');
      const fileUpdates = await fileAgent.implementChanges(
        fixResult.changes, 
        request,
        planningResult.plan
      );

      // Step 5: Testing Phase
      console.log('Testing Phase Started');
      const testResults = await this.testImplementation(
        fileUpdates.updates,
        planningResult.plan
      );

      // Step 6: Self-Learning Phase
      if (testResults.success) {
        console.log('Learning from successful implementation');
        await this.learnFromSuccess(request, fileUpdates, testResults);
      } else {
        console.log('Learning from implementation issues');
        await this.learnFromIssues(request, fileUpdates, testResults);
      }

      // Save completed task to history
      this.currentTask.status = testResults.success ? 'completed' : 'needs_revision';
      this.taskHistory.push(this.currentTask);

      return {
        success: testResults.success,
        plan: planningResult.plan,
        implementations: fixResult.fixed ? fixResult.finalImplementation : implementationResults,
        fixes: fixResult.fixed ? {
          applied: true,
          changes: fixResult.changes,
          analysis: fixResult.analysis
        } : {
          applied: false,
          changes: []
        },
        fileUpdates: fileUpdates.updates,
        testResults: testResults
      };

    } catch (error) {
      console.error('Error in orchestration:', error);
      if (this.currentTask) {
        this.currentTask.status = 'failed';
        this.currentTask.error = error.message;
        this.taskHistory.push(this.currentTask);
      }
      throw error;
    }
  }

  async testImplementation(fileUpdates, plan) {
    const testResults = [];
    
    for (const update of fileUpdates) {
      const result = await applicationTester.testFeature(
        update.path,
        plan.requirements
      );
      testResults.push({
        file: update.path,
        ...result
      });
    }

    return {
      success: testResults.every(r => r.success),
      results: testResults
    };
  }

  async learnFromSuccess(request, implementation, testResults) {
    const analysis = await projectAnalysisAgent.analyzeFeaturePatterns();
    await documentManager.updateFile(
      'src/patterns/success_patterns.json',
      JSON.stringify({
        request,
        implementation,
        testResults,
        analysis
      }, null, 2)
    );
  }

  async learnFromIssues(request, implementation, testResults) {
    const analysis = await projectAnalysisAgent.analyzeFeaturePatterns();
    await documentManager.updateFile(
      'src/patterns/issue_patterns.json',
      JSON.stringify({
        request,
        implementation,
        testResults,
        analysis
      }, null, 2)
    );
  }

  getTaskHistory() {
    return this.taskHistory;
  }

  getCurrentTask() {
    return this.currentTask;
  }
}

export default new Orchestrator();