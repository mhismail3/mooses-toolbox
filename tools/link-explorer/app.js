/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LINK EXPLORER - Tool Logic
 * 
 * Progressively explores and visualizes the link hierarchy of any webpage.
 * Features:
 * - Lazy loading of child links (only fetched when user expands)
 * - Smart content detection (excludes nav, TOC, footer)
 * - Collapsible tree interface
 * - 50 link limit per page
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Maximum links to extract per page
    MAX_LINKS_PER_PAGE: 50,
    
    // CORS proxy options (fallback chain)
    CORS_PROXIES: [
      { url: 'https://api.allorigins.win/raw?url=', encode: true },
      { url: 'https://corsproxy.io/?', encode: true },
      { url: 'https://api.codetabs.com/v1/proxy?quest=', encode: true },
    ],
    
    // Selectors to identify main content areas (in priority order)
    MAIN_CONTENT_SELECTORS: [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.page-content',
      '#content',
      '#main',
      '.markdown-body', // GitHub
      '.docs-content', // Documentation sites
      '.prose', // Tailwind prose
    ],
    
    // Selectors to EXCLUDE from link extraction
    EXCLUDE_SELECTORS: [
      // Navigation
      'nav',
      'header',
      'footer',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.nav',
      '.navbar',
      '.navigation',
      '.menu',
      '.sidebar',
      '.side-nav',
      '.sidenav',
      
      // Table of contents
      '.toc',
      '.table-of-contents',
      '.tableOfContents',
      '#toc',
      '#table-of-contents',
      '[class*="toc"]',
      '.on-this-page',
      '.page-toc',
      
      // Breadcrumbs
      '.breadcrumb',
      '.breadcrumbs',
      '[aria-label="breadcrumb"]',
      
      // Related/suggested content
      '.related',
      '.related-posts',
      '.suggested',
      '.recommendations',
      
      // Comments
      '.comments',
      '#comments',
      '.comment-section',
      
      // Ads and misc
      '.ad',
      '.ads',
      '.advertisement',
      '.social-share',
      '.share-buttons',
      '.author-bio',
      
      // Pagination (links to same content, different pages)
      '.pagination',
      '.pager',
    ],
    
    // Link patterns to exclude
    EXCLUDE_LINK_PATTERNS: [
      /^#/,                           // Anchor links
      /^javascript:/i,                // JavaScript links
      /^mailto:/i,                    // Email links
      /^tel:/i,                       // Phone links
      /^data:/i,                      // Data URLs
      /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|tar|gz|mp3|mp4|avi|mov)$/i,  // Files
      /^\/\/[^/]/,                    // Protocol-relative URLs (usually for CDN)
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  // Tree data structure
  let treeData = null;
  
  // Set of all discovered URLs (for deduplication stats)
  let allDiscoveredUrls = new Set();
  
  // Set of expanded node IDs
  let expandedNodes = new Set();
  
  // Track which proxy is currently working
  let workingProxyIndex = 0;
  
  // Node ID counter
  let nodeIdCounter = 0;

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const urlInput = document.getElementById('url-input');
  const exploreBtn = document.getElementById('explore-btn');
  const statsBar = document.getElementById('stats-bar');
  const treeControls = document.getElementById('tree-controls');
  const treeContainer = document.getElementById('tree-container');
  const linkTree = document.getElementById('link-tree');
  const emptyState = document.getElementById('empty-state');
  const collapseAllBtn = document.getElementById('collapse-all-btn');
  const clearBtn = document.getElementById('clear-btn');

  // Stats elements
  const statTotal = document.getElementById('stat-total');
  const statExpanded = document.getElementById('stat-expanded');
  const statDomains = document.getElementById('stat-domains');

  // ═══════════════════════════════════════════════════════════════════════════════
  // URL & FETCH UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Validate and normalize a URL
   */
  function normalizeUrl(url, baseUrl = null) {
    try {
      // Handle relative URLs
      if (baseUrl && !url.match(/^https?:\/\//i)) {
        const base = new URL(baseUrl);
        
        if (url.startsWith('//')) {
          return base.protocol + url;
        } else if (url.startsWith('/')) {
          return base.origin + url;
        } else {
          // Relative path
          const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
          return base.origin + basePath + url;
        }
      }
      
      const parsed = new URL(url);
      
      // Only allow http/https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      
      // Remove hash
      parsed.hash = '';
      
      // Normalize trailing slash for consistency
      if (parsed.pathname === '') {
        parsed.pathname = '/';
      }
      
      return parsed.href;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract domain from URL
   */
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if URL should be excluded based on patterns
   */
  function shouldExcludeUrl(url) {
    return CONFIG.EXCLUDE_LINK_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Fetch a URL through CORS proxy with fallback
   */
  async function fetchWithProxy(url, proxyIndex = 0) {
    if (proxyIndex >= CONFIG.CORS_PROXIES.length) {
      throw new Error('All CORS proxies failed');
    }
    
    const proxy = CONFIG.CORS_PROXIES[proxyIndex];
    const proxyUrl = proxy.url + (proxy.encode ? encodeURIComponent(url) : url);
    
    try {
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      
      // Verify we got actual HTML content
      if (!html.includes('<') || html.length < 100) {
        throw new Error('Invalid HTML response');
      }
      
      // Remember working proxy
      workingProxyIndex = proxyIndex;
      
      return html;
    } catch (error) {
      console.warn(`Proxy ${proxyIndex} failed for ${url}:`, error.message);
      
      // Try next proxy
      return fetchWithProxy(url, proxyIndex + 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HTML PARSING & LINK EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Parse HTML string into a DOM document
   */
  function parseHtml(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Set base URL for relative link resolution
    const base = doc.createElement('base');
    base.href = baseUrl;
    doc.head.prepend(base);
    
    return doc;
  }

  /**
   * Find the main content area of the document
   */
  function findMainContent(doc) {
    // Try each main content selector in priority order
    for (const selector of CONFIG.MAIN_CONTENT_SELECTORS) {
      const element = doc.querySelector(selector);
      if (element) {
        return element;
      }
    }
    
    // Fallback to body
    return doc.body;
  }

  /**
   * Remove excluded elements from a container (modifies in place)
   */
  function removeExcludedElements(container) {
    // Clone to avoid modifying original
    const clone = container.cloneNode(true);
    
    // Remove all excluded elements
    for (const selector of CONFIG.EXCLUDE_SELECTORS) {
      try {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      } catch (e) {
        // Invalid selector, skip
      }
    }
    
    return clone;
  }

  /**
   * Extract links from HTML content
   */
  function extractLinks(html, sourceUrl) {
    const doc = parseHtml(html, sourceUrl);
    
    // Find main content
    let contentArea = findMainContent(doc);
    
    // Remove excluded elements
    contentArea = removeExcludedElements(contentArea);
    
    // Get page title
    const title = doc.querySelector('title')?.textContent?.trim() || getDomain(sourceUrl);
    
    // Find all anchor tags
    const anchors = contentArea.querySelectorAll('a[href]');
    
    // Extract and deduplicate links
    const linksMap = new Map();
    const sourceDomain = getDomain(sourceUrl);
    
    anchors.forEach(anchor => {
      const href = anchor.getAttribute('href');
      
      // Skip excluded patterns
      if (shouldExcludeUrl(href)) {
        return;
      }
      
      // Normalize URL
      const normalizedUrl = normalizeUrl(href, sourceUrl);
      if (!normalizedUrl) {
        return;
      }
      
      // Skip if it's the same as source URL
      if (normalizedUrl === sourceUrl) {
        return;
      }
      
      // Skip if already seen
      if (linksMap.has(normalizedUrl)) {
        return;
      }
      
      // Get link text
      let text = anchor.textContent?.trim() || '';
      
      // Clean up text (remove excessive whitespace)
      text = text.replace(/\s+/g, ' ').substring(0, 200);
      
      // If no text, try to get meaningful info from URL
      if (!text) {
        try {
          const urlObj = new URL(normalizedUrl);
          text = decodeURIComponent(urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname);
        } catch (e) {
          text = normalizedUrl;
        }
      }
      
      // Determine if link is external
      const isExternal = getDomain(normalizedUrl) !== sourceDomain;
      
      linksMap.set(normalizedUrl, {
        url: normalizedUrl,
        text: text,
        isExternal: isExternal,
        domain: getDomain(normalizedUrl),
      });
    });
    
    // Convert to array and limit
    const links = Array.from(linksMap.values()).slice(0, CONFIG.MAX_LINKS_PER_PAGE);
    
    return {
      title: title,
      url: sourceUrl,
      links: links,
      totalFound: linksMap.size,
      wasTruncated: linksMap.size > CONFIG.MAX_LINKS_PER_PAGE,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TREE DATA STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new tree node
   */
  function createNode(url, text, isExternal = false, isRoot = false) {
    return {
      id: `node-${++nodeIdCounter}`,
      url: url,
      text: text,
      isExternal: isExternal,
      isRoot: isRoot,
      domain: getDomain(url),
      children: null,           // null = not loaded, [] = loaded but empty
      isLoading: false,
      error: null,
      totalFound: 0,            // Total links found before truncation
      wasTruncated: false,
    };
  }

  /**
   * Load children for a node
   */
  async function loadNodeChildren(node) {
    if (node.isLoading || node.children !== null) {
      return;
    }
    
    node.isLoading = true;
    node.error = null;
    renderTree();
    
    try {
      const html = await fetchWithProxy(node.url, workingProxyIndex);
      const result = extractLinks(html, node.url);
      
      // Create child nodes
      node.children = result.links.map(link => 
        createNode(link.url, link.text, link.isExternal)
      );
      
      node.totalFound = result.totalFound;
      node.wasTruncated = result.wasTruncated;
      
      // Update discovered URLs
      result.links.forEach(link => allDiscoveredUrls.add(link.url));
      
    } catch (error) {
      console.error('Failed to load children for:', node.url, error);
      node.children = [];
      node.error = error.message || 'Failed to load';
    } finally {
      node.isLoading = false;
      renderTree();
      updateStats();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TREE RENDERING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate HTML for a single tree node
   */
  function renderNode(node, depth = 0) {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children !== null && node.children.length > 0;
    const isLoaded = node.children !== null;
    const canExpand = !node.isExternal || node.isRoot; // Don't auto-expand external links (except root)
    
    // Determine toggle state
    let toggleClass = 'tree-toggle';
    if (node.isLoading) {
      toggleClass += ' loading';
    } else if (isExpanded) {
      toggleClass += ' expanded';
    } else if (isLoaded && !hasChildren) {
      toggleClass += ' leaf';
    }
    
    // Build node HTML
    let html = `
      <li class="tree-node${node.isRoot ? ' root' : ''}" data-node-id="${node.id}" data-depth="${depth}">
        <div class="tree-node-content">
          <button 
            type="button" 
            class="${toggleClass}" 
            data-action="toggle"
            title="${node.isLoading ? 'Loading...' : isExpanded ? 'Collapse' : 'Expand'}"
            ${!canExpand && !isLoaded ? 'disabled' : ''}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          
          <div class="tree-link-info">
            <div class="tree-link-title">
              <span class="tree-link-text">${escapeHtml(node.text)}</span>
              
              ${node.isExternal ? '<span class="link-count-badge external">↗ External</span>' : ''}
              
              ${node.wasTruncated ? `<span class="link-count-badge" title="Showing ${node.children?.length} of ${node.totalFound} links">+${node.totalFound - (node.children?.length || 0)} more</span>` : ''}
              
              ${node.error ? `<span class="tree-error">⚠ ${escapeHtml(node.error)}</span>` : ''}
              
              <a 
                href="${escapeHtml(node.url)}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="tree-link-external"
                title="Open in new tab"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
            <div class="tree-link-url" title="${escapeHtml(node.url)}">${escapeHtml(truncateUrl(node.url))}</div>
          </div>
        </div>
    `;
    
    // Render children if expanded
    if (isExpanded && hasChildren) {
      html += '<ul>';
      node.children.forEach(child => {
        html += renderNode(child, depth + 1);
      });
      html += '</ul>';
    }
    
    html += '</li>';
    
    return html;
  }

  /**
   * Render the entire tree
   */
  function renderTree() {
    if (!treeData) {
      linkTree.hidden = true;
      emptyState.hidden = false;
      return;
    }
    
    emptyState.hidden = true;
    linkTree.hidden = false;
    linkTree.innerHTML = renderNode(treeData, 0);
  }

  /**
   * Truncate URL for display
   */
  function truncateUrl(url, maxLength = 60) {
    if (url.length <= maxLength) return url;
    
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      
      if (path.length > maxLength - 20) {
        return parsed.origin + path.substring(0, maxLength - 20) + '...';
      }
      
      return url.substring(0, maxLength) + '...';
    } catch (e) {
      return url.substring(0, maxLength) + '...';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Count total links in tree
   */
  function countTotalLinks(node) {
    if (!node) return 0;
    
    let count = 1; // Count self
    
    if (node.children) {
      node.children.forEach(child => {
        count += countTotalLinks(child);
      });
    }
    
    return count;
  }

  /**
   * Get unique domains from tree
   */
  function getUniqueDomains(node, domains = new Set()) {
    if (!node) return domains;
    
    if (node.domain) {
      domains.add(node.domain);
    }
    
    if (node.children) {
      node.children.forEach(child => getUniqueDomains(child, domains));
    }
    
    return domains;
  }

  /**
   * Update stats display
   */
  function updateStats() {
    if (!treeData) {
      statsBar.hidden = true;
      treeControls.hidden = true;
      return;
    }
    
    statsBar.hidden = false;
    treeControls.hidden = false;
    
    const totalLinks = countTotalLinks(treeData);
    const uniqueDomains = getUniqueDomains(treeData);
    
    statTotal.textContent = totalLinks;
    statExpanded.textContent = expandedNodes.size;
    statDomains.textContent = uniqueDomains.size;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // USER ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Find node by ID in tree
   */
  function findNodeById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Handle toggle click
   */
  async function handleToggle(nodeId) {
    const node = findNodeById(treeData, nodeId);
    if (!node) return;
    
    // If already expanded, collapse
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
      renderTree();
      updateStats();
      return;
    }
    
    // Load children if not loaded
    if (node.children === null) {
      expandedNodes.add(nodeId);
      await loadNodeChildren(node);
    } else {
      // Already loaded, just expand
      expandedNodes.add(nodeId);
      renderTree();
      updateStats();
    }
  }

  /**
   * Start exploration with a URL
   */
  async function startExploration(url) {
    const normalizedUrl = normalizeUrl(url);
    
    if (!normalizedUrl) {
      ToolTemplate.showToast('Please enter a valid URL', 4000);
      return;
    }
    
    // Reset state
    treeData = null;
    allDiscoveredUrls.clear();
    expandedNodes.clear();
    nodeIdCounter = 0;
    
    // Show loading state
    emptyState.hidden = true;
    linkTree.hidden = false;
    linkTree.innerHTML = `
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    `;
    statsBar.hidden = true;
    treeControls.hidden = true;
    
    exploreBtn.disabled = true;
    exploreBtn.textContent = '⏳ Loading...';
    
    try {
      // Fetch and parse the page
      const html = await fetchWithProxy(normalizedUrl);
      const result = extractLinks(html, normalizedUrl);
      
      // Create root node
      treeData = createNode(normalizedUrl, result.title, false, true);
      treeData.children = result.links.map(link => 
        createNode(link.url, link.text, link.isExternal)
      );
      treeData.totalFound = result.totalFound;
      treeData.wasTruncated = result.wasTruncated;
      
      // Add to discovered URLs
      allDiscoveredUrls.add(normalizedUrl);
      result.links.forEach(link => allDiscoveredUrls.add(link.url));
      
      // Expand root by default
      expandedNodes.add(treeData.id);
      
      // Render
      renderTree();
      updateStats();
      
      ToolTemplate.showToast(`Found ${result.links.length} links!`);
      
    } catch (error) {
      console.error('Exploration failed:', error);
      
      // Show error state
      linkTree.innerHTML = `
        <div class="tree-empty">
          <div class="tree-empty-icon">⚠️</div>
          <p class="mb-0">Failed to fetch the page</p>
          <p class="muted mt-sm" style="font-size: var(--text-sm);">
            ${escapeHtml(error.message)}<br>
            The site may block external requests or the URL may be invalid.
          </p>
        </div>
      `;
      
      ToolTemplate.showToast('Failed to load page', 4000);
    } finally {
      exploreBtn.disabled = false;
      exploreBtn.textContent = '🔍 Explore';
    }
  }

  /**
   * Collapse all expanded nodes
   */
  function collapseAll() {
    // Keep only root expanded
    if (treeData) {
      expandedNodes.clear();
      expandedNodes.add(treeData.id);
    }
    renderTree();
    updateStats();
    ToolTemplate.showToast('Collapsed all');
  }

  /**
   * Clear everything
   */
  function clearAll() {
    treeData = null;
    allDiscoveredUrls.clear();
    expandedNodes.clear();
    nodeIdCounter = 0;
    urlInput.value = '';
    
    renderTree();
    updateStats();
    
    ToolTemplate.showToast('Cleared');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle tree click events (event delegation)
   */
  function handleTreeClick(e) {
    const toggle = e.target.closest('[data-action="toggle"]');
    if (toggle) {
      const node = toggle.closest('[data-node-id]');
      if (node) {
        handleToggle(node.dataset.nodeId);
      }
      return;
    }
  }

  /**
   * Handle explore button click
   */
  function handleExplore() {
    const url = urlInput.value.trim();
    if (!url) {
      ToolTemplate.showToast('Please enter a URL', 3000);
      urlInput.focus();
      return;
    }
    
    startExploration(url);
  }

  /**
   * Handle Enter key in input
   */
  function handleInputKeydown(e) {
    if (e.key === 'Enter') {
      handleExplore();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    // Explore button
    exploreBtn.addEventListener('click', handleExplore);
    
    // URL input
    urlInput.addEventListener('keydown', handleInputKeydown);
    
    // Tree click handler (event delegation)
    linkTree.addEventListener('click', handleTreeClick);
    
    // Controls
    collapseAllBtn.addEventListener('click', collapseAll);
    clearBtn.addEventListener('click', clearAll);
    
    // Handle paste - auto-explore if URL is pasted
    urlInput.addEventListener('paste', (e) => {
      // Small delay to let paste complete
      setTimeout(() => {
        const url = urlInput.value.trim();
        if (url && normalizeUrl(url)) {
          // Don't auto-explore, just validate visually
          urlInput.classList.remove('invalid');
        }
      }, 100);
    });
    
    // Focus input on load
    urlInput.focus();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

