import { promises as fs } from 'fs';
import * as path from 'path';

class StateManager {
  constructor() {
    this.states = [];
    this.currentState = {
      html: '',
      css: '',
      js: '',
      components: []
    };
  }

  async saveState() {
    this.states.push({ ...this.currentState });
    
    // Save to disk for persistence
    try {
      const stateDir = path.join('src', 'states');
      await fs.mkdir(stateDir, { recursive: true });
      
      await fs.writeFile(
        path.join(stateDir, `state-${Date.now()}.json`),
        JSON.stringify(this.currentState, null, 2)
      );
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  async updateState(newContent) {
    // Save current state before updating
    await this.saveState();
    
    // Merge new content with current state
    this.currentState = {
      ...this.currentState,
      ...newContent
    };
    
    return this.currentState;
  }

  getCurrentState() {
    return this.currentState;
  }

  async revertToPreviousState() {
    if (this.states.length === 0) return null;
    
    this.currentState = this.states.pop();
    return this.currentState;
  }

  async revertToState(index) {
    if (index < 0 || index >= this.states.length) return null;
    
    this.currentState = { ...this.states[index] };
    this.states = this.states.slice(0, index + 1);
    return this.currentState;
  }
}

export default new StateManager();