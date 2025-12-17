/**
 * JSONL Viewer - Tool Logic
 *
 * Parses and displays JSONL (JSON Lines) files with syntax highlighting,
 * search, pagination, and copy functionality.
 */

(function() {
  'use strict';

  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const fileMeta = document.getElementById('file-meta');
  const statsBar = document.getElementById('stats-bar');
  const statEntries = document.getElementById('stat-entries');
  const statValid = document.getElementById('stat-valid');
  const statErrors = document.getElementById('stat-errors');
  const statErrorsChip = document.getElementById('stat-errors-chip');
  const searchBar = document.getElementById('search-bar');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchResultsInfo = document.getElementById('search-results-info');
  const entriesContainer = document.getElementById('entries-container');
  const pagination = document.getElementById('pagination');
  const paginationInfo = document.getElementById('pagination-info');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const errorEntries = document.getElementById('error-entries');
  const errorList = document.getElementById('error-list');
  const actions = document.getElementById('actions');
  const copyBtn = document.getElementById('copy-btn');
  const expandAllBtn = document.getElementById('expand-all-btn');
  const collapseAllBtn = document.getElementById('collapse-all-btn');
  const clearBtn = document.getElementById('clear-btn');
  const emptyState = document.getElementById('empty-state');

  // State
  let allEntries = [];
  let validEntries = [];
  let invalidEntries = [];
  let filteredEntries = [];
  let currentPage = 0;
  const entriesPerPage = 50;
  let currentFileName = '';

  // File Handling
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  function processFile(file) {
    currentFileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseJsonl(content);

      // Update UI
      fileName.textContent = file.name;
      fileMeta.textContent = `${ToolTemplate.formatFileSize(file.size)}`;
      fileInfo.classList.add('visible');
      dropZone.style.display = 'none';
    };
    reader.onerror = () => {
      ToolTemplate.showToast('Failed to read file', 4000);
    };
    reader.readAsText(file);
  }

  // JSONL Parsing
  function parseJsonl(content) {
    const lines = content.split('\n');
    allEntries = [];
    validEntries = [];
    invalidEntries = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return; // Skip empty lines

      try {
        const parsed = JSON.parse(trimmed);
        validEntries.push({
          lineNumber: index + 1,
          data: parsed,
          raw: trimmed
        });
      } catch (err) {
        invalidEntries.push({
          lineNumber: index + 1,
          raw: trimmed,
          error: err.message
        });
      }
    });

    allEntries = [...validEntries];
    filteredEntries = [...validEntries];
    currentPage = 0;

    updateStats();
    renderEntries();
    updatePagination();

    // Show/hide elements
    if (validEntries.length > 0) {
      statsBar.classList.add('visible');
      entriesContainer.classList.add('visible');
      searchBar.classList.add('visible');
      actions.hidden = false;
      emptyState.hidden = true;
      ToolTemplate.showToast(`Loaded ${validEntries.length} entries`);
    } else {
      emptyState.hidden = false;
      actions.hidden = true;
    }

    // Show errors if any
    if (invalidEntries.length > 0) {
      renderErrors();
      errorEntries.hidden = false;
      statErrorsChip.style.display = '';
    } else {
      errorEntries.hidden = true;
      statErrorsChip.style.display = 'none';
    }
  }

  function updateStats() {
    const totalLines = validEntries.length + invalidEntries.length;
    statEntries.textContent = totalLines;
    statValid.textContent = validEntries.length;
    statErrors.textContent = invalidEntries.length;
  }

  // Rendering
  function renderEntries() {
    const start = currentPage * entriesPerPage;
    const end = Math.min(start + entriesPerPage, filteredEntries.length);
    const pageEntries = filteredEntries.slice(start, end);

    entriesContainer.innerHTML = pageEntries.map((entry, idx) => {
      const preview = getEntryPreview(entry.data);
      const highlighted = syntaxHighlight(JSON.stringify(entry.data, null, 2));
      const globalIndex = start + idx;

      return `
        <div class="entry-card" data-index="${globalIndex}">
          <div class="entry-header" onclick="window.toggleEntry(${globalIndex})">
            <div class="entry-header-left">
              <span class="entry-number">#${entry.lineNumber}</span>
              <span class="entry-preview">${escapeHtml(preview)}</span>
            </div>
            <span class="entry-toggle">&#9660;</span>
          </div>
          <div class="entry-body">
            <pre class="entry-json">${highlighted}</pre>
            <div class="entry-actions">
              <button class="btn small" onclick="window.copyEntry(${globalIndex})">Copy</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getEntryPreview(data) {
    if (typeof data !== 'object' || data === null) {
      return String(data);
    }

    // Try to get meaningful preview from common fields
    const previewFields = ['message', 'text', 'content', 'name', 'title', 'id', 'type', 'event'];
    for (const field of previewFields) {
      if (data[field] !== undefined) {
        const value = String(data[field]);
        return value.length > 60 ? value.substring(0, 60) + '...' : value;
      }
    }

    // Fallback: show keys
    const keys = Object.keys(data);
    if (keys.length === 0) return '{}';
    return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
  }

  function syntaxHighlight(json) {
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      });
  }

  function renderErrors() {
    errorList.innerHTML = invalidEntries.slice(0, 10).map(entry => `
      <div class="error-entry">
        <div class="error-entry-line">Line ${entry.lineNumber}: ${entry.error}</div>
        <div class="error-entry-content">${escapeHtml(entry.raw.substring(0, 200))}${entry.raw.length > 200 ? '...' : ''}</div>
      </div>
    `).join('');

    if (invalidEntries.length > 10) {
      errorList.innerHTML += `<p class="muted">... and ${invalidEntries.length - 10} more errors</p>`;
    }
  }

  // Pagination
  function updatePagination() {
    const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);

    if (totalPages <= 1) {
      pagination.classList.remove('visible');
      return;
    }

    pagination.classList.add('visible');
    paginationInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
  }

  function goToPage(page) {
    const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);
    if (page < 0 || page >= totalPages) return;

    currentPage = page;
    renderEntries();
    updatePagination();

    // Scroll to top of entries
    entriesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Search
  function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
      filteredEntries = [...validEntries];
      searchResultsInfo.hidden = true;
    } else {
      filteredEntries = validEntries.filter(entry => {
        const str = JSON.stringify(entry.data).toLowerCase();
        return str.includes(query);
      });
      searchResultsInfo.textContent = `Found ${filteredEntries.length} matching entries`;
      searchResultsInfo.hidden = false;
    }

    currentPage = 0;
    renderEntries();
    updatePagination();
  }

  // Actions
  window.toggleEntry = function(index) {
    const card = entriesContainer.querySelector(`[data-index="${index}"]`);
    if (card) {
      card.classList.toggle('expanded');
    }
  };

  window.copyEntry = async function(index) {
    const entry = filteredEntries[index];
    if (!entry) return;

    const text = JSON.stringify(entry.data, null, 2);
    const success = await ToolTemplate.copyToClipboard(text);
    ToolTemplate.showToast(success ? 'Copied!' : 'Failed to copy');
  };

  async function copyAllData() {
    const text = filteredEntries.map(e => JSON.stringify(e.data)).join('\n');
    const success = await ToolTemplate.copyToClipboard(text);
    ToolTemplate.showToast(success ? `Copied ${filteredEntries.length} entries` : 'Failed to copy');
  }

  function expandAll() {
    entriesContainer.querySelectorAll('.entry-card').forEach(card => {
      card.classList.add('expanded');
    });
  }

  function collapseAll() {
    entriesContainer.querySelectorAll('.entry-card').forEach(card => {
      card.classList.remove('expanded');
    });
  }

  function clearData() {
    // Reset state
    allEntries = [];
    validEntries = [];
    invalidEntries = [];
    filteredEntries = [];
    currentPage = 0;
    currentFileName = '';

    // Reset UI
    fileInput.value = '';
    fileInfo.classList.remove('visible');
    dropZone.style.display = '';
    statsBar.classList.remove('visible');
    searchBar.classList.remove('visible');
    entriesContainer.classList.remove('visible');
    entriesContainer.innerHTML = '';
    pagination.classList.remove('visible');
    errorEntries.hidden = true;
    actions.hidden = true;
    emptyState.hidden = true;
    searchInput.value = '';
    searchResultsInfo.hidden = true;

    ToolTemplate.showToast('Cleared');
  }

  // Utilities
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initialization
  function init() {
    // Drop zone events
    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);

    // File input
    fileInput.addEventListener('change', handleFileSelect);

    // Search
    searchInput.addEventListener('input', ToolTemplate.debounce(handleSearch, 300));
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      handleSearch();
    });

    // Pagination
    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

    // Actions
    copyBtn.addEventListener('click', copyAllData);
    expandAllBtn.addEventListener('click', expandAll);
    collapseAllBtn.addEventListener('click', collapseAll);
    clearBtn.addEventListener('click', clearData);

    // Prevent default drag behavior on document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
