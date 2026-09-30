#!/bin/bash

set -e

echo "🚀 Quick Deploy (auto-commit)"

# Auto-commit any changes
if [ -n "$(git status --porcelain)" ]; then
  echo "📝 Committing changes..."
  git add -A
  git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "Nothing to commit"
fi

# Build and deploy
echo "🔨 Building and deploying..."
npm run deploy

echo "✅ Done! Live at: https://pg-manager-pgmaaya.web.app"
