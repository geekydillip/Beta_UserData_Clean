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
async function callOllama(prompt, model = 'gemma3:4b', maxRetries = 3) {
  const payload = { model, prompt, stream: false };
  const data = JSON.stringify(payload);
  const byteLen = Buffer.byteLength(data, 'utf8');

  const agent = new http.Agent({ keepAlive: false });
  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      'Content-Length': byteLen
    },
    agent,
    timeout: 120000 // 120 seconds
  };

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let responseData = '';
          res.setEncoding('utf8');

          res.on('data', (chunk) => { responseData += chunk; });

          res.on('end', () => {
            // if non-2xx, include status code in message
            if (res.statusCode >= 400) {
              return reject(new Error(`Ollama HTTP ${res.statusCode}: ${responseData}`));
            }
            try {
              const json = JSON.parse(responseData);
              if (json && json.error) return reject(new Error(`Ollama error: ${json.error}`));
              const reply = json.response ?? json.output ?? json.result ?? responseData;
              if (!reply || (typeof reply === 'string' && reply.trim().length === 0)) {
                return reject(new Error('AI model returned empty response'));
              }
              resolve(reply);
            } catch (e) {
              // If parse fails, still return raw response for debugging
              return reject(new Error('Failed to parse Ollama response: ' + responseData));
            }
          });
        });

        req.on('timeout', () => {
          req.destroy(new Error('Request to Ollama timed out'));
        });

        req.on('error', (err) => {
          reject(new Error('Failed to connect to Ollama: ' + err.message));
        });

        req.write(data, 'utf8');
        req.end();
      });

      return result; // success

    } catch (err) {
      // If last attempt, rethrow; else wait and retry
      console.error(`callOllama attempt ${attempt} failed: ${err.message}`);
      if (attempt >= maxRetries) throw err;
      // Exponential backoff
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 20000);
      await new Promise(r => setTimeout(r, delay));
      // On next retry, continue loop
    }
  }
}

// Route: Process text (JSON requests)
app.post('/api/process/text', async (req, res) => {
  try {
    const processingType = req.body.processingType || 'custom';
    const customPrompt = req.body.customPrompt || '';
    const inputText = req.body.text;

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

    const result = await callOllama(fullPrompt);
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

        const result = await callOllama(fullPrompt);
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

    let modelPrompt = '';
    if (processingType === 'voc') {
      modelPrompt = `You are a data-cleaning assistant for Voice of Problem analysis reported by Customer.
Your goal is to process each row of customer feedback data and produce a cleaned, summarized problem statement for product analysis.

Task
For each row in the input data:
Combine and clean the Title and Problem fields to create one clear, concise English sentence that describes the actual user issue.
Identify the product module or area the issue belongs to (e.g., “Lock Screen”, “Camera”, “Battery”, “Network”, “Settings”).
Determine the severity of the issue based on user impact. Calculate the severity by analyzing the Context of the problem.

Rules
Ignore any IDs, usernames, timestamps, or tags enclosed in square brackets [ ... ] (e.g., [Samsung Members][AppName: Samsung Members]).
Merge logically — don’t repeat words or phrases unnecessarily.
Use one complete sentence in the “Summarized Problem” field.
Avoid internal notes or diagnostic language (e.g., “log 부족” or “H/W check required”).
Always output valid, strict JSON that can be parsed directly.

Severity Guidelines
Choose the severity level that best reflects the user impact:
Critical → Device unusable, data loss, or crash.
High → Major feature not working as expected.
Medium → Partial malfunction or intermittent issue.
Low → Minor, cosmetic, or suggestion-level issue.

Expected Output Format
Return only a single JSON array where each object includes exactly these keys:

[
  {
    "Module": "Lock Screen",
    "Summarized Problem": "The Sports option from Google is unavailable on the Lock Screen of the Galaxy S24 Ultra.",
    "Severity": "Medium"
  }
]

Example Input
[
  {
    "Title": "[Samsung Members][64338785][AppName: Samsung Members][Lock Screen] Sports from Google option is not available in S24 ultra",
    "Problem": "Sports from Google option is not available in S24 ultra: [Samsung Members Notice] Log가 부족하거나 H/W 점검이 필요하다고 판단된 경우 분석 결과와 함께 필요한 정보를 기재하여 Resolve 바랍니다."
  }
]

Output Requirements

Output only the JSON array (no explanations, commentary, or extra text).
The JSON must be valid and properly structured.
Srtictly follow this output JSON format after merged into Excel, the resulting file must contain the following columns in this exact sequence:
Case Code, Model No., Title, Problem, Module, Summarized Problem, Severity
Each object should correspond to one input row, preserving the order.
Final Output Columns


Input:
${JSON.stringify(rows, null, 2)}

Return only the JSON array.`;
    } else {
      modelPrompt = `${customPrompt}\n\n${JSON.stringify(rows, null, 2)}`;
    }

    // Send to AI model
    const modelResult = await callOllama(modelPrompt);

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

    // Merge original data with AI results
    const merged = rows.map((r, i) => {
      const ai = parsed[i] || {};
      return {
        ...r,
        Module: ai.Module || '',
        'Summarized Problem': ai['Summarized Problem'] || ai.SummarizedProblem || '',
        Severity: ai.Severity || ''
      };
    });

    // Convert merged JSON back to Excel
    const newWb = xlsx.utils.book_new();
    const newSheet = xlsx.utils.json_to_sheet(merged);
    xlsx.utils.book_append_sheet(newWb, newSheet, 'Data');
    const buf = xlsx.write(newWb, { bookType: 'xlsx', type: 'buffer' });

    // Save to file
    const processedFilename = `processed-${Date.now()}-${originalName}`;
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
