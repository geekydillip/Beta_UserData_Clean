const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const xlsx = require('xlsx');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

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
async function callOllama(prompt, model = 'gemma3:4b', targetPort = 11434) {
  return new Promise((resolve, reject) => {
    const payload = { model: model, prompt: prompt, stream: false };
    const data = JSON.stringify(payload);
    const dataLength = Buffer.byteLength(data);

    const options = {
      hostname: '127.0.0.1',
      port: targetPort,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': dataLength
      },
      // no default timeout here; we'll set it on the request socket
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          // Ollama sometimes nests response; adjust if needed
          resolve(jsonResponse.response ?? jsonResponse);
        } catch (err) {
          return reject(new Error('Failed to parse Ollama response: ' + err.message));
        }
      });
    });

    // Set socket timeout (e.g., 5 minutes)
    req.setTimeout(5 * 60 * 1000, () => {
      req.abort();
    });

    req.on('error', (error) => {
      reject(new Error('Failed to connect to Ollama: ' + error.message));
    });

    req.write(data);
    req.end();
  });
}

// Route: Process text (JSON requests)
app.post('/api/process/text', async (req, res) => {
  try {
    const processingType = req.body.processingType || 'custom';
    const customPrompt = req.body.customPrompt || '';
    const inputText = req.body.text;
    const model = req.body.model || 'gemma3:4b';

    if (!inputText) {
      return res.status(400).json({ error: 'No text provided' });
    }

    let fullPrompt = '';
    switch (processingType) {
      case 'custom':
        fullPrompt = `${customPrompt}\n\n${inputText}`;
        break;
      default:
        fullPrompt = inputText;
    }

    const result = await callOllama(fullPrompt, model);
    res.json({
      success: true,
      result: result,
      inputLength: inputText.length
    });

  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({
      error: error.message || 'Failed to process text'
    });
  }
});

// Route: Upload and process file (multipart/form-data)
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    const processingType = req.body.processingType || 'custom';
    const customPrompt = req.body.customPrompt || '';
    const model = req.body.model || 'gemma3:4b';

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.xlsx' || ext === '.xls') {
        // For Excel, process normally
        return processExcel(req, res);
      } else {
        // For other files, process normally
        const inputText = fs.readFileSync(req.file.path, 'utf-8');
        fs.unlinkSync(req.file.path);

        let fullPrompt = '';
        switch (processingType) {
          case 'custom':
            fullPrompt = `${customPrompt}\n\n${inputText}`;
            break;
          default:
            fullPrompt = inputText;
        }

        const result = await callOllama(fullPrompt, model);
        res.json({
          success: true,
          result: result,
          inputLength: inputText.length
        });
      }
    } else {
      return res.status(400).json({ error: 'No file provided' });
    }

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({
      error: error.message || 'Failed to process file'
    });
  }
});

