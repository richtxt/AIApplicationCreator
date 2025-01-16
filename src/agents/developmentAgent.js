import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import * as path from 'path';
import config from '../config/config.js';

class DevelopmentAgent {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 2000,
    });
  }

  async generateCode(request, step) {
    try {
      console.log("\nGenerating code for step:", step);
      
      const prompt = `
You are an expert React developer. Create a component based on these requirements:

Feature Request: ${request}

Current Step: ${JSON.stringify(step, null, 2)}

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
      console.log("\nReceived response:", response.content);

      const result = this.parseResponse(response.content);
      
      // Transform the code into proper file content
      const fileContents = this.prepareFileContents(result.code, step.files[0]);

      return {
        code: fileContents,
        explanation: result.explanation,
        files: step.files.map(file => path.join('src', 'components', file))
      };
    } catch (error) {
      console.error('\nError in generateCode:', error);
      return {
        code: "// Error generating code\n// " + error.message,
        explanation: "An error occurred: " + error.message
      };
    }
  }

  prepareFileContents(code, filename) {
    if (filename.endsWith('.css')) {
      return code.replace(/\/\/ /g, '');
    }

    // For JavaScript/React files
    return `import React, { useState } from 'react';

${code}`;
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
      return {
        code: "// Error parsing response",
        explanation: "Failed to parse the generated response"
      };
    }
  }
}

export default new DevelopmentAgent();