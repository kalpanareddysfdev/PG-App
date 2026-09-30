# Deployment Guide

Two automated deployment scripts are available:

## 1. Interactive Deploy (Recommended)
```bash
./deploy.sh
```
**Features:**
- Shows pending changes
- Prompts you to commit (with custom message)
- Builds and deploys
- Shows live URL when done

**Use this when:** You want control over commit messages.

---

## 2. Quick Deploy (Fast)
```bash
./quick-deploy.sh
```
**Features:**
- Auto-commits all changes with timestamp
- One command builds and deploys
- Fastest option

**Use this when:** You just want to ship changes ASAP.

---

## What Happens During Deploy

1. **Git Check** — Detects uncommitted changes
2. **Commit** — Stages and commits (if needed)
3. **Build** — Runs `npm run build` → creates optimized production files
4. **Deploy** — Pushes to Firebase Hosting (pg-manager-pgmaaya.web.app)
5. **Done** — Shows live URL

---

## From Terminal

From the project root:
```bash
# Interactive (asks for commit message)
./deploy.sh

# Quick (auto-commits)
./quick-deploy.sh
```

Both scripts run `npm run deploy` under the hood, which combines build + Firebase deploy.

---

## Troubleshooting

**"Permission denied" error?**
```bash
chmod +x deploy.sh quick-deploy.sh
```

**Firebase not authenticated?**
```bash
npx firebase login
```

**Need to rebuild from scratch?**
```bash
rm -rf dist node_modules
npm install
./deploy.sh
```

