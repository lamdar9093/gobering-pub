# Overview

Gobering is a French medical appointment booking platform connecting patients with healthcare professionals. It facilitates searching for providers, online appointment booking, and medical schedule management. The platform aims to provide a modern, efficient, and user-friendly experience for both patients and healthcare providers.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
-   **Framework**: React 18 with TypeScript and Vite.
-   **UI Components**: Shadcn/ui (Radix UI based), Tailwind CSS.
-   **State Management**: TanStack Query.
-   **Form Handling**: React Hook Form with Zod validation.
-   **UI/UX**: Clean, professional design with intuitive navigation. Features include horizontal search results with inline availability, weekly booking views, and dedicated interfaces for client/professional management.
    -   **Hero Banner Modernization** (November 2025): Complete redesign inspired by Doctolib and GoRendezVous.
        -   **Taller Design**: Increased vertical height with 65-70vh minimum on desktop (py-10 sm:py-16 padding).
        -   **Wave Transition**: Smooth SVG wave divider replaces straight edge for modern aesthetic.
        -   **Elegant Overlap**: Next section slides under wave using negative margins (-mt-10 sm:-mt-12 md:-mt-16).
        -   **Responsive**: Wave scales from 48px (mobile) → 64px (tablet) → 96px (desktop).
        -   **Accessibility**: Wave marked aria-hidden, all interactive elements maintain 44px minimum WCAG compliance.
        -   **Implementation**: hero-section.tsx (wave SVG), professions-grid.tsx (overlap effect).
    -   **B2B Launch Strategy** (December 2025): Homepage transformed to professional-focused model.
        -   **Hero Section**: Title "Simplifiez la gestion de vos rendez-vous", 2 CTA buttons (Commencer gratuitement + Découvrir les fonctionnalités), Se connecter in top right.
        -   **Features Grid**: Replaced patient search professions grid with 8 professional features (Calendrier, Clients, Rappels, Widgets, Statistiques, Disponibilités, Multi-clinique, Mobile).
        -   **How It Works**: New 3-step section (Créer compte, Configurer services, Partager lien) with visual flow.
        -   **CTA Updates**: Professional signup focus with "21 jours essai gratuit" badge.
        -   **Rationale**: Hide patient search until provider density improves; focus on B2B acquisition first, reactivate patient search when inventory supports discovery.
