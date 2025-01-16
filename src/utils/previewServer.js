import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PreviewServer {
  constructor() {
    this.app = express();
    this.port = 3001; // Different port from main server
  }

  async start() {
    // Ensure components directory exists
    const componentsDir = path.join('src', 'components');
    await fs.mkdir(componentsDir, { recursive: true });

    // Serve static files from src directory
    this.app.use('/components', express.static(componentsDir));
    
    // Serve preview HTML
    this.app.get('/preview/:component', async (req, res) => {
      try {
        const componentName = req.params.component;
        const componentPath = path.join(componentsDir, `${componentName}.js`);

        // Check if component exists
        try {
          await fs.access(componentPath);
        } catch (error) {
          return res.status(404).send(`Component ${componentName} not found`);
        }

        // Check for CSS file
        let hasCss = false;
        try {
          await fs.access(path.join(componentsDir, `${componentName}.css`));
          hasCss = true;
        } catch (error) {
          // CSS file is optional
        }

        const previewHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preview: ${componentName}</title>
            <script src="https://unpkg.com/react@17/umd/react.development.js"></script>
            <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
            <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
            <script src="https://cdn.tailwindcss.com"></script>
            ${hasCss ? `<link href="/components/${componentName}.css" rel="stylesheet">` : ''}
            <style>
              #root { padding: 20px; }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel" src="/components/${componentName}.js"></script>
          </body>
          </html>
        `;

        res.send(previewHtml);
      } catch (error) {
        console.error('Preview error:', error);
        res.status(500).send('Error generating preview');
      }
    });

    this.app.listen(this.port, () => {
      console.log(`Preview server running on port ${this.port}`);
    });
  }

  getPreviewUrl(componentName) {
    return `http://localhost:${this.port}/preview/${componentName}`;
  }
}

export default new PreviewServer();