import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';
import documentManager from '../utils/documentManager.js';

dotenv.config();

class FileAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
    });
  }

  async implementChanges(implementations, request, plan) {
    try {
      console.log("File Agent: Implementing changes...");
      
      if (!Array.isArray(implementations)) {
        console.error("Expected array of implementations");
        return {
          success: false,
          error: "Invalid implementation format",
          updates: []
        };
      }

      // Array to track all updates
      const updates = [];

      // Handle each implementation
      for (const impl of implementations) {
        // Ensure we have the minimum required properties
        if (!impl.code || !impl.type) {
          console.warn("Skipping invalid implementation:", impl);
          continue;
        }

        // Generate filename if none provided
        const filename = impl.files?.[0] || this.generateFilename(impl.type, request);
        const filePath = this.determineFilePath(filename, impl.type);
        
        try {
          // Ensure proper directory exists
          await this.ensureDirectoryExists(path.dirname(filePath));
          
          // Process the code based on file type
          const processedCode = this.processCodeForFileType(
            impl.code,
            impl.type,
            path.basename(filePath)
          );

          // Update the file
          await documentManager.updateFile(filePath, processedCode);
          
          updates.push({
            path: filePath,
            content: processedCode,
            type: impl.type,
            success: true
          });
        } catch (error) {
          console.error(`Error updating file ${filePath}:`, error);
          updates.push({
            path: filePath,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: updates.some(u => u.success),
        updates
      };
    } catch (error) {
      console.error("Error in File Agent:", error);
      return {
        success: false,
        error: error.message,
        updates: []
      };
    }
  }

  generateFilename(type, request) {
    // Extract a component name from the request or use a default
    const words = request.split(/\s+/);
    const componentName = words.find(w => w.toLowerCase().includes('calculator')) || 'Component';
    
    switch (type) {
      case 'component':
        return `${componentName}.js`;
      case 'style':
        return `${componentName}.css`;
      case 'test':
        return `${componentName}.test.js`;
      default:
        return `${componentName}.js`;
    }
  }

  determineFilePath(filename, type) {
    // Remove any existing path information
    filename = path.basename(filename);

    // Determine the appropriate directory based on file type
    switch (type) {
      case 'component':
        return path.join('src', 'components', filename);
      
      case 'test':
        return path.join('src', 'components', '__tests__', filename);
      
      case 'style':
        return path.join('src', 'components', filename.replace(/\.js$/, '.css'));
      
      case 'util':
        return path.join('src', 'utils', filename);
      
      default:
        // Check file extension for additional routing
        if (filename.endsWith('.css')) {
          return path.join('src', 'components', filename);
        }
        if (filename.endsWith('.test.js')) {
          return path.join('src', 'components', '__tests__', filename);
        }
        if (filename.endsWith('.js')) {
          return path.join('src', 'components', filename);
        }
        
        // Default to components directory
        return path.join('src', 'components', filename);
    }
  }

  processCodeForFileType(code, type, filename) {
    switch (type) {
      case 'component':
        return this.processComponentCode(code, filename);
      
      case 'style':
        return this.processStyleCode(code);
      
      case 'test':
        return this.processTestCode(code);
      
      default:
        return code;
    }
  }

  processComponentCode(code, filename) {
    // Ensure React imports
    if (!code.includes('import React')) {
      code = `import React, { useState } from 'react';\n${code}`;
    }

    // Ensure proper component name
    const componentName = path.basename(filename, '.js');
    if (!code.includes(`export default ${componentName}`)) {
      code = `${code}\n\nexport default ${componentName};`;
    }

    return code;
  }

  processStyleCode(code) {
    // Remove any potential script tags or comments
    return code.replace(/<script>|<\/script>/g, '')
              .replace(/\/\* *js.*?\*\//g, '');
  }

  processTestCode(code) {
    // Ensure test boilerplate
    if (!code.includes('describe(')) {
      code = `
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

${code}
      `.trim();
    }
    return code;
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

export default new FileAgent();