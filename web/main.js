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
            uiController.showError(`Initialization failed: ${error.message}`);
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
        // Validate file extension
        if (!file.name.toLowerCase().endsWith('.las')) {
            throw new Error('Please select a valid LAS file');
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
        uiController.showError(`Failed to load file: ${error.message}`);
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
            uiController.showError(`Failed to change color mode: ${error.message}`);
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

