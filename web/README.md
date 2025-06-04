# Cuovare Website

A beautiful, responsive website showcasing the Cuovare VS Code extension.

## File Structure

```
web/
├── index.html      # Main HTML structure
├── styles.css      # Custom CSS styles and animations  
├── script.js       # Interactive JavaScript functionality
└── README.md       # This file
```

## Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Modern Animations**: Smooth scrolling, hover effects, and entrance animations
- **Glass Morphism**: Beautiful translucent effects throughout
- **Performance Optimized**: Minimal dependencies, optimized loading
- **Accessibility**: Proper focus states, reduced motion support, high contrast mode

## Technologies Used

- **HTML5**: Semantic markup structure
- **Tailwind CSS**: Utility-first CSS framework (via CDN)
- **Custom CSS**: Enhanced animations and effects
- **Vanilla JavaScript**: Modern ES6+ features for interactivity
- **Font Awesome**: Icon library
- **Google Fonts**: Inter and Fira Code typography

## Key Sections

1. **Hero Section**: Eye-catching introduction with animated elements
2. **Features**: Showcase of 6 main capabilities with interactive cards
3. **Roadmap**: Development timeline with 4 phases
4. **Documentation**: Getting started guides and resources
5. **Footer**: Links and community information

## Development

To work on the website:

1. Open `index.html` in a web browser
2. For live reloading, use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using VS Code Live Server extension
   Right-click index.html > "Open with Live Server"
   ```

## Performance Notes

- All external resources are loaded from CDN for optimal caching
- Images are optimized for web delivery  
- JavaScript is modular and only runs when needed
- CSS animations respect user's motion preferences

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Customization

### Colors
The color scheme is defined in CSS custom properties. Main colors:
- Primary: `#667eea` (purple-blue)
- Secondary: `#764ba2` (deep purple)
- Accent: Various gradients between primary colors

### Animations
All animations can be disabled by users with motion sensitivity via `prefers-reduced-motion` media query.

### Content
To update content, edit the respective sections in `index.html`. The structure is clearly commented and organized.

## Deployment

The website is static and can be deployed to any web server or CDN:

- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any traditional web hosting

Simply upload all files to your web server's public directory.
