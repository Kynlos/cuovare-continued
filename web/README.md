# Cuovare Website

This directory contains the static website for Cuovare, built with Tailwind CSS and designed to look like GitHub's markdown rendering.

## Files

- `index.html` - Main homepage (based on README.md)
- `agent-mode.html` - Agent Mode documentation (based on docs/AGENT_MODE.md)
- `development.html` - Development guide (based on docs/DEVELOPMENT.md)
- `changelog.html` - Version history (based on CHANGELOG.md)
- `styles.css` - GitHub-like markdown styling
- `README.md` - This file

## Features

- 📱 **Responsive Design** - Mobile-first approach with Tailwind CSS
- 🎨 **GitHub-like Styling** - Familiar markdown rendering
- 🔍 **Syntax Highlighting** - Code blocks with highlight.js
- 📊 **Interactive Elements** - Mermaid diagrams and charts
- ⚡ **Fast Loading** - CDN-based resources
- 🧭 **Easy Navigation** - Consistent header navigation

## Development

To serve the website locally:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have serve installed)
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Deployment

This is a static website that can be deployed to:

- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

## Structure

```
web/
├── index.html           # Homepage
├── agent-mode.html      # Agent Mode guide
├── development.html     # Development guide
├── changelog.html       # Version history
├── styles.css          # GitHub-like styling
└── README.md           # This file
```

## Content Sources

The website content is automatically derived from:

- `../README.md` → `index.html`
- `../docs/AGENT_MODE.md` → `agent-mode.html`
- `../docs/DEVELOPMENT.md` → `development.html`
- `../CHANGELOG.md` → `changelog.html`

## Styling

The website uses:

- **Tailwind CSS** via CDN for utilities
- **Highlight.js** for syntax highlighting
- **Mermaid** for diagrams
- **Custom CSS** for GitHub-like markdown rendering

All styling is designed to match GitHub's markdown appearance while being responsive and modern.
