import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { initializeCronJobs } from "./cron";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Trust proxy - required for rate limiting behind reverse proxies (Replit)
app.set('trust proxy', 1);

// IMPORTANT: Stripe webhooks need raw body for signature verification
// These must come BEFORE express.json() to work properly
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Security headers with Helmet
const isProduction = process.env.NODE_ENV === "production";
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction 
          ? ["'self'"] 
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow in dev for Vite
        styleSrc: isProduction 
          ? ["'self'"] 
          : ["'self'", "'unsafe-inline'"], // Allow in dev for inline styles
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://js.stripe.com"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for some external resources
  })
);

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: { error: "Trop de demandes de réinitialisation. Veuillez réessayer dans 1 heure." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for email verification resend
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 resend attempts per hour
  message: { error: "Trop de demandes de renvoi d'email. Veuillez réessayer dans 1 heure." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: { error: "Trop de requêtes. Veuillez réessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith('/api/webhooks') || req.originalUrl.startsWith('/api/stripe/webhook'), // Skip for webhooks
});

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Serve static files from public directory (for uploaded files)
app.use('/uploads', express.static('public/uploads'));

// Export rate limiters for use in routes
export { loginLimiter, passwordResetLimiter, emailVerificationLimiter };

// Session configuration with PostgreSQL store
const PgStore = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  session({
    store: new PgStore({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "gobering-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database extensions (required for accent-insensitive search)
  try {
    await pgPool.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    log('✓ PostgreSQL unaccent extension initialized');
  } catch (error) {
    console.error('Failed to initialize unaccent extension:', error);
    console.error('Accent-insensitive search will not work without this extension');
  }

  // Create performance indexes for frequently queried columns
  try {
    // Index on professional_breaks.professional_id for faster break lookups
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_professional_breaks_professional_id 
      ON professional_breaks(professional_id);
    `);
    
    // Index on professional_schedules.professional_id for faster schedule lookups
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_professional_schedules_professional_id 
      ON professional_schedules(professional_id);
    `);
    
    // Index on appointments for faster conflict checking
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_professional_date 
      ON appointments(professional_id, appointment_date);
    `);
    
    // Index on appointments.patient_id for faster patient appointment lookups
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_id 
      ON appointments(patient_id);
    `);
    
    // Index on clinic_members for faster role lookups
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_clinic_members_professional_id 
      ON clinic_members(professional_id);
    `);
    
    log('✓ Performance indexes created successfully');
  } catch (error) {
    console.error('Failed to create performance indexes:', error);
    console.error('Database queries may be slower without indexes');
  }

  const server = await registerRoutes(app);

  // Global error handler - must be after all routes
  app.use(async (err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === "production";
    
    // Log full error details for developer (visible in server logs)
    console.error('API Error:', {
      path: req.path,
      method: req.method,
      status,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    // Send error notification to operations team for 5xx errors (server errors)
    if (status >= 500) {
      const { sendErrorNotification } = await import('./email');
      
      // Extract user info if available from session
      const userId = req.session?.userId ? parseInt(req.session.userId) : undefined;
      
      sendErrorNotification({
        errorType: 'backend',
        errorMessage: err.message || 'Internal Server Error',
        errorStack: err.stack,
        path: req.path,
        method: req.method,
        userId,
        userAgent: req.get('user-agent'),
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
      }).catch(emailErr => {
        // Log email error but don't crash
        console.error('Failed to send error notification email:', emailErr);
      });
    }
    
    // Determine message to send to client
    let userMessage: string;
    if (isProduction) {
      // In production: 
      // - For 4xx errors (client errors), return the specific message
      // - For 5xx errors (server errors), return a generic message
      if (status >= 400 && status < 500) {
        userMessage = err.message || "Requête invalide";
      } else {
        userMessage = "Une erreur serveur s'est produite. Nous avons été notifiés et travaillons à la résoudre.";
      }
    } else {
      // In development, always return the full error message
      userMessage = err.message || "Internal Server Error";
    }
    
    res.status(status).json({ 
      error: userMessage,
      // Include error details in development only
      ...(isProduction ? {} : { 
        details: err.message,
        stack: err.stack 
      })
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Initialize cron jobs for trial reminders
  initializeCronJobs();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
