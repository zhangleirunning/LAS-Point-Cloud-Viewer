/**
 * Error Handler - Provides user-friendly error messages and handling
 */

export class ErrorHandler {
    /**
     * Error categories for better classification
     */
    static CATEGORIES = {
        FILE_FORMAT: 'file_format',
        FILE_SIZE: 'file_size',
        MEMORY: 'memory',
        WEBGL: 'webgl',
        WASM: 'wasm',
        NETWORK: 'network',
        UNKNOWN: 'unknown'
    };
    
    /**
     * Parse error and return user-friendly message with details and actions
     * @param {Error|string} error - The error to parse
     * @param {string} context - Context where error occurred (e.g., 'file_load', 'render')
     * @returns {Object} Object with message, details, action, and category
     */
    static parseError(error, context = '') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const lowerMessage = errorMessage.toLowerCase();
        
        // File format errors
        if (lowerMessage.includes('magic') || lowerMessage.includes('invalid las')) {
            return {
                message: 'Invalid LAS File Format',
                details: 'The selected file does not appear to be a valid LAS point cloud file. The file header is missing or corrupted.',
                action: 'Please select a valid .las file. Make sure the file is not corrupted and was properly downloaded or transferred.',
                category: this.CATEGORIES.FILE_FORMAT
            };
        }
        
        if (lowerMessage.includes('version') && lowerMessage.includes('unsupported')) {
            const versionMatch = errorMessage.match(/version[:\s]+(\d+\.\d+)/i);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            return {
                message: 'Unsupported LAS Version',
                details: `This viewer supports LAS versions 1.2 and 1.4, but the file uses version ${version}.`,
                action: 'Try converting the file to LAS 1.2 or 1.4 format using a LAS conversion tool like LAStools or PDAL.',
                category: this.CATEGORIES.FILE_FORMAT
            };
        }
        
        if (lowerMessage.includes('format') && lowerMessage.includes('unsupported')) {
            const formatMatch = errorMessage.match(/format[:\s]+(\d+)/i);
            const format = formatMatch ? formatMatch[1] : 'unknown';
            return {
                message: 'Unsupported Point Format',
                details: `This viewer requires LAS point format 2 (with RGB colors), but the file uses format ${format}.`,
                action: 'Convert the file to point format 2 using LAS conversion tools. Format 2 includes RGB color information for each point.',
                category: this.CATEGORIES.FILE_FORMAT
            };
        }
        
        // File size and corruption errors
        if (lowerMessage.includes('truncated') || lowerMessage.includes('too small') || 
            lowerMessage.includes('smaller than')) {
            return {
                message: 'Corrupted or Incomplete File',
                details: 'The file appears to be truncated or corrupted. The file size is smaller than expected based on the header information.',
                action: 'Re-download the file or check if the file transfer was interrupted. Verify the file integrity with the original source.',
                category: this.CATEGORIES.FILE_SIZE
            };
        }
        
        if (lowerMessage.includes('file too large') || lowerMessage.includes('out of memory')) {
            return {
                message: 'File Too Large',
                details: 'The selected file is too large to load in the browser. This viewer works best with files under 500MB.',
                action: 'Try using a smaller file or use desktop software for very large point clouds. You can also try decimating the point cloud to reduce its size.',
                category: this.CATEGORIES.FILE_SIZE
            };
        }
        
        // Memory errors
        if (lowerMessage.includes('memory') || lowerMessage.includes('allocation')) {
            return {
                message: 'Memory Allocation Failed',
                details: 'The browser ran out of memory while processing the point cloud. This can happen with large files or when multiple tabs are open.',
                action: 'Close other browser tabs and try again. For very large files, consider using a desktop application.',
                category: this.CATEGORIES.MEMORY
            };
        }
        
        // WebGL errors
        if (lowerMessage.includes('webgl') || lowerMessage.includes('context')) {
            return {
                message: 'WebGL Initialization Failed',
                details: 'Unable to initialize WebGL for 3D rendering. This may be due to browser settings or hardware limitations.',
                action: 'Make sure WebGL is enabled in your browser settings. Try updating your graphics drivers or using a different browser.',
                category: this.CATEGORIES.WEBGL
            };
        }
        
