#!/bin/bash

# Create a backup directory
BACKUP_DIR="project_backup_$(date +%Y%m%d_%H%M%S)"
echo "Creating backup directory: $BACKUP_DIR"
mkdir -p $BACKUP_DIR

# Copy all project files to backup directory
echo "Copying project files to backup..."
cp -r * $BACKUP_DIR 2>/dev/null
cp -r .env* $BACKUP_DIR 2>/dev/null
cp -r .git* $BACKUP_DIR 2>/dev/null

# Create a .gitignore for the backup directory
echo "node_modules/" > $BACKUP_DIR/.gitignore

# Zip the backup directory
echo "Creating zip archive..."
zip -r "${BACKUP_DIR}.zip" $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "✅ Backup completed: ${BACKUP_DIR}.zip"
echo "Your project is safely backed up." 