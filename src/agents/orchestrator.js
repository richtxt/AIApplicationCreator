import developmentAgent from './developmentAgent.js';
import documentManager from '../utils/documentManager.js';

class Orchestrator {
  constructor() {
    this.currentContext = null;
  }

  async initialize() {
    await documentManager.initialize();
  }

  async processFeatureRequest(request) {
    console.log('\n=== Starting Feature Implementation ===');
    global.eventEmitter.emit('phase', { 
      phase: 'Starting',
      message: 'Beginning feature implementation'
    });
    
    try {
      // Development Phase
      global.eventEmitter.emit('phase', {
        phase: 'Development',
        message: 'Generating component'
      });

      const implementation = await this.developFeature(request);

      if (!implementation.success) {
        throw new Error('Development failed: ' + implementation.error);
      }

      // Update UI with new implementation
      global.eventEmitter.emit('component-update', {
        component: implementation.code
      });

      // Update context with new implementation
      await this.updateContext(implementation);

      global.eventEmitter.emit('phase', {
        phase: 'Complete',
        message: 'Feature implemented successfully'
      });

      return {
        success: true,
        implementation
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
    
  async developFeature(request) {
    return await developmentAgent.generateCode({
      request,
      context: this.currentContext
    });
  }

  async updateContext(implementation) {
    try {
      // Save files
      for (const file of implementation.files) {
        await documentManager.updateFile(file.path, file.content);
      }
    } catch (error) {
      console.error('Error updating context:', error);
      throw error;
    }
  }
}

export default new Orchestrator();