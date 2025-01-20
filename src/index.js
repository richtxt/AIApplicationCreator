import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createServer } from 'http';
import orchestrator from './agents/orchestrator.js';
import documentManager from './utils/documentManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express setup
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static('public'));
app.use('/components', express.static('src/components'));

// Initialize the system
await orchestrator.initialize();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Create a global event emitter for the orchestrator
global.eventEmitter = {
  emit: (event, data) => {
    io.emit(event, data);
  }
};

// Serve main HTML interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle feature generation requests
app.post('/generate', async (req, res) => {
  try {
    const { featureRequest } = req.body;
    
    if (!featureRequest) {
      return res.status(400).json({ error: 'Feature request is required' });
    }

    // Start processing
    io.emit('phase', { phase: 'Starting', message: 'Processing feature request' });

    // Process the feature request
    const result = await orchestrator.processFeatureRequest(featureRequest);

    res.json({
      ...result,
      logs: global.processLogs || []
    });
  } catch (error) {
    console.error('Error processing request:', error);
    io.emit('error', { message: error.message });
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      logs: global.processLogs || []
    });
  }
});


// Get our chromaDB files
app.get('/files', async (req, res) => {
  try {
      // Get files from ChromaDB through DocumentManager
      const documents = await documentManager.getAllFiles();
      
      // Send the files data
      res.json({
          success: true,
          files: documents.map(doc => ({
              path: doc.metadata.path,
              timestamp: doc.metadata.timestamp
          }))
      });
  } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({
          success: false,
          error: 'Failed to fetch files'
      });
  }
});

// Get logs
app.get('/logs', (req, res) => {
  res.json({
    logs: global.processLogs || []
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  io.emit('error', { message: 'Unhandled Rejection: ' + reason });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  io.emit('error', { message: 'Uncaught Exception: ' + error.message });
});