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
      maxTokens: 2000,
    });
  }

  async analyzeAndFix(implementationResults, originalRequest, plan) {
    try {
      console.log("Fix Agent: Starting analysis...");
      
      // Get fixes from the model
      const analysis = await this.getAnalysis(implementationResults, originalRequest, plan);
      console.log("Analysis completed, applying fixes...");

      if (analysis.issues.length > 0) {
        console.log(`Found ${analysis.issues.length} issues to fix`);
        
        // Apply fixes to implementation
        const fixedImplementations = await this.applyFixes(
          implementationResults,
          analysis.fixes
        );

        return {
          fixed: true,
          changes: analysis.fixes,
          analysis: analysis,
          finalImplementation: fixedImplementations
        };
      }

      return {
        fixed: false,
        changes: [],
        analysis: analysis,
        finalImplementation: implementationResults
      };
    } catch (error) {
      console.error("Error in Fix Agent:", error);
      return {
        fixed: false,
        changes: [],
        analysis: { issues: [] },
        finalImplementation: implementationResults
      };
    }
  }

  async getAnalysis(implementations, request, plan) {
    const prompt = `
      Analyze this implementation for a ${request}.
      
      Implementation:
      ${JSON.stringify(implementations, null, 2)}
      
      Plan:
      ${JSON.stringify(plan, null, 2)}

      Identify any issues with:
      1. Naming consistency
      2. Error handling
      3. Input validation
      4. Code structure
      5. Documentation

      Return a JSON object with this exact structure:
      {
        "issues": [
          {
            "type": "naming|validation|error_handling|structure|documentation",
            "description": "Issue description",
            "severity": "high|medium|low",
            "location": {
              "file": "filename",
              "component": "component name"
            }
          }
        ],
        "fixes": [
          {
            "type": "component|style|test",
            "code": "complete fixed code",
            "files": ["filename"],
            "description": "what was fixed"
          }
        ]
      }
    `;

    const response = await this.model.invoke(prompt);
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing analysis:', error);
      return { issues: [], fixes: [] };
    }
  }

  async applyFixes(implementations, fixes) {
    // Convert fixes to a format the File Agent can use
    return implementations.map(impl => {
      const relevantFixes = fixes.filter(fix => 
        fix.type === impl.type && 
        fix.files.some(f => impl.files.includes(f))
      );

      if (relevantFixes.length > 0) {
        // Use the most recent fix
        const latestFix = relevantFixes[relevantFixes.length - 1];
        return {
          ...impl,
          code: latestFix.code || impl.code,
          type: latestFix.type || impl.type,
          files: latestFix.files || impl.files
        };
      }

      return impl;
    });
  }
}

export default new FixAgent();