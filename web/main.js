/**
 * LAS Point Cloud Viewer - Main Entry Point
 * 
 * This application demonstrates:
 * - Modern C++ compiled to WebAssembly
 * - 3D graphics programming with WebGL
 * - Computational geometry (octree, frustum culling)
 * - Large dataset handling and optimization
 */

import { PointCloudViewer } from './PointCloudViewer.js';
import { UIController } from './UIController.js';
import { ErrorHandler } from './ErrorHandler.js';

// Application state
let viewer = null;
let uiController = null;

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        console.log('Initializing LAS Point Cloud Viewer...');
        
        // Get canvas element
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        
        // Set canvas size to match container
        resizeCanvas(canvas);
        window.addEventListener('resize', () => resizeCanvas(canvas));
        
        // Initialize UI controller
        uiController = new UIController();
        uiController.initialize();
        
        // Set up file selection callback
        uiController.onFileSelected = handleFileSelected;
        
        // Set up color mode change callback
        uiController.onColorModeChanged = handleColorModeChanged;
        
        // Initialize viewer
        viewer = new PointCloudViewer(canvas);
        await viewer.initialize();
        
        // Start render loop
        viewer.startRenderLoop();
        
        // Update stats display periodically
        setInterval(updateStatsDisplay, 100);
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        if (uiController) {
            ErrorHandler.handleError(error, uiController, 'initialization');
        } else {
            // Fallback if UI controller isn't available
            alert(`Failed to initialize application: ${error.message}`);
        }
    }
}

/**
 * Handle file selection
 * @param {File} file - Selected LAS file
 */
async function handleFileSelected(file) {
    if (!viewer || !uiController) {
        return;
    }
    
    try {
        // Validate file before attempting to load
        const validationError = ErrorHandler.validateFile(file);
        if (validationError) {
            // Show validation error but allow large files to proceed with warning
            if (validationError.category === ErrorHandler.CATEGORIES.FILE_SIZE && 
                file.size > 0 && file.size >= 227) {
                // Just show warning for large files, don't block
                uiController.showError(validationError.message, {
                    details: validationError.details,
                    action: validationError.action
                });
                // Continue with loading after brief delay
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                // Block loading for other validation errors
                uiController.showError(validationError.message, {
                    details: validationError.details,
                    action: validationError.action
                });
                return;
            }
        }
        
        // Show loading indicator
        uiController.showLoading('Loading point cloud...');
        uiController.updateProgress(10);
        
        // Hide any previous errors
        uiController.hideError();
        
        // Load file (this includes parsing)
        uiController.updateProgress(30);
        const metadata = await viewer.loadFile(file);
        
        // Progress is updated during spatial index building
        uiController.updateProgress(100);
        
        // Hide loading indicator after a brief delay
        setTimeout(() => {
            uiController.hideLoading();
        }, 500);
        
        // Display metadata
        uiController.displayMetadata(metadata);
        
        console.log('File loaded successfully:', metadata);
    } catch (error) {
        console.error('Failed to load file:', error);
        uiController.hideLoading();
        ErrorHandler.handleError(error, uiController, 'file_load');
    }
}

/**
 * Handle color mode change
 * @param {string} mode - Selected color mode
 */
function handleColorModeChanged(mode) {
    if (!viewer) {
        return;
    }
    
    try {
        viewer.setColorMode(mode);
        console.log(`Color mode changed to: ${mode}`);
    } catch (error) {
        console.error('Failed to change color mode:', error);
        if (uiController) {
            ErrorHandler.handleError(error, uiController, 'color_mode_change');
        }
    }
}

/**
 * Update statistics display
 */
function updateStatsDisplay() {
    if (!viewer || !uiController) {
        return;
    }
    
    try {
        const stats = viewer.getStats();
        uiController.updateStats(stats);
    } catch (error) {
        // Silently ignore errors in stats update
        console.debug('Stats update error:', error);
    }
}

/**
 * Resize canvas to match container
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
function resizeCanvas(canvas) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Set canvas size with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Set display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
}

/**
 * Clean up on page unload
 */
window.addEventListener('beforeunload', () => {
    if (viewer) {
        viewer.dispose();
    }
});

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