// Excel processing
async function processExcel(req, res) {
  try {
    const uploadedPath = req.file.path;
    const originalName = req.file.originalname;

    // Read Excel file and convert to JSON
    const workbook = xlsx.readFile(uploadedPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    const processingType = req.body.processingType || 'custom';
    const customPrompt = req.body.customPrompt || '';
    const model = req.body.model || 'gemma3:4b';

    let modelPrompt = '';
    if (processingType === 'voc') {
      modelPrompt = `You are a data-cleaning assistant for Voice of Problem analysis reported by customers.
Your goal is to process each row of customer feedback data, extract meaningful insights, and generate structured outputs for Excel.


For each row in the input data:

Merge & Clean
Combine and clean the Title and Problem fields into one single clear English sentence that accurately describes the real user issue.

Module Identification
Identify the correct product module or functional area the issue belongs to
(e.g., Lock Screen, Camera, Battery, Network, Settings, Display, App Permissions, etc.).

Severity Classification
Determine severity based on user impact, using the rules below.

Severity Reason
Provide 1 concise sentence explaining why the chosen severity applies
(e.g., “Major feature not working”, “Cosmetic issue only”, “Device freeze causing usability problems”, etc.).

Output JSON Object
For each row, produce one JSON object containing EXACTLY these keys in this order:

Case Code,
Model No.,
Title,
Problem,
Module,
Summarized Problem,
Severity,
Severity Reason

📌 Rules
Text Cleaning Rules

Remove IDs, usernames, timestamps, tags or anything inside [ ... ].
Example: [Samsung Members][AppName: Samsung Members] → ignored

Translate non-English text to English.
Avoid duplication when merging Title + Problem.
Avoid internal diagnostic notes (e.g., “log 부족”, “H/W check needed”).
Output one complete sentence for Summarized Problem.

📌 Severity Guidelines

Choose the severity that best reflects real customer impact:

Severity	When to Use
Critical	Device unusable, boot failure, data loss, crashes, freezing.
High	Major feature not working (e.g., Camera fails, Wi-Fi not connecting).
Medium	Partial malfunction, occasional failure, degraded experience.
Low	Minor UI issue, cosmetic problem, suggestion or enhancement request.

📌 Output Format Requirements

Return a single JSON array.
No explanations outside the JSON.
The JSON must be valid and strictly parseable.
Each output object must preserve the input order.
Output must match this structural sequence:

Case Code,
Model No.,
Title,
Problem,
Module,
Summarized Problem,
Severity,
Severity Reason

📌 Example Input
[
  {
    "Case Code": "C-001",
    "Model No.": "Galaxy S24U",
    "Title": "[Samsung Members][64338785][AppName: Samsung Members][Lock Screen] Sports from Google option is not available in S24 ultra",
    "Problem": "Sports from Google option is not available in S24 ultra: [Samsung Members Notice] Log가 부족하거나 H/W 점검이 필요하다고 판단된 경우 분석 결과와 함께 필요한 정보를 기재하여 Resolve 바랍니다."
  }
]

📌 Example Output
[
  {
    "Case Code": "C-001",
    "Model No.": "Galaxy S24U",
    "Title": "Sports from Google option is not available in S24 ultra",
    "Problem": "Sports from Google option is not available in S24 ultra: Log가 부족하거나 H/W 점검이 필요하다고 판단된 경우 분석 결과와 함께 필요한 정보를 기재하여 Resolve 바랍니다.",
    "Module": "Lock Screen",
    "Summarized Problem": "The Google Sports option is missing from the Lock Screen on the Galaxy S24 Ultra.",
    "Severity": "Medium",
    "Severity Reason": "A Lock Screen feature is missing, causing partial functionality loss but not affecting core device operation."
  }
]


Input:
${JSON.stringify(rows, null, 2)}

Return only the JSON array.`;
    } else {
      modelPrompt = `${customPrompt}\n\n${JSON.stringify(rows, null, 2)}`;
    }

    // Send to AI model
    const modelResult = await callOllama(modelPrompt, model);

    // Parse AI response back to JSON
    let modelText = modelResult.trim();
    if (!modelText) {
      throw new Error('AI model returned empty response');
    }
    const firstBracket = modelText.indexOf('[');
    const lastBracket = modelText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      modelText = modelText.substring(firstBracket, lastBracket + 1);
    } else {
      throw new Error('AI response does not contain a valid JSON array');
    }

    let parsed;
    try {
      parsed = JSON.parse(modelText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', modelText);
      throw new Error('AI response is not valid JSON: ' + parseError.message);
    }

    // Use AI processed results directly (AI now returns complete rows)
    const merged = parsed;

    // Convert merged JSON back to Excel
    const newWb = xlsx.utils.book_new();
    const newSheet = xlsx.utils.json_to_sheet(merged);
    xlsx.utils.book_append_sheet(newWb, newSheet, 'Data');
    const buf = xlsx.write(newWb, { bookType: 'xlsx', type: 'buffer' });

    // Save to file
    const now = new Date();
    const datetime = now.getFullYear() +
                     ('0' + (now.getMonth() + 1)).slice(-2) +
                     ('0' + now.getDate()).slice(-2) + '-' +
                     ('0' + now.getHours()).slice(-2) +
                     ('0' + now.getMinutes()).slice(-2) +
                     ('0' + now.getSeconds()).slice(-2);
    const processedFilename = `${model.replace(/:/g, '')}-${datetime}-${originalName}`;
    const processedPath = path.join('downloads', processedFilename);
    fs.writeFileSync(processedPath, buf);

    fs.unlinkSync(uploadedPath);

    res.json({
      success: true,
      downloadUrl: `/downloads/${processedFilename}`,
      filename: processedFilename
    });
  } catch (error) {
    console.error('Excel processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Processing failed'
    });
  }
}



// Models endpoint
app.get('/api/models', async (req, res) => {
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:11434/api/tags', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              const models = json.models ? json.models.map(m => m.name) : [];
              resolve(models);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });

    res.json({ success: true, models: response });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check if Ollama is running
    const response = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:11434/', (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (response) {
      res.json({ status: 'ok', ollama: 'connected' });
    } else {
      res.json({ status: 'ok', ollama: 'disconnected' });
    }
  } catch (error) {
    res.json({ status: 'ok', ollama: 'disconnected' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Ollama Web Processor is running!`);
  console.log(`📍 Open your browser and go to: http://localhost:${PORT}`);
  console.log(`🤖 Make sure Ollama is running with gemma3:4b model\n`);
});
