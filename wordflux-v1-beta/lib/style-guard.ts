/**
 * Production style enforcement for WordFlux Board Orchestrator
 * Strips verbose AI patterns and enforces concise, human responses
 */

// Banned patterns that indicate verbose AI behavior
const BANNED = /(Thinking:|^✻|Let me\b|Now let me\b|I will\b|I'll\b|As an AI\b|Here(?:'|')s\b|Great!|```)/i;

// Additional patterns to remove
const VERBOSE_PATTERNS = /^(Okay|Sure|Alright|Got it|Understood),?\s*/i;
const HEADING_PATTERN = /^#+\s.*$/gm;
const EMOJI_PREFIX = /^[✅❌➡️✏️🔍📋💬⚡🏷️👤🚀]\s*/;

/**
 * Enforce strict style rules on output text
 */
export function enforceStyle(s: string): string {
  if (!s) return '';
  
  // Strip headings, extra whitespace, trailing punctuation spam
  let cleaned = s
    .replace(HEADING_PATTERN, '')      // Remove markdown headings
    .replace(/\s{2,}/g, ' ')           // Collapse multiple spaces
    .replace(/[!.]{2,}$/g, '.')        // Replace multiple punctuation
    .trim();
  
  // Remove banned AI patterns
  if (BANNED.test(cleaned)) {
    cleaned = cleaned.replace(BANNED, '').trim();
  }
  
  // Remove verbose openings
  cleaned = cleaned.replace(VERBOSE_PATTERNS, '');
  
  // Remove emoji prefixes from confirmations
  cleaned = cleaned.replace(EMOJI_PREFIX, '');
  
  // Ensure single sentence ends with single period
  if (cleaned && !cleaned.match(/[.!?]$/)) {
    cleaned += '.';
  }
  
  return cleaned;
}

/**
 * Format output based on type with strict constraints
 */
export function formatOutput(
  type: 'PLAN' | 'CONFIRMATION' | 'ASK' | 'PREVIEW', 
  data: any
): string {
  switch(type) {
    case 'PLAN':
      // JSON only, no prose
      if (typeof data === 'object') {
        return JSON.stringify(data);
      }
      return '';
      
    case 'CONFIRMATION':
      // Past-tense, ≤30 words
      const confirmation = enforceStyle(String(data));
      const words = confirmation.split(/\s+/);
      if (words.length > 30) {
        return words.slice(0, 30).join(' ') + '.';
      }
      return confirmation;
      
    case 'ASK':
      // Single precise question
      return enforceStyle(String(data));
      
    case 'PREVIEW':
      // Compact action list
      const preview = enforceStyle(String(data));
      // Ensure it's formatted as a list if multiple items
      if (preview.includes(';')) {
        return preview.split(';').map(s => s.trim()).join('; ');
      }
      return preview;
      
    default:
      return '';
  }
}

/**
 * Detect output type from content
 */
export function detectOutputType(content: string): 'PLAN' | 'CONFIRMATION' | 'ASK' | 'PREVIEW' | 'UNKNOWN' {
  // JSON = PLAN
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    return 'PLAN';
  }
  
  // Question marks or "Which" = ASK
  if (content.includes('?') || /\bWhich\b/i.test(content)) {
    return 'ASK';
  }
  
  // Multiple actions with semicolons = PREVIEW
  if (content.includes(';') && content.split(';').length > 2) {
    return 'PREVIEW';
  }
  
  // Past tense verbs = CONFIRMATION
  if (/\b(Created|Moved|Updated|Tagged|Assigned|Deleted|Completed)\b/i.test(content)) {
    return 'CONFIRMATION';
  }
  
  return 'UNKNOWN';
}

/**
 * Convert verbose confirmation to concise format
 */
export function simplifyConfirmation(message: string): string {
  // Remove success emojis and verbose prefixes
  let simplified = message
    .replace(/^✅\s*/, '')
    .replace(/^Successfully\s+/i, '')
    .replace(/^Command executed:\s*/i, '');
  
  // Convert to past tense if needed
  simplified = simplified
    .replace(/\bcreate(d?)\b/i, 'Created')
    .replace(/\bmove(d?)\b/i, 'Moved')
    .replace(/\bupdate(d?)\b/i, 'Updated')
    .replace(/\btag(ged?)\b/i, 'Tagged')
    .replace(/\bassign(ed?)\b/i, 'Assigned')
    .replace(/\bdelete(d?)\b/i, 'Deleted');
  
  return enforceStyle(simplified);
}