#!/usr/bin/env python3
"""
Generate a small test LAS file for debugging
"""
import struct
import random

def create_test_las_file(filename, num_points=1000):
    """Create a minimal valid LAS 1.2 file with the specified number of points"""
    
    # LAS Header (227 bytes for LAS 1.2)
    header = bytearray(227)
    
    # File signature "LASF"
    header[0:4] = b'LASF'
    
    # File source ID
    struct.pack_into('<H', header, 4, 0)
    
    # Global encoding
    struct.pack_into('<H', header, 6, 0)
    
    # GUID (16 bytes) - all zeros for simplicity
    # header[8:24] already zeros
    
    # Version major/minor
    header[24] = 1  # Major
    header[25] = 2  # Minor
    
    # System identifier (32 bytes)
    sys_id = b'TEST_SYSTEM'.ljust(32, b'\0')
    header[26:58] = sys_id
    
    # Generating software (32 bytes)
    gen_soft = b'Python Test Generator'.ljust(32, b'\0')
    header[58:90] = gen_soft
    
    # Creation day/year
    struct.pack_into('<H', header, 90, 1)    # Day
    struct.pack_into('<H', header, 92, 2024) # Year
    
    # Header size
    struct.pack_into('<H', header, 94, 227)
    
    # Offset to point data
    struct.pack_into('<L', header, 96, 227)
    
    # Number of variable length records
    struct.pack_into('<L', header, 100, 0)
    
    # Point data format (2 = RGB format)
    header[104] = 2
    
    # Point data record length (26 bytes for format 2)
    struct.pack_into('<H', header, 105, 26)
    
    # Number of point records
    struct.pack_into('<L', header, 107, num_points)
    
    # Number of points by return (5 entries)
    struct.pack_into('<L', header, 111, num_points)  # Return 1
    struct.pack_into('<L', header, 115, 0)           # Return 2
    struct.pack_into('<L', header, 119, 0)           # Return 3
    struct.pack_into('<L', header, 123, 0)           # Return 4
    struct.pack_into('<L', header, 127, 0)           # Return 5
    
    # Generate some test points in a small area
    min_x, max_x = 1000.0, 1100.0
    min_y, max_y = 2000.0, 2100.0
    min_z, max_z = 100.0, 200.0
    
    # Scale factors (0.01 = centimeter precision)
    scale_x = scale_y = scale_z = 0.01
    
    # Offsets
    offset_x, offset_y, offset_z = min_x, min_y, min_z
    
    # X/Y/Z scale factors
    struct.pack_into('<d', header, 131, scale_x)
    struct.pack_into('<d', header, 139, scale_y)
    struct.pack_into('<d', header, 147, scale_z)
    
    # X/Y/Z offsets
    struct.pack_into('<d', header, 155, offset_x)
    struct.pack_into('<d', header, 163, offset_y)
    struct.pack_into('<d', header, 171, offset_z)
    
    # Max X/Y/Z
    struct.pack_into('<d', header, 179, max_x)
    struct.pack_into('<d', header, 187, max_y)
    struct.pack_into('<d', header, 195, max_z)
    
    # Min X/Y/Z
    struct.pack_into('<d', header, 203, min_x)
    struct.pack_into('<d', header, 211, min_y)
    struct.pack_into('<d', header, 219, min_z)
    
    # Generate point data
    points_data = bytearray()
    
    for i in range(num_points):
        # Generate random coordinates within bounds
        x = random.uniform(min_x, max_x)
        y = random.uniform(min_y, max_y)
        z = random.uniform(min_z, max_z)
        
        # Convert to scaled integers
        x_scaled = int((x - offset_x) / scale_x)
        y_scaled = int((y - offset_y) / scale_y)
        z_scaled = int((z - offset_z) / scale_z)
        
        # Point record (26 bytes for format 2)
        point = bytearray(26)
        
        # X, Y, Z (4 bytes each)
        struct.pack_into('<L', point, 0, x_scaled)
        struct.pack_into('<L', point, 4, y_scaled)
        struct.pack_into('<L', point, 8, z_scaled)
        
        # Intensity (2 bytes)
        intensity = random.randint(0, 65535)
        struct.pack_into('<H', point, 12, intensity)
        
        # Return info, classification, scan angle, user data, point source (4 bytes)
        return_info = 0x11  # Return 1 of 1
        classification = random.choice([1, 2, 3, 4, 5])  # Various classes
        scan_angle = 0
        user_data = 0
        
        point[14] = return_info
        point[15] = classification
        point[16] = scan_angle
        point[17] = user_data
        
        # Point source ID (2 bytes)
        struct.pack_into('<H', point, 18, 0)
        
        # RGB colors (6 bytes for format 2)
        red = random.randint(0, 65535)
        green = random.randint(0, 65535)
        blue = random.randint(0, 65535)
        struct.pack_into('<H', point, 20, red)
        struct.pack_into('<H', point, 22, green)
        struct.pack_into('<H', point, 24, blue)
        
        points_data.extend(point)
    
    # Write the file
    with open(filename, 'wb') as f:
        f.write(header)
        f.write(points_data)
    
    print(f"Generated {filename} with {num_points} points")
    print(f"File size: {len(header) + len(points_data)} bytes ({(len(header) + len(points_data))/1024:.1f} KB)")
    print(f"Bounds: X[{min_x:.1f}, {max_x:.1f}] Y[{min_y:.1f}, {max_y:.1f}] Z[{min_z:.1f}, {max_z:.1f}]")

if __name__ == "__main__":
    # Create a small test file (1KB)
    create_test_las_file("test_small.las", 100)
    
    # Create a medium test file (20KB) 
    create_test_las_file("test_medium.las", 1000)
    
    # Create a larger test file (200KB)
    create_test_las_file("test_large.las", 10000)