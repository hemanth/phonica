import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5180;

app.use(cors());
app.use(express.json());

// OpenAI Realtime Session Ephemeral Token Proxy (OpenAI GA endpoint)
app.post('/api/openai/session', async (req, res) => {
  try {
    const apiKey = req.headers['x-openai-key'] || req.body.apiKey || process.env.OPENAI_API_KEY;
    const model = (req.body.model && req.body.model !== 'gpt-live-1') ? req.body.model : 'gpt-4o-realtime-preview';
    const instructions = req.body.instructions || 'You are an expert polyglot pronunciation coach powered by GPT-Live.';

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing OpenAI API Key' });
    }

    let response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model,
          instructions
        }
      })
    });

    if (!response.ok && model !== 'gpt-4o-realtime-preview-2024-12-17') {
      response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: 'gpt-4o-realtime-preview-2024-12-17',
            instructions
          }
        })
      });
    }

    const data = await response.json();
    const formattedResult = {
      ...data,
      value: data.value || data.client_secret?.value,
      client_secret: data.client_secret || (data.value ? { value: data.value } : undefined)
    };

    return res.status(response.status).json(formattedResult);
  } catch (err) {
    console.error('OpenAI session error', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// OpenAI GPT-Live Sessions Proxy (POST https://api.openai.com/v1/live/sessions)
app.post('/api/openai/live/sessions', async (req, res) => {
  try {
    const apiKey = req.headers['x-openai-key'] || req.body.apiKey || (req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '') : '') || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing OpenAI API Key' });
    }

    const livePayload = {
      session: {
        model: req.body.model || 'gpt-live-1',
        instructions: req.body.instructions || 'You are Vocalis, an elite polyglot pronunciation coach.',
        ...(req.body.delegation ? { delegation: req.body.delegation } : {})
      },
      transport: {
        type: 'webrtc',
        sdp: req.body.sdp
      }
    };

    const response = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(livePayload)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('OpenAI live session proxy error', err);
    return res.status(500).json({ error: err.message || 'Proxy Live session failed' });
  }
});

// OpenAI Realtime WebRTC Calls SDP Proxy
app.post('/api/openai/calls', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/sdp'
      },
      body: req.body
    });

    const answer = await response.text();
    res.status(response.status).type('application/sdp').send(answer);
  } catch (err) {
    console.error('OpenAI calls proxy error', err);
    res.status(500).send(err.message || 'SDP negotiation failed');
  }
});

// OpenAI Audio Speech Proxy for Hear Native LLM playback
app.post('/api/openai/speech', async (req, res) => {
  try {
    const apiKey = req.headers['x-openai-key'] || req.body.apiKey || process.env.OPENAI_API_KEY;
    const input = req.body.input || '';
    const voice = req.body.voice || 'alloy';
    const speed = req.body.speed || 1.0;
    const model = req.body.model || 'tts-1';

    if (!apiKey || !input) {
      return res.status(400).json({ error: 'Missing apiKey or input text' });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input,
        voice,
        speed
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    const arrayBuffer = await response.arrayBuffer();
    res.type('audio/mpeg').send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('OpenAI speech error', err);
    res.status(500).send(err.message || 'Speech generation failed');
  }
});

// OpenAI Whisper Transcription & Acoustic Evaluation Proxy
app.post('/api/openai/transcribe', async (req, res) => {
  try {
    const apiKey = req.headers['x-openai-key'] || req.body.apiKey || process.env.OPENAI_API_KEY;
    const { audioBase64, mimeType, targetWord, languageCode, ipa, syllables } = req.body;

    if (!apiKey || !audioBase64) {
      return res.status(400).json({ error: 'Missing apiKey or audioBase64' });
    }

    // Send audio to Whisper API
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const fileBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', fileBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    if (languageCode) {
      const langPrefix = languageCode.split('-')[0].toLowerCase();
      formData.append('language', langPrefix);
    }
    if (targetWord) {
      formData.append('prompt', `Pronouncing: ${targetWord}`);
    }

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    let heardText = targetWord;
    if (whisperRes.ok) {
      const whisperData = await whisperRes.json();
      heardText = whisperData.text?.trim() || targetWord;
    } else {
      console.warn('Whisper API error, will proceed to GPT fallback');
    }

    // Evaluate with gpt-4o-mini
    const evalRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an elite polyglot acoustic phonetics evaluator. Analyze the user pronunciation transcribed verbatim by Whisper.'
          },
          {
            role: 'user',
            content: `Target Word: "${targetWord}"
Language: ${languageCode}
Target IPA: ${ipa}
Target Syllables: ${JSON.stringify(syllables || [])}
Verbatim Spoken Audio Transcribed by Whisper: "${heardText}"

Assess the phonological match.
Respond ONLY with a JSON object in this exact schema:
{
  "score": number (0 to 100),
  "heardText": "${heardText}",
  "syllableEvaluation": [
    { "syllable": "string", "correct": boolean }
  ],
  "feedback": "string (concise summary of acoustic accuracy)",
  "accentNote": "string (precise anatomical tongue/lip placement advice for this specific word)"
}`
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!evalRes.ok) {
      const errDetail = await evalRes.text();
      return res.status(evalRes.status).send(errDetail);
    }

    const evalData = await evalRes.json();
    const resultText = evalData.choices?.[0]?.message?.content || '{}';
    res.type('application/json').send(resultText);
  } catch (err) {
    console.error('OpenAI transcribe error', err);
    res.status(500).json({ error: err.message || 'Transcription evaluation failed' });
  }
});

// If dist folder exists, serve static assets
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res, next) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

if (process.env.NODE_ENV === 'production') {
  app.listen(PORT, () => {
    console.log(`Lingua Phonica server listening on port ${PORT}`);
  });
}

export default app;
