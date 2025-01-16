import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';
import documentManager from '../utils/documentManager.js';

dotenv.config();

class ProjectAnalysisAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
    });
  }

  async analyzeProject() {
    try {
      // 1. Get project structure
      const structure = await this.mapProjectStructure('./src');
      
      // 2. Get codebase context
      const codeContext = await documentManager.getContextForQuery(
        "Project architecture and patterns"
      );

      // 3. Create analysis prompt
      const analysisPrompt = `
        Analyze this project's architecture and patterns.
        Provide a detailed analysis including architecture patterns, components, and suggested improvements.

        Project Structure:
        ${JSON.stringify(structure, null, 2)}

        Codebase Context:
        ${codeContext}

        Respond with a properly formatted JSON object exactly like this:
        {
          "architecture": {
            "patterns": ["pattern1", "pattern2"],
            "components": ["component1", "component2"],
            "dependencies": ["dependency1", "dependency2"]
          },
          "features": [
            {
              "name": "string",
              "purpose": "string",
              "implementation": "string",
              "dependencies": ["string"]
            }
          ],
          "improvements": [
            {
              "type": "enhancement|refactor|optimization",
              "description": "string",
              "priority": "high|medium|low"
            }
          ]
        }
      `;

      // 4. Get analysis from model
      const response = await this.model.invoke(analysisPrompt);
      
      try {
        // Extract JSON from the response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('Project Analysis Complete:', analysis);

        // 5. Store analysis
        await this.storeAnalysis(analysis);

        return analysis;
      } catch (parseError) {
        console.error('Error parsing analysis response:', parseError);
        // Return a default structure if parsing fails
        return {
          architecture: {
            patterns: [],
            components: structure.components || [],
            dependencies: []
          },
          features: [],
          improvements: []
        };
      }
    } catch (error) {
      console.error('Error analyzing project:', error);
      // Return empty analysis rather than throwing
      return {
        architecture: { patterns: [], components: [], dependencies: [] },
        features: [],
        improvements: []
      };
    }
  }

  async mapProjectStructure(startPath) {
    const structure = {
      components: [],
      files: []
    };

    try {
      const items = await fs.readdir(startPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(startPath, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.')) {
          structure.components.push(item.name);
          const subStructure = await this.mapProjectStructure(fullPath);
          structure.components.push(...subStructure.components);
          structure.files.push(...subStructure.files);
        } else if (item.isFile()) {
          structure.files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error mapping structure for ${startPath}:`, error);
    }

    return structure;
  }

  async storeAnalysis(analysis) {
    try {
      const analysisPath = path.join('src', 'analysis');
      await fs.mkdir(analysisPath, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(analysisPath, `analysis-${timestamp}.json`);

      await documentManager.updateFile(
        filePath,
        JSON.stringify(analysis, null, 2)
      );

      return filePath;
    } catch (error) {
      console.error('Error storing analysis:', error);
      // Continue without throwing
    }
  }

  async getStoredAnalyses() {
    try {
      const analysisPath = path.join('src', 'analysis');
      const files = await fs.readdir(analysisPath);
      
      const analyses = [];
      for (const file of files) {
        try {
          const content = await fs.readFile(
            path.join(analysisPath, file),
            'utf-8'
          );
          analyses.push(JSON.parse(content));
        } catch (error) {
          console.error(`Error reading analysis file ${file}:`, error);
        }
      }

      return analyses;
    } catch (error) {
      console.error('Error reading analyses:', error);
      return [];
    }
  }

  async analyzeFeaturePatterns() {
    try {
      const analyses = await this.getStoredAnalyses();
      return this.extractPatterns(analyses);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      return {
        successPatterns: [],
        antiPatterns: [],
        recommendations: []
      };
    }
  }

  async extractPatterns(analyses) {
    const prompt = `
      Analyze these project analyses to identify patterns:
      ${JSON.stringify(analyses, null, 2)}

      Respond with a JSON object in this exact format:
      {
        "successPatterns": ["pattern1", "pattern2"],
        "antiPatterns": ["antiPattern1", "antiPattern2"],
        "recommendations": ["recommendation1", "recommendation2"]
      }
    `;

    try {
      const response = await this.model.invoke(prompt);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error extracting patterns:', error);
      return {
        successPatterns: [],
        antiPatterns: [],
        recommendations: []
      };
    }
  }
}

export default new ProjectAnalysisAgent();