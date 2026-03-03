/**
 * Color Mapper - Handles different color visualization modes
 * Provides functions to map point data to colors based on selected mode
 */

export class ColorMapper {
    /**
     * Color modes available
     */
    static MODES = {
        RGB: 'rgb',
        ELEVATION: 'elevation',
        INTENSITY: 'intensity',
        CLASSIFICATION: 'classification'
    };
    
    /**
     * Apply color mapping to point data
     * @param {string} mode - Color mode (rgb, elevation, intensity, classification)
     * @param {Object} pointData - Point data with positions, colors, intensity, classification
     * @param {number} count - Number of points
     * @param {Object} bounds - Bounding box with minZ and maxZ
     * @returns {Uint8Array} RGB color array (3 bytes per point)
     */
    static applyColorMode(mode, pointData, count, bounds) {
        switch (mode) {
            case ColorMapper.MODES.RGB:
                return ColorMapper.mapRGB(pointData, count);
            case ColorMapper.MODES.ELEVATION:
                return ColorMapper.mapElevation(pointData, count, bounds);
            case ColorMapper.MODES.INTENSITY:
                return ColorMapper.mapIntensity(pointData, count);
            case ColorMapper.MODES.CLASSIFICATION:
                return ColorMapper.mapClassification(pointData, count);
            default:
                console.warn(`Unknown color mode: ${mode}, using RGB`);
                return ColorMapper.mapRGB(pointData, count);
        }
    }
    
    /**
     * RGB mode: use original colors from LAS file
     * @param {Object} pointData - Point data
     * @param {number} count - Number of points
     * @returns {Uint8Array} RGB color array
     */
    static mapRGB(pointData, count) {
        // Simply return the original colors
        return pointData.colors;
    }
    
    /**
     * Elevation mode: map Z coordinate to color gradient
     * Uses a blue (low) -> green -> yellow -> red (high) gradient
     * @param {Object} pointData - Point data
     * @param {number} count - Number of points
     * @param {Object} bounds - Bounding box with minZ and maxZ
     * @returns {Uint8Array} RGB color array
     */
    static mapElevation(pointData, count, bounds) {
        const colors = new Uint8Array(count * 3);
        const { minZ, maxZ } = bounds;
        const range = maxZ - minZ;
        
        // Avoid division by zero
        const normalizedRange = range > 0 ? range : 1;
        
        for (let i = 0; i < count; i++) {
            // Get Z coordinate
            const z = pointData.positions[i * 3 + 2];
            
            // Normalize Z to [0, 1]
            const t = (z - minZ) / normalizedRange;
            
            // Apply color gradient: blue -> cyan -> green -> yellow -> red
            const rgb = ColorMapper.elevationGradient(t);
            
            colors[i * 3] = rgb[0];
            colors[i * 3 + 1] = rgb[1];
            colors[i * 3 + 2] = rgb[2];
        }
        
        return colors;
    }
    
    /**
     * Intensity mode: map intensity to grayscale
     * @param {Object} pointData - Point data
     * @param {number} count - Number of points
     * @returns {Uint8Array} RGB color array
     */
    static mapIntensity(pointData, count) {
        const colors = new Uint8Array(count * 3);
        
        // Intensity is uint16 (0-65535), normalize to 0-255
        for (let i = 0; i < count; i++) {
            const intensity = pointData.intensity[i];
            
            // Normalize to 0-255 range
            const gray = Math.floor((intensity / 65535) * 255);
            
            // Set RGB to same value for grayscale
            colors[i * 3] = gray;
            colors[i * 3 + 1] = gray;
            colors[i * 3 + 2] = gray;
        }
        
        return colors;
    }
    
    /**
     * Classification mode: map classification codes to distinct colors
     * Uses ASPRS LAS classification standard colors
     * @param {Object} pointData - Point data
     * @param {number} count - Number of points
     * @returns {Uint8Array} RGB color array
     */
    static mapClassification(pointData, count) {
        const colors = new Uint8Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            const classification = pointData.classification[i];
            
            // Get color for classification code
            const rgb = ColorMapper.classificationColor(classification);
            
            colors[i * 3] = rgb[0];
            colors[i * 3 + 1] = rgb[1];
            colors[i * 3 + 2] = rgb[2];
        }
        
        return colors;
    }
    
    /**
     * Elevation gradient color mapping
     * @param {number} t - Normalized value [0, 1]
     * @returns {Array<number>} RGB color [r, g, b]
     */
    static elevationGradient(t) {
        // Clamp t to [0, 1]
        t = Math.max(0, Math.min(1, t));
        
        // 5-color gradient: blue -> cyan -> green -> yellow -> red
        if (t < 0.25) {
            // Blue to cyan
            const s = t / 0.25;
            return [0, Math.floor(s * 255), 255];
        } else if (t < 0.5) {
            // Cyan to green
            const s = (t - 0.25) / 0.25;
            return [0, 255, Math.floor((1 - s) * 255)];
        } else if (t < 0.75) {
            // Green to yellow
            const s = (t - 0.5) / 0.25;
            return [Math.floor(s * 255), 255, 0];
        } else {
            // Yellow to red
            const s = (t - 0.75) / 0.25;
            return [255, Math.floor((1 - s) * 255), 0];
        }
    }
    
    /**
     * Classification color mapping based on ASPRS LAS standard
     * @param {number} classification - Classification code
     * @returns {Array<number>} RGB color [r, g, b]
     */
    static classificationColor(classification) {
        // ASPRS LAS classification codes with standard colors
        const classColors = {
            0: [128, 128, 128],  // Never classified - gray
            1: [160, 82, 45],    // Unclassified - brown
            2: [139, 69, 19],    // Ground - dark brown
            3: [34, 139, 34],    // Low Vegetation - green
            4: [0, 255, 0],      // Medium Vegetation - bright green
            5: [0, 128, 0],      // High Vegetation - dark green
            6: [255, 0, 0],      // Building - red
            7: [128, 128, 128],  // Low Point (noise) - gray
            8: [255, 255, 0],    // Reserved - yellow
            9: [0, 0, 255],      // Water - blue
            10: [255, 165, 0],   // Rail - orange
            11: [128, 128, 128], // Road Surface - gray
            12: [192, 192, 192], // Reserved - light gray
            13: [255, 255, 255], // Wire - Guard (Shield) - white
            14: [255, 0, 255],   // Wire - Conductor (Phase) - magenta
            15: [128, 0, 128],   // Transmission Tower - purple
            16: [255, 192, 203], // Wire-structure Connector - pink
            17: [165, 42, 42],   // Bridge Deck - brown
            18: [255, 215, 0]    // High Noise - gold
        };
        
        // Return color for classification, or gray for unknown
        return classColors[classification] || [128, 128, 128];
    }
}

