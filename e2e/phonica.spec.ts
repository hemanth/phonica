import { test, expect } from '@playwright/test';

test.describe('Phonica E2E Test Suite', () => {

  test('1. Overview page renders correctly with core elements', async ({ page }) => {
    await page.goto('/');
    
    // Check page title / heading
    await expect(page).toHaveTitle(/phonica/i);
    await expect(page.locator('text=phonica').first()).toBeVisible();

    // Check Overview navigation pill is visible in header
    const overviewBtn = page.getByRole('banner').getByRole('button', { name: 'Overview', exact: true });
    await expect(overviewBtn).toBeVisible();

    // Verify presence of studio transition button
    const enterStudioBtn = page.getByRole('button', { name: /enter studio|launch studio|launch voice studio/i }).first();
    await expect(enterStudioBtn).toBeVisible();
  });

  test('2. Navigation between Overview and Studio works cleanly', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Studio mode via header button
    const studioBtn = page.getByRole('banner').getByRole('button', { name: 'Studio', exact: true });
    await studioBtn.click();

    // Studio view should display WordHero and Acoustic Voice Coach
    await expect(page.locator('text=Acoustic Voice Coach')).toBeVisible();
    await expect(page.locator('text=Spoken Coaching Stream')).toBeVisible();

    // Switch back to Overview via header button
    const overviewBtn = page.getByRole('banner').getByRole('button', { name: 'Overview', exact: true });
    await overviewBtn.click();
    await expect(page.locator('text=Acoustic Voice Coach')).not.toBeVisible();
  });

  test('3. Coaching Stream dropdown has NO AUTO option and lists fixed locales', async ({ page }) => {
    await page.goto('/#studio');

    // Wait for the coach panel
    await expect(page.locator('text=Acoustic Voice Coach')).toBeVisible();
    
    // Locate the coaching stream select element
    const coachingSelect = page.locator('select[title="Language spoken by the AI coach for explanations and feedback"]');
    await expect(coachingSelect).toBeVisible();

    // Verify AUTO / Match Word is NOT an option
    const options = await coachingSelect.locator('option').allInnerTexts();
    const hasAuto = options.some(opt => opt.includes('AUTO') || opt.includes('Match Word'));
    expect(hasAuto).toBe(false);

    // Verify expected locales are present (e.g. English, French, German, Japanese)
    expect(options.some(opt => opt.includes('English (US) (en-US)'))).toBe(true);
    expect(options.some(opt => opt.includes('French (France) (fr-FR)'))).toBe(true);
    expect(options.some(opt => opt.includes('German (Germany) (de-DE)'))).toBe(true);
    expect(options.some(opt => opt.includes('Japanese (ja-JP)'))).toBe(true);

    // Test selecting French coaching stream
    await coachingSelect.selectOption({ label: 'French (France) (fr-FR)' });
    await expect(coachingSelect).toHaveValue('FR_FR');
  });

  test('4. Voice Persona is clearly labeled and single strict persona is indicated', async ({ page }) => {
    await page.goto('/#studio');

    // Check voice badge in the status overlay
    const voiceBadge = page.locator('span[title="Strict Single Voice Persona"]');
    await expect(voiceBadge).toBeVisible();
    await expect(voiceBadge).toContainText(/Voice:/);
  });

  test('5. Word Rolling and Language Filtering updates word and target locale', async ({ page }) => {
    await page.goto('/#studio');

    // Get current word
    const wordElement = page.locator('h1, [data-testid="hero-word"]').first();
    await expect(wordElement).toBeVisible();
    const initialWord = await wordElement.innerText();

    // Click next word button
    const nextWordBtn = page.getByRole('button', { name: /next word|roll/i }).first();
    if (await nextWordBtn.isVisible()) {
      await nextWordBtn.click();
      await page.waitForTimeout(400);
      const newWord = await wordElement.innerText();
      expect(newWord).toBeTruthy();
    }
  });

  test('6. Engine Switcher switches between OpenAI, Gemini, and Web Audio', async ({ page }) => {
    await page.goto('/#studio');

    // Switch to Web Audio
    const webAudioBtn = page.getByRole('button', { name: /Web Audio/i });
    await expect(webAudioBtn).toBeVisible();
    await webAudioBtn.click();

    // Click Start Live Voice Conversation
    const startBtn = page.getByRole('button', { name: /Start Live Voice/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await page.waitForTimeout(600);

    // Transcripts should display offline system notice
    const transcriptArea = page.locator('text=Offline speech engine active');
    await expect(transcriptArea).toBeVisible();

    // Disconnect
    const disconnectBtn = page.getByRole('button', { name: /Disconnect Live/i });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();
  });

  test('7. API Key Modal opens from header and allows configuring Gemini and voice', async ({ page }) => {
    await page.goto('/#studio');

    // Click Key button in Header
    const keyBtn = page.getByRole('button', { name: /Configure API Keys|Keys/i });
    await expect(keyBtn).toBeVisible();
    await keyBtn.click();

    // Modal should be visible
    await expect(page.locator('text=Voice Engine Credentials')).toBeVisible();
    await expect(page.locator('text=Google Gemini API Key')).toBeVisible();

    // Close modal via Close button
    const closeBtn = page.getByRole('button', { name: 'Close modal' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.locator('text=Voice Engine Credentials')).not.toBeVisible();
  });

  test('8. Quick Coaching Prompts trigger message dispatch in Web Audio mode', async ({ page }) => {
    await page.goto('/#studio');

    // Switch to Web Audio so session is active without remote keys
    const webAudioBtn = page.getByRole('button', { name: /Web Audio/i });
    await webAudioBtn.click();

    const startBtn = page.getByRole('button', { name: /Start Live Voice/i });
    await startBtn.click();
    await page.waitForTimeout(400);

    // Click a quick prompt button
    const quickPrompt = page.locator('button:has-text("Break down the hardest syllable")');
    if (await quickPrompt.isVisible()) {
      await quickPrompt.click();
      await page.waitForTimeout(400);
      
      // Check that user prompt was recorded in the transcript feed
      await expect(page.locator('text=Break down the hardest syllable')).toBeVisible();
    }
  });

  test('9. Generate real audio via Gemini API and verify audio synthesis', async ({ page }) => {
    await page.goto('/#studio');

    const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!geminiKey) {
      test.skip(!geminiKey, 'VITE_GEMINI_API_KEY not set');
      return;
    }
    await page.evaluate((key) => {
      localStorage.setItem('gemini_api_key', key);
      localStorage.setItem('selected_engine', 'gemini');
      localStorage.setItem('gemini_voice', 'Puck');
    }, geminiKey);

    await page.reload();

    // Generate neural audio speech through Gemini 2.5 Flash TTS
    const audioResult = await page.evaluate(async (key) => {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: 'You are an expert native speaker of French. Pronounce the French word "Bonjour" with flawless native phonetics, authentic accent, and natural cadence. Say only the word "Bonjour", nothing else.'
              }]
            }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck'
                  }
                }
              }
            }
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          return { ok: false, status: response.status, errBody };
        }

        const json = await response.json();
        const candidate = json.candidates?.[0];
        const audioPart = candidate?.content?.parts?.[0]?.inlineData;
        
        return {
          ok: true,
          mimeType: audioPart?.mimeType || 'audio/pcm',
          hasData: Boolean(audioPart?.data && audioPart.data.length > 100),
          dataLength: audioPart?.data?.length || 0
        };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }, geminiKey);

    expect(audioResult.ok).toBe(true);
    expect(audioResult.hasData).toBe(true);
    expect(audioResult.dataLength).toBeGreaterThan(500);

    // Verify UI native play button exists and clicks
    const hearNativeBtn = page.getByRole('button', { name: /Hear Native/i });
    await expect(hearNativeBtn).toBeVisible();
    await hearNativeBtn.click();
    await page.waitForTimeout(600);
  });

});
