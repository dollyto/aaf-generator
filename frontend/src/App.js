import React, { useState, useEffect } from 'react';
import './App.css';

// Get API URL from environment variable or default to localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [columns, setColumns] = useState([]);
  const [summary, setSummary] = useState([]);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [downloadingAAF, setDownloadingAAF] = useState(false);
  const [downloadingWAVs, setDownloadingWAVs] = useState(false);
  const [selectedModel, setSelectedModel] = useState('eleven_multilingual_v2');
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online', 'offline', 'checking'

  // Health check function
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setBackendStatus('online');
          return true;
        }
      }
      setBackendStatus('offline');
      return false;
    } catch (error) {
      console.log('Backend health check failed:', error.message);
      setBackendStatus('offline');
      return false;
    }
  };

  // Start health check on component mount
  useEffect(() => {
    // Initial health check
    checkBackendHealth();

    // Set up periodic health checks every 10 seconds
    const interval = setInterval(checkBackendHealth, 10000);

    // Cleanup on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Load available models when backend comes online
  useEffect(() => {
    if (backendStatus === 'online' && availableModels.length === 0) {
      const loadModels = async () => {
        setLoadingModels(true);
        try {
          const response = await fetch(`${API_BASE_URL}/models/`);
          if (response.ok) {
            const data = await response.json();
            setAvailableModels(data.models || []);
          }
        } catch (error) {
          console.error('Failed to load models:', error);
        }
        setLoadingModels(false);
      };
      loadModels();
    }
  }, [backendStatus, availableModels.length]);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setUploadStatus('');
    setColumns([]);
    setSummary([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile || !apiKey) return;
    
    // Check if backend is online before proceeding
    if (backendStatus !== 'online') {
      setUploadStatus('Backend is offline. Please wait for it to come back online.');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('api_key', apiKey);
    setUploadStatus('Uploading...');
    setSummary([]);
    try {
      const response = await fetch(`${API_BASE_URL}/upload-csv/?model_id=${selectedModel}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setUploadStatus(data.message);
      setColumns(data.columns || []);
      setSummary(data.summary || []);
    } catch (error) {
      setUploadStatus('Upload failed. Backend may be offline.');
    }
  };

  const playAudio = (audioBase64, lineIndex, altIndex) => {
    if (playingAudio) {
      playingAudio.pause();
      playingAudio.currentTime = 0;
    }
    const audioData = atob(audioBase64);
    const arrayBuffer = new ArrayBuffer(audioData.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < audioData.length; i++) {
      view[i] = audioData.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      setPlayingAudio(null);
      URL.revokeObjectURL(audioUrl);
    };
    audio.play();
    setPlayingAudio(audio);
  };

  const stopAudio = () => {
    if (playingAudio) {
      playingAudio.pause();
      playingAudio.currentTime = 0;
      setPlayingAudio(null);
    }
  };

  const handleDownloadAAF = async () => {
    // Check if backend is online before proceeding
    if (backendStatus !== 'online') {
      alert('Backend is offline. Please wait for it to come back online.');
      return;
    }
    
    setDownloadingAAF(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-aaf/`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('AAF generation failed:', errorText);
        setDownloadingAAF(false);
        alert(`Failed to generate AAF file: ${response.status} ${response.statusText}`);
        return;
      }
      
      // Check if response is JSON (error) or binary (success)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        console.error('AAF generation error:', errorData);
        setDownloadingAAF(false);
        alert(`Failed to generate AAF file: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'output.aaf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Failed to download AAF file: ${error.message}`);
    }
    setDownloadingAAF(false);
  };

  const handleDownloadWAVs = async () => {
    // Check if backend is online before proceeding
    if (backendStatus !== 'online') {
      alert('Backend is offline. Please wait for it to come back online.');
      return;
    }
    
    setDownloadingWAVs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/download-wavs/`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('WAV download failed:', errorText);
        setDownloadingWAVs(false);
        alert(`Failed to download WAV files: ${response.status} ${response.statusText}`);
        return;
      }
      
      // Check if response is JSON (error) or binary (success)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        console.error('WAV download error:', errorData);
        setDownloadingWAVs(false);
        alert(`Failed to download WAV files: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audio_files.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Failed to download WAV files: ${error.message}`);
    }
    setDownloadingWAVs(false);
  };

  // Loading overlay component
  const LoadingOverlay = () => {
    if (backendStatus === 'online') return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        color: 'white',
        fontSize: '18px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderRadius: '10px',
          border: '2px solid #007bff'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h2 style={{ marginBottom: '10px' }}>
            {backendStatus === 'checking' ? 'Checking Backend Status...' : 'Backend Offline'}
          </h2>
          <p style={{ marginBottom: '20px', opacity: 0.8 }}>
            {backendStatus === 'checking' 
              ? 'Please wait while we connect to the server...' 
              : 'The backend server is currently offline. Please wait while it starts up...'
            }
          </p>
          <p style={{ fontSize: '14px', opacity: 0.6 }}>
            This is normal behavior on Render.com free tier - the server wakes up when needed.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <LoadingOverlay />
      <header className="App-header">
        <h1>AAF Generator MVP</h1>
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundColor: backendStatus === 'online' ? '#28a745' : backendStatus === 'checking' ? '#ffc107' : '#dc3545',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'white',
            animation: backendStatus === 'checking' ? 'spin 1s linear infinite' : 'none'
          }}></div>
          {backendStatus === 'online' ? 'Backend Online' : 
           backendStatus === 'checking' ? 'Checking...' : 'Backend Offline'}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="model-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              ElevenLabs Model:
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                width: '300px'
              }}
              disabled={loadingModels}
            >
              {loadingModels ? (
                <option>Loading models...</option>
              ) : (
                availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))
              )}
            </select>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <input type="file" accept=".csv" onChange={handleFileChange} />
            {selectedFile && <p>Selected file: {selectedFile.name}</p>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="api-key" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              ElevenLabs API Key:
            </label>
            <input
              type="password"
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                width: '300px'
              }}
            />
          </div>
          <button type="submit" disabled={!selectedFile || loadingModels || !apiKey || backendStatus !== 'online'}>
            {backendStatus !== 'online' ? 'Backend Offline' : 'Upload CSV'}
          </button>
        </form>
        {uploadStatus && <p>{uploadStatus}</p>}
        {columns.length > 0 && (
          <div>
            <strong>CSV Columns:</strong>
            <ul>
              {columns.map((col) => (
                <li key={col}>{col}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.length > 0 && (
          <div style={{ maxHeight: '400px', overflowY: 'auto', width: '100%' }}>
            <h2>Audio Generation Summary</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}>#</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}>Start Time</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}>End Time</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}>Voice ID</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}>Translation</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}># Alternatives</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px' }}>Audio Playback</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((line, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>{line.start_time}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>{line.end_time}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>{line.voice_id}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>{line.text}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>{line.num_audio_alternatives}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px' }}>
                      {line.audio_alternatives && line.audio_alternatives.map((audioBase64, altIdx) => (
                        <button
                          key={altIdx}
                          onClick={() => playAudio(audioBase64, idx, altIdx)}
                          style={{
                            margin: '2px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          Play Alt {altIdx + 1}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {playingAudio && (
              <div style={{ marginTop: '10px' }}>
                <button 
                  onClick={stopAudio}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Stop Audio
                </button>
              </div>
            )}
          </div>
        )}
        {/* Download Buttons at the bottom */}
        <div style={{ marginTop: '32px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={handleDownloadWAVs}
            disabled={downloadingWAVs || summary.length === 0 || backendStatus !== 'online'}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (downloadingWAVs || summary.length === 0 || backendStatus !== 'online') ? 'not-allowed' : 'pointer',
              opacity: (downloadingWAVs || summary.length === 0 || backendStatus !== 'online') ? 0.7 : 1
            }}
          >
            {downloadingWAVs ? 'Creating ZIP...' : backendStatus !== 'online' ? 'Backend Offline' : 'Download WAV Files (ZIP)'}
          </button>
          <button
            onClick={handleDownloadAAF}
            disabled={downloadingAAF || summary.length === 0 || backendStatus !== 'online'}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (downloadingAAF || summary.length === 0 || backendStatus !== 'online') ? 'not-allowed' : 'pointer',
              opacity: (downloadingAAF || summary.length === 0 || backendStatus !== 'online') ? 0.7 : 1
            }}
          >
            {downloadingAAF ? 'Generating AAF...' : backendStatus !== 'online' ? 'Backend Offline' : 'Download AAF'}
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
