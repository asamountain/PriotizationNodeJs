#!/bin/bash

echo "🧹 Starting project cleanup..."

# Files to remove
FILES_TO_REMOVE=(
  "scripts/migrate-data.js"
  "scripts/migrate-data.cjs"
  "scripts/verify-migration.js"
  "scripts/verify-migration.cjs"
  "scripts/check-sqlite-schema.js"
  "scripts/check-sqlite-schema.cjs"
  "pages/debug.js"
  "pages/health.js"
)

echo "The following files will be removed:"
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    echo "  - $file"
  fi
done

echo
read -p "Continue with cleanup? (y/n): " CONFIRM

if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
  echo "Cleanup cancelled."
  exit 0
fi

# Remove unnecessary files
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "✓ Removed: $file"
  else
    echo "ℹ️ Not found: $file"
  fi
done

# Create essential directories if they don't exist
mkdir -p lib models pages/api/tasks components

echo
echo "✅ Project cleanup completed!"
echo "The project structure has been streamlined." 