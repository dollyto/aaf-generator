from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from io import BytesIO
import requests
import base64
import tempfile
import os
import aaf2
import wave
import struct
import zipfile

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_b06c8ec344c2b671e4eb4dbf9067512dd1c9114713e6e254")
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

# Store last processed summary for MVP
last_processed_summary = []

def generate_elevenlabs_audio(text, voice_id, model_id="eleven_multilingual_v2"):
    url = ELEVENLABS_TTS_URL.format(voice_id=voice_id)
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/wav"
    }
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    # Use pcm_48000 format (raw PCM data at 48kHz)
    url_with_format = f"{url}?output_format=pcm_48000"
    
    response = requests.post(url_with_format, headers=headers, json=payload)
    if response.status_code == 200:
        # Check what format we actually got
        content_type = response.headers.get('content-type', '')
        print(f"Eleven Labs response content-type: {content_type}")
        print(f"Response content length: {len(response.content)} bytes")
        if len(response.content) > 16:
            print(f"Response header bytes: {response.content[:16].hex()}")
            # Check if it starts with RIFF (WAV header)
            if response.content[:4] == b'RIFF':
                print("✓ Valid WAV file detected (RIFF header)")
            else:
                print("✗ Raw PCM data detected (will convert to WAV)")
        return response.content
    else:
        print(f"Eleven Labs API error: {response.status_code} - {response.text}")
        return None

def generate_elevenlabs_audio_with_speed(text, voice_id, speed_factor=1.0, model_id="eleven_multilingual_v2"):
    """Generate Eleven Labs audio with speed adjustment"""
    url = ELEVENLABS_TTS_URL.format(voice_id=voice_id)
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/wav"
    }
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    # Add speed parameter if not 1.0
    if speed_factor != 1.0:
        payload["voice_settings"]["speed"] = speed_factor
        print(f"  Using speed factor: {speed_factor}")
    
    # Use pcm_48000 format (raw PCM data at 48kHz)
    url_with_format = f"{url}?output_format=pcm_48000"
    
    response = requests.post(url_with_format, headers=headers, json=payload)
    if response.status_code == 200:
        # Check what format we actually got
        content_type = response.headers.get('content-type', '')
        print(f"Eleven Labs response content-type: {content_type}")
        print(f"Response content length: {len(response.content)} bytes")
        if len(response.content) > 16:
            print(f"Response header bytes: {response.content[:16].hex()}")
            # Check if it starts with RIFF (WAV header)
            if response.content[:4] == b'RIFF':
                print("✓ Valid WAV file detected (RIFF header)")
            else:
                print("✗ Raw PCM data detected (will convert to WAV)")
        return response.content
    else:
        print(f"Eleven Labs API error: {response.status_code} - {response.text}")
        return None

def create_wav_file(pcm_data, sample_rate=48000, channels=1, sample_width=2):
    """Create a proper WAV file from PCM data"""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_wav:
        with wave.open(temp_wav.name, 'wb') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_data)
        return temp_wav.name

