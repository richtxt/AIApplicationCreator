import { promises as fs } from 'fs';
import planningAgent from './planningAgent.js';
import developmentAgent from './developmentAgent.js';
import testingAgent from './testingAgent.js';
import documentManager from '../utils/documentManager.js';

class Orchestrator {
  constructor() {
    this.MAX_ATTEMPTS = 3;
    this.currentContext = null;
  }

  // async initialize() {
  //   // Load project context
  //   await documentManager.initialize();
  //   this.currentContext = await documentManager.getProjectContext();
  // }

  async processFeatureRequest(request) {
    console.log('\n=== Starting Feature Implementation ===');
    global.eventEmitter.emit('phase', { 
      phase: 'Starting',
      message: 'Beginning feature implementation'
    });
    
    try {
      // // Step 1: Planning Phase
      // global.eventEmitter.emit('phase', {
      //   phase: 'Planning',
      //   message: 'Creating implementation plan'
      // });
      
      // const plan = await planningAgent.createPlan(request, this.currentContext);
      
      // if (!plan.success) {
      //   throw new Error('Planning failed: ' + plan.error);
      // }

      // global.eventEmitter.emit('log', {
      //   message: 'Plan created successfully'
      // });

      // global.eventEmitter.emit('phase', {
      //   phase: 'Planning',
      //   message: JSON.stringify(plan)
      // });

      // // Step 2: Implementation Loop
      // let implementation = null;
      // let testResults = null;
      // let attempts = 0;

      while (attempts < this.MAX_ATTEMPTS) {
        attempts++;
        global.eventEmitter.emit('phase', {
          phase: 'Development',
          message: `Attempt ${attempts} of ${this.MAX_ATTEMPTS}`
        });

        // Generate or fix implementation
        implementation = await this.developFeature(
          request,
          // plan,
          // implementation,
          // testResults
        );

      //   // Update UI with new implementation
      //   global.eventEmitter.emit('component-update', {
      //     component: implementation.component
      //   });

      //   // Test the implementation
      //   global.eventEmitter.emit('phase', {
      //     phase: 'Testing',
      //     message: `Testing attempt ${attempts}`
      //   });

      //   testResults = await testingAgent.testFeature(
      //     implementation,
      //     plan.testCriteria
      //   );

      //   if (testResults.success) {
      //     global.eventEmitter.emit('phase', {
      //       phase: 'Complete',
      //       message: 'All tests passed!'
      //     });
      //     break;
      //   }

      //   global.eventEmitter.emit('log', {
      //     message: `Test failures: ${JSON.stringify(testResults.failures)}`
      //   });

      //   if (attempts === this.MAX_ATTEMPTS) {
      //     throw new Error('Max attempts reached. Could not implement feature successfully.');
      //   }
      }

      // Update context with new implementation
      // await this.updateContext(implementation);

      return {
        success: true,
        plan,
        implementation,
        testResults
      };

    } catch (error) {
      global.eventEmitter.emit('error', {
        message: error.message
      });
      
      console.error('Error in feature implementation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
    
  async developFeature(request, plan, previousImplementation, previousTestResults) {
    return await developmentAgent.generateCode({
      request,
      // plan,
      context: this.currentContext,
      // previousImplementation,
      // testResults: previousTestResults
    });
  }

  async updateContext(implementation) {
    try {
      // Save files
      for (const file of implementation.files) {
        await documentManager.updateFile(file.path, file.content);
      }

      // Update context
      this.currentContext = await documentManager.getProjectContext();
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }
}

export default new Orchestrator();