import React, { useState } from 'react';
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
  const [backendStatus, setBackendStatus] = useState('checking');

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setUploadStatus('');
    setColumns([]);
    setSummary([]);
  };

  // Load available models on component mount
  React.useEffect(() => {
    const loadModels = async () => {
      setLoadingModels(true);
      setBackendStatus('checking');
      try {
        const response = await fetch(`${API_BASE_URL}/models/`);
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
          console.error('Backend responded with error:', response.status);
        }
      } catch (error) {
        setBackendStatus('error');
        console.error('Failed to connect to backend:', error);
      }
      setLoadingModels(false);
    };
    loadModels();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
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
      setUploadStatus('Upload failed.');
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>AAF Generator MVP</h1>
        
        {/* Backend Connection Status */}
        <div style={{ 
          marginBottom: '16px', 
          padding: '8px', 
          borderRadius: '4px',
          backgroundColor: backendStatus === 'connected' ? '#d4edda' : 
                         backendStatus === 'error' ? '#f8d7da' : '#fff3cd',
          color: backendStatus === 'connected' ? '#155724' : 
                backendStatus === 'error' ? '#721c24' : '#856404',
          border: `1px solid ${backendStatus === 'connected' ? '#c3e6cb' : 
                              backendStatus === 'error' ? '#f5c6cb' : '#ffeaa7'}`
        }}>
          <strong>Backend Status:</strong> {
            backendStatus === 'connected' ? '✅ Connected' :
            backendStatus === 'error' ? '❌ Connection Failed' :
            '⏳ Checking...'
          }
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
          <button type="submit" disabled={!selectedFile || loadingModels}>
            Upload CSV
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
            disabled={downloadingWAVs || summary.length === 0}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (downloadingWAVs || summary.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (downloadingWAVs || summary.length === 0) ? 0.7 : 1
            }}
          >
            {downloadingWAVs ? 'Creating ZIP...' : 'Download WAV Files (ZIP)'}
          </button>
          <button
            onClick={handleDownloadAAF}
            disabled={downloadingAAF || summary.length === 0}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (downloadingAAF || summary.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (downloadingAAF || summary.length === 0) ? 0.7 : 1
            }}
          >
            {downloadingAAF ? 'Generating AAF...' : 'Download AAF'}
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
