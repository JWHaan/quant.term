#!/bin/bash

# Script to find potentially unused files in the project
# This will help identify files that are never imported

echo "=== Finding Potentially Unused Files ==="
echo ""

# Find all TypeScript/TSX files
echo "Total files: $(find src -name "*.tsx" -o -name "*.ts" | wc -l)"
echo ""

# Check for files that are never imported
echo "=== Files that may be unused (not imported anywhere) ==="
echo ""

for file in $(find src -name "*.tsx" -o -name "*.ts"); do
    # Get the basename without extension
    basename=$(basename "$file" .tsx)
    basename=$(basename "$basename" .ts)
    
    # Skip index files and main entry points
    if [[ "$basename" == "index" ]] || [[ "$basename" == "main" ]] || [[ "$basename" == "App" ]]; then
        continue
    fi
    
    # Search for imports of this file
    import_count=$(grep -r "from.*$basename" src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "$file" | wc -l)
    
    if [ "$import_count" -eq 0 ]; then
        echo "❌ $file (0 imports)"
    fi
done

echo ""
echo "=== Analysis Complete ==="
