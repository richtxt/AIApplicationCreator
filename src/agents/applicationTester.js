import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import documentManager from '../utils/documentManager.js';

const execAsync = promisify(exec);
dotenv.config();

class ApplicationTester {
  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
    });
  }

  async testFeature(featurePath, requirements) {
    try {
      console.log(`Testing feature at: ${featurePath}`);

      // 1. Generate tests based on requirements
      const tests = await this.generateTests(featurePath, requirements);
      
      // 2. Write test files
      await this.writeTests(featurePath, tests);

      // 3. Run tests and collect results
      const results = await this.runTests(featurePath);

      // 4. Analyze results and suggest fixes
      const analysis = await this.analyzeResults(results, requirements);

      // 5. Store test results for learning
      await this.storeTestResults(featurePath, results, analysis);

      return {
        success: results.passed,
        results: results,
        analysis: analysis,
        fixes: analysis.suggestedFixes
      };
    } catch (error) {
      console.error('Error testing feature:', error);
      throw error;
    }
  }

  async generateTests(featurePath, requirements) {
    try {
      // Get feature code
      const featureCode = await fs.readFile(featurePath, 'utf-8');

      const prompt = `
        Given this feature code and requirements, generate comprehensive tests.
        Include unit tests, integration tests, and edge cases.

        Feature Code:
        ${featureCode}

        Requirements:
        ${JSON.stringify(requirements, null, 2)}

        Generate tests in the following format:
        {
          "unitTests": [
            {
              "name": "test name",
              "code": "test code",
              "description": "what is being tested"
            }
          ],
          "integrationTests": [
            {
              "name": "test name",
              "code": "test code",
              "description": "what is being tested"
            }
          ],
          "edgeCaseTests": [
            {
              "name": "test name",
              "code": "test code",
              "description": "what edge case is being tested"
            }
          ]
        }
      `;

      const response = await this.model.invoke(prompt);
      return JSON.parse(response.content);
    } catch (error) {
      console.error('Error generating tests:', error);
      throw error;
    }
  }

  async writeTests(featurePath, tests) {
    const testDir = path.join(path.dirname(featurePath), '__tests__');
    await fs.mkdir(testDir, { recursive: true });

    const featureName = path.basename(featurePath, path.extname(featurePath));
    
    // Write unit tests
    const unitTestPath = path.join(testDir, `${featureName}.unit.test.js`);
    const unitTests = tests.unitTests.map(test => test.code).join('\n\n');
    await fs.writeFile(unitTestPath, unitTests);

    // Write integration tests
    const integrationTestPath = path.join(testDir, `${featureName}.integration.test.js`);
    const integrationTests = tests.integrationTests.map(test => test.code).join('\n\n');
    await fs.writeFile(integrationTestPath, integrationTests);

    // Write edge case tests
    const edgeTestPath = path.join(testDir, `${featureName}.edge.test.js`);
    const edgeTests = tests.edgeCaseTests.map(test => test.code).join('\n\n');
    await fs.writeFile(edgeTestPath, edgeTests);
  }

  async runTests(featurePath) {
    try {
      const testDir = path.join(path.dirname(featurePath), '__tests__');
      const { stdout, stderr } = await execAsync(`npx jest ${testDir}`);

      return this.parseTestResults(stdout, stderr);
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        details: error.stderr
      };
    }
  }

  async analyzeResults(results, requirements) {
    const prompt = `
      Analyze these test results against the requirements.
      
      Test Results:
      ${JSON.stringify(results, null, 2)}

      Requirements:
      ${JSON.stringify(requirements, null, 2)}

      Provide analysis in JSON format:
      {
        "meetingRequirements": boolean,
        "coverage": {
          "percentage": number,
          "missingCases": []
        },
        "issues": [
          {
            "type": "error|warning|suggestion",
            "description": "",
            "impact": "high|medium|low"
          }
        ],
        "suggestedFixes": [
          {
            "issue": "",
            "solution": "",
            "codeChanges": ""
          }
        ]
      }
    `;

    const response = await this.model.invoke(prompt);
    return JSON.parse(response.content);
  }

  async storeTestResults(featurePath, results, analysis) {
    const testResultsDir = path.join('src', 'test-results');
    await fs.mkdir(testResultsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = path.join(
      testResultsDir,
      `${path.basename(featurePath)}-${timestamp}.json`
    );

    const testData = {
      feature: featurePath,
      timestamp: new Date().toISOString(),
      results: results,
      analysis: analysis
    };

    await fs.writeFile(
      resultPath,
      JSON.stringify(testData, null, 2)
    );

    // Store in ChromaDB for learning
    await documentManager.updateFile(
      resultPath,
      JSON.stringify(testData, null, 2)
    );
  }

  parseTestResults(stdout, stderr) {
    // Parse Jest output into structured results
    const results = {
      passed: !stderr,
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };

    // Basic parsing - can be enhanced based on actual Jest output format
    const testLines = stdout.split('\n');
    for (const line of testLines) {
      if (line.includes('PASS')) {
        results.passed++;
      } else if (line.includes('FAIL')) {
        results.failed++;
      }
      // Add more parsing logic as needed
    }

    results.total = results.passed + results.failed;
    return results;
  }
}

export default new ApplicationTester();