        if (lowerMessage.includes('shader')) {
            return {
                message: 'Graphics Shader Error',
                details: 'Failed to compile or link graphics shaders. This is usually a browser or graphics driver issue.',
                action: 'Try refreshing the page. If the problem persists, update your graphics drivers or try a different browser.',
                category: this.CATEGORIES.WEBGL
            };
        }
        
        // WASM errors
        if (lowerMessage.includes('wasm') || lowerMessage.includes('webassembly')) {
            return {
                message: 'WebAssembly Module Error',
                details: 'Failed to load or initialize the WebAssembly module required for point cloud processing.',
                action: 'Refresh the page and try again. Make sure you are using a modern browser that supports WebAssembly.',
                category: this.CATEGORIES.WASM
            };
        }
        
        // File selection errors
        if (lowerMessage.includes('please select') || lowerMessage.includes('no file')) {
            return {
                message: 'No File Selected',
                details: 'Please select a LAS file to visualize.',
                action: 'Click the "Choose LAS File" button and select a .las file from your computer.',
                category: this.CATEGORIES.FILE_FORMAT
            };
        }
        
        // Network/loading errors
        if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || 
            lowerMessage.includes('load')) {
            return {
                message: 'Failed to Load Resource',
                details: 'A required resource failed to load. This may be due to network issues or missing files.',
                action: 'Check your internet connection and refresh the page. If the problem persists, the application files may be incomplete.',
                category: this.CATEGORIES.NETWORK
            };
        }
        
        // Initialization errors
        if (context === 'initialization' || lowerMessage.includes('not initialized')) {
            return {
                message: 'Application Not Ready',
                details: 'The application has not finished initializing. Please wait a moment and try again.',
                action: 'Wait for the application to fully load, then try your action again.',
                category: this.CATEGORIES.UNKNOWN
            };
        }
        
        // Generic/unknown errors
        return {
            message: 'An Error Occurred',
            details: errorMessage,
            action: 'Try refreshing the page. If the problem persists, check the browser console for more details.',
            category: this.CATEGORIES.UNKNOWN
        };
    }
    
    /**
     * Handle error and display to user via UI controller
     * @param {Error|string} error - The error to handle
     * @param {Object} uiController - UI controller instance
     * @param {string} context - Context where error occurred
     */
    static handleError(error, uiController, context = '') {
        const errorInfo = this.parseError(error, context);
        
        // Log to console for debugging
        console.error(`[${context || 'Error'}]`, error);
        
        // Display to user
        if (uiController && uiController.showError) {
            uiController.showError(errorInfo.message, {
                details: errorInfo.details,
                action: errorInfo.action
            });
        }
        
        return errorInfo;
    }
    
    /**
     * Validate file before attempting to load
     * @param {File} file - File to validate
     * @returns {Object|null} Error info if validation fails, null if valid
     */
    static validateFile(file) {
        if (!file) {
            return this.parseError('No file selected', 'file_validation');
        }
        
        // Check file extension
        if (!file.name.toLowerCase().endsWith('.las')) {
            return {
                message: 'Invalid File Type',
                details: `The selected file "${file.name}" does not have a .las extension.`,
                action: 'Please select a file with a .las extension. LAS (LASer) is the standard format for point cloud data.',
                category: this.CATEGORIES.FILE_FORMAT
            };
        }
        
        // Check file size (warn if > 500MB)
        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
            return {
                message: 'Large File Warning',
                details: `The selected file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Large files may take a long time to load and could cause performance issues.`,
                action: 'For best performance, use files under 500MB. You can continue, but loading may be slow.',
                category: this.CATEGORIES.FILE_SIZE
            };
        }
        
        // Check if file is empty
        if (file.size === 0) {
            return {
                message: 'Empty File',
                details: 'The selected file is empty (0 bytes).',
                action: 'Please select a valid LAS file that contains point cloud data.',
                category: this.CATEGORIES.FILE_SIZE
            };
        }
        
        // Check minimum size (LAS header is at least 227 bytes)
        if (file.size < 227) {
            return {
                message: 'File Too Small',
                details: `The selected file is only ${file.size} bytes, which is too small to be a valid LAS file.`,
                action: 'A valid LAS file must be at least 227 bytes (the minimum header size). Please select a different file.',
                category: this.CATEGORIES.FILE_SIZE
            };
        }
        
        return null; // File is valid
    }
}
