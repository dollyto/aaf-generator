#!/bin/bash

echo "🚀 AAF Generator Deployment Helper"
echo "=================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit"
fi

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  No remote repository found!"
    echo "Please create a GitHub repository and add it as origin:"
    echo "git remote add origin https://github.com/yourusername/your-repo-name.git"
    echo "git push -u origin main"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Committing changes..."
    git add .
    git commit -m "Update for deployment"
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push

echo ""
echo "✅ Code pushed to GitHub!"
echo ""
echo "🎯 Next steps for deployment:"
echo ""
echo "Option 1 - Render.com (Recommended):"
echo "1. Go to https://render.com"
echo "2. Sign up and create a new Web Service"
echo "3. Connect your GitHub repository"
echo "4. Configure backend:"
echo "   - Environment: Python"
echo "   - Build Command: pip install -r requirements.txt"
echo "   - Start Command: uvicorn main:app --host 0.0.0.0 --port \$PORT"
echo "5. Add environment variable: ELEVENLABS_API_KEY"
echo ""
echo "Option 2 - Railway.app:"
echo "1. Go to https://railway.app"
echo "2. Sign up and connect your GitHub repository"
echo "3. Deploy using the railway.json configuration"
echo "4. Add environment variables in the dashboard"
echo ""
echo "🔑 Don't forget to set your ELEVENLABS_API_KEY environment variable!" 