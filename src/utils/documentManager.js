import { ChromaClient } from 'chromadb';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { OpenAI } from '@langchain/openai';

dotenv.config();

class DocumentManager {
  constructor() {
    this.client = new ChromaClient();
    this.collection = null;
    this.COLLECTION_NAME = "codebase-context";
    this.documents = new Map(); // In-memory cache
  }

  async initialize() {
    try {
      // Initialize ChromaDB collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.COLLECTION_NAME,
      });

      // Load files into memory and ChromaDB
      await this.syncCodebase();
      console.log("Document manager initialized successfully");
    } catch (error) {
      console.error('Error initializing document manager:', error);
      console.log('Continuing without document context...');
    }
  }

  async syncCodebase() {
    try {
      const codeFiles = await this.scanDirectory('./src');
      console.log(`Found ${codeFiles.length} files to sync`);

      if (codeFiles.length === 0) return;

      const documents = [];
      const metadatas = [];
      const ids = [];

      for (const file of codeFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const id = Buffer.from(file).toString('base64');
          
          documents.push(content);
          metadatas.push({ path: file });
          ids.push(id);

          this.documents.set(file, {
            content,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }

      // Add documents to ChromaDB
      await this.collection.add({
        ids,
        documents,
        metadatas
      });

      console.log('Codebase sync complete');
    } catch (error) {
      console.error('Error syncing codebase:', error);
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
      
      // Update ChromaDB
      const id = Buffer.from(filePath).toString('base64');
      await this.collection.upsert({
        ids: [id],
        documents: [content],
        metadatas: [{ path: filePath }]
      });

      // Update in-memory cache
      this.documents.set(filePath, {
        content,
        timestamp: Date.now()
      });

      console.log(`Updated file: ${filePath}`);
    } catch (error) {
      console.error(`Error updating file ${filePath}:`, error);
    }
  }

  async getAllFiles() {
    try {
        const response = await this.collection.get();
        return response.metadatas.map((metadata, index) => ({
            metadata: {
                path: metadata.path,
                timestamp: this.documents.get(metadata.path)?.timestamp || Date.now()
            },
            id: response.ids[index]
        }));
    } catch (error) {
        console.error('Error getting all files:', error);
        return [];
    }
}

  async getContextForQuery(query) {
    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: 5
      });

      if (results.documents[0].length === 0) {
        return "No relevant context found";
      }

      return results.documents[0]
        .map((content, i) => `File: ${results.metadatas[0][i].path}\n${content}`)
        .join('\n\n');
    } catch (error) {
      console.error('Error getting context:', error);
      return "Error retrieving context";
    }
  }
}

export default new DocumentManager();