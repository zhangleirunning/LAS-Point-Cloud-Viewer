/**
 * UI Controller - Manages all UI interactions and updates
 */
export class UIController {
    constructor() {
        // File upload elements
        this.fileInput = document.getElementById('fileInput');
        this.fileName = document.getElementById('fileName');
        
        // Loading indicator
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.progressFill = document.getElementById('progressFill');
        this.loadingText = document.querySelector('.loading-text');
        
        // Metadata display
        this.metadataSection = document.getElementById('metadata');
        this.pointCountEl = document.getElementById('pointCount');
        this.fileSizeEl = document.getElementById('fileSize');
        this.boundsXEl = document.getElementById('boundsX');
        this.boundsYEl = document.getElementById('boundsY');
        this.boundsZEl = document.getElementById('boundsZ');
        this.pointFormatEl = document.getElementById('pointFormat');
        
        // Statistics display
        this.fpsEl = document.getElementById('fps');
        this.visiblePointsEl = document.getElementById('visiblePoints');
        this.cameraDistanceEl = document.getElementById('cameraDistance');
        
        // Error display
        this.errorEl = document.getElementById('error');
        
        // Callbacks
        this.onFileSelected = null;
    }
    
    /**
     * Initialize UI event handlers
     */
    initialize() {
        // File input handler
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && this.onFileSelected) {
                this.updateFileName(file.name);
                this.onFileSelected(file);
            }
        });
        
        // Update file label when file is selected
        const fileLabel = document.querySelector('.file-label');
        if (fileLabel) {
            fileLabel.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileLabel.style.background = '#2369c7';
            });
            
            fileLabel.addEventListener('dragleave', () => {
                fileLabel.style.background = '#2a7de1';
            });
        }
    }
    
    /**
     * Update the displayed file name
     * @param {string} name - File name
     */
    updateFileName(name) {
        if (this.fileName) {
            this.fileName.textContent = name;
        }
    }
    
    /**
     * Show loading indicator
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading point cloud...') {
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.remove('hidden');
            if (this.loadingText) {
                this.loadingText.textContent = message;
            }
        }
    }
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.add('hidden');
        }
    }
    
    /**
     * Update loading progress
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(percent) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percent}%`;
        }
    }
    
    /**
     * Display file metadata
     * @param {Object} metadata - File metadata
     */
    displayMetadata(metadata) {
        if (!this.metadataSection) return;
        
        this.metadataSection.classList.remove('hidden');
        
        // Update point count
        if (this.pointCountEl) {
            this.pointCountEl.textContent = this.formatNumber(metadata.pointCount);
        }
        
        // Update file size
        if (this.fileSizeEl) {
            this.fileSizeEl.textContent = this.formatFileSize(metadata.fileSize);
        }
        
        // Update bounds
        if (metadata.bounds) {
            if (this.boundsXEl) {
                this.boundsXEl.textContent = 
                    `${metadata.bounds.minX.toFixed(2)} to ${metadata.bounds.maxX.toFixed(2)}`;
            }
            if (this.boundsYEl) {
                this.boundsYEl.textContent = 
                    `${metadata.bounds.minY.toFixed(2)} to ${metadata.bounds.maxY.toFixed(2)}`;
            }
            if (this.boundsZEl) {
                this.boundsZEl.textContent = 
                    `${metadata.bounds.minZ.toFixed(2)} to ${metadata.bounds.maxZ.toFixed(2)}`;
            }
        }
        
        // Update point format
        if (this.pointFormatEl) {
            this.pointFormatEl.textContent = `Format ${metadata.pointFormat}`;
        }
    }
    
    /**
     * Update statistics display
     * @param {Object} stats - Current statistics
     */
    updateStats(stats) {
        if (this.fpsEl) {
            this.fpsEl.textContent = stats.fps;
        }
        
        if (this.visiblePointsEl) {
            this.visiblePointsEl.textContent = this.formatNumber(stats.visiblePoints);
        }
        
        if (this.cameraDistanceEl) {
            this.cameraDistanceEl.textContent = stats.cameraDistance.toFixed(2);
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        if (this.errorEl) {
            this.errorEl.textContent = message;
            this.errorEl.classList.remove('hidden');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hideError();
            }, 5000);
        }
    }
    
    /**
     * Hide error message
     */
    hideError() {
        if (this.errorEl) {
            this.errorEl.classList.add('hidden');
        }
    }
    
    /**
     * Format number with thousands separators
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        return num.toLocaleString();
    }
    
    /**
     * Format file size in human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}
