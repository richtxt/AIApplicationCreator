import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import * as path from 'path';
import documentManager from '../utils/documentManager.js';

dotenv.config();

class FileAgent {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
      maxTokens: 1000,
      verbose: true
    });
  }

  async implementChanges(changes, originalRequest, plan) {
    try {
      console.log("\nFile Agent: Implementing changes...");

      const fileUpdates = [];
      const processedFiles = new Set();

      for (const change of changes) {
        const files = this.determineAffectedFiles(change, plan);
        
        for (const file of files) {
          if (!processedFiles.has(file)) {
            processedFiles.add(file);
            
            const update = await this.prepareFileUpdate(file, change, originalRequest);
            fileUpdates.push(update);
          }
        }
      }

      // Apply updates
      for (const update of fileUpdates) {
        await this.applyFileUpdate(update);
      }

      return {
        success: true,
        updates: fileUpdates
      };

    } catch (error) {
      console.error("Error in File Agent:", error);
      throw error;
    }
  }

  determineAffectedFiles(change, plan) {
    const files = new Set();
    
    // Add explicitly mentioned files
    if (change.files) {
      change.files.forEach(f => files.add(f));
    }

    // Look up files from plan
    if (plan && plan.implementationSteps) {
      plan.implementationSteps.forEach(step => {
        if (step.step === change.stepIndex) {
          step.files.forEach(f => files.add(f));
        }
      });
    }

    // Ensure files have proper directory structure
    return Array.from(files).map(file => 
      path.join('src', file)
    );
  }

  async prepareFileUpdate(filePath, change, originalRequest) {
    const prompt = `
As a code file manager, prepare an update for a source code file.

File: ${filePath}
Change Description: ${JSON.stringify(change)}
Original Feature Request: ${originalRequest}

Provide a complete, updated version of the file that:
1. Implements the required changes
2. Maintains proper file structure
3. Includes necessary imports
4. Has appropriate error handling
5. Follows best practices

Return ONLY the complete file content in proper format.
`;

    const response = await this.model.invoke(prompt);
    
    return {
      path: filePath,
      content: response.content.trim()
    };
  }

  async applyFileUpdate({ path: filePath, content }) {
    await documentManager.updateFile(filePath, content);
    console.log(`Updated file: ${filePath}`);
  }
}

export default new FileAgent();