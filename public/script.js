// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileContent = document.getElementById('fileContent');
const removeFile = document.getElementById('removeFile');
const processBtn = document.getElementById('processBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const customPrompt = document.getElementById('customPrompt');
const customPromptInput = document.getElementById('customPromptInput');
const statusElement = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const modelSelect = document.getElementById('modelSelect');

// State
let currentFile = null;
let currentResult = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadModels();
    checkOllamaConnection();
});

function setupEventListeners() {
    // Dropzone events
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);

    // File input
    fileInput.addEventListener('change', handleFileSelect);
    removeFile.addEventListener('click', clearFile);

    // Processing type change
    document.querySelectorAll('input[name="processingType"]').forEach(radio => {
        radio.addEventListener('change', handleProcessingTypeChange);
    });

    // Model change
    modelSelect.addEventListener('change', handleModelChange);

    // Process button
    processBtn.addEventListener('click', handleProcess);
}



function handleDragOver(e) {
    e.preventDefault();
    dropzone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    // Validate file type
    const validTypes = ['.txt', '.md', '.json', '.csv', '.log', '.xls', '.xlsx'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(fileExt)) {
        alert('Please upload a valid file type: .txt, .md, .json, .csv, .log, .xls, or .xlsx');
        return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }

    currentFile = file;
    
    // Display file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Read and display file content
    if (fileExt === '.xls' || fileExt === '.xlsx') {
        fileContent.textContent = 'Excel file - content will be extracted as CSV format for processing.';
        dropzone.style.display = 'none';
        filePreview.style.display = 'block';
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            fileContent.textContent = content.length > 500 ? content.substring(0, 500) + '...' : content;
            dropzone.style.display = 'none';
            filePreview.style.display = 'block';
        };
        reader.readAsText(file);
    }
}

function clearFile() {
    currentFile = null;
    fileInput.value = '';
    dropzone.style.display = 'block';
    filePreview.style.display = 'none';
    fileContent.textContent = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}



function handleProcessingTypeChange(e) {
    if (e.target.value === 'custom') {
        customPrompt.style.display = 'block';
    } else {
        customPrompt.style.display = 'none';
    }
}

async function handleModelChange(e) {
    const selectedModel = e.target.value;
    console.log('Model changed to:', selectedModel);

    // Check Ollama connection with the selected model
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.ollama === 'connected') {
            updateStatus('connected', `Ollama Connected - ${selectedModel} ready`);
        } else {
            updateStatus('error', `Ollama Disconnected - ${selectedModel} unavailable`);
        }
    } catch (error) {
        updateStatus('error', `Connection check failed - ${selectedModel}`);
    }
}

async function handleProcess() {
    if (!currentFile) {
        alert('Please upload a file first');
        return;
    }

    // Get processing type and model
    const processingType = document.querySelector('input[name="processingType"]:checked').value;
    const customPromptValue = customPromptInput.value;
    const selectedModel = modelSelect.value;

    // Validate custom prompt
    if (processingType === 'custom' && !customPromptValue.trim()) {
        alert('Please enter a custom prompt');
        return;
    }

    try {
        if (currentFile.name.endsWith('.xlsx') || currentFile.name.endsWith('.xls')) {
            // Handle Excel processing - show simple progress bar
            progressContainer.style.display = 'block';
            updateProgress(0, 'Initializing...');
            await processExcelFile(currentFile, processingType, customPromptValue, selectedModel);
        } else {
            // Process other files - show loading overlay
            showLoading(selectedModel);
            const formData = new FormData();
            formData.append('file', currentFile);
            formData.append('processingType', processingType);
            formData.append('customPrompt', customPromptValue);
            formData.append('model', selectedModel);

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to process file');
            }

            const result = await response.json();

            if (result.success) {
                // For non-Excel, download as text
                downloadText(result.result, `processed-${Date.now()}.txt`);
            } else {
                throw new Error(result.error || 'Processing failed');
            }
        }

    } catch (error) {
        console.error('Processing error:', error);
        alert('Error: ' + error.message + '\n\nMake sure Ollama is running with the selected model.');
    } finally {
        hideLoading();
        progressContainer.style.display = 'none';
    }
}

async function processExcelFile(file, processingType, customPrompt, model) {
    return new Promise(async (resolve, reject) => {
        try {
            // Show simple progress steps
            setTimeout(() => updateProgress(25, 'Processing file...'), 500);
            setTimeout(() => updateProgress(50, 'Calling AI model...'), 1500);
            setTimeout(() => updateProgress(75, 'Generating results...'), 3000);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('processingType', processingType);
            formData.append('customPrompt', customPrompt);
            formData.append('model', model);

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                reject(new Error('Processing failed'));
                return;
            }

            // Wait for response and handle download
            const result = await response.json();

            if (result.success && result.downloadUrl) {
                updateProgress(100, 'Processing complete');
                downloadFile(result.downloadUrl, result.filename || 'processed.xlsx');
            } else {
                reject(new Error(result.error || 'Processing failed'));
            }

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}



function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}



function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showLoading(model) {
    const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = `Processing with ${model}...`;
    loadingOverlay.style.display = 'flex';
    processBtn.disabled = true;
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
    processBtn.disabled = false;
}

async function checkOllamaConnection() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.ollama === 'connected') {
            updateStatus('connected', 'Ollama Connected');
        } else {
            updateStatus('error', 'Ollama Disconnected');
        }
    } catch (error) {
        updateStatus('error', 'Ollama Not Running');
    }

    // Check again every 30 seconds
    setTimeout(checkOllamaConnection, 30000);
}

function updateStatus(status, text) {
    statusElement.className = 'status ' + status;
    statusElement.querySelector('.status-text').textContent = text;
}

async function loadModels() {
    try {
        const response = await fetch('/api/models');
        const data = await response.json();

        if (data.success && data.models.length > 0) {
            modelSelect.innerHTML = '';
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });

            // Default to gemma3:4b if available, else first model
            const defaultModel = data.models.includes('gemma3:4b') ? 'gemma3:4b' : data.models[0];
            modelSelect.value = defaultModel;
        } else {
            // Fallback
            modelSelect.innerHTML = '<option value="gemma3:4b">gemma3:4b</option>';
        }
    } catch (error) {
        console.error('Error loading models:', error);
        // Fallback
        modelSelect.innerHTML = '<option value="gemma3:4b">gemma3:4b</option>';
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to process
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleProcess();
    }

    // Ctrl/Cmd + K to clear
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        clearFile();
    }
});
