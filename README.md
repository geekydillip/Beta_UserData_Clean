# Ollama Web Processor

A professional web interface for processing data locally with Ollama gemma3:4b model. Upload files or paste text to get AI-powered analysis, summaries, translations, and more - all processed locally on your machine.

## 🚀 Features

- **Professional UI**: Modern dark theme with responsive design
- **File Upload**: Drag-and-drop support for text files (.txt, .md, .json, .csv, .log) and Excel files (.xls, .xlsx)
- **Direct Text Input**: Paste text directly for processing
- **Multiple Processing Options**:
  - Summarize content
  - Analyze and extract insights
  - Extract key points
  - Translate to English
  - Generate Q&A pairs
  - Custom prompts
- **Results Management**: Copy to clipboard or download as text files
- **Real-time Status**: Connection monitoring for Ollama
- **Local Processing**: All data stays on your machine

## 📋 Prerequisites

- **Node.js** (v14 or higher) or **Python 3** (for automated setup)
- **Ollama** with gemma3:4b model installed
- **Web Browser** (Chrome, Firefox, Edge, etc.)

## 🛠️ Installation

1. **Clone or download this repository**
2. **Navigate to the project directory**
3. **Install dependencies**:
   ```bash
   npm install
   ```

## 🚀 Usage

### Option 1: Manual Setup (Node.js)

1. **Start Ollama** with gemma3:4b model:
   ```bash
   ollama run gemma3:4b
   ```

2. **Start the web application**:
   ```bash
   npm start
   ```

3. **Open your browser** and go to: `http://localhost:3001`

### Option 2: Automated Setup (Python)

1. **Run the Python script** (automatically handles Ollama and server startup):
   ```bash
   python run_server.py
   ```

2. **Open your browser** and go to: `http://localhost:3001`

### Processing Data

- Upload a file (text or Excel) using drag-and-drop
- Or paste text directly
- Select processing type
- Click "Process with AI"

## 📁 Project Structure

```
ollama-web-processor/
├── server.js              # Express backend server
├── server_Stable.js       # Stable version of the server
├── server.js.bak          # Backup of server.js
├── run_server.py         # Python script for automated setup
├── terminate_servers.py   # Python script to stop servers
├── package.json           # Node.js dependencies
├── README.md              # This file
├── public/                # Frontend files
│   ├── index.html         # Main HTML interface
│   ├── styles.css         # Modern CSS styling
│   └── script.js          # Frontend JavaScript logic
├── uploads/               # Temporary file storage
└── downloads/             # Processed file storage
```

## 🔧 Technical Details

- **Backend**: Node.js + Express server
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **File Handling**: Multer for secure uploads, xlsx library for Excel parsing
- **AI Integration**: Direct Ollama API calls (localhost:11434)
- **Security**: CORS enabled, file validation, size limits

## 🎯 Processing Options

### Summarize
Get concise summaries of your content.

### Analyze
Extract key insights and analysis from your data.

### Extract
Pull out important points and key information.

### Translate
Convert content to English (if not already in English).

### Q&A
Generate 5 important questions and provide answers based on your content.

### Custom
Enter your own custom prompt for flexible processing.

## 🔒 Privacy & Security

- **Local Processing**: All AI processing happens on your local machine
- **No Data Transmission**: Files and text never leave your computer
- **Temporary Storage**: Uploaded files are automatically cleaned up after processing
- **File Validation**: Strict file type and size restrictions

## 🐛 Troubleshooting

### "Failed to connect to Ollama"
- Ensure Ollama is running: `ollama serve`
- Verify Gemma model is installed: `ollama pull gemma3:4b`
- Check if Ollama is accessible on localhost:11434

### "File upload failed"
- Check file size (max 10MB)
- Verify file type (.txt, .md, .json, .csv, .log, .xls, .xlsx)
- Ensure proper permissions

### Server won't start
- Install dependencies: `npm install`
- Check Node.js version: `node --version`
- Verify port 3001 is available

## 📈 Recent Updates

- **v1.1.0** - Switched to Gemma 3:4B model for improved performance
- **Automation Scripts** - Added Python scripts for automated Ollama and server startup
- **Code Improvements** - Simplified Ollama API integration and enhanced file processing
- **UI Enhancements** - Updated Excel file processing display messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use and modify as needed.

## 🙏 Acknowledgments

- **Ollama** for providing local AI capabilities
- **Gemma** for the excellent language model
- **Express.js** for the robust backend framework

---

**Note**: This application requires Ollama to be running locally. Make sure to start Ollama before using the web interface.
