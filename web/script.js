/**
 * Cuovare Website JavaScript
 * Advanced interactive features and animations with premium libraries
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    initializeMobileMenu();
    initializeSmoothScrolling();
    initializeScrollEffects();
    initializeAnimationObserver();
    initializeInteractiveElements();
    initializeParticles();
    initializeTypedText();
    initializeGSAPAnimations();
    initializePerformanceMetrics();
    initializeThreeJSBackground();
});

/**
 * Initialize Particles.js Background
 */
function initializeParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            particles: {
                number: {
                    value: 80,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: ['#667eea', '#764ba2', '#f093fb', '#f5576c']
                },
                shape: {
                    type: 'circle',
                    stroke: {
                        width: 0,
                        color: '#000000'
                    }
                },
                opacity: {
                    value: 0.3,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 1,
                        opacity_min: 0.1,
                        sync: false
                    }
                },
                size: {
                    value: 3,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 2,
                        size_min: 0.1,
                        sync: false
                    }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#667eea',
                    opacity: 0.2,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 1,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false,
                    attract: {
                        enable: false,
                        rotateX: 600,
                        rotateY: 1200
                    }
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: {
                        enable: true,
                        mode: 'grab'
                    },
                    onclick: {
                        enable: true,
                        mode: 'push'
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 140,
                        line_linked: {
                            opacity: 0.5
                        }
                    },
                    push: {
                        particles_nb: 4
                    }
                }
            },
            retina_detect: true
        });
    }
}

/**
 * Initialize Typed.js Text Animation
 */
function initializeTypedText() {
    if (typeof Typed !== 'undefined') {
        const heroTyped = document.getElementById('typed-hero');
        if (heroTyped) {
            new Typed('#typed-hero', {
                strings: [
                    'Revolutionary AI-Powered Development',
                    'Intelligent Code Understanding',
                    'Predictive Development Tools',
                    'The Future of Programming'
                ],
                typeSpeed: 60,
                backSpeed: 30,
                backDelay: 2000,
                startDelay: 1000,
                loop: true,
                showCursor: true,
                cursorChar: '|',
                autoInsertCss: true
            });
        }
    }
}

/**
 * Initialize GSAP Animations
 */
function initializeGSAPAnimations() {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Hero section animations
        const heroTl = gsap.timeline();
        heroTl.from('.floating', {
            y: 50,
            opacity: 0,
            duration: 1.5,
            ease: 'power3.out'
        })
        .from('h1', {
            y: 30,
            opacity: 0,
            duration: 1,
            ease: 'power2.out'
        }, '-=1')
        .from('.hero-description', {
            y: 20,
            opacity: 0,
            duration: 1,
            ease: 'power2.out'
        }, '-=0.5');

        // Performance metrics animation
        gsap.utils.toArray('.performance-bar').forEach((bar, index) => {
            gsap.fromTo(bar, 
                { width: '0%' },
                {
                    width: bar.dataset.width,
                    duration: 2,
                    ease: 'power2.out',
                    delay: index * 0.3,
                    scrollTrigger: {
                        trigger: bar,
                        start: 'top 80%',
                        once: true
                    }
                }
            );
        });

        // Feature cards stagger animation
        gsap.utils.toArray('.feature-card').forEach((card, index) => {
            gsap.fromTo(card,
                { y: 50, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    delay: index * 0.1,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 85%',
                        once: true
                    }
                }
            );
        });

        // Floating icons animation
        gsap.utils.toArray('.floating').forEach(element => {
            gsap.to(element, {
                y: '-20px',
                duration: 3,
                ease: 'power1.inOut',
                yoyo: true,
                repeat: -1
            });
        });
    }
}

/**
 * Animate Performance Metrics
 */
function initializePerformanceMetrics() {
    const animateCounter = (element, target, duration = 2000) => {
        let start = 0;
        const increment = target / (duration / 16);
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = target.toString() + (target < 100 ? '%' : 'ms');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(start).toString() + (target < 100 ? '%' : 'ms');
            }
        }, 16);
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counters = entry.target.querySelectorAll('.metric-counter');
                counters.forEach(counter => {
                    const target = parseFloat(counter.dataset.target);
                    animateCounter(counter, target);
                });
                observer.unobserve(entry.target);
            }
        });
    });

    document.querySelectorAll('.metrics-container').forEach(container => {
        observer.observe(container);
    });
}

/**
 * Initialize Three.js Background Effects
 */
