/**
 * WASM Module Loader
 * Handles loading and initialization of the WebAssembly module
 */

/**
 * Load the WASM module
 * @returns {Promise<Object>} Loaded WASM module with wrapper functions
 */
export async function loadWASM() {
    try {
        console.log('Loading WASM module...');
        
        // Check if Emscripten runtime is available
        if (typeof createLASViewerModule === 'undefined') {
            throw new Error('WebAssembly module not found. Make sure las_viewer.js is loaded before this script.');
        }
        
        // Initialize the WASM module
        const wasmModule = await createLASViewerModule();
        
        console.log('WASM runtime initialized');
        
        // Create wrapper object with typed functions
        const wrapper = createWASMWrapper(wasmModule);
        
        console.log('WASM module loaded successfully');
        return wrapper;
        
    } catch (error) {
        console.error('Failed to load WASM module:', error);
        throw new Error(`WebAssembly initialization failed: ${error.message}`);
    }
}

/**
 * Create a wrapper object with typed functions for WASM interface
 * @param {Object} module - Emscripten Module object
 * @returns {Object} Wrapper with typed functions
 */
function createWASMWrapper(module) {
    return {
        // Raw module reference
        _module: module,
        
        // Memory management
        malloc: (size) => module._malloc(size),
        free: (ptr) => module._free(ptr),
        
        // Memory views
        HEAP8: module.HEAP8,
        HEAPU8: module.HEAPU8,
        HEAP16: module.HEAP16,
        HEAPU16: module.HEAPU16,
        HEAP32: module.HEAP32,
        HEAPU32: module.HEAPU32,
        HEAPF32: module.HEAPF32,
        HEAPF64: module.HEAPF64,
        
        /**
         * Load LAS file from memory buffer
         * @param {Uint8Array} data - File data
         * @returns {Object} Header metadata
         */
        loadLASFile: function(data) {
            try {
                console.log(`Loading LAS file: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
                
                // Check file size
                if (data.length > 2 * 1024 * 1024 * 1024) {
                    throw new Error('File too large (> 2GB). Please use a smaller file.');
                }
                
                // Allocate memory for file data
                console.log('Allocating WASM memory...');
                const dataPtr = this.malloc(data.length);
                if (!dataPtr) {
                    throw new Error(`Failed to allocate ${(data.length / 1024 / 1024).toFixed(2)} MB of memory. The file may be too large for available memory.`);
                }
                
                console.log('Copying data to WASM memory...');
                // Copy data to WASM memory in chunks to avoid blocking
                const chunkSize = 10 * 1024 * 1024; // 10MB chunks
                for (let offset = 0; offset < data.length; offset += chunkSize) {
                    const end = Math.min(offset + chunkSize, data.length);
                    const chunk = data.subarray(offset, end);
                    this.HEAPU8.set(chunk, dataPtr + offset);
                    
                    if (offset % (50 * 1024 * 1024) === 0) {
                        console.log(`Copied ${(offset / 1024 / 1024).toFixed(2)} MB / ${(data.length / 1024 / 1024).toFixed(2)} MB`);
                    }
                }
                console.log('Data copied successfully');
                
                // Call WASM function
                console.log('Parsing LAS file...');
                const headerPtr = module._loadLASFile(dataPtr, data.length);
                
                // Free input data
                this.free(dataPtr);
                
                if (!headerPtr) {
                    throw new Error('Failed to parse LAS file header. The file may be corrupted or in an unsupported format.');
                }
                
                // Read header from WASM memory
                const header = this.readLASHeader(headerPtr);
                console.log(`Loaded ${header.pointCount.toLocaleString()} points`);
                
                return header;
            } catch (error) {
                throw new Error(`Failed to load LAS file: ${error.message}`);
            }
        },
        
        /**
         * Read LAS header from WASM memory
         * @param {number} ptr - Pointer to header struct
         * @returns {Object} Header data
         */
        readLASHeader: function(ptr) {
            // LASHeader struct layout (from design.md):
            // uint32_t point_count
            // double min_x, min_y, min_z
            // double max_x, max_y, max_z
            // double scale_x, scale_y, scale_z
            // double offset_x, offset_y, offset_z
            // uint8_t point_format
            // uint16_t point_record_length
            
            let offset = ptr / 4; // Convert to 32-bit offset
            
            const pointCount = this.HEAPU32[offset];
            offset += 1;
            
            // Read doubles (8 bytes each)
            const doubleOffset = (ptr + 4) / 8;
            const minX = this.HEAPF64[doubleOffset];
            const minY = this.HEAPF64[doubleOffset + 1];
            const minZ = this.HEAPF64[doubleOffset + 2];
            const maxX = this.HEAPF64[doubleOffset + 3];
            const maxY = this.HEAPF64[doubleOffset + 4];
            const maxZ = this.HEAPF64[doubleOffset + 5];
            const scaleX = this.HEAPF64[doubleOffset + 6];
            const scaleY = this.HEAPF64[doubleOffset + 7];
            const scaleZ = this.HEAPF64[doubleOffset + 8];
            const offsetX = this.HEAPF64[doubleOffset + 9];
            const offsetY = this.HEAPF64[doubleOffset + 10];
            const offsetZ = this.HEAPF64[doubleOffset + 11];
            
            // Read uint8_t and uint16_t
            const byteOffset = ptr + 4 + (12 * 8);
            const pointFormat = this.HEAPU8[byteOffset];
            const pointRecordLength = this.HEAPU16[(byteOffset + 1) / 2];
            
            return {
                pointCount,
                bounds: {
                    minX, minY, minZ,
                    maxX, maxY, maxZ
                },
                scale: { x: scaleX, y: scaleY, z: scaleZ },
                offset: { x: offsetX, y: offsetY, z: offsetZ },
                pointFormat,
                pointRecordLength
            };
        },
        
        /**
         * Get point data from WASM
         * @returns {Object} Point data arrays (positions, colors, intensity, classification)
         */
        getPointData: function() {
            try {
                const countPtr = this.malloc(4);
                if (!countPtr) {
                    throw new Error('Failed to allocate memory for point count.');
                }
                
                // Call WASM function
                const dataPtr = module._getPointData(countPtr);
                
                // Read count
                const count = this.HEAPU32[countPtr / 4];
                this.free(countPtr);
                
                if (!dataPtr || count === 0) {
                    return { 
                        positions: new Float32Array(0), 
                        colors: new Uint8Array(0),
                        intensity: new Uint16Array(0),
                        classification: new Uint8Array(0),
                        count: 0 
                    };
                }
                
                // Read point data (structure-of-arrays layout)
                // LASPoint: float x, y, z; uint8_t r, g, b; uint16_t intensity; uint8_t classification
                const pointSize = 4 * 3 + 3 + 2 + 1; // 20 bytes per point
                
                const positions = new Float32Array(count * 3);
                const colors = new Uint8Array(count * 3);
                const intensity = new Uint16Array(count);
                const classification = new Uint8Array(count);
                
                for (let i = 0; i < count; i++) {
                    const offset = dataPtr + i * pointSize;
                    
                    // Read positions (3 floats)
                    positions[i * 3] = this.HEAPF32[(offset) / 4];
                    positions[i * 3 + 1] = this.HEAPF32[(offset + 4) / 4];
                    positions[i * 3 + 2] = this.HEAPF32[(offset + 8) / 4];
                    
                    // Read colors (3 uint8_t)
                    colors[i * 3] = this.HEAPU8[offset + 12];
                    colors[i * 3 + 1] = this.HEAPU8[offset + 13];
                    colors[i * 3 + 2] = this.HEAPU8[offset + 14];
                    
                    // Read intensity (uint16_t)
                    intensity[i] = this.HEAPU16[(offset + 15) / 2];
                    
                    // Read classification (uint8_t)
                    classification[i] = this.HEAPU8[offset + 17];
                }
                
                return { positions, colors, intensity, classification, count };
            } catch (error) {
                throw new Error(`Failed to get point data: ${error.message}`);
            }
        },
        
        /**
         * Build spatial index (octree)
         */
        buildSpatialIndex: function() {
            try {
                module._buildSpatialIndex();
            } catch (error) {
                throw new Error(`Failed to build spatial index: ${error.message}`);
            }
        },
        
        /**
         * Query visible points using frustum culling
         * @param {Float32Array} frustumPlanes - 6 planes (24 floats)
         * @param {number} cameraDistance - Distance from camera to target
         * @param {number} maxPoints - Maximum points to return
         * @returns {Uint32Array} Indices of visible points
         */
        queryVisiblePoints: function(frustumPlanes, cameraDistance, maxPoints) {
            try {
                // Allocate memory for frustum planes
                const planesPtr = this.malloc(frustumPlanes.length * 4);
                if (!planesPtr) {
                    throw new Error('Failed to allocate memory for frustum planes.');
                }
                
                // Copy frustum planes to WASM memory
                this.HEAPF32.set(frustumPlanes, planesPtr / 4);
                
                // Allocate memory for output count
                const countPtr = this.malloc(4);
                if (!countPtr) {
                    this.free(planesPtr);
                    throw new Error('Failed to allocate memory for point count.');
                }
                
                // Call WASM function
                const indicesPtr = module._queryVisiblePoints(
                    planesPtr,
                    cameraDistance,
                    maxPoints,
                    countPtr
                );
                
                // Read count
                const count = this.HEAPU32[countPtr / 4];
                
                // Copy indices to JavaScript array
                const indices = new Uint32Array(count);
                if (count > 0 && indicesPtr) {
                    indices.set(this.HEAPU32.subarray(indicesPtr / 4, indicesPtr / 4 + count));
                }
                
                // Free allocated memory
                this.free(planesPtr);
                this.free(countPtr);
                
                return indices;
            } catch (error) {
                throw new Error(`Failed to query visible points: ${error.message}`);
            }
        },
        
        /**
         * Free LAS data and clean up
         */
        freeLASData: function() {
            try {
                module._freeLASData();
            } catch (error) {
                console.error('freeLASData failed:', error);
            }
        }
    };
}

/**
 * Copy typed array to WASM memory (zero-copy when possible)
 * @param {Object} wasmModule - WASM wrapper
 * @param {TypedArray} array - Array to copy
 * @returns {number} Pointer to data in WASM memory
 */
export function copyToWASM(wasmModule, array) {
    const bytesPerElement = array.BYTES_PER_ELEMENT;
    const length = array.length;
    const ptr = wasmModule.malloc(length * bytesPerElement);
    
    if (!ptr) {
        throw new Error('Failed to allocate WASM memory');
    }
    
    // Copy data based on type
    if (array instanceof Float32Array) {
        wasmModule.HEAPF32.set(array, ptr / 4);
    } else if (array instanceof Uint32Array) {
        wasmModule.HEAPU32.set(array, ptr / 4);
    } else if (array instanceof Uint8Array) {
        wasmModule.HEAPU8.set(array, ptr);
    } else {
        wasmModule.free(ptr);
        throw new Error('Unsupported array type');
    }
    
    return ptr;
}

/**
 * Read typed array from WASM memory
 * @param {Object} wasmModule - WASM wrapper
 * @param {number} ptr - Pointer to data
 * @param {number} length - Number of elements
 * @param {string} type - Array type ('float32', 'uint32', 'uint8')
 * @returns {TypedArray} Array with data
 */
export function readFromWASM(wasmModule, ptr, length, type) {
    switch (type) {
        case 'float32':
            return new Float32Array(wasmModule.HEAPF32.buffer, ptr, length);
        case 'uint32':
            return new Uint32Array(wasmModule.HEAPU32.buffer, ptr, length);
        case 'uint8':
            return new Uint8Array(wasmModule.HEAPU8.buffer, ptr, length);
        default:
            throw new Error(`Unsupported type: ${type}`);
    }
}
