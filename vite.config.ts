import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite configuration for phonica
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'openai-session-proxy',
      configureServer(server) {
        // Ephemeral token generation via OpenAI GA client_secrets endpoint
        server.middlewares.use('/api/openai/session', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const apiKey = req.headers['x-openai-key'] || data.apiKey;
              const model = (data.model && data.model !== 'gpt-live-1') ? data.model : 'gpt-4o-realtime-preview';
              const instructions = data.instructions || 'You are an expert polyglot pronunciation coach powered by GPT-Live.';

              if (!apiKey) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing OpenAI API Key' }));
                return;
              }

              // Try with requested model first
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

              // Fallback to gpt-4o-realtime-preview-2024-12-17 if model not recognized
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

              const result = await response.json();
              const formattedResult = {
                ...result,
                value: result.value || result.client_secret?.value,
                client_secret: result.client_secret || (result.value ? { value: result.value } : undefined)
              };

              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(formattedResult));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Internal proxy error' }));
            }
          });
        });

        // OpenAI GPT-Live Sessions Proxy (POST https://api.openai.com/v1/live/sessions)
        server.middlewares.use('/api/openai/live/sessions', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }

          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const authHeader = req.headers['authorization'];
              const apiKey = payload.apiKey || (typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : '') || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

              if (!apiKey) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing OpenAI API Key' }));
                return;
              }

              const livePayload = {
                session: {
                  model: payload.model || 'gpt-live-1',
                  instructions: payload.instructions || 'You are Vocalis, an elite polyglot pronunciation coach.',
                  ...(payload.delegation ? { delegation: payload.delegation } : {})
                },
                transport: {
                  type: 'webrtc',
                  sdp: payload.sdp
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

              const responseData = await response.json();
              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(responseData));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Proxy Live session failed' }));
            }
          });
        });

        // WebRTC SDP handshake proxy to https://api.openai.com/v1/realtime/calls
        server.middlewares.use('/api/openai/calls', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }

          let sdp = '';
          req.on('data', chunk => {
            sdp += chunk;
          });

          req.on('end', async () => {
            try {
              const authHeader = req.headers['authorization'];
              const response = await fetch('https://api.openai.com/v1/realtime/calls', {
                method: 'POST',
                headers: {
                  'Authorization': authHeader as string,
                  'Content-Type': 'application/sdp'
                },
                body: sdp
              });

              const answer = await response.text();
              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/sdp');
              res.end(answer);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(err?.message || 'Proxy SDP negotiation failed');
            }
          });
        });

        // OpenAI Audio Speech proxy for Hear Native LLM playback
        server.middlewares.use('/api/openai/speech', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }

          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const apiKey = req.headers['x-openai-key'] || data.apiKey;
              const input = data.input || '';
              const voice = data.voice || 'alloy';
              const speed = data.speed || 1.0;
              const model = data.model || 'tts-1';

              if (!apiKey || !input) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing apiKey or input text' }));
                return;
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
                res.statusCode = response.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(errText);
                return;
              }

              const arrayBuffer = await response.arrayBuffer();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'audio/mpeg');
              res.end(Buffer.from(arrayBuffer));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(err?.message || 'Speech generation proxy error');
            }
          });
        });

        // OpenAI Whisper Transcription & Acoustic Evaluation Proxy
        server.middlewares.use('/api/openai/transcribe', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }

          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const apiKey = req.headers['x-openai-key'] || data.apiKey;
              const { audioBase64, mimeType, targetWord, languageCode, ipa, syllables } = data;

              if (!apiKey || !audioBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing apiKey or audioBase64' }));
                return;
              }

              // Step 1: Send audio to Whisper API
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
                console.warn('Whisper API call failed, will evaluate with GPT fallback', await whisperRes.text());
              }

              // Step 2: Evaluate with gpt-4o-mini
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
                res.statusCode = evalRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(errDetail);
                return;
              }

              const evalData = await evalRes.json();
              const resultText = evalData.choices?.[0]?.message?.content || '{}';
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(resultText);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'OpenAI transcribe evaluation failed' }));
            }
          });
        });
      }
    }
  ],
  server: {
    port: 5180,
    strictPort: true,
    host: true
  }
});
