const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to call Ollama API
async function callOllama(prompt, model = 'qwen2.5:3b') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse.response);
        } catch (error) {
          reject(new Error('Failed to parse Ollama response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error('Failed to connect to Ollama: ' + error.message));
    });

    req.write(data);
    req.end();
  });
}

// Route: Upload and process file
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    let inputText = '';
    
    // Get input text from file or direct text input
    if (req.file) {
      inputText = fs.readFileSync(req.file.path, 'utf-8');
      // Clean up uploaded file after reading
      fs.unlinkSync(req.file.path);
    } else if (req.body.text) {
      inputText = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const processingType = req.body.processingType || 'custom';
    const customPrompt = req.body.customPrompt || '';

    // Build the prompt based on processing type
    let fullPrompt = '';
    
    switch (processingType) {
      case 'summarize':
        fullPrompt = `Please provide a concise summary of the following text:\n\n${inputText}`;
        break;
      case 'analyze':
        fullPrompt = `Please analyze the following text and provide key insights:\n\n${inputText}`;
        break;
      case 'extract':
        fullPrompt = `Please extract the key points and important information from the following text:\n\n${inputText}`;
        break;
      case 'translate':
        fullPrompt = `Please translate the following text to English (if it's not already in English, otherwise keep it as is):\n\n${inputText}`;
        break;
      case 'questions':
        fullPrompt = `Based on the following text, generate 5 important questions and provide answers:\n\n${inputText}`;
        break;
      case 'custom':
        fullPrompt = `${customPrompt}\n\n${inputText}`;
        break;
      default:
        fullPrompt = inputText;
    }

    // Call Ollama API
    const result = await callOllama(fullPrompt);

    res.json({ 
      success: true, 
      result: result,
      inputLength: inputText.length
    });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process data'
    });
  }
});

// Route: Process text directly (without file upload)
app.post('/api/process-text', async (req, res) => {
  try {
    const { text, processingType, customPrompt } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    let fullPrompt = '';
    
    switch (processingType) {
      case 'summarize':
        fullPrompt = `Please provide a concise summary of the following text:\n\n${text}`;
        break;
      case 'analyze':
        fullPrompt = `Please analyze the following text and provide key insights:\n\n${text}`;
        break;
      case 'extract':
        fullPrompt = `Please extract the key points and important information from the following text:\n\n${text}`;
        break;
      case 'translate':
        fullPrompt = `Please translate the following text to English (if it's not already in English, otherwise keep it as is):\n\n${text}`;
        break;
      case 'questions':
        fullPrompt = `Based on the following text, generate 5 important questions and provide answers:\n\n${text}`;
        break;
      case 'custom':
        fullPrompt = `${customPrompt}\n\n${text}`;
        break;
      default:
        fullPrompt = text;
    }

    const result = await callOllama(fullPrompt);

    res.json({ 
      success: true, 
      result: result,
      inputLength: text.length
    });

  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process text'
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test Ollama connection
    await callOllama('Hello', 'qwen2.5:3b');
    res.json({ status: 'ok', ollama: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', ollama: 'disconnected', message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Ollama Web Processor is running!`);
  console.log(`📍 Open your browser and go to: http://localhost:${PORT}`);
  console.log(`🤖 Make sure Ollama is running with Qwen 3:8b model\n`);
});
