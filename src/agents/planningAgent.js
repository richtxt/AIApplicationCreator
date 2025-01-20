import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';

dotenv.config();

class PlanningAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
    });
  }

  async createPlan(request, context) {
    try {
      const prompt = `
Create a detailed implementation plan for this feature request:
${request}

Project Context:
${context}

Provide specific requirements and test criteria. Include:
1. Visual requirements (what should be visible and where)
2. Functional requirements (what should work and how)
3. Test criteria for each requirement

Return in this exact JSON format:
{
  "requirements": {
    "visual": [
      {
        "description": "string",
        "selector": "CSS selector",
        "priority": "high|medium|low"
      }
    ],
    "functional": [
      {
        "description": "string",
        "steps": [
          {
            "action": "click|type|check",
            "selector": "CSS selector",
            "value": "string (for type)",
            "expectedValue": "string (for check)"
          }
        ],
        "priority": "high|medium|low"
      }
    ]
  },
  "testCriteria": {
    "visual": [
      {
        "requirement": "string",
        "selector": "CSS selector"
      }
    ],
    "functional": [
      {
        "requirement": "string",
        "steps": [
          {
            "action": "click|type|check",
            "selector": "CSS selector",
            "value": "string",
            "expectedValue": "string"
          }
        ]
      }
    ]
  },
  "components": [
    {
      "name": "string",
      "type": "string",
      "purpose": "string"
    }
  ]
}`;

      const response = await this.model.invoke(prompt);
      
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        const plan = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          ...plan
        };
      } catch (error) {
        console.error('Error parsing plan:', error);
        return {
          success: false,
          error: 'Failed to parse planning response'
        };
      }
    } catch (error) {
      console.error('Error in planning:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new PlanningAgent();