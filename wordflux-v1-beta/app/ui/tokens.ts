// Central UI tokens used across Workspace/Board/Chat
export const HEADER_HEIGHT_REM = 3.5;

// Chat panel sizing
export const CHAT_MIN_PX = 320;           // Small screens (e.g., 1024×600)
export const CHAT_PREFERRED_PX = 360;     // Target width
export const CHAT_MAX_PX = 384;           // Upper bound
export const CHAT_FIXED_PX = 384;         // Fixed width when locking the chat

// Brand colors
export const BRAND_NAVY = '#000023';
export const BRAND_ORANGE = '#ff6633';
export const BRAND_MAGENTA = '#ff3366';
export const BRAND_WHITE = '#fff9f9';

// High contrast brand colors for accessibility
export const BRAND_MAGENTA_700 = '#C2185B';
export const BRAND_CRIMSON_800 = '#B00020';

// Gradients
export const GRADIENT_SUNSET = 'linear-gradient(135deg, #ff6633 0%, #ff3366 100%)';
export const GRADIENT_DARK = 'linear-gradient(135deg, #000023 0%, #1a1a3e 100%)';
export const GRADIENT_SOFT = 'linear-gradient(180deg, #fff9f9 0%, #fff5f0 100%)';

// Modern design tokens
export const LAYOUT_BG = BRAND_WHITE;
export const SURFACE = '#ffffff';
export const SURFACE_ELEVATED = 'rgba(255, 255, 255, 0.95)';
export const SURFACE_GLASS = 'rgba(255, 255, 255, 0.85)';
export const SURFACE_SUBTLE = '#f3f4f6'; // Keep for compatibility
export const BORDER = 'rgba(0, 0, 35, 0.08)';
export const BORDER_LIGHT = 'rgba(255, 102, 51, 0.15)';
export const TEXT_DARK = BRAND_NAVY;
export const TEXT_MUTED = 'rgba(0, 0, 35, 0.6)';
export const TEXT_SOFT = 'rgba(0, 0, 35, 0.4)';

// Shadows
export const SHADOW_SM = '0 2px 8px rgba(0, 0, 35, 0.06)';
export const SHADOW_MD = '0 8px 24px rgba(0, 0, 35, 0.08)';
export const SHADOW_LG = '0 20px 40px rgba(0, 0, 35, 0.12)';
export const SHADOW_GLOW = '0 4px 16px rgba(255, 102, 51, 0.3)';

// Spacing + radius
export const SPACE_SM = 12;  // px
export const SPACE_MD = 16;  // px
export const RADIUS_MD = 8;  // px
export const RADIUS_LG = 16;  // px

// Polling intervals (ms)
export const POLL_FOREGROUND_MS = 3000;
export const POLL_BACKGROUND_MS = 15000; // slower when tab hidden