-   **Branding**: 
    -   **Logo Icon**: CalendarCheck (calendar with checkmark) used consistently across all Gobering brand logos site-wide, matching the favicon.
    -   **Favicon**: CalendarCheck icon in Gobering blue (#2196F3) displays in browser tabs.
    -   **Logo Locations** (November 2025): All 8 brand logo instances updated to CalendarCheck:
        -   Homepage hero section (hero-section.tsx)
        -   Professional landing page header and footer (ProLanding.tsx)
        -   Pricing page (Tarifs.tsx)
        -   Search results page (SearchResults.tsx)
        -   Contact page (Contact.tsx)
        -   Authenticated pages header (header.tsx)
        -   Professional auth header (ProHeader.tsx)
    -   **Feature Icons**: Calendar icon (without checkmark) intentionally used for calendar functionality (navigation menus, loading animations, feature descriptions).
-   **Cache Management** (November 2025): Critical fix for onboarding tour preventing stale data issues.
    -   **Problem**: After password reset, existing accounts saw onboarding tour due to stale React Query cache.
    -   **Solution**: `removeQueries` + `prefetchQuery` pattern ensures fresh `/api/auth/me` data before navigation.
    -   **Implementation**: Applied in ProLogin.tsx for both login and first-password-change mutations.
    -   **Pattern**: `queryClient.removeQueries()` → `await queryClient.prefetchQuery({ staleTime: 0 })` → `setLocation()`.
    -   **Guarantee**: Dashboard always receives fresh `hasCompletedOnboarding` from database, preventing tour regressions.
-   **Key Features**:
    -   Appointment management (booking, cancellation, rescheduling) with unique tokens and email notifications.
    -   Beneficiary booking for others.
    -   Dynamic availability with customizable buffer times.
    -   Timezone handling (America/Toronto to UTC conversion).
    -   Client management with sorting, filtering, pagination, and deduplication.
    -   Secure profile management.
    -   CRUD for services.
    -   Role-Based Access Control (Admin, Professionnel, Secrétaire) with dynamic navigation and access.
    -   Secretary workflow for managing assigned professionals.
    -   Comprehensive waitlist system with automatic notifications and priority booking.
    -   Customizable external booking widgets (HTML button and iFrame).
    -   Modernized public professional profile pages with interactive service selection and waitlist integration.

## Backend
-   **Runtime**: Node.js with Express.js.
-   **Language**: TypeScript.
-   **Database ORM**: Drizzle ORM.
-   **API Structure**: RESTful API.
-   **Key Features**:
    -   Data integrity (prevents double-booking, manages slot release).
    -   Secure cancellation token generation.
    -   Role-based patient data access.
    -   Secretary authorization security for cross-professional operations.
    -   Waitlist automation with FIFO queue, token-based priority booking, and expiry handling.
    -   SMS notifications via Twilio for PRO plan users.
    -   Automatic error monitoring with email notifications to operations team for all backend (500) and frontend (React) errors.
    -   Soft delete system for professionals with undo functionality (restoration within session).
    -   **Dual Service System** (November 2025): Supports both legacy individual services and new clinic-based services.
        -   **Problem**: After deleting all clinic services, search results still showed old services from legacy table.
        -   **Solution**: `getProfessionalServices()` checks if professional has `clinicId` before fallback.
        -   **Logic**: Clinic professionals return empty array when no services (no fallback), non-clinic professionals use legacy table.
        -   **Benefit**: Consistent behavior between widget and search results when services are deleted.
    -   **Email Verification System** (November 2025): Prevents fake account creation by requiring email verification before login.
        -   **Security**: SHA-256 hashed tokens, 24-hour expiration, single-use, rate-limited resend (5/hour).
        -   **Flow**: Registration → verification email → email confirmation → login enabled.
        -   **Migration**: Existing users (4 accounts) auto-verified with `verification_method='migrated'` to prevent lockouts.
        -   **Routes**: GET /api/verify-email/:token (verify), POST /api/resend-verification (resend).
        -   **Frontend Pages**: /verify-email-pending (post-registration), /verify-email/:token (confirmation).
        -   **Login Protection**: Blocks unverified users with HTTP 403 + structured error redirect.

## Database
-   **Primary Database**: PostgreSQL (Neon serverless driver).
-   **Schema Management**: Drizzle Kit.
-   **Core Entities**: Users, Professionals, Appointments.
-   **Validation**: Zod schemas.
-   **Required Extensions**: PostgreSQL `unaccent` extension for accent-insensitive search (enabled via `CREATE EXTENSION IF NOT EXISTS unaccent;`).
-   **Public Search**: Secretaries (role='Secrétaire') are automatically excluded from public professional search results. Only professionals with role='Admin' or 'Professionnel' appear in searches.
-   **Performance Optimization** (November 2025):
    -   **Automatic Indexing**: Database indexes auto-created at startup on frequently queried columns.
    -   **Indexed Tables**: `professional_breaks.professional_id`, `professional_schedules.professional_id`, `appointments(professional_id, appointment_date)`, `appointments.patient_id`, `clinic_members.professional_id`.
    -   **Query Optimization**: Parallel execution of independent database queries in critical endpoints.
    -   **Cached Data Reuse**: Eliminated redundant database calls by reusing already-fetched data within requests.

## Subscription System
-   **Model**: Multi-tier (Legacy, Free, Pro, LAMDAA) with seat-based billing.
    -   **LAMDAA**: Special permanent accounts with lifetime Pro access, no expiration.
-   **Trial**: 21-day PRO access for new professionals.
-   **Integration**: Stripe Checkout and Customer Portal.
-   **Inheritance**: Invited members inherit the Admin's subscription status.
-   **Read-Only Mode**: Activated upon trial expiry or unpaid subscriptions, blocking write access.
-   **Automated System**: Email reminders and read-only enforcement via cron jobs.
-   **Environment Management**: Automatic detection of development vs production environment.
    -   **Development**: Uses TESTING_* prefixed Stripe keys for safe testing.
    -   **Production**: Uses standard Stripe keys (REPLIT_DEPLOYMENT=1 or NODE_ENV=production).
    -   **Validation**: Startup validation ensures all required keys are present and correctly formatted.
    -   **Configuration**: See STRIPE_SETUP.md for detailed setup instructions.
-   **Duplicate Prevention**: Smart subscription management prevents multiple active subscriptions.
    -   **Update vs Create**: System updates existing active subscriptions instead of creating duplicates.
    -   **Automatic Cleanup**: Webhooks cancel old subscriptions when new ones are created.
    -   **Seat Management**: Subscription items (base + additional seats) updated via Stripe API with proper proration.
    -   **Edge Cases**: Handles canceled/incomplete subscriptions and missing Stripe references gracefully.
-   **Special LAMDAA Accounts** (Permanent Pro Access):
    -   **Configuration**: isLamdaaAccount=true (users table), planType='pro', subscriptionStatus='active', subscriptionEndsAt=null
    -   **Protection**: Cron jobs skip LAMDAA accounts to prevent automatic downgrades
    -   **Management** (February 2026): Centralized email-based configuration
        -   **Config File**: `server/config/lamdaa-accounts.ts` - Single source of truth for LAMDAA emails
        -   **Auto-Sync**: `syncLamdaaAccounts()` runs at server startup to sync database with config
        -   **Auto-Register**: New registrations with LAMDAA emails are automatically marked
        -   **How to Add/Remove**: Edit `LAMDAA_EMAILS` array in config file, restart server
    -   **Current LAMDAA Accounts**:
        -   leuz20028@yahoo.fr (Lamda Lamda - Admin)
        -   sodasarrdieng@gmail.com (Soda Sarr - Professionnel)
        -   simrodrigue@outlook.com (Simon Rodrigue)

# External Dependencies

## UI Framework
-   Radix UI
-   Lucide React
-   Tailwind CSS

## Backend Services
-   Neon Database (PostgreSQL)
-   Drizzle ORM
-   Express Session
-   Stripe (Payment Processing)
-   Twilio (SMS Notifications)
-   Resend (Email Notifications)
    -   HTML email templates with table-based buttons for universal client compatibility (Gmail, Outlook, Yahoo, Apple Mail)
    -   Transactional emails: appointment confirmations, password resets, team invitations, waitlist notifications

## Additional Libraries
-   TanStack Query
-   React Hook Form
-   Zod
-   Date-fns
-   Class Variance Authority