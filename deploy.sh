#!/bin/bash

set -e

echo "🚀 PG Maaya Deployment Script"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if there are uncommitted changes
echo -e "\n${BLUE}📋 Checking git status...${NC}"
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}📝 Uncommitted changes detected${NC}"

  # Show what's changed
  echo -e "\n${YELLOW}Changes to commit:${NC}"
  git status --short

  # Ask user if they want to commit
  read -p "Do you want to commit these changes? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter commit message: " commit_msg
    git add -A
    git commit -m "$commit_msg"
    echo -e "${GREEN}✓ Changes committed${NC}"
  else
    echo -e "${YELLOW}⚠ Skipping commit. Deploying current state...${NC}"
  fi
else
  echo -e "${GREEN}✓ Working tree clean${NC}"
fi

# Build the app
echo -e "\n${BLUE}🔨 Building app...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

# Deploy to Firebase
echo -e "\n${BLUE}📤 Deploying to Firebase...${NC}"
npx -y firebase-tools@latest deploy

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}📱 Live at: https://pg-manager-pgmaaya.web.app${NC}"
echo -e "${GREEN}================================${NC}"
