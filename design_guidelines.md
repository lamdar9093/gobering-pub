# Design Guidelines: Gobering Healthcare Platform

## Design Approach: Modern Healthcare UX

**Selected Framework**: Clean, minimalist design inspired by Doctolib, ZocDoc, and modern healthcare platforms  
**Rationale**: Medical booking platforms need clarity, trust, and immediate action. The design prioritizes simplicity, professional imagery, and conversion-focused layouts.

---

## Landing Page Hero Section Design

### A. Layout Structure: Split Hero Design

**Desktop Layout (>768px)**:
- **Container**: max-w-7xl mx-auto, py-16 to py-20
- **Grid**: 2 columns (40% text / 60% image)
- **Spacing**: Generous padding and gaps (gap-12 to gap-16)

**Mobile Layout (<768px)**:
- **Single column**: Image hidden or background
- **Content**: Centered, full-width
- **Padding**: Reduced to p-6

### B. Hero Content - Ultra Minimal Text

**Title (Primary Headline)**:
- Font size: text-4xl md:text-5xl lg:text-6xl
- Font weight: font-bold
- Color: text-gray-900 (dark mode: text-white)
- Line height: leading-tight
- Max width: No limit, but keep text short
- **Content**: 3-6 words max (e.g., "Prenez rendez-vous en ligne")

**Subtitle (Supporting Text)**:
- Font size: text-lg md:text-xl
- Font weight: font-normal
- Color: text-gray-600 (dark mode: text-gray-300)
- Max width: max-w-xl
- **Content**: One line max (e.g., "Trouvez votre professionnel en quelques clics")

**NO long descriptive paragraphs in hero** ❌

### C. Color Palette - Modern & Professional

**Primary Colors**:
- Primary Blue: hsl(210, 85%, 45%) - Professional trust
- Light Blue: hsl(210, 95%, 96%) - Soft backgrounds
- Dark Text: hsl(215, 25%, 15%) - High contrast readability

**Accent Colors**:
- Success Green: hsl(145, 70%, 45%) - Trust badges
- Soft Gray: hsl(0, 0%, 98%) - Backgrounds
- Border Gray: hsl(0, 0%, 88%) - Subtle dividers

**Dark Mode**:
- Background: hsl(220, 15%, 10%)
- Card: hsl(220, 15%, 15%)
- Text: hsl(0, 0%, 95%)

### D. Hero Image Guidelines

**Image Requirements**:
- **Content**: Professional diversity (NOT only medical)
  - ✅ Osteopath, psychologist, physiotherapist, dentist, nutritionist
  - ✅ Client consultations, welcoming environments
  - ❌ Avoid doctor-only imagery (no stethoscopes/white coats exclusively)
- **Style**: Natural, authentic, warm but professional
- **Quality**: High resolution (1200px+ width)
- **Aspect Ratio**: 4:3 or 16:9
- **Treatment**: Rounded corners (rounded-2xl), subtle shadow

**Image Positioning**:
- Desktop: Right side, 60% width
- Tablet: 50% width
- Mobile: Hidden or subtle background overlay

### E. Trust Badges (Subtle Integration)

**Badge Design**:
- **Layout**: Horizontal flex, gap-6 to gap-8
- **Size**: Small, unobtrusive (text-sm)
- **Icons**: Minimal line icons (lucide-react)
- **Color**: text-gray-600 with accent icons

**Badge Content Examples**:
- "500+ professionnels" (Users icon)
- "Disponible 24/7" (Clock icon)  
- "Gratuit et sécurisé" (Shield icon)

**Placement**: Below search form or subtitle, mt-6 to mt-8

### F. Search Form Integration

**Form Styling**:
- **Background**: bg-white with border shadow-lg
- **Padding**: p-4 to p-6
- **Border Radius**: rounded-xl
- **Fields**: Clean inputs with placeholder text
- **CTA Button**: High contrast primary color, font-medium

**Form Position**: 
- Center of left column (below subtitle)
- mt-8 spacing from subtitle

---

## Component Specifications

### Hero Section Component

**Container**:
```
- Outer: bg-gradient-to-b from-gray-50 to-white
- Inner: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Padding vertical: py-16 lg:py-20
```

**Grid Structure**:
```
- Desktop: grid grid-cols-2 gap-12 lg:gap-16 items-center
- Mobile: Single column, image hidden
```

**Typography Hierarchy**:
```
1. Main title: text-4xl/5xl/6xl font-bold
2. Subtitle: text-lg/xl text-gray-600
3. Search form: Prominent, shadow-lg
4. Trust badges: text-sm text-gray-500
```

---

## Responsive Behavior

**Breakpoints**:
- Mobile (<640px): Single column, centered text, no image
- Tablet (640-1024px): Adjusted grid gaps, smaller text
- Desktop (>1024px): Full split layout, max spacing

**Image Handling**:
- Desktop: Visible, rounded-2xl, shadow-xl
- Tablet: Smaller, rounded-xl
- Mobile: hidden or absolute background with overlay

---

## Accessibility

**WCAG 2.1 AA Standards**:
- Color contrast ratio: 4.5:1 minimum for text
- Focus indicators: 2px outline on interactive elements
- Keyboard navigation: Tab order logical
- Alt text: Descriptive for hero images
- aria-labels: For icon-only badges

---

## Animation Guidelines

**Entrance Animations** (Optional, subtle):
- Fade-in: opacity 0 to 1, duration-500
- Slide-up: translate-y-4 to 0, duration-700
- Stagger delays: 100ms between elements

**NO**:
- Pulsing effects ❌
- Continuous animations ❌
- Distracting movements ❌

---

## Implementation Notes

**Image Storage**:
- Stock images: /attached_assets/stock_images/
- Import: `import heroImage from "@assets/hero-professional.jpg"`

**CSS Classes Priority**:
- Use Tailwind utility classes
- Custom CSS only for complex gradients
- Follow existing pattern in components

**Testing Checklist**:
- [ ] Desktop (1440px+): Full split layout visible
- [ ] Tablet (768-1024px): Adjusted spacing
- [ ] Mobile (375-640px): Single column, readable
- [ ] Dark mode: Proper color inversion
- [ ] Accessibility: Keyboard navigation works

---

This design ensures a modern, trustworthy, and conversion-focused landing page that welcomes all types of healthcare professionals while maintaining simplicity and clarity.
