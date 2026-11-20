/**
 * Voice Input Service
 * Uses browser Web Speech API (if available) with graceful fallback to manual text input.
 * Dispatches text to backend POST /voice/parse for rule-based vernacular parsing.
 * MANDATORY: AI output is strictly a DRAFT and requires human confirmation before saving.
 */

import { Api } from '../api.js';

export const VoiceService = {
  isSpeechSupported() {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  },

  createRecognizer(onTranscript, onError) {
    if (!this.isSpeechSupported()) {
      return null;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognizer = new SpeechRecognition();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = 'hi-IN'; // Default to vernacular Hindi/English

    recognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognizer.onerror = (event) => {
      onError(event.error);
    };

    return recognizer;
  },

  /**
   * Parse spoken text using backend AI voice service
   * Returns structured draft: { intent, weight_g, karat, karigar, article, due_date, missing_fields, ambiguities }
   */
  async parseVoiceText(text, language = 'auto') {
    if (!text || !text.trim()) {
      throw new Error('Please speak or type a transaction sentence first.');
    }
    const result = await Api.parseVoice(text.trim(), language);
    return result;
  },
};
