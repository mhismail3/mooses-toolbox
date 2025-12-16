/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TOOL TEMPLATE - Core Application Logic
 * 
 * Provides:
 * - Theme toggle (light/dark mode with localStorage persistence)
 * - Info modal handling (open/close with native <dialog>)
 * - Utility functions for common tool operations
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // THEME MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  const THEME_KEY = 'tool-template-theme';

  /**
   * Get the current theme from localStorage or system preference
   */
  function getStoredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    
    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Apply theme to document and update UI
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeToggleIcons(theme);
  }

  /**
   * Update theme toggle button icons
   */
  function updateThemeToggleIcons(theme) {
    const sunIcon = document.querySelector('.theme-icon.sun');
    const moonIcon = document.querySelector('.theme-icon.moon');
    
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.classList.remove('visible');
        moonIcon.classList.add('visible');
      } else {
        sunIcon.classList.add('visible');
        moonIcon.classList.remove('visible');
      }
    }
  }

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  /**
   * Initialize theme on page load (called before transitions are enabled)
   */
  function initTheme() {
    const theme = getStoredTheme();
    applyTheme(theme);
    
    // Enable transitions after initial theme is applied (prevents flash)
    requestAnimationFrame(() => {
      document.documentElement.classList.add('theme-ready');
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INFO MODAL
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Open the info modal
   */
  function openInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal && typeof modal.showModal === 'function') {
      modal.showModal();
    }
  }

  /**
   * Close the info modal
   */
  function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal && typeof modal.close === 'function') {
      modal.close();
    }
  }

  /**
   * Initialize modal event listeners
   */
  function initModal() {
    const modal = document.getElementById('info-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    
    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', closeInfoModal);
    }
    
    // Click on backdrop (outside modal content) to close
    if (modal) {
      modal.addEventListener('click', (e) => {
        // Check if click was on the dialog backdrop (outside the modal)
        const rect = modal.getBoundingClientRect();
        const isOutside = (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
        if (isOutside) {
          closeInfoModal();
        }
      });
      
      // Close on Escape key (native dialog behavior, but ensure it works)
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeInfoModal();
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS (exported for tool use)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Format file size in human-readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format date in locale-aware string
   * @param {Date|string|number} date - Date to format
   * @returns {string} Formatted date string
   */
  function formatDate(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Debounce function to limit execution rate
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }

  /**
   * Show a temporary toast notification (simple version)
   * @param {string} message - Message to show
   * @param {number} duration - Duration in milliseconds
   */
  function showToast(message, duration = 3000) {
    // Remove existing toast if any
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.75rem 1.25rem;
      background: var(--color-text);
      color: var(--color-bg);
      border-radius: var(--radius-sm);
      font-size: var(--text-base);
      z-index: var(--z-modal);
      animation: toast-appear 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remove after duration
    setTimeout(() => {
      toast.style.animation = 'toast-disappear 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Add toast animation styles
  const toastStyles = document.createElement('style');
  toastStyles.textContent = `
    @keyframes toast-appear {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes toast-disappear {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
  `;
  document.head.appendChild(toastStyles);

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Initialize the application
   */
  function init() {
    // Initialize theme immediately (before DOM is fully ready for flash prevention)
    initTheme();
    
    // Wait for DOM to be ready for interactive elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDOMReady);
    } else {
      onDOMReady();
    }
  }

  /**
   * Called when DOM is ready
   */
  function onDOMReady() {
    // Theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Info button
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
      infoBtn.addEventListener('click', openInfoModal);
    }
    
    // Initialize modal
    initModal();
    
    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only apply if user hasn't manually set a preference
        if (!localStorage.getItem(THEME_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT UTILITIES (for use by tool-specific scripts)
  // ═══════════════════════════════════════════════════════════════════════════════

  window.ToolTemplate = {
    // Theme
    toggleTheme,
    getStoredTheme,
    applyTheme,
    
    // Modal
    openInfoModal,
    closeInfoModal,
    
    // Utilities
    formatFileSize,
    formatDate,
    debounce,
    copyToClipboard,
    showToast
  };

  // Initialize immediately
  init();

})();


