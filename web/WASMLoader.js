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
    // Emscripten doesn't expose the memory buffer on the Module object
    // But we can use a workaround: write to a known location and read it back
    // to get access to the underlying buffer
    
    let memoryBuffer = null;
    
    const getMemoryBuffer = () => {
        if (!memoryBuffer) {
            // Allocate a small test buffer
            const testPtr = module._malloc(8);
            if (!testPtr) {
                throw new Error('Failed to allocate test memory');
            }
            
            // Use Emscripten's getValue/setValue if available
            if (module.getValue && module.setValue) {
                // We can use these functions, but we still need the buffer for bulk operations
                // Try to access it through the internal _emscripten functions
            }
            
            // The memory must exist if malloc succeeded
            // Try using the internal asm object or exports
            if (module.asm && module.asm.memory) {
                memoryBuffer = module.asm.memory.buffer;
                console.log('Found memory through module.asm.memory');
            } else {
                // Last resort: search through all enumerable and non-enumerable properties
                const allKeys = Object.getOwnPropertyNames(module);
                for (const key of allKeys) {
                    try {
                        const val = module[key];
                        if (val instanceof WebAssembly.Memory) {
                            memoryBuffer = val.buffer;
                            console.log(`Found WebAssembly.Memory at module.${key}`);
                            break;
                        }
                    } catch (e) {
                        // Skip properties that throw on access
                    }
                }
            }
            
            module._free(testPtr);
            
            if (!memoryBuffer) {
                throw new Error('Cannot access WASM memory buffer - exhausted all access methods');
            }
        }
        return memoryBuffer;
    };
    
    const getHeapView = (TypedArray) => {
        return new TypedArray(getMemoryBuffer());
    };
    
    return {
        // Raw module reference
        _module: module,
        
        // Memory management
        malloc: (size) => module._malloc(size),
        free: (ptr) => module._free(ptr),
        
        // Memory views - create getters that always return fresh views
        get HEAP8() { return getHeapView(Int8Array); },
        get HEAPU8() { return getHeapView(Uint8Array); },
        get HEAP16() { return getHeapView(Int16Array); },
        get HEAPU16() { return getHeapView(Uint16Array); },
        get HEAP32() { return getHeapView(Int32Array); },
        get HEAPU32() { return getHeapView(Uint32Array); },
        get HEAPF32() { return getHeapView(Float32Array); },
        get HEAPF64() { return getHeapView(Float64Array); },
        
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
                // Use Emscripten's writeArrayToMemory function instead of direct heap access
                if (module.writeArrayToMemory) {
                    module.writeArrayToMemory(data, dataPtr);
                } else {
                    // Fallback: use setValue byte by byte (slower but should work)
                    for (let i = 0; i < data.length; i++) {
                        module.setValue(dataPtr + i, data[i], 'i8');
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
                console.log(`Point cloud loaded: ${header.pointCount.toLocaleString()} points`);
                
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
            // LASHeader struct layout (from las_parser.h):
            // uint32_t point_count          (4 bytes)
            // [4 bytes padding for alignment]
            // double min_x, min_y, min_z    (24 bytes)
            // double max_x, max_y, max_z    (24 bytes)
            // double scale_x, scale_y, scale_z  (24 bytes)
            // double offset_x, offset_y, offset_z (24 bytes)
            // uint8_t point_format          (1 byte)
            // [1 byte padding]
            // uint16_t point_record_length  (2 bytes)
            // uint8_t version_major         (1 byte)
            // uint8_t version_minor         (1 byte)
            // [2 bytes padding to align to 8 bytes]
            // Total: 112 bytes
            
            let offset = ptr;
            
            // Read uint32_t point_count
            const pointCount = module.getValue(offset, 'i32');
            offset += 4;
            
            // Skip 4 bytes of padding (struct alignment for doubles)
            offset += 4;
            
            // Read 12 doubles (min/max/scale/offset for x,y,z)
            const minX = module.getValue(offset, 'double'); offset += 8;
            const minY = module.getValue(offset, 'double'); offset += 8;
            const minZ = module.getValue(offset, 'double'); offset += 8;
            const maxX = module.getValue(offset, 'double'); offset += 8;
            const maxY = module.getValue(offset, 'double'); offset += 8;
            const maxZ = module.getValue(offset, 'double'); offset += 8;
            const scaleX = module.getValue(offset, 'double'); offset += 8;
            const scaleY = module.getValue(offset, 'double'); offset += 8;
            const scaleZ = module.getValue(offset, 'double'); offset += 8;
            const offsetX = module.getValue(offset, 'double'); offset += 8;
            const offsetY = module.getValue(offset, 'double'); offset += 8;
            const offsetZ = module.getValue(offset, 'double'); offset += 8;
            
            // Read uint8_t point_format
            const pointFormat = module.getValue(offset, 'i8');
            offset += 1;
            
            // Skip 1 byte padding
            offset += 1;
            
            // Read uint16_t point_record_length
            const pointRecordLength = module.getValue(offset, 'i16');
            offset += 2;
            
            // Read version fields
            const versionMajor = module.getValue(offset, 'i8');
            offset += 1;
            const versionMinor = module.getValue(offset, 'i8');
            
            return {
                pointCount,
                bounds: {
                    minX, minY, minZ,
                    maxX, maxY, maxZ
                },
                scale: { x: scaleX, y: scaleY, z: scaleZ },
                offset: { x: offsetX, y: offsetY, z: offsetZ },
                pointFormat,
                pointRecordLength,
                version: `${versionMajor}.${versionMinor}`
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
                
                // Read count using getValue
                const count = module.getValue(countPtr, 'i32');
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
                
                // Use the correct struct size (20 bytes with padding)
                // C++ struct layout: float x,y,z (12) + uint8_t r,g,b (3) + 1 padding + uint16_t intensity (2) + uint8_t class (1) + 1 padding = 20
                const pointSize = 20;
                
                const positions = new Float32Array(count * 3);
                const colors = new Uint8Array(count * 3);
                const intensity = new Uint16Array(count);
                const classification = new Uint8Array(count);
                
                for (let i = 0; i < count; i++) {
                    let offset = dataPtr + i * pointSize;
                    
                    // Read positions (3 floats) using getValue
                    positions[i * 3] = module.getValue(offset, 'float'); offset += 4;
                    positions[i * 3 + 1] = module.getValue(offset, 'float'); offset += 4;
                    positions[i * 3 + 2] = module.getValue(offset, 'float'); offset += 4;
                    
                    // Read colors (3 uint8_t)
                    colors[i * 3] = module.getValue(offset, 'i8'); offset += 1;
                    colors[i * 3 + 1] = module.getValue(offset, 'i8'); offset += 1;
                    colors[i * 3 + 2] = module.getValue(offset, 'i8'); offset += 1;
                    
                    // Skip 1 byte of padding for alignment
                    offset += 1;
                    
                    // Read intensity (uint16_t)
                    intensity[i] = module.getValue(offset, 'i16'); offset += 2;
                    
                    // Read classification (uint8_t)
                    classification[i] = module.getValue(offset, 'i8');
                }
                
                return { positions, colors, intensity, classification, count };
            } catch (error) {
                console.error('Error in getPointData:', error);
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
                
                // Copy frustum planes to WASM memory using setValue
                for (let i = 0; i < frustumPlanes.length; i++) {
                    module.setValue(planesPtr + i * 4, frustumPlanes[i], 'float');
                }
                
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
                
                // Read count using getValue
                const count = module.getValue(countPtr, 'i32');
                
                // Copy indices to JavaScript array
                const indices = new Uint32Array(count);
                if (count > 0 && indicesPtr) {
                    for (let i = 0; i < count; i++) {
                        indices[i] = module.getValue(indicesPtr + i * 4, 'i32');
                    }
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
