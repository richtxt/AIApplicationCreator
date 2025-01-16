import { ChromaClient } from 'chromadb';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { OpenAI } from '@langchain/openai';

dotenv.config();

class DocumentManager {
  constructor() {
    this.collection = null;
    this.COLLECTION_NAME = "codebase-context";
    this.documents = new Map(); // In-memory cache
  }

  async initialize() {
    try {
      // Load files into memory
      await this.syncCodebase();
      console.log("Document manager initialized successfully");
    } catch (error) {
      console.error('Error initializing document manager:', error);
      // Continue without throwing
      console.log('Continuing without document context...');
    }
  }

  async syncCodebase() {
    try {
      const codeFiles = await this.scanDirectory('./src');
      console.log(`Found ${codeFiles.length} files to sync`);

      if (codeFiles.length === 0) return;

      for (const file of codeFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          this.documents.set(file, {
            content,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }

      console.log('Codebase sync complete');
    } catch (error) {
      console.error('Error syncing codebase:', error);
      // Continue without throwing
    }
  }

  async scanDirectory(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subDirFiles = await this.scanDirectory(fullPath);
          files.push(...subDirFiles);
        } else if (entry.isFile() && /\.(js|jsx|ts|tsx|html|css)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    }
    return files;
  }

  async updateFile(filePath, content) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write to filesystem
      await fs.writeFile(filePath, content);
      console.log(`Written file: ${filePath}`);

      // Update in-memory cache
      this.documents.set(filePath, {
        content,
        timestamp: Date.now()
      });

      console.log(`Updated file: ${filePath}`);
    } catch (error) {
      console.error(`Error updating file ${filePath}:`, error);
      // Continue without throwing
    }
  }

  async getContextForQuery(query) {
    try {
      // Simple context matching based on file content
      const relevantFiles = [];
      for (const [filePath, { content }] of this.documents.entries()) {
        if (content.toLowerCase().includes(query.toLowerCase())) {
          relevantFiles.push({
            path: filePath,
            content: content
          });
        }
      }

      return relevantFiles.length > 0 
        ? relevantFiles.map(f => `File: ${f.path}\n${f.content}`).join('\n\n')
        : "No relevant context found";
    } catch (error) {
      console.error('Error getting context:', error);
      return "Error retrieving context";
    }
  }
}

export default new DocumentManager();