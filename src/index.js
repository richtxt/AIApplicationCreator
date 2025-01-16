import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import orchestrator from './agents/orchestrator.js';
import previewServer from './utils/previewServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Initialize the system
await orchestrator.initialize();

// Start preview server
previewServer.start();

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

    const result = await orchestrator.processFeatureRequest(featureRequest);

    // Add preview URL if component was created
    try {
      if (result.implementations?.length > 0) {
        // Look for main component file
        const mainFile = result.implementations.find(impl => 
          impl.files?.some(file => file.endsWith('.js') || file.endsWith('.jsx'))
        );

        if (mainFile && mainFile.files?.length > 0) {
          const componentFile = mainFile.files.find(f => 
            f.endsWith('.js') || f.endsWith('.jsx')
          );
          if (componentFile) {
            const componentName = path.basename(componentFile, path.extname(componentFile));
            result.previewUrl = previewServer.getPreviewUrl(componentName);
          }
        }
      }
    } catch (previewError) {
      console.error('Error setting up preview:', previewError);
      // Continue without preview if there's an error
    }

    res.json({
      ...result,
      logs: global.processLogs || []
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      logs: global.processLogs || []
    });
  }
});

// Get logs
app.get('/logs', (req, res) => {
  res.json({
    logs: global.processLogs || []
  });
});

// Get component preview
app.get('/preview/:component', (req, res) => {
  const componentName = req.params.component;
  const previewHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Preview: ${componentName}</title>
      <script src="https://unpkg.com/react@17/umd/react.development.js"></script>
      <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
      <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
      <link href="/components/${componentName}.css" rel="stylesheet">
    </head>
    <body>
      <div id="root"></div>
      <script type="text/babel" src="/components/${componentName}.js"></script>
    </body>
    </html>
  `;
  res.send(previewHtml);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});