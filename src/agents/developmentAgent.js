import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import * as path from 'path';
import documentManager from '../utils/documentManager.js';

class DevelopmentAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 2000,
    });
  }

  async generateCode({ request, context }) {
    try {
      console.log("\nGenerating code for request:", request);
      
      // Get relevant context from ChromaDB
      const projectContext = await documentManager.getContextForQuery(request);

      const prompt = `
You are an expert React developer. Create a component based on these requirements:

Feature Request: ${request}

Project Context:
${projectContext}

Requirements:
- Use React functional components with hooks
- Use Tailwind CSS for styling
- Include error handling
- Write clean, production-ready code
- Export the component as default
- Include JSDoc comments

Your response must be in this exact format:

[CODE_START]
// Your complete React component code here
[CODE_END]

[EXPLANATION_START]
// Your explanation of the implementation here
[EXPLANATION_END]
`;

      console.log("\nSending request to OpenAI...");
      const response = await this.model.invoke(prompt);
      console.log("\nReceived response");

      const result = this.parseResponse(response.content);
      
      // Transform the code into proper file content
      const componentName = this.extractComponentName(result.code);
      const fileName = `${componentName}.jsx`;
      const filePath = path.join('src', 'components', fileName);
      
      const fileContents = this.prepareFileContents(result.code);

      return {
        success: true,
        code: fileContents,
        explanation: result.explanation,
        files: [{
          path: filePath,
          content: fileContents
        }]
      };
    } catch (error) {
      console.error('\nError in generateCode:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractComponentName(code) {
    const match = code.match(/function\s+(\w+)|const\s+(\w+)\s*=/);
    return match ? (match[1] || match[2]) : 'GeneratedComponent';
  }

  prepareFileContents(code) {
    return `import React, { useState } from 'react';\n\n${code}`;
  }

  parseResponse(response) {
    try {
      const codeMatch = response.match(/\[CODE_START\]([\s\S]*?)\[CODE_END\]/);
      const explanationMatch = response.match(/\[EXPLANATION_START\]([\s\S]*?)\[EXPLANATION_END\]/);

      const code = codeMatch ? codeMatch[1].trim() : '';
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';

      if (!code) {
        throw new Error('No code generated');
      }

      return {
        code,
        explanation: explanation || "No explanation provided"
      };
    } catch (error) {
      console.error('\nError parsing response:', error);
      throw new Error('Failed to parse the generated response');
    }
  }
}

export default new DevelopmentAgent();