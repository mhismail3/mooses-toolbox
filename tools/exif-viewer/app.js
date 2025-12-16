/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXIF VIEWER - Tool Logic
 * 
 * Extracts and displays EXIF metadata from uploaded images.
 * Uses exif-js library for parsing.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const imagePreview = document.getElementById('image-preview');
  const previewImg = document.getElementById('preview-img');
  const fileName = document.getElementById('file-name');
  const fileMeta = document.getElementById('file-meta');
  const exifResults = document.getElementById('exif-results');
  const noExif = document.getElementById('no-exif');
  const copyBtn = document.getElementById('copy-btn');
  const clearBtn = document.getElementById('clear-btn');

  // Data containers
  const cameraData = document.getElementById('camera-data');
  const datetimeData = document.getElementById('datetime-data');
  const gpsData = document.getElementById('gps-data');
  const imageData = document.getElementById('image-data');

  // Store current EXIF data for copying
  let currentExifData = null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle file drop
   */
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  /**
   * Handle drag over
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  }

  /**
   * Handle drag leave
   */
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  }

  /**
   * Handle file input change
   */
  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  /**
   * Process uploaded file
   */
  function processFile(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      ToolTemplate.showToast('Please upload a JPEG or TIFF image', 4000);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      fileName.textContent = file.name;
      fileMeta.textContent = ` • ${ToolTemplate.formatFileSize(file.size)}`;
      imagePreview.classList.add('visible');
      dropZone.style.display = 'none';
    };
    reader.readAsDataURL(file);

    // Extract EXIF data
    extractExif(file);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXIF EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Extract EXIF data from file using exif-js
   */
  function extractExif(file) {
    // Reset displays
    exifResults.hidden = true;
    noExif.hidden = true;
    currentExifData = null;

    EXIF.getData(file, function() {
      const allTags = EXIF.getAllTags(this);
      
      if (!allTags || Object.keys(allTags).length === 0) {
        noExif.hidden = false;
        return;
      }

      currentExifData = allTags;
      displayExifData(allTags);
      exifResults.hidden = false;
      ToolTemplate.showToast('EXIF data extracted!');
    });
  }

  /**
   * Display EXIF data in organized sections
   */
  function displayExifData(tags) {
    // Camera & Settings
    const cameraFields = [
      { key: 'Make', label: 'Camera Make' },
      { key: 'Model', label: 'Camera Model' },
      { key: 'LensModel', label: 'Lens' },
      { key: 'FNumber', label: 'Aperture', format: (v) => `f/${v}` },
      { key: 'ExposureTime', label: 'Shutter Speed', format: formatExposure },
      { key: 'ISOSpeedRatings', label: 'ISO' },
      { key: 'FocalLength', label: 'Focal Length', format: (v) => `${v}mm` },
      { key: 'FocalLengthIn35mmFilm', label: '35mm Equivalent', format: (v) => `${v}mm` },
      { key: 'ExposureBias', label: 'Exposure Compensation', format: (v) => v > 0 ? `+${v} EV` : `${v} EV` },
      { key: 'MeteringMode', label: 'Metering Mode', format: formatMeteringMode },
      { key: 'Flash', label: 'Flash', format: formatFlash },
      { key: 'WhiteBalance', label: 'White Balance', format: (v) => v === 0 ? 'Auto' : 'Manual' },
    ];
    renderTable(cameraData, cameraFields, tags);

    // Date & Time
    const dateFields = [
      { key: 'DateTimeOriginal', label: 'Date Taken', format: formatExifDate },
      { key: 'DateTimeDigitized', label: 'Date Digitized', format: formatExifDate },
      { key: 'DateTime', label: 'Date Modified', format: formatExifDate },
    ];
    renderTable(datetimeData, dateFields, tags);

    // GPS
    renderGpsData(tags);

    // Image Details
    const imageFields = [
      { key: 'PixelXDimension', label: 'Width', format: (v) => `${v} px` },
      { key: 'PixelYDimension', label: 'Height', format: (v) => `${v} px` },
      { key: 'Orientation', label: 'Orientation', format: formatOrientation },
      { key: 'ColorSpace', label: 'Color Space', format: (v) => v === 1 ? 'sRGB' : v === 65535 ? 'Uncalibrated' : `Unknown (${v})` },
      { key: 'Software', label: 'Software' },
      { key: 'Artist', label: 'Artist/Creator' },
      { key: 'Copyright', label: 'Copyright' },
    ];
    renderTable(imageData, imageFields, tags);
  }

  /**
   * Render a data table section
   */
  function renderTable(tbody, fields, tags) {
    const rows = fields
      .filter(f => tags[f.key] !== undefined && tags[f.key] !== null && tags[f.key] !== '')
      .map(f => {
        const value = f.format ? f.format(tags[f.key]) : tags[f.key];
        return `
          <tr>
            <td class="label-cell">${f.label}</td>
            <td class="value-cell">${escapeHtml(String(value))}</td>
          </tr>
        `;
      })
      .join('');

    if (rows) {
      tbody.innerHTML = rows;
      tbody.closest('.exif-section').style.display = 'block';
    } else {
      tbody.closest('.exif-section').style.display = 'none';
    }
  }

  /**
   * Render GPS data with map link
   */
  function renderGpsData(tags) {
    const gpsSection = document.getElementById('gps-section');
    
    const lat = tags.GPSLatitude;
    const latRef = tags.GPSLatitudeRef;
    const lon = tags.GPSLongitude;
    const lonRef = tags.GPSLongitudeRef;
    const alt = tags.GPSAltitude;
    const altRef = tags.GPSAltitudeRef;

    if (!lat || !lon) {
      gpsSection.style.display = 'none';
      return;
    }

    // Convert GPS coordinates to decimal
    const latDecimal = convertDMSToDecimal(lat, latRef);
    const lonDecimal = convertDMSToDecimal(lon, lonRef);

    // Format for display
    const latFormatted = formatDMS(lat, latRef);
    const lonFormatted = formatDMS(lon, lonRef);

    let html = `
      <table class="data-table">
        <tbody>
          <tr>
            <td class="label-cell">Latitude</td>
            <td class="value-cell">${escapeHtml(latFormatted)}</td>
          </tr>
          <tr>
            <td class="label-cell">Longitude</td>
            <td class="value-cell">${escapeHtml(lonFormatted)}</td>
          </tr>
    `;

    if (alt !== undefined) {
      const altValue = altRef === 1 ? -alt : alt;
      html += `
          <tr>
            <td class="label-cell">Altitude</td>
            <td class="value-cell">${altValue.toFixed(1)} m</td>
          </tr>
      `;
    }

    html += `
        </tbody>
      </table>
      <a href="https://www.google.com/maps?q=${latDecimal},${lonDecimal}" 
         target="_blank" 
         rel="noopener noreferrer" 
         class="gps-link">
        🗺️ Open in Google Maps
      </a>
    `;

    gpsData.innerHTML = html;
    gpsSection.style.display = 'block';
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FORMATTING HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Convert DMS (degrees, minutes, seconds) to decimal
   */
  function convertDMSToDecimal(dms, ref) {
    if (!dms || dms.length < 3) return 0;
    
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    
    if (ref === 'S' || ref === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }

  /**
   * Format DMS for display
   */
  function formatDMS(dms, ref) {
    if (!dms || dms.length < 3) return 'Unknown';
    
    const degrees = Math.floor(dms[0]);
    const minutes = Math.floor(dms[1]);
    const seconds = dms[2].toFixed(2);
    
    return `${degrees}° ${minutes}' ${seconds}" ${ref}`;
  }

  /**
   * Format exposure time (shutter speed)
   */
  function formatExposure(value) {
    if (value >= 1) {
      return `${value}s`;
    }
    // Convert to fraction
    const denominator = Math.round(1 / value);
    return `1/${denominator}s`;
  }

  /**
   * Format EXIF date string
   */
  function formatExifDate(dateStr) {
    if (!dateStr) return 'Unknown';
    
    // EXIF date format: "YYYY:MM:DD HH:MM:SS"
    const parts = dateStr.split(' ');
    if (parts.length < 2) return dateStr;
    
    const dateParts = parts[0].split(':');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length < 3) return dateStr;
    
    const date = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeParts[0] || 0),
      parseInt(timeParts[1] || 0),
      parseInt(timeParts[2] || 0)
    );
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format metering mode
   */
  function formatMeteringMode(value) {
    const modes = {
      0: 'Unknown',
      1: 'Average',
      2: 'Center-weighted',
      3: 'Spot',
      4: 'Multi-spot',
      5: 'Pattern',
      6: 'Partial',
      255: 'Other'
    };
    return modes[value] || `Unknown (${value})`;
  }

  /**
   * Format flash status
   */
  function formatFlash(value) {
    // Flash values are a bitfield
    const fired = (value & 1) === 1;
    return fired ? 'Fired' : 'Did not fire';
  }

  /**
   * Format orientation
   */
  function formatOrientation(value) {
    const orientations = {
      1: 'Normal',
      2: 'Flipped horizontally',
      3: 'Rotated 180°',
      4: 'Flipped vertically',
      5: 'Rotated 90° CCW, flipped',
      6: 'Rotated 90° CW',
      7: 'Rotated 90° CW, flipped',
      8: 'Rotated 90° CCW'
    };
    return orientations[value] || `Unknown (${value})`;
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
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Copy all EXIF data as text
   */
  async function copyAllData() {
    if (!currentExifData) {
      ToolTemplate.showToast('No data to copy');
      return;
    }

    // Build text representation
    let text = `EXIF Data for: ${fileName.textContent}\n`;
    text += '='.repeat(50) + '\n\n';

    // Add all non-empty tags
    for (const [key, value] of Object.entries(currentExifData)) {
      if (value !== undefined && value !== null && value !== '') {
        // Skip binary/thumbnail data
        if (key === 'thumbnail' || key === 'MakerNote' || key === 'UserComment') continue;
        
        let displayValue = value;
        if (Array.isArray(value)) {
          displayValue = value.join(', ');
        } else if (typeof value === 'object') {
          displayValue = JSON.stringify(value);
        }
        
        text += `${key}: ${displayValue}\n`;
      }
    }

    const success = await ToolTemplate.copyToClipboard(text);
    if (success) {
      ToolTemplate.showToast('EXIF data copied to clipboard!');
    } else {
      ToolTemplate.showToast('Failed to copy data');
    }
  }

  /**
   * Clear current image and data
   */
  function clearData() {
    // Reset preview
    previewImg.src = '';
    imagePreview.classList.remove('visible');
    dropZone.style.display = '';
    
    // Reset file input
    fileInput.value = '';
    
    // Hide results
    exifResults.hidden = true;
    noExif.hidden = true;
    
    // Clear data
    currentExifData = null;
    cameraData.innerHTML = '';
    datetimeData.innerHTML = '';
    gpsData.innerHTML = '';
    imageData.innerHTML = '';
    
    ToolTemplate.showToast('Cleared');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    // Drop zone events
    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    
    // File input
    fileInput.addEventListener('change', handleFileSelect);
    
    // Action buttons
    copyBtn.addEventListener('click', copyAllData);
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


