/**
 * Scale Photo OCR Service
 * Submits weighing scale display photos to backend POST /scale-photos.
 * Receives LCD reading, compares with manual weight, and validates match.
 * MANDATORY: AI reading is assistive only; human operator retains final authority.
 */

import { Api } from '../api.js';

export const OcrService = {
  async processScalePhoto(transactionId, enteredWeight, file) {
    if (!file) {
      throw new Error('Please select an image file first.');
    }
    if (!enteredWeight) {
      throw new Error('Please enter the manual weight to compare against the photo.');
    }

    const result = await Api.uploadScalePhoto(transactionId, enteredWeight, file);
    return {
      evidenceId: result.evidence_id ?? result.evidenceId ?? null,
      ocrReadingG: result.ocr_reading_g ?? result.ocrReadingG ?? null,
      enteredG: result.entered_g ?? result.enteredG ?? null,
      status: result.status || 'UNREADABLE', // "MATCH", "MISMATCH", "UNREADABLE"
      needsManualConfirm: !!(result.needs_manual_confirm ?? result.needsManualConfirm),
      disclaimer: result.disclaimer || 'OCR reading is assistive evidence only.',
      confidence: result.confidence ?? result.ocr_confidence ?? null,
      raw: result,
    };
  },
};
