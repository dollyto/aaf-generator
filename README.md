# AAF Generator

A web application for generating AAF (Advanced Authoring Format) files with audio synchronization.

## Features

- Upload CSV files with translation data
- Generate audio using ElevenLabs API
- Create AAF files with synchronized audio
- Download generated audio files

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (optional)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set environment variables:
```bash
export ELEVENLABS_API_KEY="your_api_key_here"
```

5. Run the backend:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the frontend:
```bash
npm start
```

### Docker Setup

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Deployment Options

### Option 1: Render.com (Recommended for testing)

1. Fork or push your code to GitHub
2. Sign up at [Render.com](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repository
5. Configure the service:
   - **Backend**: Python environment, build command: `pip install -r requirements.txt`, start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Frontend**: Static site, build command: `npm install && npm run build`, publish directory: `build`
6. Add environment variables:
   - `ELEVENLABS_API_KEY`: Your ElevenLabs API key

### Option 2: Railway.app

1. Sign up at [Railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy using the provided `railway.json` configuration
4. Add environment variables in the Railway dashboard

### Option 3: Heroku

1. Create a `Procfile` in the backend directory:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

2. Deploy using Heroku CLI or GitHub integration

## Environment Variables

- `ELEVENLABS_API_KEY`: Your ElevenLabs API key (required)
- `REACT_APP_API_URL`: Backend API URL (for frontend deployment)

## API Endpoints

- `POST /upload-csv/`: Upload CSV file with translation data
- `GET /generate-aaf/`: Generate AAF file
- `GET /download-wavs/`: Download generated audio files
- `GET /models/`: Get available ElevenLabs models
- `GET /duration-analysis/`: Get audio duration analysis

## Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive data
- Consider using a `.env` file for local development

## Testing

For team testing, we recommend using Render.com as it provides:
- Free tier with generous limits
- Automatic deployments from GitHub
- Easy environment variable management
- HTTPS by default
- Custom domains (optional)

## Support

For deployment issues or questions, check the platform-specific documentation:
- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Heroku Documentation](https://devcenter.heroku.com) 