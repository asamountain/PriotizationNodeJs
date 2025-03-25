#!/bin/bash
# deploy.sh - Script to push to Git and deploy to Vercel in one command

# Text colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if a commit message was provided
if [ -z "$1" ]; then
  echo -e "${YELLOW}Please provide a commit message. Usage:${NC}"
  echo -e "  ./deploy.sh \"Your commit message\""
  exit 1
fi

COMMIT_MESSAGE="$1"

# Step 1: Add all changes to Git
echo -e "${BLUE}Step 1/4: Adding all changes to Git...${NC}"
git add .

# Step 2: Commit with the provided message
echo -e "${BLUE}Step 2/4: Committing changes with message: ${YELLOW}$COMMIT_MESSAGE${NC}"
git commit -m "$COMMIT_MESSAGE"

# Check if commit was successful
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}Commit failed. Please fix the issues and try again.${NC}"
  exit 1
fi

# Step 3: Push to Git repository
echo -e "${BLUE}Step 3/4: Pushing to Git repository...${NC}"
git push

# Check if push was successful
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}Push to Git failed. Please fix the issues and try again.${NC}"
  exit 1
fi

# Step 4: Deploy to Vercel
echo -e "${BLUE}Step 4/4: Deploying to Vercel...${NC}"
npx vercel --prod

# Check if Vercel deployment was successful
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}Vercel deployment had issues. Please check the output above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Success! Your changes have been:${NC}"
echo -e "${GREEN}   1. Added to Git${NC}"
echo -e "${GREEN}   2. Committed with message: ${YELLOW}$COMMIT_MESSAGE${NC}"
echo -e "${GREEN}   3. Pushed to your Git repository${NC}"
echo -e "${GREEN}   4. Deployed to Vercel production${NC}" 