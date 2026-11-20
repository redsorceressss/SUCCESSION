/**
 * Client-Side Precision Validators
 * Matches backend Pydantic schema validation exactly.
 * IMPORTANT: NEVER use JavaScript binary floating point for gold weights!
 * Always validate as string and perform decimal string checks.
 */

export const Validators = {
  /**
   * Validates positive gold weight string: gt 0, max 12 digits total, max 4 decimal places
   */
  isValidWeight(val) {
    if (typeof val !== 'string' && typeof val !== 'number') return false;
    const s = String(val).trim();
    if (!s) return false;

    // Pattern: 1 or more digits, optional decimal point and 1 to 4 digits
    const regex = /^\d+(\.\d{1,4})?$/;
    if (!regex.test(s)) return false;

    const num = parseFloat(s);
    if (isNaN(num) || num <= 0) return false;

    // Total length check (max 12 significant digits)
    const digitsOnly = s.replace('.', '');
    if (digitsOnly.length > 12) return false;

    return true;
  },

  /**
   * Validates non-negative weight (e.g. scrap gold): ge 0, max 4 decimal places
   */
  isValidNonNegativeWeight(val) {
    if (typeof val !== 'string' && typeof val !== 'number') return false;
    const s = String(val).trim();
    if (!s) return false;

    const regex = /^\d+(\.\d{1,4})?$/;
    if (!regex.test(s)) return false;

    const num = parseFloat(s);
    if (isNaN(num) || num < 0) return false;

    const digitsOnly = s.replace('.', '');
    if (digitsOnly.length > 12) return false;

    return true;
  },

  /**
   * Validates karat: integer between 1 and 24
   */
  isValidKarat(val) {
    const k = parseInt(val, 10);
    return !isNaN(k) && String(k) === String(val).trim() && k >= 1 && k <= 24;
  },

  /**
   * Validates wastage percentage: ge 0, le 20, max 3 decimal places
   */
  isValidWastagePct(val) {
    if (typeof val !== 'string' && typeof val !== 'number') return false;
    const s = String(val).trim();
    if (!s) return false;

    const regex = /^\d+(\.\d{1,3})?$/;
    if (!regex.test(s)) return false;

    const num = parseFloat(s);
    return !isNaN(num) && num >= 0 && num <= 20;
  },

  /**
   * Normalizes a decimal weight string to standard 4 decimal places
   * e.g. "50" -> "50.0000", "49.85" -> "49.8500"
   */
  formatWeight4(val) {
    const s = String(val).trim();
    if (!this.isValidNonNegativeWeight(s) && !this.isValidWeight(s)) return s;
    const parts = s.split('.');
    const integerPart = parts[0];
    const fractionPart = (parts[1] || '').padEnd(4, '0').slice(0, 4);
    return `${integerPart}.${fractionPart}`;
  },

  /**
   * Pure string-based decimal subtraction: a - b (for positive results)
   * Avoids float inaccuracies (e.g., 50.0000 - 49.8500 = 0.1500)
   */
  decimalSubtract(strA, strB) {
    const normA = this.formatWeight4(strA);
    const normB = this.formatWeight4(strB);
    const intA = BigInt(normA.replace('.', ''));
    const intB = BigInt(normB.replace('.', ''));
    const diff = intA - intB;
    const isNeg = diff < 0n;
    const absDiff = (isNeg ? -diff : diff).toString().padStart(5, '0');
    const integerPart = absDiff.slice(0, -4) || '0';
    const fractionPart = absDiff.slice(-4);
    return (isNeg ? '-' : '') + `${integerPart}.${fractionPart}`;
  },

  /**
   * Sanitizes user-provided text for safe rendering in HTML templates
   * Mitigates Cross-Site Scripting (XSS) risks.
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};
