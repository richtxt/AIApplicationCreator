import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import config from '../config/config.js';
import * as dotenv from 'dotenv';

dotenv.config();

class PlanningAgent {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 1000,
    });
  }

  async analyzeFeaturesAndCreatePlan(featureRequest) {
    try {
      console.log("\nPlanning Phase - Analyzing:", featureRequest);
      
      const prompt = `
As a technical architect, create a detailed implementation plan for this feature request.

Feature Request: ${featureRequest}

Create a plan that breaks this down into small, clear steps.
Each step should:
1. Have a clear, specific purpose
2. Include what files will be created or modified
3. Specify what will be implemented
4. Include test requirements

Respond in this exact JSON format:
{
  "analysis": {
    "feature": "Brief description of the feature",
    "complexity": "low/medium/high",
    "requirements": ["list", "of", "key", "requirements"]
  },
  "implementation": {
    "steps": [
      {
        "id": 1,
        "description": "Specific description of what this step implements",
        "purpose": "Why this step is needed",
        "files": ["list of files to create/modify"],
        "testRequirements": ["list of what to test"]
      }
    ]
  }
}

Make steps atomic and focused. Each step should do ONE thing well.
`;

      console.log("\nGenerating implementation plan...");
      const response = await this.model.invoke(prompt);
      
      try {
        const plan = JSON.parse(response.content);
        console.log("\nPlan generated successfully");
        
        // Convert to the format expected by the orchestrator
        return {
          success: true,
          plan: {
            analysis: plan.analysis,
            implementationSteps: plan.implementation.steps.map(step => ({
              step: step.id,
              description: step.description,
              purpose: step.purpose,
              files: step.files,
              testRequirements: step.testRequirements
            }))
          }
        };
      } catch (error) {
        console.error('Error parsing planning response:', error);
        throw new Error('Failed to create valid implementation plan');
      }
    } catch (error) {
      console.error('Error in planning:', error);
      throw error;
    }
  }
}

export default new PlanningAgent();