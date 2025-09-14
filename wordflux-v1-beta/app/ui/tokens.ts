// Central UI tokens used across Workspace/Board/Chat - 2025 Design System
export const HEADER_HEIGHT = 56; // px

// Chat panel sizing (The Remote)
// Modernized for responsive layout
export const CHAT_MIN_PX = 320;           // Minimum width
export const CHAT_PREFERRED_PX = 376;     // Target width on larger screens
export const CHAT_MAX_PX = 420;           // Maximum width
export const CHAT_FIXED_PX = 376;         // Fixed width when locking

// Neutrals - 2025 palette
export const INK_900 = '#0B0E1A';
export const INK_700 = '#344054';
export const INK_500 = '#667085';
export const LINE = '#EDEEF2';
export const BG = '#FCFCFE';
export const SURFACE_WHITE = '#FFFFFF';

// Brand colors - mature tones
export const BRAND_600 = '#C2185B';  // primary magenta
export const BRAND_700 = '#B00020';  // deep crimson
export const ACCENT_500 = '#FF6A00'; // orange accent

// Legacy brand colors (keep for compatibility)
export const BRAND_NAVY = '#000023';
export const BRAND_ORANGE = '#ff6633';
export const BRAND_MAGENTA = '#ff3366';
export const BRAND_WHITE = '#fff9f9';
export const BRAND_MAGENTA_700 = '#C2185B';
export const BRAND_CRIMSON_800 = '#B00020';

// State colors
export const SUCCESS_600 = '#1E974B';
export const WARNING_600 = '#C16A00';
export const DANGER_600 = '#C0352B';

// Gradients - 2025 refined
export const GRADIENT_BRAND = 'linear-gradient(135deg, #B00020, #C2185B)';
export const GRADIENT_SUNSET = 'linear-gradient(135deg, #ff6633 0%, #ff3366 100%)'; // legacy
export const GRADIENT_DARK = 'linear-gradient(135deg, #000023 0%, #1a1a3e 100%)';
export const GRADIENT_SOFT = 'linear-gradient(180deg, #FCFCFE 0%, #F5F5F5 100%)';

// Modern design tokens - 2025
export const LAYOUT_BG = BG;
export const SURFACE = SURFACE_WHITE;
export const SURFACE_ELEVATED = 'rgba(255, 255, 255, 0.95)';
export const SURFACE_GLASS = 'rgba(255, 255, 255, 0.85)';
export const SURFACE_SUBTLE = '#F3F4F6'; // compatibility
export const BORDER = LINE;
export const BORDER_LIGHT = LINE;
export const TEXT_DARK = INK_900;
export const TEXT_MUTED = INK_500;
export const TEXT_SOFT = INK_500;

// Typography scale - 2025
export const FONT_BASE = 14; // px
export const FONT_SM = 12;   // labels/chips
export const FONT_MD = 14;   // body
export const FONT_LG = 16;   // column titles
export const FONT_XL = 20;   // section headers
export const FONT_2XL = 26;  // page headers
export const LINE_HEIGHT = 1.55;
export const WEIGHT_MEDIUM = 500;
export const WEIGHT_SEMIBOLD = 600;
export const WEIGHT_BOLD = 700;

// Shadows - 2025 subtle elevation
export const SHADOW_CARD = '0 1px 1px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)';
export const SHADOW_CARD_HOVER = '0 1px 1px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)';
export const SHADOW_MODAL = '0 10px 40px rgba(0,0,0,.14)';
export const SHADOW_SM = '0 2px 8px rgba(0, 0, 35, 0.06)'; // legacy
export const SHADOW_MD = '0 8px 24px rgba(0, 0, 35, 0.08)'; // legacy
export const SHADOW_LG = '0 20px 40px rgba(0, 0, 35, 0.12)'; // legacy
export const SHADOW_GLOW = '0 4px 16px rgba(255, 102, 51, 0.3)';
export const SHADOW_BRAND = '0 1px 1px rgba(0,0,0,.04), 0 6px 16px rgba(176,0,32,.18)';

// Focus ring
export const FOCUS_RING = '0 0 0 3px rgba(194, 24, 91, .18)';

// Spacing - 2025 rhythm
export const SPACE_XS = 8;   // px
export const SPACE_SM = 12;  // px
export const SPACE_MD = 16;  // px
export const SPACE_LG = 24;  // px

// Radius - 2025 soft but not bubbly
export const RADIUS_SM = 8;   // px
export const RADIUS_MD = 12;  // cards & inputs
export const RADIUS_LG = 16;  // panels/drawers
export const RADIUS_PILL = 9999; // pills/chips

// Motion - 2025 swift
export const DURATION_TAP = 120; // ms
export const DURATION_PANEL = 160; // ms
export const DURATION_PALETTE = 220; // ms
export const EASING = 'cubic-bezier(.2,.8,.2,1)'

// Polling intervals (ms)
export const POLL_FOREGROUND_MS = 3000;
export const POLL_BACKGROUND_MS = 15000; // slower when tab hidden
