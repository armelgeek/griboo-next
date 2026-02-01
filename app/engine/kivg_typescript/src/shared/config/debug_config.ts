/**
 * Global debug configuration for the KIVG engine.
 * Controls verbose logging throughout the application.
 * 
 * To enable debug mode, either:
 * 1. Call setDebugEnabled(true) in your code
 * 2. Set localStorage.setItem('KIVG_DEBUG', 'true') in browser console
 * 
 * @example
 * // Enable debug mode
 * import { setDebugEnabled } from './debug-config';
 * setDebugEnabled(true);
 * 
 * // Check if debug mode is enabled
 * import { isDebugEnabled } from './debug-config';
 * if (isDebugEnabled()) {
 *   console.log('Debug information');
 * }
 */

let debugEnabled = true;

// Check for localStorage in browser (can be set via browser console)
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    if (localStorage.getItem('KIVG_DEBUG') === 'true') {
      debugEnabled = true;
    }
  } catch (e) {
    // Ignore localStorage access errors
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Enable or disable debug mode at runtime
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;

  // Also update localStorage if available
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      if (enabled) {
        localStorage.setItem('KIVG_DEBUG', 'true');
      } else {
        localStorage.removeItem('KIVG_DEBUG');
      }
    } catch (e) {
      // Ignore localStorage access errors
    }
  }
}

/**
 * Conditional debug logger - only logs when debug mode is enabled
 */
export function debugLog(...args: any[]): void {
  if (debugEnabled) {
    console.log(...args);
  }
}

/**
 * Conditional debug logger with custom label
 */
export function debugLogWithLabel(label: string, ...args: any[]): void {
  if (debugEnabled) {
    console.log(`[${label}]`, ...args);
  }
}
