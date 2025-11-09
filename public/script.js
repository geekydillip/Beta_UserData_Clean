// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileContent = document.getElementById('fileContent');
const removeFile = document.getElementById('removeFile');
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const processBtn = document.getElementById('processBtn');
const resultsSection = document.getElementById('resultsSection');
const resultContent = document.getElementById('resultContent');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const customPrompt = document.getElementById('customPrompt');
const customPromptInput = document.getElementById('customPromptInput');
const statusElement = document.getElementById('status');

// State
let currentFile = null;
let currentResult = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkOllamaConnection();
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Dropzone events
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);

    // File input
    fileInput.addEventListener('change', handleFileSelect);
    removeFile.addEventListener('click', clearFile);

    // Text input
    textInput.addEventListener('input', updateCharCount);

    // Processing type change
    document.querySelectorAll('input[name="processingType"]').forEach(radio => {
        radio.addEventListener('change', handleProcessingTypeChange);
    });

    // Process button
    processBtn.addEventListener('click', handleProcess);

    // Result actions
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadResult);
}

function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
    });

    // Clear previous data when switching tabs
    if (tab === 'upload') {
        textInput.value = '';
        updateCharCount();
    } else if (tab === 'paste') {
        clearFile();
    }
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
    const validTypes = ['.txt', '.md', '.json', '.csv', '.log'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(fileExt)) {
        alert('Please upload a valid file type: .txt, .md, .json, .csv, or .log');
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
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        fileContent.textContent = content.length > 500 ? content.substring(0, 500) + '...' : content;
        dropzone.style.display = 'none';
        filePreview.style.display = 'block';
    };
    reader.readAsText(file);
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

function updateCharCount() {
    charCount.textContent = textInput.value.length;
}

function handleProcessingTypeChange(e) {
    if (e.target.value === 'custom') {
        customPrompt.style.display = 'block';
    } else {
        customPrompt.style.display = 'none';
    }
}

async function handleProcess() {
    // Get active tab
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    
    // Get input data
    let inputData = null;
    let isFile = false;
    
    if (activeTab === 'upload') {
        if (!currentFile) {
            alert('Please upload a file first');
            return;
        }
        inputData = currentFile;
        isFile = true;
    } else {
        if (!textInput.value.trim()) {
            alert('Please enter some text first');
            return;
        }
        inputData = textInput.value;
        isFile = false;
    }
    
    // Get processing type
    const processingType = document.querySelector('input[name="processingType"]:checked').value;
    const customPromptValue = customPromptInput.value;
    
    // Validate custom prompt
    if (processingType === 'custom' && !customPromptValue.trim()) {
        alert('Please enter a custom prompt');
        return;
    }
    
    // Show loading
    showLoading();
    
    try {
        let result;
        
        if (isFile) {
            // Process file
            const formData = new FormData();
            formData.append('file', inputData);
            formData.append('processingType', processingType);
            formData.append('customPrompt', customPromptValue);
            
            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Failed to process file');
            }
            
            result = await response.json();
        } else {
            // Process text
            const response = await fetch('/api/process-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: inputData,
                    processingType: processingType,
                    customPrompt: customPromptValue
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to process text');
            }
            
            result = await response.json();
        }
        
        // Display result
        if (result.success) {
            currentResult = result.result;
            resultContent.textContent = result.result;
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            throw new Error(result.error || 'Processing failed');
        }
        
    } catch (error) {
        console.error('Processing error:', error);
        alert('Error: ' + error.message + '\n\nMake sure Ollama is running with the Qwen 3:8b model.');
    } finally {
        hideLoading();
    }
}

function showLoading() {
    loadingOverlay.style.display = 'flex';
    processBtn.disabled = true;
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
    processBtn.disabled = false;
}

async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(currentResult);
        
        // Visual feedback
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>Copied!';
        copyBtn.style.color = '#10b981';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.color = '';
        }, 2000);
    } catch (error) {
        alert('Failed to copy to clipboard');
    }
}

function downloadResult() {
    const blob = new Blob([currentResult], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ollama-result-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function checkOllamaConnection() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
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
        textInput.value = '';
        updateCharCount();
        resultsSection.style.display = 'none';
    }
});