function initializeThreeJSBackground() {
    if (typeof THREE !== 'undefined') {
        // Create subtle 3D background for technology section
        const container = document.querySelector('#technology');
        if (container) {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000, 0);
            
            // Create floating geometric shapes
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x667eea, 
                wireframe: true,
                transparent: true,
                opacity: 0.1 
            });
            
            const cubes = [];
            for (let i = 0; i < 20; i++) {
                const cube = new THREE.Mesh(geometry, material);
                cube.position.x = (Math.random() - 0.5) * 20;
                cube.position.y = (Math.random() - 0.5) * 20;
                cube.position.z = (Math.random() - 0.5) * 20;
                cube.rotation.x = Math.random() * Math.PI;
                cube.rotation.y = Math.random() * Math.PI;
                scene.add(cube);
                cubes.push(cube);
            }
            
            camera.position.z = 10;
            
            // Animation loop
            const animate = () => {
                requestAnimationFrame(animate);
                
                cubes.forEach(cube => {
                    cube.rotation.x += 0.01;
                    cube.rotation.y += 0.01;
                });
                
                renderer.render(scene, camera);
            };
            
            // Only initialize if in viewport
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        container.appendChild(renderer.domElement);
                        renderer.domElement.style.position = 'absolute';
                        renderer.domElement.style.top = '0';
                        renderer.domElement.style.left = '0';
                        renderer.domElement.style.zIndex = '1';
                        renderer.domElement.style.pointerEvents = 'none';
                        animate();
                        observer.unobserve(entry.target);
                    }
                });
            });
            
            observer.observe(container);
            
            // Handle resize
            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }
    }
}

/**
 * Mobile Menu Functionality
 */
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            const isHidden = mobileMenu.classList.contains('hidden');
            
            if (isHidden) {
                mobileMenu.classList.remove('hidden');
                mobileMenu.classList.add('mobile-menu-enter');
                mobileMenuBtn.innerHTML = '<i class="fas fa-times text-xl"></i>';
            } else {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('mobile-menu-enter');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>';
            }
        });

        // Close mobile menu when clicking on links
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('mobile-menu-enter');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>';
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!mobileMenuBtn.contains(event.target) && !mobileMenu.contains(event.target)) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('mobile-menu-enter');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>';
            }
        });
    }
}

/**
 * Smooth Scrolling for Navigation Links
 */
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.offsetTop;
                const offsetPosition = elementPosition - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Navigation Scroll Effects
 */
function initializeScrollEffects() {
    const nav = document.querySelector('nav');
    let lastScrollTop = 0;
    let isScrolling = false;

    function handleScroll() {
        if (!isScrolling) {
            window.requestAnimationFrame(function() {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                // Add background to nav when scrolling
                if (scrollTop > 100) {
                    nav.classList.add('bg-gray-900', 'bg-opacity-95', 'shadow-lg');
                } else {
                    nav.classList.remove('bg-gray-900', 'bg-opacity-95', 'shadow-lg');
                }

                // Hide/show nav on scroll
                if (scrollTop > lastScrollTop && scrollTop > 200) {
                    // Scrolling down
                    nav.style.transform = 'translateY(-100%)';
                } else {
                    // Scrolling up
                    nav.style.transform = 'translateY(0)';
                }

                lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
                isScrolling = false;
            });
            isScrolling = true;
        }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Intersection Observer for Animations
 */
function initializeAnimationObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fadeInUp');
                // Add staggered animation delay for multiple elements
                const siblings = Array.from(entry.target.parentNode.children);
                const index = siblings.indexOf(entry.target);
                entry.target.style.animationDelay = `${index * 0.1}s`;
            }
        });
    }, observerOptions);

    // Observe feature cards and roadmap items
    document.querySelectorAll('.glass-effect, .feature-card, .roadmap-item').forEach(el => {
        observer.observe(el);
    });

    // Observe sections for navigation highlighting
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (id) {
                    updateActiveNavigation(id);
                }
            }
        });
    }, { threshold: 0.3 });

    document.querySelectorAll('section[id]').forEach(section => {
        sectionObserver.observe(section);
    });
}

/**
 * Update Active Navigation Item
 */
function updateActiveNavigation(activeId) {
    document.querySelectorAll('nav a[href^="#"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href === `#${activeId}`) {
            link.classList.add('text-purple-400');
        } else {
            link.classList.remove('text-purple-400');
        }
    });
}

/**
 * Interactive Elements
 */
function initializeInteractiveElements() {
    // Add hover effects to cards
    document.querySelectorAll('.glass-effect').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.classList.add('hover-glow');
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hover-glow');
        });
    });

    // Add click effects to buttons
    document.querySelectorAll('button, .btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add typing effect to code blocks
    initializeTypingEffect();
    
    // Initialize status indicators
    initializeStatusIndicators();
}

/**
 * Typing Effect for Code Blocks
 */
function initializeTypingEffect() {
    const codeBlocks = document.querySelectorAll('.code-animation');
    
    codeBlocks.forEach(block => {
        const text = block.textContent;
        block.textContent = '';
        let i = 0;
        
        function typeWriter() {
            if (i < text.length) {
                block.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            } else {
                setTimeout(() => {
                    block.textContent = '';
                    i = 0;
                    setTimeout(typeWriter, 1000);
                }, 2000);
            }
        }
        
        // Start typing effect when element comes into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    typeWriter();
                    observer.unobserve(entry.target);
                }
            });
        });
        
        observer.observe(block);
    });
}

/**
 * Status Indicators Animation
 */
function initializeStatusIndicators() {
    const statusDots = document.querySelectorAll('.animate-pulse');
    
    statusDots.forEach((dot, index) => {
        // Stagger the pulse animation
        dot.style.animationDelay = `${index * 0.3}s`;
    });
}

/**
 * Utility Functions
 */

// Throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Debounce function for performance
function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    nav {
        transition: transform 0.3s ease, background-color 0.3s ease;
    }
`;
document.head.appendChild(style);
