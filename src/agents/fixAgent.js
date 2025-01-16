import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import documentManager from '../utils/documentManager.js';

dotenv.config();

class FixAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
      maxTokens: 2000, // Increased token limit
    });
  }

  async analyzeAndFix(implementationSteps, originalRequest, plan) {
    try {
      console.log("Fix Agent: Starting analysis...");

      const prompt = `
        As a code reviewer and fixer, analyze this implementation:

        Original Request: ${originalRequest}

        Implementation Steps:
        ${JSON.stringify(implementationSteps, null, 2)}

        Plan:
        ${JSON.stringify(plan, null, 2)}

        Find any issues with:
        1. Naming consistency
        2. Error handling
        3. Input validation
        4. Integration between steps
        5. Code style and best practices

        Provide a JSON response in exactly this format:
        {
          "analysis": {
            "issues": [
              {
                "type": "naming|error_handling|validation|integration|style",
                "description": "string",
                "severity": "high|medium|low",
                "location": {
                  "step": number,
                  "file": "string"
                }
              }
            ]
          },
          "fixes": [
            {
              "stepIndex": number,
              "file": "string",
              "description": "string",
              "before": "string",
              "after": "string",
              "explanation": "string"
            }
          ]
        }`;

      const response = await this.model.invoke(prompt);
      
      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }

        const analysis = JSON.parse(jsonMatch[0]);
        const hasIssues = analysis.analysis.issues.length > 0;

        if (hasIssues) {
          console.log(`Found ${analysis.analysis.issues.length} issues to fix`);
          return {
            fixed: true,
            changes: analysis.fixes || [],
            analysis: analysis.analysis
          };
        } else {
          console.log("No issues found");
          return {
            fixed: false,
            changes: [],
            analysis: analysis.analysis
          };
        }
      } catch (parseError) {
        console.error('Error parsing fix analysis:', parseError);
        // Return a safe default if parsing fails
        return {
          fixed: false,
          changes: [],
          analysis: {
            issues: []
          }
        };
      }
    } catch (error) {
      console.error("Error in Fix Agent:", error);
      return {
        fixed: false,
        changes: [],
        analysis: {
          issues: []
        }
      };
    }
  }
}

export default new FixAgent();