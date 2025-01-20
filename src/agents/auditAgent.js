import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';
import documentManager from '../utils/documentManager.js';

dotenv.config();

class AuditAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
    });
  }

  async auditImplementation(request, implementationResults) {
    try {
      console.log("\nAudit Agent: Starting implementation audit...");

      // 1. Check file structure
      const fileIssues = await this.checkFileStructure();
      
      // 2. Check component implementation
      const componentIssues = await this.checkComponents();
      
      // 3. Check for common issues
      const codeIssues = await this.analyzeCode();

      const issues = [...fileIssues, ...componentIssues, ...codeIssues];
      
      if (issues.length > 0) {
        console.log(`Found ${issues.length} issues to fix`);
        const fixes = await this.generateFixes(issues, request);
        return {
          success: false,
          issues,
          fixes,
          needsRegeneration: this.needsCompleteRegeneration(issues)
        };
      }

      return { success: true, issues: [] };
    } catch (error) {
      console.error('Error in audit:', error);
      return { success: false, error: error.message };
    }
  }

  async checkFileStructure() {
    const issues = [];
    const componentsDir = path.join('src', 'components');

    try {
      const files = await fs.readdir(componentsDir);
      
      // Check for misnamed files
      const jsFiles = files.filter(f => f.endsWith('.js'));
      for (const file of jsFiles) {
        if (file === 'script.js') {
          issues.push({
            type: 'file_structure',
            severity: 'high',
            description: 'Generic script.js file found instead of properly named component file',
            file: file
          });
        }
      }

      // Check for missing JSX files
      if (!files.some(f => f.endsWith('.jsx'))) {
        issues.push({
          type: 'file_structure',
          severity: 'high',
          description: 'No .jsx files found in components directory',
          fix: 'rename_to_jsx'
        });
      }
    } catch (error) {
      console.error('Error checking file structure:', error);
    }

    return issues;
  }

  async checkComponents() {
    const issues = [];
    const componentsDir = path.join('src', 'components');

    try {
      const files = await fs.readdir(componentsDir);
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          const content = await fs.readFile(path.join(componentsDir, file), 'utf-8');
          
          // Check for React imports
          if (!content.includes('import React')) {
            issues.push({
              type: 'component',
              severity: 'high',
              description: 'Missing React import',
              file: file
            });
          }

          // Check for default export
          if (!content.includes('export default')) {
            issues.push({
              type: 'component',
              severity: 'high',
              description: 'Missing default export',
              file: file
            });
          }

          // Check for empty component
          if (content.includes('// existing code')) {
            issues.push({
              type: 'component',
              severity: 'critical',
              description: 'Component contains placeholder code',
              file: file
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking components:', error);
    }

    return issues;
  }

  async analyzeCode() {
    const issues = [];
    const componentsDir = path.join('src', 'components');

    try {
      const files = await fs.readdir(componentsDir);
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          const content = await fs.readFile(path.join(componentsDir, file), 'utf-8');
          
          // Check for implementation completeness
          if (!content.includes('return') || !content.includes('JSX')) {
            issues.push({
              type: 'implementation',
              severity: 'critical',
              description: 'Component lacks proper implementation',
              file: file
            });
          }

          // Check for state management
          if (!content.includes('useState')) {
            issues.push({
              type: 'implementation',
              severity: 'high',
              description: 'Component lacks state management',
              file: file
            });
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing code:', error);
    }

    return issues;
  }

  async generateFixes(issues, originalRequest) {
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    
    if (criticalIssues.length > 0) {
      // For critical issues, suggest complete regeneration
      return {
        type: 'regenerate',
        description: 'Critical issues found - component needs complete regeneration',
        issues: criticalIssues
      };
    }

    // For non-critical issues, generate specific fixes
    const prompt = `
      Fix these issues in the implementation:
      ${JSON.stringify(issues, null, 2)}

      Original request: ${originalRequest}

      Provide fixes in this format:
      {
        "fixes": [
          {
            "type": "rename|modify|add",
            "file": "filename",
            "content": "complete fixed content",
            "description": "what was fixed"
          }
        ]
      }
    `;

    const response = await this.model.invoke(prompt);
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing fixes:', error);
      return { fixes: [] };
    }
  }

  needsCompleteRegeneration(issues) {
    return issues.some(i => i.severity === 'critical');
  }
}

export default new AuditAgent();