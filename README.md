# Moose's Toolbox

A collection of browser-based utility tools with a polished, responsive design. All tools run entirely in your browser — no files are uploaded to any server.

## View Locally

The simplest way — just open `index.html` directly in your browser:

```bash
open index.html
```

Or use a local server for a more realistic environment:

```bash
# Using Python (built-in)
python3 -m http.server 3000

# Using Node.js
npx serve .
```

Then visit `http://localhost:3000` in your browser.

## Live Site

Visit: **[tools.mhismail.com](https://tools.mhismail.com)**

## File Structure

```
tool-template/
├── index.html          # Landing page listing all tools
├── styles.css          # Shared CSS (tokens + components)
├── app.js              # Shared JS (theme, modal, utilities)
├── README.md           # This file
├── _template/          # Starter template for new tools
│   └── index.html      # Copy this to create new tools
└── tools/
    ├── exif-viewer/    # EXIF metadata viewer
    │   ├── index.html
    │   └── app.js
    └── [your-tool]/    # Add more tools here
        ├── index.html
        └── app.js
```

## Deploying to GitHub Pages

1. **Create a new repository** on GitHub (e.g., `tools` or `tool-template`)

2. **Push this folder** to the repository:
   ```bash
   cd tool-template
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/mhismail3/YOUR-REPO.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Choose **main** branch and **/ (root)** folder
   - Click **Save**

4. **Your site is live** at `https://YOUR-USERNAME.github.io/YOUR-REPO/`

## URLs

Once deployed, your tools will be available at:

- **Landing Page**: `https://your-username.github.io/repo-name/`
- **EXIF Viewer**: `https://your-username.github.io/repo-name/tools/exif-viewer/`
- **New Tool**: `https://your-username.github.io/repo-name/tools/your-tool/`

## Creating a New Tool

### Step 1: Copy the Template

```bash
cp -r _template tools/my-new-tool
```

### Step 2: Update Paths

In `tools/my-new-tool/index.html`, update the paths to point to root:

```html
<!-- Shared styles -->
<link rel="stylesheet" href="../../styles.css">

<!-- Shared JS -->
<script src="../../app.js"></script>
```

### Step 3: Customize

Edit your new tool's `index.html`:

```html
<!-- Update the title -->
<title>My New Tool</title>

<!-- Update the favicon emoji -->
<link rel="icon" href="data:image/svg+xml,...🔨...">

<!-- Update the tool icon -->
<div class="tool-icon">🔨</div>

<!-- Update the title -->
<h1 class="tool-title">My New Tool</h1>

<!-- Replace the panel content with your UI -->
<div class="panel-content">
  <!-- Your tool UI here -->
</div>

<!-- Update the info modal -->
<div class="modal-body">
  <h3>How to Use</h3>
  <p>Instructions for your tool...</p>
</div>
```

### Step 4: Add Your Logic

Create `tools/my-new-tool/app.js`:

```javascript
(function() {
  'use strict';

  // Access template utilities
  const { formatFileSize, showToast, copyToClipboard } = window.ToolTemplate;

  function init() {
    // Your tool logic here
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

### Step 5: Add to Landing Page

Edit `index.html` to add your tool to the grid:

```html
<a href="tools/my-new-tool/" class="tool-card">
  <div class="tool-card-icon">🔨</div>
  <div class="tool-card-content">
    <h2 class="tool-card-title">My New Tool</h2>
    <p class="tool-card-desc">
      Brief description of what the tool does.
    </p>
  </div>
</a>
```

## Available Components

### Buttons

```html
<button class="btn">Default</button>
<button class="btn primary">Primary</button>
<button class="btn small">Small</button>
```

### Drop Zone (File Upload)

```html
<div class="drop-zone">
  <div class="drop-zone-icon">📁</div>
  <div class="drop-zone-text">
    <strong>Drop files here</strong>
    or click to browse
  </div>
  <input type="file" accept="image/*">
</div>
```

### Data Table

```html
<table class="data-table">
  <tbody>
    <tr>
      <td class="label-cell">Property</td>
      <td class="value-cell">Value</td>
    </tr>
  </tbody>
</table>
```

### Empty State

```html
<div class="empty-state">
  <div class="empty-state-icon">📦</div>
  <p>No data to display.</p>
</div>
```

## JavaScript API

The template exposes utilities via `window.ToolTemplate`:

```javascript
// Theme
ToolTemplate.toggleTheme();
ToolTemplate.getStoredTheme(); // 'light' or 'dark'
ToolTemplate.applyTheme('dark');

// Modal
ToolTemplate.openInfoModal();
ToolTemplate.closeInfoModal();

// Utilities
ToolTemplate.formatFileSize(1024); // "1 KB"
ToolTemplate.formatDate(new Date());
ToolTemplate.debounce(fn, 300);
await ToolTemplate.copyToClipboard('text');
ToolTemplate.showToast('Message!', 3000);
```

## CSS Custom Properties

Key design tokens:

```css
:root {
  /* Colors */
  --aero: #2c8f7a;      /* Primary accent */
  --pine: #0f7363;      /* Secondary accent */
  --clay: #c45b37;      /* Tertiary accent */
  
  /* Layout */
  --max-width-content: 860px;
  --header-height: 72px;
  
  /* Spacing */
  --space-sm: 8px;
  --space-md: 10px;
  --space-lg: 14px;
  --space-xl: 16px;
  
  /* Radii */
  --radius-sm: 6px;
  --radius-md: 14px;
  --radius-lg: 22px;
}
```

## Browser Support

- Chrome, Edge, Safari, Firefox (modern versions)
- Native `<dialog>` element (Chrome 37+, Firefox 98+, Safari 15.4+)
