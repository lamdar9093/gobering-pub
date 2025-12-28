import { useState, useEffect, useRef, RefObject } from 'react';

interface UseScrollVisibilityOptions {
  threshold?: number; // Minimum scroll distance to trigger hide
  onSearchSubmit?: boolean; // Whether search was just submitted
  headerRef?: RefObject<HTMLElement>; // Header element to exclude
}

// Check if element is interactive (button, link, input, etc.)
function isInteractiveElement(element: HTMLElement): boolean {
  // Check the element itself and its parents (up to 5 levels)
  let current: HTMLElement | null = element;
  let depth = 0;
  
  while (current && depth < 5) {
    const tagName = current.tagName.toLowerCase();
    
    // Interactive HTML elements
    if (['button', 'a', 'input', 'select', 'textarea', 'label'].includes(tagName)) {
      return true;
    }
    
    // Elements with interactive roles or attributes
    if (
      current.hasAttribute('role') && 
      ['button', 'link', 'tab', 'menuitem'].includes(current.getAttribute('role') || '')
    ) {
      return true;
    }
    
    // Elements with click handlers or testids suggesting interactivity
    if (
      current.onclick !== null ||
      current.getAttribute('data-testid')?.includes('button') ||
      current.getAttribute('data-testid')?.includes('link') ||
      current.classList.contains('cursor-pointer')
    ) {
      return true;
    }
    
    current = current.parentElement;
    depth++;
  }
  
  return false;
}

export function useScrollVisibility({ 
  threshold = 30, // Increased from 10 to ignore micro-scrolls from input focus
  onSearchSubmit = false,
  headerRef
}: UseScrollVisibilityOptions = {}) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const touchStartY = useRef(0);
  const lastToggleTime = useRef(0); // Track last toggle to prevent double-firing
  const lastInputFocusTime = useRef(Date.now() - 10000); // Init to past time so first scroll works

  useEffect(() => {
    // Always show when search is submitted
    if (onSearchSubmit) {
      setIsVisible(true);
      lastScrollY.current = window.scrollY;
    }
  }, [onSearchSubmit]);

  useEffect(() => {
    // Initialize lastScrollY
    lastScrollY.current = window.scrollY;

    const isMobile = () => window.innerWidth < 768;

    // Track when inputs receive focus to ignore auto-scroll
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        lastInputFocusTime.current = Date.now();
      }
    };

    const handleScroll = () => {
      // Only apply scroll behavior on mobile
      if (!isMobile()) {
        setIsVisible(true);
        return;
      }

      // Ignore scrolls for 500ms after focusing an input (browser auto-scroll protection)
      const timeSinceInputFocus = Date.now() - lastInputFocusTime.current;
      if (timeSinceInputFocus < 500) {
        lastScrollY.current = window.scrollY;
        return;
      }

      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY.current;

      // Hide on scroll in ANY direction (up or down)
      // Threshold is 30px to ignore small jitters
      if (Math.abs(scrollDifference) > threshold && currentScrollY > 50) {
        setIsVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Only apply touch behavior on mobile
      if (!isMobile()) return;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only apply touch behavior on mobile
      if (!isMobile()) return;

      const touchEndY = e.changedTouches[0].clientY;
      const touchDifference = Math.abs(touchEndY - touchStartY.current);

      // If it's a tap (minimal movement), check if it's an interactive element
      if (touchDifference < 10) {
        const target = e.target as HTMLElement;
        
        // Don't toggle if clicked on header
        if (headerRef?.current && headerRef.current.contains(target)) {
          return;
        }
        
        // Don't toggle if clicked on interactive element (button, link, etc.)
        if (isInteractiveElement(target)) {
          return;
        }
        
        // Prevent double-toggle (touchend + click firing for same tap)
        const now = Date.now();
        if (now - lastToggleTime.current < 300) {
          return;
        }
        lastToggleTime.current = now;
        
        // Toggle visibility for non-interactive areas
        setIsVisible(prev => !prev);
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Only apply click behavior on mobile
      if (!isMobile()) return;

      const target = e.target as HTMLElement;
      
      // Don't toggle if clicked on header
      if (headerRef?.current && headerRef.current.contains(target)) {
        return;
      }
      
      // Don't toggle if clicked on interactive element (button, link, input, etc.)
      if (isInteractiveElement(target)) {
        return;
      }
      
      // Prevent double-toggle (touchend + click firing for same tap)
      const now = Date.now();
      if (now - lastToggleTime.current < 300) {
        return;
      }
      lastToggleTime.current = now;
      
      // Toggle visibility for non-interactive areas (empty space, divs, etc.)
      setIsVisible(prev => !prev);
    };

    // Add event listeners unconditionally
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('click', handleClick);
    };
  }, [threshold, headerRef]);

  return isVisible;
}
