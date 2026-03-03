/**
 * Tests for ErrorHandler utility
 */

import { ErrorHandler } from './ErrorHandler.js';

describe('ErrorHandler', () => {
    describe('parseError', () => {
        test('should parse invalid magic bytes error', () => {
            const error = new Error('Invalid LAS magic bytes');
            const result = ErrorHandler.parseError(error, 'file_load');
            
            expect(result.message).toBe('Invalid LAS File Format');
            expect(result.details).toContain('valid LAS point cloud file');
            expect(result.action).toContain('select a valid .las file');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.FILE_FORMAT);
        });
        
        test('should parse unsupported version error', () => {
            const error = new Error('Unsupported LAS version: 1.3');
            const result = ErrorHandler.parseError(error, 'file_load');
            
            expect(result.message).toBe('Unsupported LAS Version');
            expect(result.details).toContain('1.3');
            expect(result.action).toContain('LAS 1.2 or 1.4');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.FILE_FORMAT);
        });
        
        test('should parse unsupported format error', () => {
            const error = new Error('Unsupported point format: 3');
            const result = ErrorHandler.parseError(error, 'file_load');
            
            expect(result.message).toBe('Unsupported Point Format');
            expect(result.details).toContain('format 3');
            expect(result.action).toContain('format 2');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.FILE_FORMAT);
        });
        
        test('should parse truncated file error', () => {
            const error = new Error('File too small to contain all point records');
            const result = ErrorHandler.parseError(error, 'file_load');
            
            expect(result.message).toBe('Corrupted or Incomplete File');
            expect(result.details).toContain('truncated or corrupted');
            expect(result.action).toContain('Re-download');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.FILE_SIZE);
        });
        
        test('should parse memory allocation error', () => {
            const error = new Error('Failed to allocate memory for file data');
            const result = ErrorHandler.parseError(error, 'file_load');
            
            expect(result.message).toBe('Memory Allocation Failed');
            expect(result.details).toContain('out of memory');
            expect(result.action).toContain('Close other browser tabs');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.MEMORY);
        });
        
        test('should parse WebGL error', () => {
            const error = new Error('WebGL 2.0 not supported');
            const result = ErrorHandler.parseError(error, 'initialization');
            
            expect(result.message).toBe('WebGL Initialization Failed');
            expect(result.details).toContain('WebGL');
            expect(result.action).toContain('browser settings');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.WEBGL);
        });
        
        test('should parse WASM error', () => {
            const error = new Error('WASM module initialization failed');
            const result = ErrorHandler.parseError(error, 'initialization');
            
            expect(result.message).toBe('WebAssembly Module Error');
            expect(result.details).toContain('WebAssembly');
            expect(result.action).toContain('Refresh the page');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.WASM);
        });
        
        test('should handle unknown errors', () => {
            const error = new Error('Something unexpected happened');
            const result = ErrorHandler.parseError(error, 'unknown');
            
            expect(result.message).toBe('An Error Occurred');
            expect(result.details).toBe('Something unexpected happened');
            expect(result.action).toContain('Try refreshing the page');
            expect(result.category).toBe(ErrorHandler.CATEGORIES.UNKNOWN);
        });
    });
    
    describe('validateFile', () => {
        test('should reject null file', () => {
            const result = ErrorHandler.validateFile(null);
            
            expect(result).not.toBeNull();
            expect(result.message).toBe('No File Selected');
        });
        
        test('should reject non-LAS file', () => {
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });
            const result = ErrorHandler.validateFile(file);
            
            expect(result).not.toBeNull();
            expect(result.message).toBe('Invalid File Type');
            expect(result.details).toContain('.las extension');
        });
        
        test('should reject empty file', () => {
            const file = new File([], 'test.las', { type: 'application/octet-stream' });
            const result = ErrorHandler.validateFile(file);
            
            expect(result).not.toBeNull();
            expect(result.message).toBe('Empty File');
        });
        
        test('should reject file smaller than minimum header size', () => {
            const data = new Uint8Array(100); // Less than 227 bytes
            const file = new File([data], 'test.las', { type: 'application/octet-stream' });
            const result = ErrorHandler.validateFile(file);
            
            expect(result).not.toBeNull();
            expect(result.message).toBe('File Too Small');
            expect(result.details).toContain('100 bytes');
        });
        
        test('should warn about large files', () => {
            const size = 600 * 1024 * 1024; // 600MB
            const file = { name: 'large.las', size: size };
            const result = ErrorHandler.validateFile(file);
            
            expect(result).not.toBeNull();
            expect(result.message).toBe('Large File Warning');
            expect(result.details).toContain('600');
        });
        
        test('should accept valid file', () => {
            const data = new Uint8Array(1000); // Valid size
            const file = new File([data], 'test.las', { type: 'application/octet-stream' });
            const result = ErrorHandler.validateFile(file);
            
            expect(result).toBeNull(); // No error
        });
    });
});
