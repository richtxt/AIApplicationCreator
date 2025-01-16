import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import documentManager from '../utils/documentManager.js';

const execAsync = promisify(exec);
dotenv.config();

class ProjectGenerator {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
    });
  }

  async generateNewProject(specification) {
    try {
      console.log('Generating new project:', specification.name);

      // 1. Analyze current project for patterns
      const projectStructure = await this.analyzeCurrentProject();

      // 2. Generate project plan
      const plan = await this.generateProjectPlan(specification, projectStructure);

      // 3. Create project structure
      const projectPath = await this.createProjectStructure(plan);

      // 4. Set up development environment
      await this.setupDevelopmentEnvironment(projectPath, plan);

      // 5. Generate initial codebase
      await this.generateInitialCodebase(projectPath, plan);

      return {
        path: projectPath,
        plan: plan,
        structure: await this.mapProjectStructure(projectPath)
      };
    } catch (error) {
      console.error('Error generating project:', error);
      throw error;
    }
  }

  async analyzeCurrentProject() {
    // Get current project structure for learning
    const structure = await documentManager.getContextForQuery(
      "Project structure and patterns"
    );

    return structure;
  }

  async generateProjectPlan(specification, currentStructure) {
    const prompt = `
      Create a detailed project plan based on this specification and learned patterns.

      Specification:
      ${JSON.stringify(specification, null, 2)}

      Current Project Structure:
      ${JSON.stringify(currentStructure, null, 2)}

      Provide plan in JSON format:
      {
        "structure": {
          "directories": [],
          "files": []
        },
        "dependencies": [
          {
            "name": "",
            "version": "",
            "purpose": ""
          }
        ],
        "components": [
          {
            "name": "",
            "purpose": "",
            "implementation": ""
          }
        ],
        "configuration": {
          "environment": {},
          "scripts": {},
          "development": {}
        }
      }
    `;

    const response = await this.model.invoke(prompt);
    return JSON.parse(response.content);
  }

  async createProjectStructure(plan) {
    const projectPath = path.join(process.cwd(), plan.name);
    
    // Create base directory
    await fs.mkdir(projectPath, { recursive: true });

    // Create directory structure
    for (const dir of plan.structure.directories) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }

    return projectPath;
  }

  async setupDevelopmentEnvironment(projectPath, plan) {
    // Initialize git
    await execAsync('git init', { cwd: projectPath });

    // Create package.json
    const packageJson = {
      name: plan.name,
      version: '1.0.0',
      type: 'module',
      scripts: plan.configuration.scripts,
      dependencies: {},
      devDependencies: {}
    };

    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Install dependencies
    for (const dep of plan.dependencies) {
      await execAsync(
        `npm install ${dep.name}@${dep.version}`,
        { cwd: projectPath }
      );
    }

    // Create configuration files
    await this.generateConfigFiles(projectPath, plan);
  }

  async generateConfigFiles(projectPath, plan) {
    // Generate .env
    const envContent = Object.entries(plan.configuration.environment)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    await fs.writeFile(path.join(projectPath, '.env'), envContent);

    // Generate .gitignore
    await fs.writeFile(
      path.join(projectPath, '.gitignore'),
      'node_modules\n.env\n.DS_Store\n'
    );

    // Generate README.md
    const readmeContent = await this.generateReadme(plan);
    await fs.writeFile(
      path.join(projectPath, 'README.md'),
      readmeContent
    );
  }

  async generateInitialCodebase(projectPath, plan) {
    for (const component of plan.components) {
      const componentPath = path.join(projectPath, component.implementation.path);
      await fs.writeFile(componentPath, component.implementation.code);
    }
  }

  async generateReadme(plan) {
    const prompt = `
      Generate a README.md file for this project:
      ${JSON.stringify(plan, null, 2)}

      Include:
      1. Project description
      2. Setup instructions
      3. Usage examples
      4. Development guidelines
      5. Testing instructions
    `;

    const response = await this.model.invoke(prompt);
    return response.content;
  }

  async mapProjectStructure(projectPath) {
    const structure = {
      path: projectPath,
      type: 'directory',
      children: []
    };

    const items = await fs.readdir(projectPath);
    for (const item of items) {
      const itemPath = path.join(projectPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        structure.children.push(
          await this.mapProjectStructure(itemPath)
        );
      } else {
        structure.children.push({
          path: itemPath,
          type: 'file',
          size: stats.size
        });
      }
    }

    return structure;
  }
}

export default new ProjectGenerator();