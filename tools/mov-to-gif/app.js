/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOV TO GIF CONVERTER - Tool Logic
 * 
 * Converts video files to animated GIFs using gif.js library.
 * All processing happens client-side in the browser.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const videoPreview = document.getElementById('video-preview');
  const previewVideo = document.getElementById('preview-video');
  const fileName = document.getElementById('file-name');
  const videoDimensions = document.getElementById('video-dimensions');
  const videoDuration = document.getElementById('video-duration');
  const fileSize = document.getElementById('file-size');

  // Settings
  const settingsPanel = document.getElementById('settings-panel');
  const widthSlider = document.getElementById('width-slider');
  const widthValue = document.getElementById('width-value');
  const fpsSelect = document.getElementById('fps-select');
  const fpsValue = document.getElementById('fps-value');
  const qualitySlider = document.getElementById('quality-slider');
  const qualityValue = document.getElementById('quality-value');
  const frameEstimate = document.getElementById('frame-estimate');

  // Buttons
  const convertBtn = document.getElementById('convert-btn');
  const changeVideoBtn = document.getElementById('change-video-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const downloadBtn = document.getElementById('download-btn');
  const reconvertBtn = document.getElementById('reconvert-btn');
  const newVideoBtn = document.getElementById('new-video-btn');

  // Progress
  const progressSection = document.getElementById('progress-section');
  const progressStatus = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percent');
  const progressBar = document.getElementById('progress-bar');
  const progressDetail = document.getElementById('progress-detail');

  // Output
  const outputSection = document.getElementById('output-section');
  const gifPreview = document.getElementById('gif-preview');
  const gifSizeEl = document.getElementById('gif-size');
  const gifDimensionsEl = document.getElementById('gif-dimensions');
  const gifFramesEl = document.getElementById('gif-frames');

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  let currentFile = null;
  let videoWidth = 0;
  let videoHeight = 0;
  let duration = 0;
  let gifEncoder = null;
  let isCancelled = false;
  let generatedGifBlob = null;
  let generatedGifUrl = null;

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
    const validTypes = ['video/quicktime', 'video/mp4', 'video/x-m4v'];
    const validExtensions = ['.mov', '.mp4', '.m4v'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      ToolTemplate.showToast('Please upload a MOV, MP4, or M4V video file', 4000);
      return;
    }

    currentFile = file;
    
    // Create object URL for video
    const videoUrl = URL.createObjectURL(file);
    previewVideo.src = videoUrl;
    
    // Wait for metadata
    previewVideo.onloadedmetadata = () => {
      videoWidth = previewVideo.videoWidth;
      videoHeight = previewVideo.videoHeight;
      duration = previewVideo.duration;
      
      // Update UI
      fileName.textContent = file.name;
      videoDimensions.textContent = `${videoWidth}×${videoHeight}`;
      videoDuration.textContent = formatDuration(duration);
      fileSize.textContent = ToolTemplate.formatFileSize(file.size);
      
      // Set initial width slider max based on video width
      widthSlider.max = Math.min(videoWidth, 1920);
      widthSlider.value = Math.min(480, videoWidth);
      updateWidthValue();
      
      // Show preview and settings
      dropZone.style.display = 'none';
      videoPreview.classList.add('visible');
      settingsPanel.classList.add('visible');
      outputSection.classList.remove('visible');
      
      // Update frame estimate
      updateFrameEstimate();
      
      ToolTemplate.showToast('Video loaded!');
    };
    
    previewVideo.onerror = () => {
      ToolTemplate.showToast('Error loading video. Try a different file.', 4000);
      resetToUpload();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Update width value display
   */
  function updateWidthValue() {
    widthValue.textContent = `${widthSlider.value}px`;
  }

  /**
   * Update FPS value display
   */
  function updateFpsValue() {
    fpsValue.textContent = `${fpsSelect.value} FPS`;
  }

  /**
   * Update quality value display
   */
  function updateQualityValue() {
    qualityValue.textContent = qualitySlider.value;
  }

  /**
   * Update frame estimate
   */
  function updateFrameEstimate() {
    if (duration > 0) {
      const fps = parseInt(fpsSelect.value);
      const frames = Math.ceil(duration * fps);
      frameEstimate.textContent = `~${frames} frames`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONVERSION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Start GIF conversion
   */
  async function startConversion() {
    if (!currentFile || !previewVideo.src) {
      ToolTemplate.showToast('Please upload a video first');
      return;
    }

    isCancelled = false;
    
    // Get settings
    const outputWidth = parseInt(widthSlider.value);
    const fps = parseInt(fpsSelect.value);
    const quality = parseInt(qualitySlider.value);
    
    // Calculate output height maintaining aspect ratio
    const aspectRatio = videoHeight / videoWidth;
    const outputHeight = Math.round(outputWidth * aspectRatio);
    
    // Show progress
    settingsPanel.classList.remove('visible');
    progressSection.classList.add('visible');
    outputSection.classList.remove('visible');
    
    updateProgress(0, 'Initializing...');
    
    try {
      // Create canvas for frame extraction
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');
      
      // Calculate frames
      const frameInterval = 1 / fps;
      const totalFrames = Math.ceil(duration * fps);
      const frames = [];
      
      updateProgress(0, `Extracting ${totalFrames} frames...`);
      progressStatus.textContent = 'Extracting frames...';
      
      // Extract frames by seeking through video
      for (let i = 0; i < totalFrames && !isCancelled; i++) {
        const time = i * frameInterval;
        
        // Seek to time and capture frame
        const frameData = await captureFrame(previewVideo, ctx, canvas, time, outputWidth, outputHeight);
        frames.push(frameData);
        
        const extractProgress = ((i + 1) / totalFrames) * 50; // First 50% is extraction
        updateProgress(extractProgress, `Extracting frame ${i + 1} of ${totalFrames}`);
      }
      
      if (isCancelled) {
        resetAfterCancel();
        return;
      }
      
      // Create GIF encoder
      progressStatus.textContent = 'Encoding GIF...';
      updateProgress(50, 'Starting GIF encoding...');
      
      gifEncoder = new GIF({
        workers: 4,
        quality: 21 - quality, // gif.js uses inverse quality (1 = best, 20 = worst)
        width: outputWidth,
        height: outputHeight,
        workerScript: 'gif.worker.js'
      });
      
      // Add frames to encoder
      const delay = Math.round(1000 / fps); // Delay in ms
      frames.forEach((frameData, i) => {
        if (!isCancelled) {
          gifEncoder.addFrame(frameData, { delay, copy: true });
        }
      });
      
      if (isCancelled) {
        gifEncoder.abort();
        resetAfterCancel();
        return;
      }
      
      // Handle encoding progress
      gifEncoder.on('progress', (p) => {
        const totalProgress = 50 + (p * 50); // Second 50% is encoding
        updateProgress(totalProgress, `Encoding: ${Math.round(p * 100)}%`);
      });
      
      // Handle completion
      gifEncoder.on('finished', (blob) => {
        if (isCancelled) {
          resetAfterCancel();
          return;
        }
        
        // Clean up old URL
        if (generatedGifUrl) {
          URL.revokeObjectURL(generatedGifUrl);
        }
        
        generatedGifBlob = blob;
        generatedGifUrl = URL.createObjectURL(blob);
        
        // Show result
        showResult(blob, outputWidth, outputHeight, totalFrames);
      });
      
      // Start rendering
      gifEncoder.render();
      
    } catch (error) {
      console.error('Conversion error:', error);
      ToolTemplate.showToast('Error during conversion. Please try again.', 4000);
      resetAfterError();
    }
  }

  /**
   * Capture a single frame from video
   */
  function captureFrame(video, ctx, canvas, time, width, height) {
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        ctx.drawImage(video, 0, 0, width, height);
        resolve(ctx.getImageData(0, 0, width, height));
      };
      
      video.addEventListener('seeked', onSeeked);
      video.currentTime = Math.min(time, video.duration - 0.001);
    });
  }

  /**
   * Update progress UI
   */
  function updateProgress(percent, detail) {
    progressPercent.textContent = `${Math.round(percent)}%`;
    progressBar.style.width = `${percent}%`;
    progressDetail.textContent = detail;
  }

  /**
   * Cancel conversion
   */
  function cancelConversion() {
    isCancelled = true;
    if (gifEncoder) {
      gifEncoder.abort();
    }
    ToolTemplate.showToast('Conversion cancelled');
  }

  /**
   * Reset after cancel
   */
  function resetAfterCancel() {
    progressSection.classList.remove('visible');
    settingsPanel.classList.add('visible');
    gifEncoder = null;
  }

  /**
   * Reset after error
   */
  function resetAfterError() {
    progressSection.classList.remove('visible');
    settingsPanel.classList.add('visible');
    gifEncoder = null;
  }

  /**
   * Show conversion result
   */
  function showResult(blob, width, height, frames) {
    // Update UI
    gifPreview.src = generatedGifUrl;
    gifSizeEl.textContent = ToolTemplate.formatFileSize(blob.size);
    gifDimensionsEl.textContent = `${width}×${height}`;
    gifFramesEl.textContent = frames;
    
    // Show output section
    progressSection.classList.remove('visible');
    outputSection.classList.add('visible');
    
    ToolTemplate.showToast('GIF created successfully!');
  }

  /**
   * Download the generated GIF
   */
  function downloadGif() {
    if (!generatedGifBlob) {
      ToolTemplate.showToast('No GIF to download');
      return;
    }
    
    const link = document.createElement('a');
    link.href = generatedGifUrl;
    
    // Generate filename from original
    const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}.gif`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    ToolTemplate.showToast('GIF downloaded!');
  }

  /**
   * Go back to settings for reconversion
   */
  function reconvert() {
    outputSection.classList.remove('visible');
    settingsPanel.classList.add('visible');
  }

  /**
   * Reset to upload new video
   */
  function resetToUpload() {
    // Clean up
    if (generatedGifUrl) {
      URL.revokeObjectURL(generatedGifUrl);
    }
    if (previewVideo.src) {
      URL.revokeObjectURL(previewVideo.src);
    }
    
    currentFile = null;
    generatedGifBlob = null;
    generatedGifUrl = null;
    previewVideo.src = '';
    gifPreview.src = '';
    fileInput.value = '';
    
    // Reset UI
    videoPreview.classList.remove('visible');
    settingsPanel.classList.remove('visible');
    progressSection.classList.remove('visible');
    outputSection.classList.remove('visible');
    dropZone.style.display = '';
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Format duration in seconds to mm:ss
   */
  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    
    // Settings
    widthSlider.addEventListener('input', () => {
      updateWidthValue();
    });
    
    fpsSelect.addEventListener('change', () => {
      updateFpsValue();
      updateFrameEstimate();
    });
    
    qualitySlider.addEventListener('input', () => {
      updateQualityValue();
    });
    
    // Buttons
    convertBtn.addEventListener('click', startConversion);
    changeVideoBtn.addEventListener('click', resetToUpload);
    cancelBtn.addEventListener('click', cancelConversion);
    downloadBtn.addEventListener('click', downloadGif);
    reconvertBtn.addEventListener('click', reconvert);
    newVideoBtn.addEventListener('click', resetToUpload);
    
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

