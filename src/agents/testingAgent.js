import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';

class TestingAgent {
  constructor() {
    this.browser = null;
  }

  async testFeature(implementation, testCriteria) {
    try {
      // Start browser if not running
      if (!this.browser) {
        this.browser = await puppeteer.launch();
      }

      const page = await this.browser.newPage();
      
      // Start test server and load page
      const testResults = [];
      const failures = [];

      // Test visual presence
      if (testCriteria.visual) {
        const visualTests = await this.runVisualTests(page, testCriteria.visual);
        testResults.push(...visualTests.results);
        if (visualTests.failures.length > 0) {
          failures.push(...visualTests.failures);
        }
      }

      // Test functionality
      if (testCriteria.functional) {
        const functionalTests = await this.runFunctionalTests(page, testCriteria.functional);
        testResults.push(...functionalTests.results);
        if (functionalTests.failures.length > 0) {
          failures.push(...functionalTests.failures);
        }
      }

      await page.close();

      return {
        success: failures.length === 0,
        results: testResults,
        failures
      };

    } catch (error) {
      console.error('Error in testing:', error);
      return {
        success: false,
        error: error.message,
        failures: [{
          type: 'error',
          message: error.message
        }]
      };
    }
  }

  async runVisualTests(page, criteria) {
    const results = [];
    const failures = [];

    for (const test of criteria) {
      try {
        const element = await page.$(test.selector);
        if (!element) {
          failures.push({
            type: 'visual',
            message: `Element not found: ${test.selector}`,
            requirement: test.requirement
          });
          continue;
        }

        const isVisible = await element.isIntersectingViewport();
        if (!isVisible) {
          failures.push({
            type: 'visual',
            message: `Element not visible: ${test.selector}`,
            requirement: test.requirement
          });
          continue;
        }

        results.push({
          type: 'visual',
          requirement: test.requirement,
          success: true
        });

      } catch (error) {
        failures.push({
          type: 'visual',
          message: error.message,
          requirement: test.requirement
        });
      }
    }

    return { results, failures };
  }

  async runFunctionalTests(page, criteria) {
    const results = [];
    const failures = [];

    for (const test of criteria) {
      try {
        // Execute test steps
        for (const step of test.steps) {
          switch (step.action) {
            case 'click':
              await page.click(step.selector);
              break;
            case 'type':
              await page.type(step.selector, step.value);
              break;
            case 'check':
              const element = await page.$(step.selector);
              const value = await element.evaluate(el => el.textContent);
              if (value !== step.expectedValue) {
                throw new Error(`Expected ${step.expectedValue}, got ${value}`);
              }
              break;
          }
        }

        results.push({
          type: 'functional',
          requirement: test.requirement,
          success: true
        });

      } catch (error) {
        failures.push({
          type: 'functional',
          message: error.message,
          requirement: test.requirement
        });
      }
    }

    return { results, failures };
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default new TestingAgent();