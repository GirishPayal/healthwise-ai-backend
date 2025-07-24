// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

const upload = multer({ dest: '/tmp/' });
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Healthwise AI Backend Running!'));

app.post('/ask', upload.single('audio'), async (req, res) => {
  try {
    // 1) Whisper STT
    const audioPath = req.file.path;
    const whisperResp = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      fs.createReadStream(audioPath),
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'audio/mpeg'
        },
        params: { model: 'whisper-1' }
      }
    );
    const userText = whisperResp.data.text;

    // 2) Assistant API
    const assistResp = await axios.post(
      `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/runs`,
      { user_input: userText },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    const assistantText = assistResp.data.choices[0].message.content;

    // 3) ElevenLabs TTS (placeholder)
    const ttsResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      { text: assistantText },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    const outPath = '/tmp/output.mp3';
    fs.writeFileSync(outPath, Buffer.from(ttsResp.data), 'binary');

    res.set('Content-Type', 'audio/mpeg');
    res.sendFile(outPath, () => {
      fs.unlinkSync(audioPath);
      fs.unlinkSync(outPath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