def analyze_audio_duration(audio_data):
    """Analyze the actual duration of a WAV file"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_wav:
            temp_wav.write(audio_data)
            temp_wav.flush()
            
            with wave.open(temp_wav.name, 'rb') as wav_file:
                frames = wav_file.getnframes()
                sample_rate = wav_file.getframerate()
                duration = frames / sample_rate
                
            os.unlink(temp_wav.name)
            return duration
    except Exception as e:
        print(f"Error analyzing audio duration: {e}")
        return None

def adjust_audio_speed(audio_data, target_duration, original_duration):
    """Adjust audio speed to match target duration"""
    try:
        # Calculate speed factor
        speed_factor = original_duration / target_duration
        
        # For now, we'll just return the original audio with a warning
        # In a full implementation, you could use libraries like pydub or librosa
        # to actually change the playback speed
        print(f"Speed adjustment needed: factor={speed_factor:.3f} (original={original_duration:.2f}s, target={target_duration:.2f}s)")
        
        if speed_factor > 1.15 or speed_factor < 0.85:
            print(f"⚠️  Large speed adjustment needed - audio may sound unnatural")
        elif speed_factor > 1.1 or speed_factor < 0.9:
            print(f"⚠️  Moderate speed adjustment needed")
        else:
            print(f"✓ Speed adjustment within acceptable range")
            
        return audio_data, speed_factor
    except Exception as e:
        print(f"Error adjusting audio speed: {e}")
        return audio_data, 1.0

def regenerate_audio_with_adjusted_speed(text, voice_id, expected_duration, max_attempts=3, model_id="eleven_multilingual_v2"):
    """Regenerate audio with speed adjustment to match expected duration"""
    print(f"  Regenerating audio with speed adjustment for target duration: {expected_duration:.2f}s")
    
    for attempt in range(max_attempts):
        if attempt == 0:
            # First attempt: try original speed
            audio = generate_elevenlabs_audio(text, voice_id, model_id)
        else:
            # Subsequent attempts: adjust speed based on previous result
            audio = generate_elevenlabs_audio_with_speed(text, voice_id, speed_factor, model_id)
        
        if not audio:
            print(f"  Failed to generate audio on attempt {attempt + 1}")
            continue
        
        # Convert to WAV if needed
        if audio[:4] == b'RIFF':
            wav_data = audio
        else:
            wav_path = create_wav_file(audio)
            with open(wav_path, 'rb') as wav_file:
                wav_data = wav_file.read()
            os.unlink(wav_path)
        
        # Analyze actual duration
        actual_duration = analyze_audio_duration(wav_data)
        if not actual_duration:
            print(f"  Failed to analyze duration on attempt {attempt + 1}")
            continue
        
        duration_diff = actual_duration - expected_duration
        duration_percent = (duration_diff / expected_duration) * 100
        
        print(f"  Attempt {attempt + 1}: Expected={expected_duration:.2f}s, Actual={actual_duration:.2f}s, Diff={duration_diff:+.2f}s ({duration_percent:+.1f}%)")
        
        # Check if duration is acceptable (within 10%)
        if abs(duration_percent) <= 10:
            print(f"  ✓ Duration within acceptable range after {attempt + 1} attempts")
            return wav_data, actual_duration, 1.0 if attempt == 0 else speed_factor
        
        # Calculate speed factor for next attempt
        if attempt < max_attempts - 1:
            speed_factor = actual_duration / expected_duration
            # Clamp speed factor to Eleven Labs range (0.7x to 1.2x)
            speed_factor = max(0.7, min(1.2, speed_factor))
            print(f"  Will try speed factor {speed_factor:.3f} on next attempt")
    
    # If all attempts failed, return the last generated audio
    print(f"  ⚠️  Could not achieve target duration after {max_attempts} attempts, using last result")
    return wav_data, actual_duration, speed_factor

@app.post("/upload-csv/")
async def upload_csv(file: UploadFile = File(...), model_id: str = "eleven_multilingual_v2"):
    global last_processed_summary
    contents = await file.read()
    df = pd.read_csv(BytesIO(contents))
    processed = []
    for idx, row in df.iterrows():
        text = str(row.get("translation", ""))
        voice_id = str(row.get("Voice ID", ""))
        start_time = str(row.get("start_time", ""))
        end_time = str(row.get("end_time", ""))
        if not text or not voice_id:
            continue
        audio_alternatives = []
        duration_analysis = []
        
        # Calculate expected duration from timecodes
        expected_duration = parse_timecode(end_time) - parse_timecode(start_time)
        
        for i in range(3):
            print(f"Generating audio for line {idx}, alternative {i}")
            
            # Use the new regeneration function that handles speed adjustment
            wav_data, actual_duration, final_speed_factor = regenerate_audio_with_adjusted_speed(
                text, voice_id, expected_duration, model_id=model_id
            )
            
            if wav_data:
                duration_diff = actual_duration - expected_duration
                duration_percent = (duration_diff / expected_duration) * 100
                
                print(f"Line {idx}, Alt {i}: Expected={expected_duration:.2f}s, Actual={actual_duration:.2f}s, Diff={duration_diff:+.2f}s ({duration_percent:+.1f}%)")
                
                duration_analysis.append({
                    "alternative": i,
                    "expected_duration": expected_duration,
                    "actual_duration": actual_duration,
                    "difference": duration_diff,
                    "percent_difference": duration_percent,
                    "speed_factor": final_speed_factor,
                    "regenerated": final_speed_factor != 1.0
                })
                
                audio_b64 = base64.b64encode(wav_data).decode('utf-8')
                audio_alternatives.append(audio_b64)
            else:
                print(f"Failed to generate audio for line {idx}, alternative {i}")
                # Add placeholder for failed generation
                duration_analysis.append({
                    "alternative": i,
                    "expected_duration": expected_duration,
                    "actual_duration": 0.0,
                    "difference": -expected_duration,
                    "percent_difference": -100.0,
                    "speed_factor": 1.0,
                    "regenerated": False,
                    "failed": True
                })
                audio_alternatives.append("")  # Empty string for failed generation
        processed.append({
            "start_time": start_time,
            "end_time": end_time,
            "voice_id": voice_id,
            "text": text,
            "num_audio_alternatives": len(audio_alternatives),
            "audio_alternatives": audio_alternatives,
            "duration_analysis": duration_analysis
        })
    last_processed_summary = processed
    return {
        "message": f"Processed {len(processed)} lines.",
        "lines": len(processed),
        "summary": processed  # Include all data including audio_alternatives
    }

def parse_timecode(tc):
    # Supports hh:mm:ss:ff or hh:mm:ss.000
    if ":" in tc:
        parts = tc.split(":")
        if len(parts) == 4:  # hh:mm:ss:ff
            h, m, s, f = parts
            return int(h) * 3600 + int(m) * 60 + int(s) + int(f) / 24.0
        elif len(parts) == 3:
            s = parts[2]
            if "." in s:
                s, ms = s.split(".")
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(s) + int(ms) / 1000.0
            else:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return 0.0

@app.get("/generate-aaf/")
def generate_aaf():
    global last_processed_summary
    if not last_processed_summary:
        return {"error": "No processed data available. Please upload a CSV first."}
    
    try:
        # Create temp dir for audio files
        with tempfile.TemporaryDirectory() as tmpdir:
            print(f"Created temp directory: {tmpdir}")
            
            # Write audio files to disk and collect their paths
            audio_paths = []
            for idx, item in enumerate(last_processed_summary):
                for alt_idx, audio_b64 in enumerate(item["audio_alternatives"]):
                    audio_path = os.path.join(tmpdir, f"line{idx}_alt{alt_idx}.wav")
                    with open(audio_path, "wb") as f:
                        f.write(base64.b64decode(audio_b64))
                    audio_paths.append((idx, alt_idx, audio_path, item))
                    print(f"Saved audio file: {audio_path}")
            
            print(f"Total audio files saved: {len(audio_paths)}")
            
            # Create AAF file
            aaf_path = os.path.join(tmpdir, "output.aaf")
            print(f"Creating AAF file: {aaf_path}")
            
            with aaf2.open(aaf_path, "w") as f:
                # Create a MasterMob (like in aaf_embed_media_tool.py)
                mastermob = f.create.MasterMob("Audio Export")
                f.content.mobs.append(mastermob)
                print("Created master mob")
                
                # Create a CompositionMob for the timeline
                compmob = f.create.CompositionMob("Audio Timeline")
                compmob.usage = 'Usage_Template'
                f.content.mobs.append(compmob)
                print("Created composition mob")
                
                # Set edit rate to 48kHz (audio sample rate)
                edit_rate = 48000
                
                # Create audio slots in the composition mob
                # We'll create 6 tracks (2 tracks per alternative)
                audio_slots = []
                for i in range(6):
                    slot = compmob.create_sound_slot(edit_rate=edit_rate)
                    audio_slots.append(slot)
                    print(f"Created audio slot {i}")
                
                # Group audio files by track and sort by start time
                track_clips = {}
                for idx, alt_idx, audio_path, item in audio_paths:
                    track_num = alt_idx * 2 + (idx % 2)
                    if track_num not in track_clips:
                        track_clips[track_num] = []
                    track_clips[track_num].append((idx, alt_idx, audio_path, item))
                
                # Sort clips on each track by start time
                for track_num in track_clips:
                    track_clips[track_num].sort(key=lambda x: parse_timecode(x[3]["start_time"]))
                
                # Import audio files and create source clips with proper timing
                for track_num, clips in track_clips.items():
                    if track_num >= len(audio_slots):
                        continue
                    
                    comp_slot = audio_slots[track_num]
                    sequence = comp_slot.segment
                    current_time = 0
                    
                    for idx, alt_idx, audio_path, item in clips:
                        try:
                            print(f"Importing audio {idx}_{alt_idx}: {audio_path}")
                            
                            # Import the audio essence into the master mob
                            master_slot = mastermob.import_audio_essence(audio_path, edit_rate=edit_rate)
                            print(f"Successfully imported audio {idx}_{alt_idx} into master mob")
                            
                            # Calculate timing
                            start_time = parse_timecode(item["start_time"])
                            end_time = parse_timecode(item["end_time"])
                            duration = max(0.1, end_time - start_time)
                            
                            print(f"Processing audio {idx}_{alt_idx}: start={start_time}s, end={end_time}s, duration={duration}s")
                            print(f"  Adding to track {track_num} at position {start_time}s")
                            
                            # Add filler if needed to reach the start time
                            if start_time > current_time:
                                filler_duration = start_time - current_time
                                filler = f.create.Filler(media_kind='sound', length=int(filler_duration * edit_rate))
                                sequence.components.append(filler)
                                current_time += filler_duration
                                print(f"  Added filler: {filler_duration}s")
                            
                            # Create a source clip that references the master mob
                            source_clip = mastermob.create_source_clip(
                                slot_id=master_slot.slot_id,
                                start=0,  # Start from beginning of source
                                length=int(duration * edit_rate),  # Convert to samples
                                media_kind='sound'
                            )
                            
                            # Add the source clip to the composition timeline
                            sequence.components.append(source_clip)
                            current_time += duration
                            
                            print(f"✓ Added audio {idx}_{alt_idx} to track {track_num} (start: {start_time}s, duration: {duration}s)")
                            
                        except Exception as e:
                            print(f"Failed to import audio {audio_path}: {e}")
                            continue
                
                # Print summary
                print(f"\nAAF Timeline Summary:")
                for i, slot in enumerate(audio_slots):
                    sequence = slot.segment
                    clip_count = len(sequence.components) if hasattr(sequence, 'components') else 0
                    print(f"  Track {i}: {clip_count} clips")
                    if clip_count > 0:
                        for j, clip in enumerate(sequence.components):
                            print(f"    Clip {j}: length={clip.length} samples")
            
            print(f"AAF file created successfully: {aaf_path}")
            
            # Read AAF file and return as response
            with open(aaf_path, "rb") as f_aaf:
                aaf_bytes = f_aaf.read()
                print(f"AAF file size: {len(aaf_bytes)} bytes")
            
            return Response(aaf_bytes, media_type="application/octet-stream", headers={
                "Content-Disposition": "attachment; filename=output.aaf"
            })
    
    except Exception as e:
        print(f"Error generating AAF: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to generate AAF: {str(e)}"}

@app.get("/download-wavs/")
def download_wavs():
    global last_processed_summary
    if not last_processed_summary:
        return {"error": "No processed data available. Please upload a CSV first."}
    
    try:
        # Create a temporary zip file in memory
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add each WAV file to the zip
            for idx, item in enumerate(last_processed_summary):
                for alt_idx, audio_b64 in enumerate(item["audio_alternatives"]):
                    # Decode the base64 audio data
                    audio_data = base64.b64decode(audio_b64)
                    
                    # Create filename with metadata
                    filename = f"line{idx}_alt{alt_idx}_start{item['start_time']}_end{item['end_time']}.wav"
                    
                    # Add to zip
                    zip_file.writestr(filename, audio_data)
                    print(f"Added to zip: {filename}")
        
        # Get the zip data
        zip_buffer.seek(0)
        zip_data = zip_buffer.getvalue()
        
        print(f"Created zip file with {len(last_processed_summary) * 3} WAV files")
        
        return Response(
            zip_data, 
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=audio_files.zip"
            }
        )
    
    except Exception as e:
        print(f"Error creating zip file: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to create zip file: {str(e)}"}

@app.get("/models/")
def get_available_models():
    """Get list of available ElevenLabs models"""
    models = [
        {"id": "eleven_multilingual_v2", "name": "Eleven Multilingual v2", "description": "High quality multilingual model (29 languages)"},
        {"id": "eleven_flash_v2_5", "name": "Eleven Flash v2.5", "description": "Fastest model with ultra-low latency (32 languages)"},
        {"id": "eleven_turbo_v2_5", "name": "Eleven Turbo v2.5", "description": "Balanced quality and speed (32 languages)"},
        {"id": "eleven_flash_v2", "name": "Eleven Flash v2", "description": "Fast English-only model"},
        {"id": "eleven_turbo_v2", "name": "Eleven Turbo v2", "description": "Balanced English-only model"},
        {"id": "eleven_monolingual_v1", "name": "Eleven English v1", "description": "Legacy English model"}
    ]
    return {"models": models}

@app.get("/duration-analysis/")
def get_duration_analysis():
    global last_processed_summary
    if not last_processed_summary:
        return {"error": "No processed data available. Please upload a CSV first."}
    
    analysis_summary = []
    total_alternatives = 0
    adjusted_alternatives = 0
    
    for idx, item in enumerate(last_processed_summary):
        if "duration_analysis" in item:
            for alt_analysis in item["duration_analysis"]:
                total_alternatives += 1
                if alt_analysis.get("speed_factor", 1.0) != 1.0:
                    adjusted_alternatives += 1
                
                analysis_summary.append({
                    "line": idx + 1,
                    "alternative": alt_analysis["alternative"] + 1,
                    "text": item["text"][:50] + "..." if len(item["text"]) > 50 else item["text"],
                    "expected_duration": round(alt_analysis["expected_duration"], 2),
                    "actual_duration": round(alt_analysis["actual_duration"], 2),
                    "difference": round(alt_analysis["difference"], 2),
                    "percent_difference": round(alt_analysis["percent_difference"], 1),
                    "speed_factor": round(alt_analysis.get("speed_factor", 1.0), 3),
                    "regenerated": alt_analysis.get("regenerated", False),
                    "failed": alt_analysis.get("failed", False)
                })
    
    return {
        "summary": {
            "total_alternatives": total_alternatives,
            "adjusted_alternatives": adjusted_alternatives,
            "adjustment_percentage": round((adjusted_alternatives / total_alternatives * 100) if total_alternatives > 0 else 0, 1)
        },
        "details": analysis_summary
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 