# Quick Start Guide - Deploy AAF Generator

## 🚀 Fast Deployment (5 minutes)

### Step 1: Prepare Your Code
```bash
# Make sure you're in the project directory
cd "AAF Generator"

# Run the deployment helper
./deploy.sh
```

### Step 2: Deploy to Render.com (Recommended)

1. **Sign up at Render.com**
   - Go to https://render.com
   - Create a free account

2. **Create Backend Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `aaf-generator-backend`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Plan**: `Free`

3. **Add Environment Variable**
   - Go to "Environment" tab
   - Add: `ELEVENLABS_API_KEY` = `your_api_key_here`

4. **Create Frontend Service**
   - Click "New +" → "Static Site"
   - Connect same GitHub repository
   - Configure:
     - **Name**: `aaf-generator-frontend`
     - **Build Command**: `cd frontend && npm install && npm run build`
     - **Publish Directory**: `frontend/build`
     - **Plan**: `Free`

### Step 3: Update Frontend API URL

After backend deploys, update the frontend environment variable:
- Go to frontend service settings
- Add: `REACT_APP_API_URL` = `https://your-backend-name.onrender.com`

## 🔧 Alternative: Railway.app

1. Go to https://railway.app
2. Connect your GitHub repository
3. Deploy using the provided `railway.json`
4. Add environment variables in dashboard

## 📋 What You Get

- **Backend URL**: `https://your-backend-name.onrender.com`
- **Frontend URL**: `https://your-frontend-name.onrender.com`
- **API Documentation**: `https://your-backend-name.onrender.com/docs`

## 🧪 Testing

1. Share the frontend URL with your team
2. Upload a CSV file with translation data
3. Test the AAF generation process
4. Download generated files

## 🔒 Security Notes

- ✅ API key is now environment variable (not hardcoded)
- ✅ HTTPS enabled by default
- ✅ CORS configured for frontend
- ⚠️ Remember to set your actual API key in environment variables

## 🆘 Troubleshooting

**Backend won't start?**
- Check environment variables are set
- Verify Python dependencies in requirements.txt

**Frontend can't connect to backend?**
- Check REACT_APP_API_URL is correct
- Verify CORS settings in backend

**Need help?**
- Check Render logs in dashboard
- Review the full README.md for detailed instructions 