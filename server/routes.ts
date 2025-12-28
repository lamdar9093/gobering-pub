import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginLimiter, passwordResetLimiter, emailVerificationLimiter } from "./index";
import { insertProfessionalSchema, insertUserSchema, insertProfessionalScheduleSchema, insertProfessionalBreakSchema, insertProfessionalServiceSchema, insertSecretaryAssignmentSchema, insertClinicServiceSchema, insertProfessionalServiceAssignmentSchema, insertWaitlistEntrySchema, insertWidgetConfigurationSchema, insertChatConversationSchema, insertChatMessageSchema, users, professionals, passwordResetTokens, timeSlots, professionalBreaks, professionalSchedules, appointments, patients, teamInvitations, professionalServices, clinics, clinicMembers, clinicServices, chatConversations, chatMessages, secretaryAssignments, waitlistEntries, widgetConfigurations, professionalServiceAssignments, auditLogs, type ProfessionalService } from "@shared/schema";
import { z } from "zod";
import "./types/session";
import { sendAppointmentConfirmationToPatient, sendAppointmentNotificationToProfessional, sendAppointmentReminder, sendTeamInvitation, sendWelcomeEmail, sendPasswordResetEmail, sendCancellationConfirmationToClient, sendCancellationNotificationToProfessional, sendCancellationNotificationToClient, sendNewMemberCredentialsEmail, sendWaitlistConfirmation, sendWaitlistSlotAvailable, sendWaitlistNotificationToProfessional, sendWaitlistCancelled, sendContactMessage, sendContactConfirmation, sendProUpgradeEmail, sendStarterUpgradeEmail, sendFreePlanConfirmationEmail, sendEmailVerification } from "./email";
import { sendAppointmentConfirmationSMS } from "./twilio";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, and, or, isNull, lt, inArray, gte, lte, sql, not } from "drizzle-orm";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import OpenAI from "openai";
import Stripe from "stripe";
import { runTrialRemindersManually } from "./cron";

// Middleware to check if user is authenticated
function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  next();
}

// Helper function to calculate team price based on number of seats
function calculateTeamPrice(planType: 'free' | 'pro', numberOfSeats: number): number {
  const basePrice = planType === 'free' ? 0 : 39;
  const seatPrice = 15;
  
  // Base price includes 1 seat, additional seats are $15 each for Pro
  if (numberOfSeats <= 1 || planType === 'free') {
    return basePrice;
  }
  
  return basePrice + (numberOfSeats - 1) * seatPrice;
}

// Helper function to get Stripe configuration based on environment
// Uses TESTING_* variables in development, normal variables in production
function getStripeConfig() {
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
  
  const config = {
    secretKey: isProduction 
      ? process.env.STRIPE_SECRET_KEY 
      : process.env.TESTING_STRIPE_SECRET_KEY,
    publicKey: isProduction 
      ? process.env.VITE_STRIPE_PUBLIC_KEY 
      : process.env.TESTING_VITE_STRIPE_PUBLIC_KEY,
    proPriceId: isProduction 
      ? process.env.STRIPE_PRO_PRICE_ID 
      : process.env.TESTING_STRIPE_PRO_PRICE_ID,
    additionalSeatPriceId: isProduction 
      ? process.env.STRIPE_ADDITIONAL_SEAT_PRICE_ID 
      : process.env.TESTING_STRIPE_ADDITIONAL_SEAT_PRICE_ID,
  };
  
  console.log(`[STRIPE CONFIG] Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`[STRIPE CONFIG] Using ${isProduction ? 'live' : 'test'} Stripe keys`);
  
  // Validate required keys are present
  const envPrefix = isProduction ? '' : 'TESTING_';
  const missingKeys: string[] = [];
  
  if (!config.secretKey) {
    missingKeys.push(`${envPrefix}STRIPE_SECRET_KEY`);
  }
  if (!config.publicKey) {
    missingKeys.push(`${envPrefix}VITE_STRIPE_PUBLIC_KEY`);
  }
  if (!config.proPriceId) {
    missingKeys.push(`${envPrefix}STRIPE_PRO_PRICE_ID`);
  }
  if (!config.additionalSeatPriceId) {
    missingKeys.push(`${envPrefix}STRIPE_ADDITIONAL_SEAT_PRICE_ID`);
  }
  
  if (missingKeys.length > 0) {
    const errorMsg = `[STRIPE CONFIG ERROR] Missing required Stripe environment variables: ${missingKeys.join(', ')}. Please configure these secrets in Replit.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // Validate Stripe key patterns
  if (config.secretKey && !config.secretKey.startsWith('sk_')) {
    throw new Error(`[STRIPE CONFIG ERROR] Invalid ${envPrefix}STRIPE_SECRET_KEY: must start with 'sk_'`);
  }
  if (config.publicKey && !config.publicKey.startsWith('pk_')) {
    throw new Error(`[STRIPE CONFIG ERROR] Invalid ${envPrefix}VITE_STRIPE_PUBLIC_KEY: must start with 'pk_'`);
  }
  if (config.proPriceId && !config.proPriceId.startsWith('price_')) {
    throw new Error(`[STRIPE CONFIG ERROR] Invalid ${envPrefix}STRIPE_PRO_PRICE_ID: must start with 'price_'`);
  }
  if (config.additionalSeatPriceId && !config.additionalSeatPriceId.startsWith('price_')) {
    throw new Error(`[STRIPE CONFIG ERROR] Invalid ${envPrefix}STRIPE_ADDITIONAL_SEAT_PRICE_ID: must start with 'price_'`);
  }
  
  console.log(`[STRIPE CONFIG] ✓ All required Stripe keys validated successfully`);
  
  return config;
}

// Helper function to check if professional is in read-only mode
// For clinic admins, checks their own subscription
// For clinic members, checks the admin's subscription
// NOTE: After trial expiry, users go to FREE plan (not read-only)
// Read-only is only for legacy users without active subscriptions
async function isReadOnlyMode(professionalId: string): Promise<boolean> {
  try {
    const professional = await storage.getProfessional(professionalId);
    console.log(`[READ-ONLY] Checking professionalId: ${professionalId}, exists: ${!!professional}`);
    if (!professional) return false;

    // If not in a clinic, never read-only
    if (!professional.clinicId) {
      console.log(`[READ-ONLY] No clinic for professional ${professionalId}, allowing write access`);
      return false;
    }

    // Get the admin's subscription status (the one who controls the plan)
    const members = await storage.getClinicMembers(professional.clinicId);
    const adminMember = members.find(m => m.role === 'Admin');
    if (!adminMember) {
      console.log(`[READ-ONLY] No admin found for clinic ${professional.clinicId}`);
      return false;
    }

    const admin = await storage.getProfessional(adminMember.professionalId);
    if (!admin) {
      console.log(`[READ-ONLY] Admin professional not found: ${adminMember.professionalId}`);
      return false;
    }

    console.log(`[READ-ONLY] Admin plan: ${admin.planType}, status: ${admin.subscriptionStatus}`);

    // Only apply read-only mode for free plan clinics
    // Accept both 'active' (explicitly selected free plan) and 'cancelled' (downgraded from PRO)
    if (admin.planType !== 'free') {
      console.log(`[READ-ONLY] Not a free plan, allowing write access`);
      return false;
    }
    
    // For free plan, apply restrictions regardless of status (active or cancelled)
    // Both mean the user is on the free tier with limitations

    // Free plan allows: 1 professional (Admin only) + 1 secretary
    // Any additional professionals or secretaries beyond this are read-only
    const currentMember = members.find(m => m.professionalId === professionalId);
    if (!currentMember) {
      console.log(`[READ-ONLY] Current member not found in clinic`);
      return false;
    }

    console.log(`[READ-ONLY] Current member role: ${currentMember.role}`);

    // Admin is never read-only (they are the 1 allowed professional)
    if (currentMember.role === 'Admin') {
      console.log(`[READ-ONLY] User is Admin, allowing write access`);
      return false;
    }

    // Sort members by join date to determine priority
    const sortedMembers = [...members].sort((a, b) => 
      new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    );

    // Separate by role using sorted list
    const professionals = sortedMembers.filter(m => m.role === 'Professionnel');
    const secretaries = sortedMembers.filter(m => m.role === 'Secrétaire');

    if (currentMember.role === 'Professionnel') {
      // Free plan allows ONLY the Admin professional
      // All non-admin professionals (Professionnel role) are read-only
      console.log(`[READ-ONLY] User is a non-Admin professional, BLOCKING write access`);
      return true;
    }

    if (currentMember.role === 'Secrétaire') {
      // Free plan allows 1 secretary
      // Find position of current member in sorted secretaries list
      const secretaryIndex = secretaries.findIndex(s => s.professionalId === professionalId);
      // First secretary (index 0) has write access, rest are read-only
      const isReadOnly = secretaryIndex > 0;
      console.log(`[READ-ONLY] User is secretary #${secretaryIndex}, ${isReadOnly ? 'BLOCKING' : 'allowing'} write access`);
      return isReadOnly;
    }

    return false;
  } catch (error) {
    console.error('[READ-ONLY CHECK] Error:', error);
    return false;
  }
}

// Helper function to filter out professionals in read-only mode (for public listings)
// Professionals in read-only mode cannot accept appointments, so they shouldn't be visible publicly
// Uses Promise.all to check all professionals in parallel for better performance
async function filterPubliclyVisibleProfessionals<T extends { id: string }>(professionals: T[]): Promise<T[]> {
  if (professionals.length === 0) return [];
  
  // Check all professionals in parallel to avoid N+1 problem
  const readOnlyChecks = await Promise.all(
    professionals.map(p => isReadOnlyMode(p.id))
  );
  
  // Filter out professionals that are in read-only mode
  return professionals.filter((_, index) => !readOnlyChecks[index]);
}

// Helper function to check if professional should show free plan limitations
async function shouldShowFreePlanLimits(professionalId: string): Promise<boolean> {
  try {
    const professional = await storage.getProfessional(professionalId);
    if (!professional) return false;
    
    // If professional has a clinic, check if they're admin or member
    let accountToCheck = professional;
    if (professional.clinicId) {
      const members = await storage.getClinicMembers(professional.clinicId);
      const adminMember = members.find(m => m.role === 'Admin');
      
      // If this professional is not the admin, check the admin's subscription status
      if (adminMember && adminMember.professionalId !== professionalId) {
        const adminProfessional = await storage.getProfessional(adminMember.professionalId);
        if (adminProfessional) {
          accountToCheck = adminProfessional;
        }
      }
    }
    
    // Show free plan limits if: trial expired AND no active subscription AND not legacy
    const now = new Date();
    const trialExpired = accountToCheck.trialEndsAt ? new Date(accountToCheck.trialEndsAt) < now : false;
    const hasActiveSubscription = accountToCheck.subscriptionStatus === 'active';
    const isLegacy = accountToCheck.subscriptionStatus === 'legacy';
    
    return trialExpired && !hasActiveSubscription && !isLegacy;
  } catch (error) {
    console.error("Error checking free plan limits:", error);
    return false;
  }
}

// Helper function to get appointment count for current month
async function getMonthlyAppointmentCount(professionalId: string): Promise<number> {
  try {
    const professional = await storage.getProfessional(professionalId);
    if (!professional) return 0;
    
    // Get all professional IDs in the clinic (or just this professional if no clinic)
    let professionalIds = [professionalId];
    if (professional.clinicId) {
      const members = await storage.getClinicMembers(professional.clinicId);
      professionalIds = members.map(m => m.professionalId).filter(Boolean);
    }
    
    if (professionalIds.length === 0) {
      return 0;
    }
    
    // Get first and last day of current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Count appointments scheduled this month for this clinic (all professionals)
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM appointments
      WHERE professional_id IN (${sql.join(professionalIds.map(id => sql.raw(`'${id}'`)), sql`, `)})
        AND appointment_date >= ${firstDay.toISOString()}::timestamp
        AND appointment_date <= ${lastDay.toISOString()}::timestamp
        AND status NOT IN ('cancelled', 'rescheduled')
    `);
    
    return Number(result.rows[0]?.count || 0);
  } catch (error) {
    console.error("Error getting monthly appointment count:", error);
    return 0;
  }
}

// Helper function to check if professional has reached the 100 appointment limit (FREE plan)
async function hasReachedAppointmentLimit(professionalId: string): Promise<boolean> {
  try {
    const professional = await storage.getProfessional(professionalId);
    if (!professional) return false;
    
    // If professional has a clinic, check the admin's subscription
    let accountToCheck = professional;
    if (professional.clinicId) {
      const members = await storage.getClinicMembers(professional.clinicId);
      const adminMember = members.find(m => m.role === 'Admin');
      
      if (adminMember && adminMember.professionalId !== professionalId) {
        const adminProfessional = await storage.getProfessional(adminMember.professionalId);
        if (adminProfessional) {
          accountToCheck = adminProfessional;
        }
      }
    }
    
    // Check if on free plan (trial expired, no active subscription, not legacy)
    const now = new Date();
    const trialExpired = accountToCheck.trialEndsAt ? new Date(accountToCheck.trialEndsAt) < now : false;
    const hasActiveSubscription = accountToCheck.subscriptionStatus === 'active';
    const isLegacy = accountToCheck.subscriptionStatus === 'legacy';
    const isOnFreePlan = trialExpired && !hasActiveSubscription && !isLegacy;
    
    // Free plan limit doesn't apply if not on free plan
    if (!isOnFreePlan) return false;
    
    // Check monthly appointment count
    const monthlyCount = await getMonthlyAppointmentCount(accountToCheck.id);
    return monthlyCount >= 100;
  } catch (error) {
    console.error("Error checking appointment limit:", error);
    return false;
  }
}

// Helper function to check if clinic has reached secretary limit (FREE plan: max 1 secretary)
async function hasReachedSecretaryLimit(clinicId: string, professionalId: string): Promise<boolean> {
  try {
    const professional = await storage.getProfessional(professionalId);
    if (!professional) return false;
    
    // If professional has a clinic, check the admin's subscription
    let accountToCheck = professional;
    const members = await storage.getClinicMembers(clinicId);
    const adminMember = members.find(m => m.role === 'Admin');
    
    if (adminMember && adminMember.professionalId !== professionalId) {
      const adminProfessional = await storage.getProfessional(adminMember.professionalId);
      if (adminProfessional) {
        accountToCheck = adminProfessional;
      }
    }
    
    // Check if on free plan (trial expired, no active subscription, not legacy)
    const now = new Date();
    const trialExpired = accountToCheck.trialEndsAt ? new Date(accountToCheck.trialEndsAt) < now : false;
    const hasActiveSubscription = accountToCheck.subscriptionStatus === 'active';
    const isLegacy = accountToCheck.subscriptionStatus === 'legacy';
    const isOnFreePlan = trialExpired && !hasActiveSubscription && !isLegacy;
    
    // Free plan limit doesn't apply if not on free plan
    if (!isOnFreePlan) return false;
    
    // Count active secretaries in the clinic
    const secretaryCount = members.filter(m => m.role === 'Secrétaire' && !m.cancelled).length;
    
    // Free plan allows max 1 secretary
    return secretaryCount >= 1;
  } catch (error) {
    console.error("Error checking secretary limit:", error);
    return false;
  }
}

// Helper function to check if professional can send SMS notifications
// SMS is a PRO feature - only PRO and legacy plans get SMS, FREE plan gets email only
async function canSendSMS(professionalId: string): Promise<boolean> {
  try {
    const professional = await storage.getProfessional(professionalId);
    if (!professional) return false;
    
    // If professional has a clinic, check the admin's subscription (members inherit admin's plan)
    let accountToCheck = professional;
    if (professional.clinicId) {
      const members = await storage.getClinicMembers(professional.clinicId);
      const adminMember = members.find(m => m.role === 'Admin');
      
      if (adminMember && adminMember.professionalId !== professionalId) {
        const adminProfessional = await storage.getProfessional(adminMember.professionalId);
        if (adminProfessional) {
          accountToCheck = adminProfessional;
        }
      }
    }
    
    // Check subscription status and plan type
    const now = new Date();
    const trialActive = accountToCheck.trialEndsAt ? new Date(accountToCheck.trialEndsAt) >= now : false;
    
    // SMS is allowed for:
    // 1. Legacy users (grandfathered unlimited features)
    // 2. Trial users (they get PRO features during trial)
    // 3. Active PRO subscribers
    if (accountToCheck.subscriptionStatus === 'legacy') {
      return true;
    }
    
    if (accountToCheck.subscriptionStatus === 'trial' && trialActive) {
      return true;
    }
    
    if (accountToCheck.subscriptionStatus === 'active' && accountToCheck.planType === 'pro') {
      return true;
    }
    
    // All other cases (FREE plan, cancelled, past_due, etc.) = no SMS
    return false;
  } catch (error) {
    console.error("Error checking SMS permissions:", error);
    return false;
  }
}

// Middleware to check if user has write access (not in read-only mode)
async function requireWriteAccess(req: any, res: any, next: any) {
  if (!req.session.professionalId) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  
  const readOnly = await isReadOnlyMode(req.session.professionalId);
  if (readOnly) {
    return res.status(403).json({ 
      error: "Compte en mode lecture seule",
      message: "L'administrateur de votre clinique utilise le plan Gratuit qui permet seulement 1 professionnel et 1 secrétaire actifs. Pour débloquer toutes les fonctionnalités, demandez à l'administrateur de passer au plan PRO.",
      readOnlyMode: true
    });
  }
  
  next();
}

// Helper function to log audit events
async function logAudit(params: {
  userId?: string;
  professionalId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}) {
  try {
    await storage.createAuditLog({
      userId: params.userId || null,
      professionalId: params.professionalId || null,
      action: params.action,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      details: params.details || null,
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error('Audit logging failed:', error);
  }
}

// Convert UTC appointment date to America/Toronto timezone
// Returns the date as an ISO string formatted in America/Toronto timezone
function convertAppointmentToLocalTime(appointment: any) {
  if (appointment.appointmentDate) {
    const utcDate = new Date(appointment.appointmentDate);
    // Format in America/Toronto timezone with offset to preserve local date
    const localISOString = formatInTimeZone(utcDate, 'America/Toronto', "yyyy-MM-dd'T'HH:mm:ssXXX");
    return {
      ...appointment,
      appointmentDate: localISOString
    };
  }
  return appointment;
}

// Helper function to check if a time slot conflicts with a break
function doesTimeSlotConflictWithBreak(
  slotDate: Date,
  slotStartTime: string,
  slotEndTime: string,
  breaks: any[]
): boolean {
  const slotDateStr = slotDate.toISOString().split('T')[0];
  
  for (const breakItem of breaks) {
    const breakDateStr = new Date(breakItem.breakDate).toISOString().split('T')[0];
    
    // Check if break is on the same date
    if (breakDateStr !== slotDateStr) {
      continue;
    }
    
    // Parse times as numbers for comparison (e.g., "10:00" -> 1000, "10:30" -> 1030)
    const slotStart = parseInt(slotStartTime.replace(':', ''));
    const slotEnd = parseInt(slotEndTime.replace(':', ''));
    const breakStart = parseInt(breakItem.startTime.replace(':', ''));
    const breakEnd = parseInt(breakItem.endTime.replace(':', ''));
    
    // Check if there's any overlap
    // Slot conflicts if: slot starts before break ends AND slot ends after break starts
    if (slotStart < breakEnd && slotEnd > breakStart) {
      return true;
    }
  }
  
  return false;
}

// Helper function to notify waitlist when appointment is cancelled
async function notifyWaitlistForCancelledAppointment(appointment: any) {
  try {
    if (!appointment.professionalId) {
      return;
    }

    // Ensure appointmentDate is a Date object
    const appointmentDate = appointment.appointmentDate instanceof Date 
      ? appointment.appointmentDate 
      : new Date(appointment.appointmentDate);

    // Check if the cancelled slot conflicts with a break/pause
    const professionalBreaks = await storage.getProfessionalBreaks(appointment.professionalId);
    const conflictsWithBreak = doesTimeSlotConflictWithBreak(
      appointmentDate,
      appointment.startTime,
      appointment.endTime || appointment.startTime,
      professionalBreaks
    );

    if (conflictsWithBreak) {
      console.log('Cancelled appointment slot conflicts with break/pause - not notifying waitlist');
      return;
    }

    // Find matching waitlist entries (same professional, service, and date)
    const matchingEntries = await storage.findMatchingWaitlistEntries(
      appointment.professionalId,
      appointment.professionalServiceId || appointment.professionalServiceAssignmentId || null,
      appointmentDate
    );

    if (matchingEntries.length === 0) {
      console.log('No matching waitlist entries found for cancelled appointment');
      return;
    }

    // Take the first entry (FIFO - First In First Out)
    const firstEntry = matchingEntries[0];

    // Get professional information for email
    const professional = await storage.getProfessional(appointment.professionalId);
    if (!professional) {
      console.error('Professional not found for waitlist notification');
      return;
    }

    // Check plan - automatic waitlist is Pro only
    const planType = professional.planType || 'legacy';
    if (planType === 'free' || planType === 'legacy') {
      console.log('Automatic waitlist is Pro only - skipping notification');
      return;
    }

    // Get service name if applicable
    const service = await storage.getAppointmentService(appointment);
    const serviceName = service?.name;

    // Format preferred time range if available
    let preferredTimeRange = undefined;
    if (firstEntry.preferredTimeStart && firstEntry.preferredTimeEnd) {
      preferredTimeRange = `${firstEntry.preferredTimeStart} - ${firstEntry.preferredTimeEnd}`;
    }

    // Calculate expiration (24 hours from now)
    const notifiedAt = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Format times to remove seconds (HH:MM:SS -> HH:MM)
    const formatTimeWithoutSeconds = (time: string | null | undefined): string => {
      if (!time) return '';
      return time.split(':').slice(0, 2).join(':');
    };

    // Update waitlist entry status to 'notified' with available slot details
    await storage.updateWaitlistEntryStatus(
      firstEntry.id, 
      'notified', 
      notifiedAt, 
      expiresAt,
      appointment.appointmentDate,
      appointment.startTime,
      appointment.endTime
    );

    // Send notification email with token and available slot details
    await sendWaitlistSlotAvailable({
      firstName: firstEntry.firstName,
      lastName: firstEntry.lastName,
      email: firstEntry.email,
      professionalFirstName: professional.firstName,
      professionalLastName: professional.lastName,
      profession: professional.profession,
      serviceName,
      preferredDate: appointment.appointmentDate,
      preferredTimeRange,
      token: firstEntry.token,
      expiresAt,
      availableStartTime: formatTimeWithoutSeconds(appointment.startTime),
      availableEndTime: formatTimeWithoutSeconds(appointment.endTime),
      beneficiaryName: appointment.beneficiaryName || undefined
    });

    console.log(`Waitlist notification sent to ${firstEntry.email} for appointment slot`);
  } catch (error) {
    console.error('Error notifying waitlist for cancelled appointment:', error);
    // Don't throw - we don't want to fail the cancellation if waitlist notification fails
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { email, password: loginPassword } = req.body;
      
      if (!email || !loginPassword) {
        return res.status(400).json({ error: "Email et mot de passe requis" });
      }

      const user = await storage.verifyUserPasswordByEmail(email, loginPassword);
      
      if (!user) {
        // Log failed login attempt
        await logAudit({
          action: 'login_failed',
          details: { email, reason: 'invalid_credentials' },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        await logAudit({
          userId: user.id,
          action: 'login_failed',
          details: { email, reason: 'email_not_verified' },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        return res.status(403).json({ 
          error: "Veuillez vérifier votre adresse email avant de vous connecter",
          status: "unverified",
          canResend: true,
          email: user.email
        });
      }

      // Check if user is associated with a professional
      const professional = await storage.getProfessionalByUserId(user.id);
      
      if (!professional) {
        await logAudit({
          userId: user.id,
          action: 'login_failed',
          details: { email, reason: 'no_professional_account' },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        return res.status(403).json({ error: "Compte professionnel non trouvé" });
      }

      // Activate professional on first login
      if (!professional.isActive) {
        await storage.updateProfessional(professional.id, { isActive: true });
      }

      // Regenerate session to prevent session fixation attacks
      // This automatically handles destroying old session and creating new one atomically
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Erreur lors de la connexion" });
        }

        // Set session data
        req.session.userId = user.id;
        req.session.professionalId = professional.id;

        // Save session explicitly to ensure it's persisted before responding
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Erreur lors de la connexion" });
          }

          // Don't return password hash
          const { password, ...safeUser } = user;
          
          // Log successful login
          logAudit({
            userId: user.id,
            professionalId: professional.id,
            action: 'login_success',
            details: { email },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
          
          // Check if user needs to change password
          if (user.requirePasswordChange) {
            return res.json({ 
              user: safeUser, 
              professional,
              requirePasswordChange: true 
            });
          }
          
          res.json({ user: safeUser, professional });
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erreur lors de la connexion" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const professional = await storage.getProfessional(professionalId);
      
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get user data to retrieve isLamdaaAccount flag
      let isLamdaaAccount = false;
      if (professional.userId) {
        const user = await storage.getUser(professional.userId);
        isLamdaaAccount = user?.isLamdaaAccount || false;
      }

      // Check if professional should see free plan limitations
      const showFreePlanLimits = await shouldShowFreePlanLimits(professionalId);
      const readOnlyMode = await isReadOnlyMode(professionalId); // Always false now, but kept for backward compatibility

      res.json({ 
        ...professional, 
        readOnlyMode,
        showFreePlanLimits,
        isLamdaaAccount
      });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du profil" });
    }
  });

  // Change password for first login (forced password change)
  app.patch("/api/auth/first-login-password", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
      }

      // Get user
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Verify requirePasswordChange is true
      if (!user.requirePasswordChange) {
        return res.status(400).json({ error: "Changement de mot de passe non requis" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and reset flag
      await db.update(users)
        .set({ 
          password: hashedPassword,
          requirePasswordChange: false 
        })
        .where(eq(users.id, userId));

      res.json({ message: "Mot de passe changé avec succès" });
    } catch (error) {
      console.error("Error changing first login password:", error);
      res.status(500).json({ error: "Erreur lors du changement de mot de passe" });
    }
  });

  app.patch("/api/professional/profile", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const { firstName, lastName, email, phone, address, city, postalCode, province, profilePicture, description, appointmentDuration, bufferTime } = req.body;

      // Build update object conditionally to avoid overwriting profilePicture when not provided
      const updateData: any = {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        postalCode,
        province: province?.trim() || null,
        description: description?.trim() || null,
        appointmentDuration: appointmentDuration || 30,
        bufferTime: bufferTime !== undefined ? bufferTime : 5,
      };

      // Only update profilePicture if explicitly provided in the request
      if (profilePicture !== undefined) {
        updateData.profilePicture = profilePicture?.trim() || null;
      }

      const updated = await storage.updateProfessional(professionalId, updateData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du profil" });
    }
  });

  app.patch("/api/professional/professions", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const { professions } = req.body;

      // Validate professions array
      if (!Array.isArray(professions) || professions.length === 0) {
        return res.status(400).json({ error: "Au moins une profession est requise" });
      }

      // Validate each profession is a string
      if (!professions.every(p => typeof p === 'string' && p.trim().length > 0)) {
        return res.status(400).json({ error: "Toutes les professions doivent être des chaînes de caractères valides" });
      }

      const updated = await storage.updateProfessional(professionalId, { professions });

      res.json(updated);
    } catch (error) {
      console.error("Error updating professions:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour des professions" });
    }
  });

  app.patch("/api/professional/settings", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const allowedFields = [
        'timezone', 'language', 'dateFormat', 'timeFormat',
        'workingHours', 'cancellationDelay', 'bufferTime', 'appointmentDuration',
        'emailNotifications', 'newAppointmentNotification', 
        'appointmentReminderNotification', 'reminderTiming', 'cancellationNotification',
        'autoConfirmAppointments', 'showCancelledAppointments', 'compactView',
        'waitlistEnabled', 'waitlistPriorityHours',
        'publiclyVisible',
        'firstName', 'lastName', 'phone', 'email',
        'description', 'yearsOfExperience', 'patientsServed', 'specializations'
      ];

      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      console.log('[SETTINGS UPDATE] Request body:', req.body);
      console.log('[SETTINGS UPDATE] Update data:', updateData);

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Aucun champ à mettre à jour" });
      }

      // Check if we need to apply visibility to all clinic members
      const applyToClinic = req.body.applyToClinic === true;
      
      console.log('[CLINIC VISIBILITY DEBUG] applyToClinic:', applyToClinic, 'publiclyVisible:', updateData.publiclyVisible);
      
      if (applyToClinic && updateData.publiclyVisible !== undefined) {
        const professional = await storage.getProfessional(professionalId);
        console.log('[CLINIC VISIBILITY DEBUG] Professional:', professional?.id, 'clinicId:', professional?.clinicId);
        
        if (professional?.clinicId) {
          // Get all clinic members
          const members = await storage.getClinicMembers(professional.clinicId);
          console.log('[CLINIC VISIBILITY DEBUG] Clinic members:', members.length);
          
          // Check if user is admin
          const isAdmin = members.some(m => 
            m.professionalId === professionalId && m.role === 'Admin'
          );
          console.log('[CLINIC VISIBILITY DEBUG] Is Admin:', isAdmin);
          
          if (isAdmin) {
            // Update visibility for all clinic professionals
            const professionalsToUpdate = members.filter(m => m.role === 'Professionnel' || m.role === 'Admin');
            console.log(`[CLINIC VISIBILITY] Admin ${professionalId} updating visibility for entire clinic ${professional.clinicId} to ${updateData.publiclyVisible}`);
            console.log(`[CLINIC VISIBILITY] Updating ${professionalsToUpdate.length} professionals:`, professionalsToUpdate.map(m => m.professionalId));
            
            const updatePromises = professionalsToUpdate.map(m => 
                storage.updateProfessional(m.professionalId, { 
                  publiclyVisible: updateData.publiclyVisible 
                })
              );
            
            const results = await Promise.all(updatePromises);
            console.log(`[CLINIC VISIBILITY] Updated ${results.length} professionals in clinic`);
            console.log(`[CLINIC VISIBILITY] Results:`, results.map(r => ({ id: r.id, name: r.firstName + ' ' + r.lastName, publiclyVisible: r.publiclyVisible })));
          } else {
            console.log('[CLINIC VISIBILITY] User is not admin, only updating own visibility');
          }
        }
      }

      const updated = await storage.updateProfessional(professionalId, updateData);
      console.log('[SETTINGS UPDATE] Updated professional appointmentDuration:', updated.appointmentDuration);

      // Synchronize workingHours with professionalSchedules table
      if (updateData.workingHours) {
        console.log('[SETTINGS UPDATE] Synchronizing workingHours to professionalSchedules');
        
        const dayMapping: Record<string, number> = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        };

        // Get existing schedules
        const existingSchedules = await storage.getProfessionalSchedules(professionalId);
        
        // Process each day
        for (const [dayName, dayOfWeek] of Object.entries(dayMapping)) {
          const dayData = updateData.workingHours[dayName];
          const existingSchedule = existingSchedules.find(s => s.dayOfWeek === dayOfWeek);
          
          if (dayData && dayData.enabled) {
            // Create or update schedule
            if (existingSchedule) {
              await storage.updateProfessionalSchedule(existingSchedule.id, {
                startTime: dayData.start,
                endTime: dayData.end,
                isAvailable: true,
              });
            } else {
              await storage.createProfessionalSchedule({
                professionalId,
                dayOfWeek,
                startTime: dayData.start,
                endTime: dayData.end,
                isAvailable: true,
              });
            }
          } else if (existingSchedule) {
            // Delete schedule if day is disabled
            await storage.deleteProfessionalSchedule(existingSchedule.id);
          }
        }
        
        console.log('[SETTINGS UPDATE] Synchronization complete');
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres" });
    }
  });

  app.patch("/api/professionals/:professionalId/complete-onboarding", requireAuth, async (req, res) => {
    try {
      const { professionalId } = req.params;
      const sessionProfessionalId = req.session.professionalId;
      
      // Ensure the user can only update their own onboarding status
      if (professionalId !== sessionProfessionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const updated = await storage.updateProfessional(professionalId, { 
        hasCompletedOnboarding: true 
      });

      res.json(updated);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Erreur lors de la finalisation de l'onboarding" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    const professionalId = req.session.professionalId;

    // Log audit before destroying session
    if (userId) {
      await logAudit({
        userId,
        professionalId,
        action: 'logout',
        details: { manual: true },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      
      // Clear cookie with same options as session configuration
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax'
      });
      
      res.json({ message: "Déconnexion réussie" });
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      // Get the user with password from database
      const [user] = await db.select({
        id: users.id,
        password: users.password,
      }).from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Mot de passe actuel incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in database
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

      res.json({ message: "Mot de passe modifié avec succès" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Erreur lors de la modification du mot de passe" });
    }
  });

  // Password reset routes
  app.post("/api/auth/request-password-reset", passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email requis" });
      }

      // Find user by email
      const [user] = await db.select({
        id: users.id,
        firstName: users.firstName,
        email: users.email,
      }).from(users).where(eq(users.email, email));

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé" });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save token to database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // Send reset email
      await sendPasswordResetEmail({
        email: user.email,
        firstName: user.firstName || 'Utilisateur',
        resetToken,
        expiresAt,
      });

      res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Erreur lors de la demande de réinitialisation" });
    }
  });

  app.post("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token requis" });
      }

      // Find token in database
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(400).json({ error: "Token invalide" });
      }

      if (resetToken.used) {
        return res.status(400).json({ error: "Ce lien a déjà été utilisé" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Ce lien a expiré" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ error: "Erreur lors de la vérification du token" });
    }
  });

  app.post("/api/auth/reset-password", passwordResetLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token et nouveau mot de passe requis" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      // Find token in database
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(400).json({ error: "Token invalide" });
      }

      if (resetToken.used) {
        return res.status(400).json({ error: "Ce lien a déjà été utilisé" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Ce lien a expiré" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true, usedAt: new Date() })
        .where(eq(passwordResetTokens.token, token));

      res.json({ message: "Mot de passe réinitialisé avec succès" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe" });
    }
  });

  app.delete("/api/auth/account", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const professionalId = req.session.professionalId;

      if (!userId || !professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional to check if they have a clinic
      const professional = await storage.getProfessional(professionalId);
      
      // If professional has a clinic, check if they are allowed to delete their account
      if (professional?.clinicId) {
        const members = await storage.getClinicMembers(professional.clinicId);
        const currentMember = members.find(m => m.professionalId === professionalId);
        
        // Only Admin can delete their own account
        if (currentMember?.role !== "Admin") {
          return res.status(403).json({ 
            error: "Seul l'administrateur de la clinique peut supprimer votre compte. Veuillez le contacter." 
          });
        }
        
        // Check if they are the only admin
        const adminCount = members.filter(m => m.role === "Admin").length;
        if (adminCount === 1 && members.length > 1) {
          return res.status(400).json({ 
            error: "Vous êtes le seul administrateur de la clinique. Veuillez désigner un autre administrateur avant de supprimer votre compte." 
          });
        }

        // Remove from clinic members
        await storage.removeClinicMember(professional.clinicId, professionalId);
      }

      // Delete all related data before deleting professional
      // IMPORTANT: Order matters due to foreign key constraints
      
      // 1. Get all conversations for this user
      const userConversations = await db.select({ id: chatConversations.id })
        .from(chatConversations)
        .where(eq(chatConversations.userId, userId));
      
      // 2. Delete chat messages for these conversations
      if (userConversations.length > 0) {
        const conversationIds = userConversations.map(c => c.id);
        for (const convId of conversationIds) {
          await db.delete(chatMessages).where(eq(chatMessages.conversationId, convId));
        }
      }
      
      // 3. Delete chat conversations
      await db.delete(chatConversations).where(eq(chatConversations.userId, userId));
      
      // 4. Delete appointments (references time slots, services, and professional)
      await db.delete(appointments).where(eq(appointments.professionalId, professionalId));
      
      // 5. Delete waitlist entries
      await db.delete(waitlistEntries).where(eq(waitlistEntries.professionalId, professionalId));
      
      // 6. Delete widget configurations
      await db.delete(widgetConfigurations).where(eq(widgetConfigurations.professionalId, professionalId));
      
      // 7. Delete secretary assignments (where this professional is the secretary)
      await db.delete(secretaryAssignments).where(eq(secretaryAssignments.secretaryId, professionalId));
      
      // 8. Delete secretary assignments (where this professional is assigned to a secretary)
      await db.delete(secretaryAssignments).where(eq(secretaryAssignments.professionalId, professionalId));
      
      // 9. Delete professional service assignments
      await db.delete(professionalServiceAssignments).where(eq(professionalServiceAssignments.professionalId, professionalId));
      
      // 10. Delete clinic services created by this professional
      await db.delete(clinicServices).where(eq(clinicServices.createdBy, professionalId));
      
      // 11. Delete professional services (deprecated table but still might have data)
      await db.delete(professionalServices).where(eq(professionalServices.professionalId, professionalId));
      
      // 12. Delete time slots
      await db.delete(timeSlots).where(eq(timeSlots.professionalId, professionalId));
      
      // 13. Delete professional breaks
      await db.delete(professionalBreaks).where(eq(professionalBreaks.professionalId, professionalId));
      
      // 14. Delete professional schedules
      await db.delete(professionalSchedules).where(eq(professionalSchedules.professionalId, professionalId));
      
      // 15. Delete patients
      await db.delete(patients).where(eq(patients.professionalId, professionalId));
      
      // 16. Delete team invitations where this professional was the inviter
      await db.delete(teamInvitations).where(eq(teamInvitations.invitedBy, professionalId));
      
      // 17. Delete team invitations where this professional was invited
      await db.delete(teamInvitations).where(eq(teamInvitations.professionalId, professionalId));
      
      // 18. Delete password reset tokens for this user
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
      
      // 19. Delete audit logs for this professional
      await db.delete(auditLogs).where(eq(auditLogs.professionalId, professionalId));
      
      // 20. Delete clinic members entries (in case removeClinicMember wasn't called or didn't work)
      await db.delete(clinicMembers).where(eq(clinicMembers.professionalId, professionalId));

      // Finally, delete professional and user records
      await db.delete(professionals).where(eq(professionals.id, professionalId));
      await db.delete(users).where(eq(users.id, userId));

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
      });

      res.json({ message: "Compte supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du compte" });
    }
  });

  // Configure multer for file uploads
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const storage_multer = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(__dirname, "..", "public", "uploads", "profile-pictures");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `profile-${uniqueSuffix}${ext}`);
    }
  });

  const upload = multer({
    storage: storage_multer,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error("Seules les images (JPEG, PNG, GIF, WebP) sont autorisées"));
      }
    }
  });

  // Upload profile picture route
  app.post("/api/upload/profile-picture", requireAuth, requireWriteAccess, upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier fourni" });
      }

      const professionalId = req.session.professionalId;
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get current professional to check for old photo
      const professional = await storage.getProfessional(professionalId);
      
      // Resize and optimize image using sharp
      // Always use .jpg extension since we're encoding as JPEG
      const baseName = path.parse(req.file.filename).name;
      const outputFileName = `optimized-${baseName}.jpg`;
      const outputPath = path.join(path.dirname(req.file.path), outputFileName);

      await sharp(req.file.path)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      // Delete original unoptimized file
      await fs.unlink(req.file.path);

      // Delete old profile picture if exists
      if (professional?.profilePicture && professional.profilePicture.startsWith('/uploads/')) {
        // Remove leading slash before joining paths
        const relativePath = professional.profilePicture.replace(/^\//, '');
        const oldPhotoPath = path.join(__dirname, "..", "public", relativePath);
        try {
          await fs.unlink(oldPhotoPath);
        } catch (err) {
          console.error("Could not delete old photo:", err);
        }
      }

      // Generate URL for the uploaded file
      const photoUrl = `/uploads/profile-pictures/${outputFileName}`;

      // Update professional profile with new photo URL
      await storage.updateProfessional(professionalId, {
        profilePicture: photoUrl
      });

      res.json({ 
        message: "Photo téléversée avec succès",
        photoUrl 
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      
      // Clean up file if it was uploaded
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error("Could not delete file:", unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Erreur lors du téléversement de la photo" 
      });
    }
  });

  app.post("/api/auth/register-professional", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        professions,
        speciality,
        phone,
        address,
        city,
        postalCode,
        province,
        description,
        planType,
      } = req.body;

      // Validation - Only firstName, lastName, email, password, professions, phone are required
      if (!firstName || !lastName || !email || !password || !professions || !Array.isArray(professions) || professions.length === 0 || !phone) {
        return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis" });
      }

      // NOUVELLE STRATÉGIE : Tous les nouveaux professionnels obtiennent PRO complet pendant 21 jours
      // Objectif : Qu'ils ressentent la valeur de Gobering, pas qu'ils la devinent
      
      // Stocker le plan choisi pour référence après l'essai
      const selectedPlan = planType === 'pro' ? 'pro' : 'free';

      // Generate verification token (cryptographically secure random bytes)
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Hash the token before storing (SHA-256)
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      
      // Set expiration to 24 hours from now
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

      // Calculate trial period (21 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 21);

      // TRANSACTION: Create everything atomically or rollback if any step fails
      const result = await db.transaction(async (tx) => {
        // Create user with unverified email and verification token
        const [user] = await tx.insert(users).values({
          username: email,
          email,
          password: await bcrypt.hash(password, 10),
          firstName,
          lastName,
          emailVerified: false,
          verificationToken: hashedToken,
          verificationTokenExpiresAt: tokenExpiresAt,
          verificationMethod: null, // Will be set to 'email' after verification
        }).returning();

        // Create a personal clinic for the new professional
        // Use provided address info or defaults if not provided
        const [clinic] = await tx.insert(clinics).values({
          name: `Clinique ${firstName} ${lastName}`,
          address: address || 'À compléter',
          city: city || 'À compléter',
          postalCode: postalCode || 'À compléter',
          phone,
          email,
        }).returning();

        // Create professional profile linked to user with PRO trial for everyone
        const [professional] = await tx.insert(professionals).values({
          userId: user.id,
          firstName,
          lastName,
          professions,
          speciality: speciality || null,
          address: address || null,
          city: city || null,
          postalCode: postalCode || null,
          province: province || null,
          phone,
          email,
          description: description || null,
          clinicId: clinic.id, // Assign the professional to their clinic
          isActive: true, // Mark as active immediately so they appear in "Membres actifs"
          planType: 'pro', // Tous obtiennent PRO pendant l'essai
          subscriptionStatus: 'trial',
          intendedPlan: selectedPlan, // Stocker le plan choisi pour après l'essai
          trialEndsAt,
        }).returning();

        // Add the professional as an Admin member of their clinic
        await tx.insert(clinicMembers).values({
          clinicId: clinic.id,
          professionalId: professional.id,
          role: 'Admin',
        });

        return { user, clinic, professional };
      });

      const { user, professional } = result;

      // Send email verification (NOT welcome email yet - that comes after verification)
      try {
        await sendEmailVerification({
          firstName,
          email,
          verificationToken, // Send the unhashed token
        });
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        // Don't fail registration if email fails, but log it
      }

      // DO NOT auto-login - user must verify email first
      // req.session.userId = user.id; // REMOVED
      // req.session.professionalId = professional.id; // REMOVED

      res.status(201).json({ 
        message: "Inscription réussie. Veuillez vérifier votre email pour activer votre compte.",
        requiresVerification: true,
        email: user.email,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      
      if (error.code === '23505') {
        // Detect if it's email or phone duplicate based on constraint name
        if (error.constraint === 'users_email_unique' || error.constraint === 'professionals_email_unique' || error.constraint === 'users_username_unique') {
          return res.status(409).json({ error: "Cet email est déjà utilisé" });
        }
        if (error.constraint === 'professionals_phone_unique') {
          return res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé" });
        }
        // Fallback for any other unique constraint violation
        return res.status(409).json({ error: "Ces informations sont déjà utilisées" });
      }
      
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  });

  // Email verification route - GET /api/verify-email/:token
  app.get("/api/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ error: "Token de vérification manquant" });
      }

      // Hash the token to match with database
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user with this token
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.verificationToken, hashedToken),
            eq(users.emailVerified, false)
          )
        )
        .limit(1);

      if (!user) {
        return res.status(400).json({ 
          error: "Lien de vérification invalide ou expiré",
          code: "INVALID_TOKEN"
        });
      }

      // Check if token is expired
      if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
        return res.status(400).json({ 
          error: "Ce lien de vérification a expiré. Veuillez demander un nouveau lien.",
          code: "TOKEN_EXPIRED",
          email: user.email
        });
      }

      // Verify the email - update user
      await db
        .update(users)
        .set({
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiresAt: null,
          verificationMethod: 'email',
        })
        .where(eq(users.id, user.id));

      // Get the user's professional profile to send welcome email
      const [professional] = await db
        .select()
        .from(professionals)
        .where(eq(professionals.userId, user.id))
        .limit(1);

      // Send welcome email now that email is verified
      if (professional) {
        try {
          await sendWelcomeEmail({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            profession: professional.professions[0],
          });
        } catch (emailError) {
          console.error("Error sending welcome email after verification:", emailError);
          // Don't fail verification if welcome email fails
        }
      }

      res.json({ 
        success: true,
        message: "Votre email a été vérifié avec succès ! Vous pouvez maintenant vous connecter.",
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Erreur lors de la vérification de l'email" });
    }
  });

  // Resend verification email - POST /api/resend-verification
  app.post("/api/resend-verification", emailVerificationLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email requis" });
      }

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        // Don't reveal whether email exists for security
        return res.json({ 
          message: "Si un compte avec cet email existe et n'est pas vérifié, un nouveau lien de vérification a été envoyé."
        });
      }

      // If already verified, don't send email
      if (user.emailVerified) {
        return res.status(400).json({ 
          error: "Cet email est déjà vérifié. Vous pouvez vous connecter.",
          code: "ALREADY_VERIFIED"
        });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      
      // Set new expiration (24 hours)
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

      // Update user with new token
      await db
        .update(users)
        .set({
          verificationToken: hashedToken,
          verificationTokenExpiresAt: tokenExpiresAt,
        })
        .where(eq(users.id, user.id));

      // Send new verification email
      try {
        await sendEmailVerification({
          firstName: user.firstName || '',
          email: user.email,
          verificationToken, // Send unhashed token
        });
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        return res.status(500).json({ error: "Erreur lors de l'envoi de l'email de vérification" });
      }

      res.json({ 
        message: "Un nouveau lien de vérification a été envoyé à votre adresse email."
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Erreur lors du renvoi de l'email de vérification" });
    }
  });

  // Lookup professionals by name or email (for clinic member management)
  // SECURITY: Only shows professionals invited by the logged-in admin's clinic
  app.get("/api/professionals/lookup", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { q } = req.query;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json([]);
      }

      // Get the requesting professional's clinic
      const requester = await storage.getProfessional(professionalId);
      if (!requester?.clinicId) {
        return res.json([]); // No clinic = no invited professionals
      }

      const searchTerm = q.toLowerCase().trim();
      
      // Get only professionals invited by this clinic
      const invitedProfessionals = await storage.getInvitedProfessionals(requester.clinicId);
      
      // Filter by search term
      const results = invitedProfessionals
        .filter(prof => {
          const fullName = `${prof.firstName} ${prof.lastName}`.toLowerCase();
          const email = prof.email?.toLowerCase() || '';
          return fullName.includes(searchTerm) || email.includes(searchTerm);
        })
        .slice(0, 10) // Limit to 10 results
        .map(prof => ({
          id: prof.id,
          firstName: prof.firstName,
          lastName: prof.lastName,
          email: prof.email,
          profession: prof.profession,
        }));

      res.json(results);
    } catch (error) {
      console.error("Lookup professionals error:", error);
      res.status(500).json({ error: "Erreur lors de la recherche" });
    }
  });

  app.get("/api/professional/appointments", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const appointments = await storage.getProfessionalAppointments(professionalId);
      const localizedAppointments = appointments.map(convertAppointmentToLocalTime);
      res.json(localizedAppointments);
    } catch (error) {
      console.error("Get professional appointments error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des rendez-vous" });
    }
  });

  // Create manual appointment (for professionals)
  app.post("/api/professional/appointments/create-manual", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const currentProfessionalId = req.session.professionalId;
      
      if (!currentProfessionalId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        appointmentDate,
        startTime,
        endTime,
        appointmentType,
        notes,
        status = "draft",
        professionalId: targetProfessionalId,
        serviceId,
        beneficiaryName,
        beneficiaryRelation,
        beneficiaryPhone,
        beneficiaryEmail,
      } = req.body;

      if (!firstName || !lastName || !appointmentDate || !startTime || !endTime) {
        return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis" });
      }

      // Security check: if a different professional is specified, verify authorization
      let finalProfessionalId = currentProfessionalId;
      let clinicId: string | undefined = undefined;
      
      // Fetch professionals in parallel if needed
      const needsBothProfs = targetProfessionalId && targetProfessionalId !== currentProfessionalId;
      let currentProf, targetProf;
      
      if (needsBothProfs) {
        [currentProf, targetProf] = await Promise.all([
          storage.getProfessional(currentProfessionalId),
          storage.getProfessional(targetProfessionalId!)
        ]);
        
        // Verify that the target professional exists
        if (!targetProf) {
          return res.status(404).json({ error: "Le professionnel sélectionné n'existe pas" });
        }
        
        // Only allow if both professionals are in the same clinic
        if (!currentProf?.clinicId || !targetProf.clinicId || currentProf.clinicId !== targetProf.clinicId) {
          return res.status(403).json({ error: "Vous ne pouvez créer un rendez-vous que pour les professionnels de votre clinique" });
        }

        // Verify that the target professional is a therapist or admin (can have appointments)
        const clinicMembers = await storage.getClinicMembers(targetProf.clinicId);
        const targetMember = clinicMembers.find(m => m.professionalId === targetProfessionalId);
        
        if (!targetMember || (targetMember.role !== 'Professionnel' && targetMember.role !== 'Admin')) {
          return res.status(403).json({ error: "Les rendez-vous ne peuvent être assignés qu'à des professionnels ou administrateurs" });
        }

        // Additional check for secretaries: verify they are assigned to the target professional
        const currentMember = clinicMembers.find(m => m.professionalId === currentProfessionalId);
        if (currentMember?.role === 'Secrétaire') {
          const assignments = await storage.getSecretaryAssignments(currentProfessionalId);
          const isAssigned = assignments.some(a => a.professionalId === targetProfessionalId);
          
          if (!isAssigned) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à créer des rendez-vous pour ce professionnel" });
          }
        }
        
        // Authorization passed, use the target professional
        finalProfessionalId = targetProfessionalId!;
        clinicId = targetProf.clinicId;
      } else {
        currentProf = await storage.getProfessional(currentProfessionalId);
        clinicId = currentProf?.clinicId || undefined;
      }

      // Validate serviceId if provided - check both new system (assignments) and old system (professional_services)
      let isAssignmentId = false;
      if (serviceId) {
        // First check if it's an assignment ID (new system with clinic services)
        const assignment = await storage.getServiceAssignmentById(serviceId);
        
        if (assignment) {
          isAssignmentId = true;
          // Verify the assignment belongs to the correct professional
          if (assignment.professionalId !== finalProfessionalId) {
            return res.status(400).json({ error: "Le service sélectionné n'appartient pas au professionnel" });
          }
        } else {
          // Fallback: check old professional_services table
          const service = await storage.getProfessionalService(serviceId);
          if (!service) {
            return res.status(400).json({ error: "Le service sélectionné n'existe pas" });
          }
          if (service.professionalId !== finalProfessionalId) {
            return res.status(400).json({ error: "Le service sélectionné n'appartient pas au professionnel" });
          }
        }
      }

      // Parse appointment date correctly with timezone
      const localDateTime = parse(`${appointmentDate} 12:00`, 'yyyy-MM-dd HH:mm', new Date());
      const parsedAppointmentDate = fromZonedTime(localDateTime, 'America/Toronto');

      // Run conflict check and appointment limit check in parallel
      const [conflicts, limitReached] = await Promise.all([
        storage.checkAppointmentConflict(
          finalProfessionalId,
          parsedAppointmentDate,
          startTime,
          endTime
        ),
        hasReachedAppointmentLimit(finalProfessionalId)
      ]);
      
      if (conflicts.length > 0) {
        return res.status(409).json({ 
          error: "Ce créneau est déjà réservé",
          message: "Un rendez-vous existe déjà à ce créneau horaire."
        });
      }

      if (limitReached) {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Vous avez atteint la limite de 100 rendez-vous du plan Gratuit. Passez au plan Pro pour continuer.",
          limitReached: true
        });
      }

      // Find or create patient
      const patient = await storage.findOrCreatePatient(
        finalProfessionalId,
        email,
        firstName,
        lastName,
        phone,
        clinicId
      );

      // Generate cancellation token for client-initiated cancellation
      const cancellationToken = crypto.randomBytes(32).toString('hex');

      const appointment = await storage.createAppointment({
        professionalId: finalProfessionalId,
        firstName,
        lastName,
        email,
        phone,
        appointmentDate: parsedAppointmentDate,
        startTime,
        endTime,
        appointmentType: appointmentType || null,
        notes: notes || null,
        status,
        userId: null,
        timeSlotId: null,
        patientId: patient.id,
        cancellationToken,
        professionalServiceId: (serviceId && !isAssignmentId) ? serviceId : null,
        professionalServiceAssignmentId: (serviceId && isAssignmentId) ? serviceId : null,
        beneficiaryName: beneficiaryName || null,
        beneficiaryRelation: beneficiaryRelation || null,
        beneficiaryPhone: beneficiaryPhone || null,
        beneficiaryEmail: beneficiaryEmail || null,
      });

      // Reuse the professional data we already fetched (currentProf or targetProf)
      const assignedProfessional = needsBothProfs ? targetProf : currentProf;
      
      if (!assignedProfessional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get service name if provided
      const service = await storage.getAppointmentService(appointment);
      const serviceName = service?.name;

      // Send confirmation emails asynchronously (don't block the response)
      const emailData = {
        patientFirstName: appointment.firstName,
        patientLastName: appointment.lastName,
        patientEmail: appointment.email,
        professionalFirstName: assignedProfessional.firstName,
        professionalLastName: assignedProfessional.lastName,
        professionalEmail: assignedProfessional.email || '',
        profession: assignedProfessional.profession,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: `${startTime} - ${endTime}`,
        notes: appointment.notes || undefined,
        serviceName,
        cancellationToken,
        cancellationDelayHours: assignedProfessional.cancellationDelay ?? 24,
      };

      console.log(`[MANUAL APPOINTMENT] About to send emails for appointment ${appointment.id} to ${emailData.patientEmail}`);

      // Send emails and SMS, log any errors (but don't block the response)
      try {
        const notifications = [];
        
        // Send email to patient only if email is provided
        if (appointment.email) {
          notifications.push(
            sendAppointmentConfirmationToPatient(emailData).then(() => {
              console.log(`[EMAIL SUCCESS] Confirmation email sent to patient ${emailData.patientEmail}`);
            }).catch(err => {
              console.error("[EMAIL ERROR] Error sending confirmation email to patient:", err);
            })
          );
        } else {
          console.log(`[EMAIL SKIP] No email provided for patient, skipping email notification`);
        }
        
        // Send email to professional if they have an email
        if (assignedProfessional.email) {
          notifications.push(
            sendAppointmentNotificationToProfessional(emailData).then(() => {
              console.log(`[EMAIL SUCCESS] Notification email sent to professional ${assignedProfessional.email}`);
            }).catch(err => {
              console.error("[EMAIL ERROR] Error sending notification email to professional:", err);
            })
          );
        }
        
        // Send SMS confirmation to CLIENT ONLY if phone is provided and professional has PRO plan
        if (appointment.phone) {
          const hasSMSAccess = await canSendSMS(finalProfessionalId);
          if (hasSMSAccess) {
            notifications.push(
              sendAppointmentConfirmationSMS({
                patientPhone: appointment.phone,
                patientFirstName: appointment.firstName,
                professionalFirstName: assignedProfessional.firstName,
                professionalLastName: assignedProfessional.lastName,
                profession: assignedProfessional.profession,
                appointmentDate: formatInTimeZone(appointment.appointmentDate, 'America/Toronto', 'EEEE d MMMM yyyy', { locale: fr }),
                appointmentTime: startTime,
                serviceName,
              }).then(() => {
                console.log(`[SMS SUCCESS] Confirmation SMS sent to patient ${appointment.phone}`);
              }).catch(err => {
                console.error("[SMS ERROR] Error sending confirmation SMS to patient:", err);
              })
            );
          } else {
            console.log(`[SMS SKIP] Professional does not have PRO plan, skipping SMS notification`);
          }
        } else {
          console.log(`[SMS SKIP] No phone provided for patient, skipping SMS notification`);
        }
        
        await Promise.all(notifications);
        console.log(`[NOTIFICATION COMPLETE] All notifications processed for appointment ${appointment.id}`);
      } catch (error) {
        console.error("[NOTIFICATION ERROR] Unexpected error in notification sending process:", error);
      }

      res.status(201).json(appointment);
    } catch (error) {
      console.error("Error creating manual appointment:", error);
      if (error instanceof Error && error.message === "APPOINTMENT_LIMIT_REACHED") {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Vous avez atteint la limite de 100 rendez-vous du plan Gratuit. Passez au plan Pro pour continuer.",
          limitReached: true
        });
      }
      res.status(500).json({ error: "Erreur lors de la création du rendez-vous" });
    }
  });

  // Update appointment status
  app.patch("/api/professional/appointments/:id/status", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Statut requis" });
      }

      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé" });
      }

      if (appointment.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const updated = await storage.updateAppointmentStatus(id, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut" });
    }
  });

  // Cancel appointment (professional)
  app.patch("/api/professional/appointments/:id/cancel", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé" });
      }

      // Check if user is the professional or a secretary with access
      let hasAccess = appointment.professionalId === professionalId;
      
      if (!hasAccess && appointment.professionalId) {
        // Check if user is a secretary with access to this professional's appointments
        const { hasAccess: secretaryAccess } = await verifySecretaryAccess(professionalId, appointment.professionalId);
        hasAccess = secretaryAccess;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const updated = await storage.cancelAppointmentByProfessional(id);
      
      // Get professional details for email (use appointment's professional for secretary case)
      const emailProfessionalId = appointment.professionalId || professionalId;
      const professional = await storage.getProfessional(emailProfessionalId);
      
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get service name if applicable
      const service = await storage.getAppointmentService(appointment);
      const serviceName = service?.name;

      // Send cancellation notification to client
      try {
        await sendCancellationNotificationToClient({
          patientFirstName: appointment.firstName,
          patientLastName: appointment.lastName,
          patientEmail: appointment.email,
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          professionalEmail: professional.email || '',
          profession: professional.profession,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.startTime || '',
          notes: appointment.notes || undefined,
          serviceName,
        });
      } catch (emailError) {
        console.error("Error sending cancellation email to client:", emailError);
      }

      // Notify waitlist if there are matching entries
      await notifyWaitlistForCancelledAppointment(appointment);

      res.json(updated);
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation du rendez-vous" });
    }
  });

  // Public endpoint - Cancel appointment by client via token
  // Get appointment details by token (public route)
  app.get("/api/appointments/by-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const appointment = await storage.getAppointmentByToken(token);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé ou lien invalide" });
      }

      if (!appointment.professionalId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get professional details
      const professional = await storage.getProfessional(appointment.professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get service name if applicable
      const service = await storage.getAppointmentService(appointment);
      const serviceName = service?.name;

      res.json({
        ...appointment,
        professionalName: `${professional.firstName} ${professional.lastName}`,
        profession: professional.profession,
        serviceName,
      });
    } catch (error) {
      console.error("Error fetching appointment by token:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du rendez-vous" });
    }
  });

  // Reschedule appointment by token (public route)
  app.post("/api/appointments/reschedule/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { appointmentDate, startTime, endTime, professionalServiceId, notes } = req.body;

      const appointment = await storage.getAppointmentByToken(token);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé ou lien invalide" });
      }

      if (!appointment.professionalId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Check if already cancelled
      if (appointment.status === 'cancelled') {
        return res.status(400).json({ error: "Ce rendez-vous est déjà annulé" });
      }

      // Verify the new slot is available
      const professional = await storage.getProfessional(appointment.professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Parse new appointment date
      const localDateTime = parse(`${appointmentDate} 12:00`, 'yyyy-MM-dd HH:mm', new Date());
      const newAppointmentDateTime = fromZonedTime(localDateTime, 'America/Toronto');

      // Update appointment (preserve existing status unless it's draft)
      const updated = await storage.updateAppointment(appointment.id, {
        appointmentDate: newAppointmentDateTime,
        startTime,
        endTime,
        professionalServiceId: professionalServiceId || null,
        notes: notes || null,
        ...(appointment.status === 'draft' ? { status: 'confirmed' } : {}),
        rescheduledBy: 'client',
        rescheduledAt: new Date(),
      });

      // Get service name if applicable
      let serviceName = undefined;
      if (updated.professionalServiceId) {
        const service = await storage.getProfessionalService(updated.professionalServiceId);
        serviceName = service?.name;
      }

      // Calculate end time for email
      const appointmentTime = `${startTime} - ${endTime}`;

      // Send confirmation email to patient about the rescheduled appointment
      try {
        await sendAppointmentConfirmationToPatient({
          patientFirstName: updated.firstName,
          patientLastName: updated.lastName,
          patientEmail: updated.email,
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          professionalEmail: professional.email || '',
          profession: professional.profession,
          appointmentDate: newAppointmentDateTime,
          appointmentTime,
          notes: updated.notes || undefined,
          serviceName,
          cancellationToken: updated.cancellationToken || '',
        });
      } catch (emailError) {
        console.error("Error sending reschedule confirmation to patient:", emailError);
      }

      // Send notification email to professional about the rescheduled appointment
      if (professional.email) {
        try {
          await sendAppointmentNotificationToProfessional({
            patientFirstName: updated.firstName,
            patientLastName: updated.lastName,
            patientEmail: updated.email,
            professionalFirstName: professional.firstName,
            professionalLastName: professional.lastName,
            professionalEmail: professional.email,
            profession: professional.profession,
            appointmentDate: newAppointmentDateTime,
            appointmentTime,
            notes: updated.notes || undefined,
            serviceName,
          });
        } catch (emailError) {
          console.error("Error sending reschedule notification to professional:", emailError);
        }
      }

      // Send SMS confirmation to CLIENT ONLY if professional has PRO plan
      const hasSMSAccess = await canSendSMS(appointment.professionalId);
      if (hasSMSAccess) {
        try {
          await sendAppointmentConfirmationSMS({
            patientPhone: updated.phone,
            patientFirstName: updated.firstName,
            professionalFirstName: professional.firstName,
            professionalLastName: professional.lastName,
            profession: professional.profession,
            appointmentDate: formatInTimeZone(newAppointmentDateTime, 'America/Toronto', 'EEEE d MMMM yyyy', { locale: fr }),
            appointmentTime: startTime,
            serviceName,
          });
        } catch (smsError) {
          console.error("Error sending reschedule SMS to patient:", smsError);
        }
      } else {
        console.log("[SMS SKIP] Professional does not have PRO plan, skipping SMS notification");
      }

      res.json(updated);
    } catch (error) {
      console.error("Error rescheduling appointment by token:", error);
      res.status(500).json({ error: "Erreur lors de la modification du rendez-vous" });
    }
  });

  app.post("/api/appointments/cancel/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const appointment = await storage.getAppointmentByToken(token);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé ou lien invalide" });
      }

      // Check if already cancelled
      if (appointment.status === 'cancelled') {
        return res.status(400).json({ error: "Ce rendez-vous est déjà annulé" });
      }

      // Check if appointment is in the past
      const now = new Date();
      const appointmentDateTime = new Date(appointment.appointmentDate);
      if (appointment.startTime) {
        const [hours, minutes] = appointment.startTime.split(':');
        appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));
      }
      
      if (appointmentDateTime < now) {
        return res.status(400).json({ error: "Impossible d'annuler un rendez-vous passé" });
      }

      // Get professional to check cancellation policy
      if (!appointment.professionalId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }
      
      const professional = await storage.getProfessional(appointment.professionalId);
      
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Check minimum cancellation delay
      const cancellationDelayHours = professional.cancellationDelay ?? 24;
      const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilAppointment < cancellationDelayHours) {
        return res.status(409).json({ 
          error: "Délai d'annulation insuffisant",
          message: `Pour annuler ce rendez-vous, vous devez le faire au moins ${cancellationDelayHours}h à l'avance. Il ne reste que ${Math.ceil(hoursUntilAppointment)}h avant votre rendez-vous.`,
          minimumHours: cancellationDelayHours,
          remainingHours: Math.ceil(hoursUntilAppointment)
        });
      }

      const updated = await storage.cancelAppointmentByClient(appointment.id);

      // Get service name if applicable
      const service = await storage.getAppointmentService(appointment);
      const serviceName = service?.name;

      // Send confirmation email to client
      try {
        await sendCancellationConfirmationToClient({
          patientFirstName: appointment.firstName,
          patientLastName: appointment.lastName,
          patientEmail: appointment.email,
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          professionalEmail: professional.email || '',
          profession: professional.profession,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.startTime || '',
          notes: appointment.notes || undefined,
          serviceName,
        });
      } catch (emailError) {
        console.error("Error sending cancellation confirmation to client:", emailError);
      }

      // Send notification email to professional
      try {
        await sendCancellationNotificationToProfessional({
          patientFirstName: appointment.firstName,
          patientLastName: appointment.lastName,
          patientEmail: appointment.email,
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          professionalEmail: professional.email || '',
          profession: professional.profession,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.startTime || '',
          notes: appointment.notes || undefined,
          serviceName,
        });
      } catch (emailError) {
        console.error("Error sending cancellation notification to professional:", emailError);
      }

      // Notify waitlist if there are matching entries
      await notifyWaitlistForCancelledAppointment(appointment);

      res.json({ 
        success: true,
        message: "Votre rendez-vous a été annulé avec succès",
        appointment: updated 
      });
    } catch (error) {
      console.error("Error cancelling appointment via token:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation du rendez-vous" });
    }
  });

  // Update appointment
  app.patch("/api/professional/appointments/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      const { professionalServiceId, appointmentDate, startTime, endTime, firstName, lastName, email, phone, notes, status } = req.body;

      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé" });
      }

      // Verify authorization: either the professional who owns the appointment, or a secretary assigned to them
      if (appointment.professionalId !== professionalId) {
        if (!appointment.professionalId || !professionalId) {
          return res.status(403).json({ error: "Non autorisé" });
        }
        
        const appointmentOwner = await storage.getProfessional(appointment.professionalId);
        const currentUser = await storage.getProfessional(professionalId);
        
        if (!appointmentOwner || !currentUser || !appointmentOwner.clinicId) {
          return res.status(403).json({ error: "Non autorisé" });
        }
        
        // Check if current user is a secretary assigned to the appointment owner
        const clinicMembers = await storage.getClinicMembers(appointmentOwner.clinicId);
        const currentMember = clinicMembers.find(m => m.professionalId === professionalId);
        
        if (currentMember?.role !== 'Secrétaire') {
          return res.status(403).json({ error: "Non autorisé" });
        }
        
        const assignments = await storage.getSecretaryAssignments(professionalId);
        const isAssigned = assignments.some(a => a.professionalId === appointment.professionalId);
        
        if (!isAssigned) {
          return res.status(403).json({ error: "Vous n'êtes pas autorisé à modifier ce rendez-vous" });
        }
      }

      const updateData: any = {};
      if (professionalServiceId !== undefined) updateData.professionalServiceId = professionalServiceId || null;
      if (appointmentDate) {
        const localDateTime = parse(`${appointmentDate} 12:00`, 'yyyy-MM-dd HH:mm', new Date());
        updateData.appointmentDate = fromZonedTime(localDateTime, 'America/Toronto');
      }
      if (startTime) updateData.startTime = startTime;
      if (endTime) updateData.endTime = endTime;
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (notes !== undefined) updateData.notes = notes || null;
      if (status) updateData.status = status;

      // If date/time was changed, mark as rescheduled by professional
      const isRescheduled = appointmentDate || startTime || endTime;
      if (isRescheduled) {
        updateData.rescheduledBy = 'professional';
        updateData.rescheduledAt = new Date();
      }

      const updated = await storage.updateAppointment(id, updateData);

      // If date/time was changed and patient has email, send notification
      if (isRescheduled && updated.email && updated.startTime && updated.endTime) {
        // Get professional details for email
        const professional = await storage.getProfessional(professionalId);
        if (professional) {
          // Get service name if applicable
          let serviceName = undefined;
          if (updated.professionalServiceId) {
            try {
              const service = await storage.getProfessionalService(updated.professionalServiceId);
              serviceName = service?.name;
            } catch (e) {
              // Service not found, continue without it
            }
          }

          const appointmentTime = `${updated.startTime} - ${updated.endTime}`;

          // Send confirmation email to patient (don't fail the update if email fails)
          try {
            await sendAppointmentConfirmationToPatient({
              patientFirstName: updated.firstName,
              patientLastName: updated.lastName,
              patientEmail: updated.email,
              professionalFirstName: professional.firstName,
              professionalLastName: professional.lastName,
              professionalEmail: professional.email || '',
              profession: professional.profession,
              appointmentDate: updated.appointmentDate,
              appointmentTime,
              notes: updated.notes || undefined,
              serviceName,
              cancellationToken: updated.cancellationToken || '',
            });
            console.log(`[EMAIL SUCCESS] Reschedule confirmation sent to ${updated.email}`);
          } catch (emailError) {
            console.error("[EMAIL ERROR] Failed to send reschedule email:", emailError);
            // Don't throw - email failure shouldn't break the update
          }
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du rendez-vous" });
    }
  });

  // Delete appointment
  app.delete("/api/professional/appointments/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;

      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé" });
      }

      // Verify authorization: either the professional who owns the appointment, or a secretary assigned to them
      if (appointment.professionalId !== professionalId) {
        if (!appointment.professionalId || !professionalId) {
          return res.status(403).json({ error: "Non autorisé" });
        }
        
        const appointmentOwner = await storage.getProfessional(appointment.professionalId);
        const currentUser = await storage.getProfessional(professionalId);
        
        if (!appointmentOwner || !currentUser || !appointmentOwner.clinicId) {
          return res.status(403).json({ error: "Non autorisé" });
        }
        
        // Check if current user is a secretary assigned to the appointment owner
        const clinicMembers = await storage.getClinicMembers(appointmentOwner.clinicId);
        const currentMember = clinicMembers.find(m => m.professionalId === professionalId);
        
        if (currentMember?.role !== 'Secrétaire') {
          return res.status(403).json({ error: "Non autorisé" });
        }
        
        const assignments = await storage.getSecretaryAssignments(professionalId);
        const isAssigned = assignments.some(a => a.professionalId === appointment.professionalId);
        
        if (!isAssigned) {
          return res.status(403).json({ error: "Vous n'êtes pas autorisé à supprimer ce rendez-vous" });
        }
      }

      // Notify waitlist if there are matching entries
      await notifyWaitlistForCancelledAppointment(appointment);
      
      await storage.deleteAppointment(id);
      res.json({ success: true, message: "Rendez-vous supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du rendez-vous" });
    }
  });

  // Patient management endpoints
  app.get("/api/professional/patients", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional and check if they're in a clinic
      const professional = await storage.getProfessional(professionalId);
      
      if (!professional || !professional.clinicId) {
        // Not in a clinic, return only their patients with appointments
        const patients = await storage.getProfessionalPatientsWithAppointments(professionalId);
        
        // Log patient data access
        await logAudit({
          userId: req.session.userId,
          professionalId,
          action: 'view_patients',
          resourceType: 'patient',
          details: { count: patients.length },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        
        res.json(patients);
        return;
      }

      // Check clinic role
      const clinicMembers = await storage.getClinicMembers(professional.clinicId);
      const currentMember = clinicMembers.find(m => m.professionalId === professionalId);
      
      if (!currentMember) {
        // Not a clinic member, return only their patients with appointments
        const patients = await storage.getProfessionalPatientsWithAppointments(professionalId);
        res.json(patients);
        return;
      }

      // If Admin or Secrétaire, return all clinic patients with professional info
      if (currentMember.role === 'Admin' || currentMember.role === 'Secrétaire') {
        const patientsWithProfessionals = await storage.getClinicPatientsWithProfessionals(professional.clinicId);
        res.json(patientsWithProfessionals);
      } else {
        // Professionnel: return only their patients with their info
        const patientsWithProfessionals = await storage.getProfessionalPatientsWithInfo(professionalId);
        res.json(patientsWithProfessionals);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des patients" });
    }
  });

  app.post("/api/professional/patients", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const currentProfessionalId = req.session.professionalId;
      
      if (!currentProfessionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const { 
        firstName, 
        lastName, 
        email, 
        phone, 
        dateOfBirth, 
        address, 
        city, 
        province,
        postalCode, 
        notes,
        professionalId: targetProfessionalId 
      } = req.body;

      if (!firstName || !lastName || !email || !phone) {
        return res.status(400).json({ error: "Les champs prénom, nom, email et téléphone sont requis" });
      }

      // Determine which professional the patient should belong to
      let finalProfessionalId = currentProfessionalId;
      let clinicId: string | null = null;

      // If a different professional is specified, verify authorization
      if (targetProfessionalId && targetProfessionalId !== currentProfessionalId) {
        const currentProf = await storage.getProfessional(currentProfessionalId);
        const targetProf = await storage.getProfessional(targetProfessionalId);
        
        if (!targetProf) {
          return res.status(404).json({ error: "Le professionnel sélectionné n'existe pas" });
        }
        
        // Verify same clinic
        if (!currentProf?.clinicId || !targetProf.clinicId || currentProf.clinicId !== targetProf.clinicId) {
          return res.status(403).json({ error: "Vous ne pouvez créer un patient que pour les professionnels de votre clinique" });
        }

        // Only Admins and Secretaries (with assignment) can create patients for other professionals
        const clinicMembers = await storage.getClinicMembers(targetProf.clinicId);
        const currentMember = clinicMembers.find(m => m.professionalId === currentProfessionalId);
        
        if (!currentMember) {
          return res.status(403).json({ error: "Non autorisé" });
        }

        if (currentMember.role === 'Secrétaire') {
          // Secretaries must be assigned to the target professional
          const assignments = await storage.getSecretaryAssignments(currentProfessionalId);
          const isAssigned = assignments.some(a => a.professionalId === targetProfessionalId);
          
          if (!isAssigned) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à créer des patients pour ce professionnel" });
          }
        } else if (currentMember.role === 'Professionnel') {
          // Regular professionals can only create patients for themselves
          return res.status(403).json({ error: "Vous ne pouvez créer des patients que pour vous-même" });
        }
        // Admin role is allowed to create patients for any professional in the clinic

        finalProfessionalId = targetProfessionalId;
        clinicId = targetProf.clinicId;
      } else {
        const professional = await storage.getProfessional(currentProfessionalId);
        clinicId = professional?.clinicId || null;
      }
      
      const patient = await storage.createPatient({
        professionalId: finalProfessionalId,
        clinicId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address || null,
        city: city || null,
        province: province || null,
        postalCode: postalCode || null,
        notes: notes || null,
      });

      res.status(201).json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      res.status(500).json({ error: "Erreur lors de la création du patient" });
    }
  });

  // Get patient details with full appointment history
  app.get("/api/professional/patients/:id", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const patient = await storage.getPatientWithAppointments(id);

      if (!patient) {
        return res.status(404).json({ error: "Client non trouvé" });
      }

      // Verify authorization: patient must belong to professional or their clinic
      const professional = await storage.getProfessional(professionalId);
      const isAuthorized = 
        patient.professionalId === professionalId ||
        (professional?.clinicId && patient.clinicId === professional.clinicId);

      if (!isAuthorized) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Convert appointment dates to local timezone
      const localizedPatient = {
        ...patient,
        appointments: patient.appointments?.map(convertAppointmentToLocalTime) || []
      };

      res.json(localizedPatient);
    } catch (error) {
      console.error("Error fetching patient details:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des détails du client" });
    }
  });

  app.get("/api/professional/patients/search", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { q } = req.query;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!q) {
        return res.status(400).json({ error: "Paramètre de recherche requis" });
      }

      const patients = await storage.searchPatients(professionalId, q as string);
      res.json(patients);
    } catch (error) {
      console.error("Error searching patients:", error);
      res.status(500).json({ error: "Erreur lors de la recherche de patients" });
    }
  });

  app.patch("/api/professional/patients/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const professional = await storage.getProfessional(professionalId);
      const patient = await storage.getPatient(id);
      
      if (!patient || !professional) {
        return res.status(404).json({ error: "Patient non trouvé" });
      }

      const hasAccess = patient.professionalId === professionalId ||
        (professional.clinicId && patient.clinicId === professional.clinicId);

      if (!hasAccess) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Clean data: convert empty dateOfBirth to null, convert valid date string to Date
      const updateData = { ...req.body };
      if (updateData.dateOfBirth !== undefined) {
        if (updateData.dateOfBirth === "" || updateData.dateOfBirth === null) {
          updateData.dateOfBirth = null;
        } else if (typeof updateData.dateOfBirth === 'string') {
          updateData.dateOfBirth = new Date(updateData.dateOfBirth);
        }
      }

      const updated = await storage.updatePatient(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating patient:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du patient" });
    }
  });

  // Professional search endpoint
  app.get("/api/professionals/search", async (req, res) => {
    try {
      const { profession, city, province, availableAfter } = req.query;
      
      // Parse availability date if provided
      let availabilityDate;
      if (availableAfter) {
        availabilityDate = new Date(availableAfter as string);
        if (isNaN(availabilityDate.getTime())) {
          return res.status(400).json({ error: "Invalid date format for availableAfter" });
        }
      }
      
      // Use availability-aware search if availability date is provided
      const results = availabilityDate 
        ? await storage.searchProfessionalsWithAvailability(
            profession as string, 
            city as string,
            province as string,
            availabilityDate
          )
        : await storage.searchProfessionals(
            profession as string, 
            city as string,
            province as string
          );
      
      // Filter out professionals in read-only mode (they can't accept new appointments)
      const visibleResults = await filterPubliclyVisibleProfessionals(results);
          
      res.json(visibleResults);
    } catch (error) {
      console.error("Error searching professionals:", error);
      res.status(500).json({ error: "Failed to search professionals" });
    }
  });

  // Get all professionals
  app.get("/api/professionals", async (req, res) => {
    try {
      const professionals = await storage.getAllProfessionals();
      res.json(professionals);
    } catch (error) {
      console.error("Error fetching professionals:", error);
      res.status(500).json({ error: "Failed to fetch professionals" });
    }
  });

  // Get professional by ID
  app.get("/api/professionals/:id", async (req, res) => {
    try {
      const professional = await storage.getProfessional(req.params.id);
      if (!professional) {
        return res.status(404).json({ error: "Professional not found" });
      }
      res.json(professional);
    } catch (error) {
      console.error("Error fetching professional:", error);
      res.status(500).json({ error: "Failed to fetch professional" });
    }
  });

  // Get professional schedules (public route for profile page)
  app.get("/api/professionals/:id/schedules", async (req, res) => {
    try {
      const schedules = await storage.getProfessionalSchedules(req.params.id);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching professional schedules:", error);
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  // Create user account
  app.post("/api/users", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid user data", details: result.error.issues });
      }
      const user = await storage.createUser(result.data);
      // Don't return password in response
      const { password, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Create appointment
  const createAppointmentSchema = z.object({
    professionalId: z.string().min(1, "Professional ID is required"),
    appointmentDate: z.string().min(1, "Appointment date is required"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    phone: z.string().min(10, "Phone number must be at least 10 characters"),
    notes: z.string().optional(),
    professionalServiceId: z.string().optional().transform(val => val === "" ? undefined : val),
    beneficiaryName: z.string().optional().transform(val => val === "" ? undefined : val),
    beneficiaryRelation: z.string().optional().transform(val => val === "" ? undefined : val),
    beneficiaryPhone: z.string().optional().transform(val => val === "" ? undefined : val),
    beneficiaryEmail: z.string().email("Invalid email format").optional().or(z.literal("")).transform(val => val === "" ? undefined : val),
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const result = createAppointmentSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid appointment data", 
          details: result.error.issues 
        });
      }
      
      const professional = await storage.getProfessional(result.data.professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professional not found" });
      }

      // Parse appointment date correctly with timezone (America/Toronto)
      // Use noon (12:00) to avoid timezone edge cases
      const localDateTime = parse(`${result.data.appointmentDate} 12:00`, 'yyyy-MM-dd HH:mm', new Date());
      const appointmentDate = fromZonedTime(localDateTime, 'America/Toronto');
      
      // Check for appointment conflicts
      const conflicts = await storage.checkAppointmentConflict(
        result.data.professionalId,
        appointmentDate,
        result.data.startTime,
        result.data.endTime
      );
      
      if (conflicts.length > 0) {
        return res.status(409).json({ error: "Time slot is already booked" });
      }

      // Validate that the requested time slot is actually available
      // Generate available slots for the requested date and verify the slot exists
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const availableSlots = await storage.getAvailableTimeSlots(
        result.data.professionalId,
        startOfDay,
        endOfDay,
        undefined,
        result.data.professionalServiceId,
        true // Skip minimum advance booking check during validation (client already started booking)
      );
      
      // Check if the requested slot exists in available slots
      // Compare dates by YYYY-MM-DD string to avoid timezone issues
      const requestedDateStr = result.data.appointmentDate; // Original YYYY-MM-DD string
      const requestedSlotIsAvailable = availableSlots.some(slot => {
        // Format slot date using date-fns to avoid UTC conversion issues
        const slotDateStr = format(new Date(slot.slotDate), 'yyyy-MM-dd');
        return slotDateStr === requestedDateStr && 
               slot.startTime === result.data.startTime && 
               slot.endTime === result.data.endTime;
      });
      
      if (!requestedSlotIsAvailable) {
        return res.status(400).json({ error: "Le créneau sélectionné n'est plus disponible" });
      }

      // Check appointment limit for Free plan
      const limitReached = await hasReachedAppointmentLimit(result.data.professionalId);
      if (limitReached) {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Vous avez atteint la limite de 100 rendez-vous du plan Gratuit. Passez au plan Pro pour continuer.",
          limitReached: true
        });
      }

      // Find or create patient record (deduplicate by email/phone)
      const patient = await storage.findOrCreatePatient(
        professional.id,
        result.data.email,
        result.data.firstName,
        result.data.lastName,
        result.data.phone,
        professional.clinicId || undefined
      );

      // Determine if the service ID is an assignment ID or a direct professional service ID
      let finalProfessionalServiceId = null;
      let professionalServiceAssignmentId = null;
      
      if (result.data.professionalServiceId) {
        // Check if it's a professional service assignment
        const assignment = await storage.getServiceAssignmentById(result.data.professionalServiceId);
        
        if (assignment) {
          // It's a clinic service assignment - use the assignment ID
          professionalServiceAssignmentId = assignment.id;
        } else {
          // Check if it's a direct professional service
          const professionalService = await storage.getProfessionalService(result.data.professionalServiceId);
          if (professionalService) {
            finalProfessionalServiceId = professionalService.id;
          }
        }
      }

      // Generate cancellation token for client-initiated cancellation
      const cancellationToken = crypto.randomBytes(32).toString('hex');

      // Create appointment directly without timeSlot
      const appointment = await storage.createAppointment({
        professionalId: result.data.professionalId,
        patientId: patient.id,
        appointmentDate,
        startTime: result.data.startTime,
        endTime: result.data.endTime,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        email: result.data.email,
        phone: result.data.phone,
        notes: result.data.notes,
        professionalServiceId: finalProfessionalServiceId,
        professionalServiceAssignmentId: professionalServiceAssignmentId,
        beneficiaryName: result.data.beneficiaryName,
        beneficiaryRelation: result.data.beneficiaryRelation,
        beneficiaryPhone: result.data.beneficiaryPhone,
        beneficiaryEmail: result.data.beneficiaryEmail,
        status: "confirmed",
        cancellationToken,
      });
      
      // Debug log to check appointment structure
      console.log('📋 Appointment created:', JSON.stringify(appointment, null, 2));
      
      // Get service name if provided
      const service = await storage.getAppointmentService(appointment);
      const serviceName = service?.name;
      
      // Send confirmation emails asynchronously (don't block the response)
      const emailData = {
        patientFirstName: appointment.firstName,
        patientLastName: appointment.lastName,
        patientEmail: appointment.email,
        patientPhone: appointment.phone,
        professionalFirstName: professional.firstName,
        professionalLastName: professional.lastName,
        professionalEmail: professional.email || '',
        profession: professional.profession,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: `${result.data.startTime} - ${result.data.endTime}`,
        notes: appointment.notes || undefined,
        serviceName,
        beneficiaryName: appointment.beneficiaryName || undefined,
        beneficiaryRelation: appointment.beneficiaryRelation || undefined,
        beneficiaryPhone: appointment.beneficiaryPhone || undefined,
        beneficiaryEmail: appointment.beneficiaryEmail || undefined,
        cancellationToken,
        cancellationDelayHours: professional.cancellationDelay ?? 24,
      };
      
      console.log('📧 Preparing to send appointment confirmation emails...');
      console.log('📧 Patient email:', emailData.patientEmail);
      console.log('📧 Professional email:', emailData.professionalEmail);
      console.log('📧 Beneficiary info:', appointment.beneficiaryName ? 'Yes (for someone else)' : 'No (for self)');
      console.log('📧 Email data beneficiary fields:', {
        beneficiaryName: emailData.beneficiaryName,
        beneficiaryRelation: emailData.beneficiaryRelation,
        beneficiaryPhone: emailData.beneficiaryPhone,
        beneficiaryEmail: emailData.beneficiaryEmail
      });
      
      // Send emails without waiting (fire and forget)
      Promise.all([
        sendAppointmentConfirmationToPatient(emailData).then(() => {
          console.log(`✅ Patient confirmation email sent successfully to ${emailData.patientEmail}`);
        }).catch(error => {
          console.error(`❌ Error sending patient confirmation email to ${emailData.patientEmail}:`, error);
          if (error.message) console.error('Error message:', error.message);
          if (error.response) console.error('Error response:', error.response);
        }),
        professional.email ? sendAppointmentNotificationToProfessional(emailData).then(() => {
          console.log(`✅ Professional notification email sent successfully to ${emailData.professionalEmail}`);
        }).catch(error => {
          console.error(`❌ Error sending professional notification email to ${emailData.professionalEmail}:`, error);
          if (error.message) console.error('Error message:', error.message);
          if (error.response) console.error('Error response:', error.response);
        }) : Promise.resolve().then(() => {
          console.log('⚠️ Professional email not sent (no email configured)');
        }),
      ]).then(() => {
        console.log(`✅ All appointment confirmation emails processed`);
      }).catch(error => {
        console.error("❌ Error in email sending process:", error);
      });

      // Send SMS confirmation to client (non-blocking) if professional has PRO plan
      canSendSMS(professional.id).then(hasSMSAccess => {
        if (hasSMSAccess) {
          sendAppointmentConfirmationSMS({
            patientPhone: appointment.phone,
            patientFirstName: appointment.firstName,
            professionalFirstName: professional.firstName,
            professionalLastName: professional.lastName,
            profession: professional.profession,
            appointmentDate: formatInTimeZone(appointment.appointmentDate, 'America/Toronto', 'EEEE d MMMM yyyy', { locale: fr }),
            appointmentTime: result.data.startTime,
            serviceName,
          }).then(() => {
            console.log(`✅ SMS confirmation sent to ${appointment.phone}`);
          }).catch(error => {
            console.error(`❌ Error sending SMS to ${appointment.phone}:`, error);
          });
        } else {
          console.log('⚠️ SMS not sent (professional does not have PRO plan)');
        }
      });
      
      res.status(201).json(appointment);
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      
      if (error.message === "APPOINTMENT_LIMIT_REACHED") {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Vous avez atteint la limite de 100 rendez-vous du plan Gratuit. Passez au plan Pro pour continuer.",
          limitReached: true
        });
      }
      
      if (error.message === 'Time slot is already booked' || error.code === '23505') {
        return res.status(409).json({ error: "Time slot is already booked" });
      }
      
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // Get user appointments
  app.get("/api/users/:userId/appointments", async (req, res) => {
    try {
      const appointments = await storage.getUserAppointments(req.params.userId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching user appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Get professional appointments
  app.get("/api/professionals/:professionalId/appointments", async (req, res) => {
    try {
      const appointments = await storage.getProfessionalAppointments(req.params.professionalId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching professional appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Get available time slots for a professional
  app.get("/api/professionals/:professionalId/timeslots", async (req, res) => {
    try {
      const { fromDate, toDate, excludeAppointmentId, professionalServiceId } = req.query;
      
      let from, to;
      if (fromDate) {
        from = new Date(fromDate as string);
        if (isNaN(from.getTime())) {
          return res.status(400).json({ error: "Invalid fromDate format" });
        }
      }
      if (toDate) {
        to = new Date(toDate as string);
        if (isNaN(to.getTime())) {
          return res.status(400).json({ error: "Invalid toDate format" });
        }
      }
      
      const timeSlots = await storage.getAvailableTimeSlots(
        req.params.professionalId, 
        from, 
        to, 
        excludeAppointmentId as string | undefined,
        professionalServiceId as string | undefined
      );
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching time slots:", error);
      res.status(500).json({ error: "Failed to fetch time slots" });
    }
  });

  // Get public services for a professional (visible services only)
  app.get("/api/professionals/:professionalId/services", async (req, res) => {
    try {
      const { professionalId } = req.params;
      const services = await storage.getProfessionalServices(professionalId);
      // Filter to only return visible services for public booking
      const visibleServices = services.filter(service => service.isVisible);
      res.json(visibleServices);
    } catch (error) {
      console.error("Error fetching professional services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // Get available time slots for a specific date
  app.get("/api/time-slots", async (req, res) => {
    try {
      const { professionalId, date: dateStr } = req.query;
      
      if (!professionalId || !dateStr) {
        return res.status(400).json({ error: "Missing professionalId or date" });
      }
      
      const date = new Date(dateStr as string);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      // Get time slots for the specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const timeSlots = await storage.getAvailableTimeSlots(professionalId as string, startOfDay, endOfDay);
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching time slots:", error);
      res.status(500).json({ error: "Failed to fetch time slots" });
    }
  });

  // Professional schedules routes
  app.get("/api/professional/schedules", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const schedules = await storage.getProfessionalSchedules(professionalId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des horaires" });
    }
  });

  app.post("/api/professional/schedules", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const scheduleValidationSchema = insertProfessionalScheduleSchema
        .omit({ professionalId: true })
        .refine(
          (data) => data.startTime < data.endTime,
          { message: "L'heure de début doit être avant l'heure de fin" }
        );

      const result = scheduleValidationSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: result.error.issues 
        });
      }

      const schedule = await storage.createProfessionalSchedule({
        ...result.data,
        professionalId,
      });

      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating schedule:", error);
      res.status(500).json({ error: "Erreur lors de la création de l'horaire" });
    }
  });

  app.patch("/api/professional/schedules/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const schedule = await storage.getProfessionalSchedule(id);
      
      if (!schedule || schedule.professionalId !== professionalId) {
        return res.status(404).json({ error: "Horaire non trouvé" });
      }

      const updateValidationSchema = insertProfessionalScheduleSchema
        .omit({ professionalId: true })
        .partial()
        .refine(
          (data) => !data.startTime || !data.endTime || data.startTime < data.endTime,
          { message: "L'heure de début doit être avant l'heure de fin" }
        );

      const result = updateValidationSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: result.error.issues 
        });
      }

      const updated = await storage.updateProfessionalSchedule(id, result.data);

      res.json(updated);
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'horaire" });
    }
  });

  app.delete("/api/professional/schedules/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const schedule = await storage.getProfessionalSchedule(id);
      
      if (!schedule || schedule.professionalId !== professionalId) {
        return res.status(404).json({ error: "Horaire non trouvé" });
      }

      await storage.deleteProfessionalSchedule(id);
      res.json({ message: "Horaire supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting schedule:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de l'horaire" });
    }
  });

  // Get professional breaks
  app.get("/api/professional/breaks", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const breaks = await storage.getProfessionalBreaks(professionalId);
      res.json(breaks);
    } catch (error) {
      console.error("Error fetching breaks:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des pauses" });
    }
  });

  // Create professional break
  app.post("/api/professional/breaks", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const validated = insertProfessionalBreakSchema.parse({
        ...req.body,
        professionalId
      });

      const breakData = await storage.createProfessionalBreak(validated);
      res.json(breakData);
    } catch (error) {
      console.error("Error creating break:", error);
      res.status(500).json({ error: "Erreur lors de la création de la pause" });
    }
  });

  // Update professional break
  app.patch("/api/professional/breaks/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const existingBreak = await storage.getProfessionalBreak(id);
      
      if (!existingBreak || existingBreak.professionalId !== professionalId) {
        return res.status(404).json({ error: "Pause non trouvée" });
      }

      const validated = insertProfessionalBreakSchema.partial().parse(req.body);
      const updated = await storage.updateProfessionalBreak(id, validated);
      res.json(updated);
    } catch (error) {
      console.error("Error updating break:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de la pause" });
    }
  });

  // Delete professional break
  app.delete("/api/professional/breaks/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const breakData = await storage.getProfessionalBreak(id);
      
      if (!breakData || breakData.professionalId !== professionalId) {
        return res.status(404).json({ error: "Pause non trouvée" });
      }

      await storage.deleteProfessionalBreak(id);
      res.json({ message: "Pause supprimée avec succès" });
    } catch (error) {
      console.error("Error deleting break:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de la pause" });
    }
  });

  // Clinic management routes
  app.post("/api/clinics", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check plan and clinic limits
      const professional = await storage.getProfessional(professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const planType = professional.planType || 'legacy';
      
      // Free plan can create ONE clinic (their individual profile)
      if (planType === 'free' && professional.clinicId) {
        return res.status(403).json({ 
          error: "Le plan Gratuit permet une seule clinique. Passez à Pro pour gérer plusieurs cliniques.",
          upgradeRequired: true 
        });
      }

      const { name, address, city, postalCode, phone, email, description } = req.body;

      if (!name || !address || !city || !postalCode) {
        return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis" });
      }

      // Create clinic
      const clinic = await storage.createClinic({
        name,
        address,
        city,
        postalCode,
        phone: phone || null,
        email: email || null,
        description: description || null,
      });

      // Update professional to link to clinic
      await storage.updateProfessional(professionalId, {
        clinicId: clinic.id,
      });

      // Add professional as admin member of the clinic
      await storage.addClinicMember({
        clinicId: clinic.id,
        professionalId,
        role: "Admin",
      });

      res.json(clinic);
    } catch (error) {
      console.error("Error creating clinic:", error);
      res.status(500).json({ error: "Erreur lors de la création de la clinique" });
    }
  });

  app.get("/api/clinics/:id", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const clinic = await storage.getClinic(clinicId);

      if (!clinic) {
        return res.status(404).json({ error: "Clinique non trouvée" });
      }

      // Check if professional is member of this clinic
      const professional = await storage.getProfessional(professionalId);
      if (professional?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      res.json(clinic);
    } catch (error) {
      console.error("Error fetching clinic:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la clinique" });
    }
  });

  app.get("/api/clinics/:id/members", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if professional is member of this clinic
      const professional = await storage.getProfessional(professionalId);
      if (professional?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const members = await storage.getClinicMembers(clinicId);
      
      // Get professional details for each member and their read-only status
      const membersWithDetails = await Promise.all(
        members.map(async (member) => {
          const prof = await storage.getProfessional(member.professionalId);
          const isReadOnly = member.role !== "Secrétaire" ? await isReadOnlyMode(member.professionalId) : false;
          return {
            ...member,
            professional: prof,
            isReadOnly,
          };
        })
      );

      // Include deleted professionals (soft delete) for 48-hour grace period
      // Frontend will handle displaying them differently with undo option
      res.json(membersWithDetails);
    } catch (error) {
      console.error("Error fetching clinic members:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des membres" });
    }
  });

  // Get all professionals in a clinic (for admin calendar switching)
  app.get("/api/clinics/:id/professionals", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if professional is member of this clinic
      const professional = await storage.getProfessional(professionalId);
      if (professional?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Get all clinic members
      const members = await storage.getClinicMembers(clinicId);
      
      // Get professional details for each member (only active professionals, excluding secretaries)
      const professionals = await Promise.all(
        members
          .filter(member => member.role !== "Secrétaire") // Exclude secretaries
          .map(async (member) => {
            return await storage.getProfessional(member.professionalId);
          })
      );

      // Filter out null values and return only active professionals
      const activeProfessionals = professionals.filter(prof => prof && prof.isActive);
      
      res.json(activeProfessionals);
    } catch (error) {
      console.error("Error fetching clinic professionals:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des professionnels" });
    }
  });

  // Create a new clinic member directly (alternative to invitation)
  // IMPORTANT: This route must be defined BEFORE the /members route to avoid Express route matching conflicts
  app.post("/api/clinics/:clinicId/members/create", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { clinicId } = req.params;
      const { firstName, lastName, email, professions, role, phone, address, city, postalCode, province } = req.body;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify requester is admin of this clinic
      const members = await storage.getClinicMembers(clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut créer des membres" });
      }

      // Check if user already exists with this email
      const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà" });
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);

      // Generate unique username from email
      const username = email.split('@')[0].toLowerCase() + Math.floor(Math.random() * 1000);

      // Create user with requirePasswordChange flag
      // Note: storage.createUser will hash the password
      const newUser = await storage.createUser({
        username,
        email: email.toLowerCase(),
        password: tempPassword,
        firstName,
        lastName,
        requirePasswordChange: true,
      });

      // Create professional profile
      const newProfessional = await storage.createProfessional({
        userId: newUser.id,
        clinicId,
        firstName,
        lastName,
        professions: (professions && professions.length > 0) ? professions : ["Professionnel de santé"],
        speciality: null,
        address: address || "",
        city: city || "",
        postalCode: postalCode || "",
        province: province || null,
        phone: phone || null,
        email: email.toLowerCase(),
        profilePicture: null,
        description: null,
        appointmentDuration: 30,
        bufferTime: 5,
      });

      // Add to clinic with specified role
      await storage.addClinicMember({
        clinicId,
        professionalId: newProfessional.id,
        role,
      });

      // Get clinic details for email
      const clinic = await storage.getClinic(clinicId);

      // Send email with credentials
      try {
        await sendNewMemberCredentialsEmail({
          email: email.toLowerCase(),
          firstName,
          lastName,
          clinicName: clinic?.name || "Clinique",
          role,
          temporaryPassword: tempPassword,
          username,
        });
      } catch (emailError) {
        console.error("Error sending credentials email:", emailError);
        // Don't fail the creation if email fails
      }

      res.status(201).json({
        message: "Membre créé avec succès",
        member: newProfessional,
      });
    } catch (error) {
      console.error("Error creating clinic member:", error);
      res.status(500).json({ error: "Erreur lors de la création du membre" });
    }
  });

  app.post("/api/clinics/:id/members", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;
      const { professionalEmail, role } = req.body;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if requesting professional is member and admin of this clinic
      const requesterProfessional = await storage.getProfessional(professionalId);
      if (requesterProfessional?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const requesterMembership = await storage.getClinicMembers(clinicId);
      const requesterMember = requesterMembership.find(m => m.professionalId === professionalId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent ajouter des membres" });
      }

      // Find professional by email
      const targetUser = await storage.getUserByEmail(professionalEmail);
      if (!targetUser) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const targetProfessional = await storage.getProfessionalByUserId(targetUser.id);
      if (!targetProfessional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Add to clinic
      await storage.updateProfessional(targetProfessional.id, {
        clinicId,
      });

      const member = await storage.addClinicMember({
        clinicId,
        professionalId: targetProfessional.id,
        role: role || "professional",
      });

      res.json(member);
    } catch (error: any) {
      console.error("Error adding clinic member:", error);
      if (error.code === '23505') {
        return res.status(409).json({ error: "Ce professionnel est déjà membre de la clinique" });
      }
      res.status(500).json({ error: "Erreur lors de l'ajout du membre" });
    }
  });

  app.delete("/api/clinics/:clinicId/members/:professionalId", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { clinicId, professionalId } = req.params;

      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if requesting professional is member of this clinic
      const requester = await storage.getProfessional(requesterId);
      if (requester?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const requesterMembership = await storage.getClinicMembers(clinicId);
      const requesterMember = requesterMembership.find(m => m.professionalId === requesterId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent retirer des membres" });
      }

      // Check if target member exists
      const targetMember = requesterMembership.find(m => m.professionalId === professionalId);
      if (!targetMember) {
        return res.status(404).json({ error: "Membre non trouvé" });
      }

      // Check if member is pending (not yet active)
      const targetProfessional = await storage.getProfessional(professionalId);
      if (!targetProfessional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // If member is pending (not active), they must be cancelled first
      if (!targetProfessional.isActive && !targetMember.cancelled) {
        return res.status(400).json({ error: "Veuillez d'abord annuler ce membre avant de le supprimer" });
      }

      // Completely delete the member from the database (cascade delete)
      await storage.deleteClinicMemberCompletely(clinicId, professionalId);

      // Update subscription quantity for the clinic admin
      const membersAfterDeletion = await storage.getClinicMembers(clinicId);
      const adminMember = membersAfterDeletion.find(m => m.role === 'Admin');
      if (adminMember) {
        await updateSubscriptionQuantity(adminMember.professionalId);
      }

      res.json({ message: "Membre supprimé avec succès", professionalId });
    } catch (error) {
      console.error("Error deleting clinic member:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du membre" });
    }
  });

  // Restore clinic member (undo deletion)
  app.post("/api/clinics/:clinicId/members/:professionalId/restore", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { clinicId, professionalId } = req.params;

      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if requesting professional is member of this clinic
      const requester = await storage.getProfessional(requesterId);
      if (requester?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const requesterMembership = await storage.getClinicMembers(clinicId);
      const requesterMember = requesterMembership.find(m => m.professionalId === requesterId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent restaurer des membres" });
      }

      // Restore the member
      await storage.restoreClinicMember(professionalId);

      // Update subscription quantity for the clinic admin
      const membersAfterRestore = await storage.getClinicMembers(clinicId);
      const adminMember = membersAfterRestore.find(m => m.role === 'Admin');
      if (adminMember) {
        await updateSubscriptionQuantity(adminMember.professionalId);
      }

      res.json({ message: "Membre restauré avec succès" });
    } catch (error) {
      console.error("Error restoring clinic member:", error);
      res.status(500).json({ error: "Erreur lors de la restauration du membre" });
    }
  });

  // Update clinic member role
  app.patch("/api/clinics/:clinicId/members/:professionalId/role", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { clinicId, professionalId } = req.params;
      const { role } = req.body;

      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!role || !["Admin", "Professionnel", "Secrétaire"].includes(role)) {
        return res.status(400).json({ error: "Rôle invalide" });
      }

      // Check if requesting professional is member of this clinic
      const requester = await storage.getProfessional(requesterId);
      if (requester?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const requesterMembership = await storage.getClinicMembers(clinicId);
      const requesterMember = requesterMembership.find(m => m.professionalId === requesterId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent modifier les rôles" });
      }

      // Check if target member exists in clinic
      const targetMember = requesterMembership.find(m => m.professionalId === professionalId);
      if (!targetMember) {
        return res.status(404).json({ error: "Membre non trouvé dans la clinique" });
      }

      // Don't allow changing last admin
      if (role !== "admin") {
        const admins = requesterMembership.filter(m => m.role === "Admin");
        if (admins.length === 1 && targetMember.role === "Admin") {
          return res.status(400).json({ error: "Impossible de retirer le dernier administrateur" });
        }
      }

      const updatedMember = await storage.updateClinicMemberRole(clinicId, professionalId, role);
      if (!updatedMember) {
        return res.status(500).json({ error: "Erreur lors de la mise à jour du rôle" });
      }
      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating member role:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du rôle" });
    }
  });

  // Cancel a pending clinic member (mark as cancelled)
  app.patch("/api/clinics/:clinicId/members/:professionalId/cancel", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { clinicId, professionalId } = req.params;

      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if requester is admin of this clinic
      const members = await storage.getClinicMembers(clinicId);
      const requesterMember = members.find(m => m.professionalId === requesterId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut annuler des membres" });
      }

      // Check if target member exists
      const targetMember = members.find(m => m.professionalId === professionalId);
      if (!targetMember) {
        return res.status(404).json({ error: "Membre non trouvé" });
      }

      // Check if target professional is pending (not yet active)
      const targetProfessional = await storage.getProfessional(professionalId);
      if (!targetProfessional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      if (targetProfessional.isActive) {
        return res.status(400).json({ error: "Seuls les membres en attente peuvent être annulés" });
      }

      // Mark member as cancelled
      await db.update(clinicMembers)
        .set({ cancelled: true })
        .where(
          and(
            eq(clinicMembers.clinicId, clinicId),
            eq(clinicMembers.professionalId, professionalId)
          )
        );

      res.json({ message: "Membre annulé avec succès" });
    } catch (error) {
      console.error("Error cancelling member:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation du membre" });
    }
  });

  // Get clinic overview statistics
  app.get("/api/clinics/:id/overview", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Check if requesting professional is member of this clinic
      const requester = await storage.getProfessional(professionalId);
      if (requester?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Get all clinic members
      const members = await storage.getClinicMembers(clinicId);

      // Get all appointments for all clinic professionals
      const clinicAppointments = await storage.getClinicAppointments(clinicId);

      // Get all professionals for the clinic
      const professionalDetails = await Promise.all(
        members.map(m => storage.getProfessional(m.professionalId))
      );

      // Calculate statistics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayAppointments = clinicAppointments.filter((apt: any) => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() === today.getTime();
      });

      const upcomingAppointments = clinicAppointments.filter((apt: any) => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() > today.getTime();
      });

      // Count unique patients
      const uniquePatients = new Set(clinicAppointments.map((apt: any) => apt.email)).size;

      // Calculate stats per professional
      const professionalStats = members.map((member, index) => {
        const professional = professionalDetails[index];
        const professionalAppointments = clinicAppointments.filter(
          (apt: any) => apt.professionalId === member.professionalId
        );

        return {
          professionalId: member.professionalId,
          firstName: professional?.firstName,
          lastName: professional?.lastName,
          profession: professional?.profession,
          role: member.role,
          totalAppointments: professionalAppointments.length,
          todayAppointments: professionalAppointments.filter((apt: any) => {
            const aptDate = new Date(apt.appointmentDate);
            aptDate.setHours(0, 0, 0, 0);
            return aptDate.getTime() === today.getTime();
          }).length,
          upcomingAppointments: professionalAppointments.filter((apt: any) => {
            const aptDate = new Date(apt.appointmentDate);
            aptDate.setHours(0, 0, 0, 0);
            return aptDate.getTime() > today.getTime();
          }).length,
        };
      });

      res.json({
        totalAppointments: clinicAppointments.length,
        todayAppointments: todayAppointments.length,
        upcomingAppointments: upcomingAppointments.length,
        totalProfessionals: members.length,
        uniquePatients,
        professionalStats,
        recentAppointments: clinicAppointments
          .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
          .slice(0, 10),
      });
    } catch (error) {
      console.error("Error fetching clinic overview:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
    }
  });

  // Team invitation routes
  app.post("/api/clinics/:id/invite", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;
      const { email, role } = req.body;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!email) {
        return res.status(400).json({ error: "Email requis" });
      }

      // Check if requesting professional is member of this clinic
      const requester = await storage.getProfessional(professionalId);
      if (requester?.clinicId !== clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const requesterMembership = await storage.getClinicMembers(clinicId);
      const requesterMember = requesterMembership.find(m => m.professionalId === professionalId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent inviter des membres" });
      }

      // Check if Free plan can invite professionals (only secretaries allowed)
      if (requester.planType === 'free' && role === 'Professionnel') {
        return res.status(403).json({ 
          error: "Limite du plan Gratuit atteinte",
          message: "Le plan Gratuit permet uniquement 1 professionnel. Vous pouvez inviter des secrétaires, mais pas d'autres professionnels. Passez au plan Pro pour ajouter plus de professionnels.",
          limitReached: true
        });
      }

      // Check if Free plan has reached secretary limit (max 1 secretary)
      if (role === 'Secrétaire') {
        const secretaryLimitReached = await hasReachedSecretaryLimit(clinicId, professionalId);
        if (secretaryLimitReached) {
          return res.status(403).json({ 
            error: "Limite du plan Gratuit atteinte",
            message: "Le plan Gratuit permet uniquement 1 secrétaire. Passez au plan Pro pour ajouter plus de secrétaires.",
            limitReached: true
          });
        }
      }

      // Get clinic details
      const clinic = await storage.getClinic(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: "Clinique non trouvée" });
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await storage.getPendingInvitationByEmail(clinicId, email);
      if (existingInvitation) {
        return res.status(400).json({ error: "Une invitation est déjà en attente pour cet email" });
      }

      // Check if user with this email already exists and is a member of the clinic
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingProfessional = await storage.getProfessionalByUserId(existingUser.id);
        if (existingProfessional && existingProfessional.clinicId === clinicId) {
          return res.status(400).json({ error: "Cet utilisateur est déjà membre de la clinique" });
        }
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const invitation = await storage.createInvitation({
        clinicId,
        invitedBy: professionalId,
        email,
        token,
        role: role || 'professional',
        status: 'pending',
        expiresAt,
      });

      // Send invitation email
      await sendTeamInvitation({
        inviteeEmail: email,
        inviterFirstName: requester.firstName,
        inviterLastName: requester.lastName,
        clinicName: clinic.name,
        invitationToken: token,
        expiresAt,
      });

      res.json({ invitation, token, message: "Invitation envoyée avec succès" });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "Erreur lors de la création de l'invitation" });
    }
  });

  // Get clinic invitations
  app.get("/api/clinics/:id/invitations", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify requester is member of this clinic
      const requester = await storage.getProfessional(professionalId);
      if (!requester || requester.clinicId !== clinicId) {
        return res.status(403).json({ error: "Accès refusé" });
      }

      // Get all clinic members to check if requester is admin
      const members = await storage.getClinicMembers(clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut voir les invitations" });
      }

      const invitations = await storage.getClinicInvitations(clinicId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching clinic invitations:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des invitations" });
    }
  });

  // Get clinic subscription status (returns Admin's subscription status)
  app.get("/api/clinics/:id/subscription-status", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const clinicId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify requester is member of this clinic
      const requester = await storage.getProfessional(professionalId);
      if (!requester || requester.clinicId !== clinicId) {
        return res.status(403).json({ error: "Accès refusé" });
      }

      const subscriptionStatus = await storage.getClinicSubscriptionStatus(clinicId);
      
      if (!subscriptionStatus) {
        return res.status(404).json({ error: "Statut d'abonnement non trouvé" });
      }

      res.json(subscriptionStatus);
    } catch (error) {
      console.error("Error fetching clinic subscription status:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du statut d'abonnement" });
    }
  });

  // Cancel invitation (change status to cancelled)
  app.patch("/api/invitations/:id/cancel", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const invitationId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const invitation = await storage.getInvitation(invitationId);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée" });
      }

      // Verify requester is admin
      const members = await storage.getClinicMembers(invitation.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut annuler des invitations" });
      }

      // Update status to cancelled
      await storage.updateInvitationStatus(invitationId, 'cancelled');
      res.json({ message: "Invitation annulée avec succès" });
    } catch (error) {
      console.error("Error canceling invitation:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation de l'invitation" });
    }
  });

  // Delete invitation permanently (only if cancelled)
  app.delete("/api/invitations/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const invitationId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const invitation = await storage.getInvitation(invitationId);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée" });
      }

      // Verify requester is admin
      const members = await storage.getClinicMembers(invitation.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut supprimer des invitations" });
      }

      // Only allow deletion if invitation is cancelled
      if (invitation.status !== 'cancelled') {
        return res.status(400).json({ error: "Seules les invitations annulées peuvent être supprimées" });
      }

      await storage.deleteInvitation(invitationId);
      res.json({ message: "Invitation supprimée avec succès" });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de l'invitation" });
    }
  });

  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const token = req.params.token;
      
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée" });
      }

      // Check if invitation is expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "Cette invitation a expiré" });
      }

      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        return res.status(400).json({ error: "Cette invitation a déjà été acceptée" });
      }

      // Get clinic details
      const clinic = await storage.getClinic(invitation.clinicId);
      
      // Get inviter details
      const inviter = await storage.getProfessional(invitation.invitedBy);

      res.json({
        invitation,
        clinic,
        inviter,
      });
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de l'invitation" });
    }
  });

  app.post("/api/invitations/:token/accept", async (req, res) => {
    try {
      const token = req.params.token;
      const {
        firstName,
        lastName,
        email,
        password,
        professions,
        speciality,
        phone,
        address,
        city,
        postalCode,
        province,
        description,
      } = req.body;

      // Get invitation
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée" });
      }

      // Check if invitation is expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "Cette invitation a expiré" });
      }

      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        return res.status(400).json({ error: "Cette invitation a déjà été acceptée" });
      }

      // Verify email matches invitation
      if (email.toLowerCase() !== invitation.email.toLowerCase()) {
        return res.status(400).json({ error: "L'email ne correspond pas à l'invitation" });
      }

      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Un compte existe déjà avec cet email" });
      }

      // Check if Free plan can add professionals (only secretaries allowed)
      if (invitation.role === 'Professionnel') {
        const members = await storage.getClinicMembers(invitation.clinicId);
        const adminMember = members.find(m => m.role === 'Admin');
        if (adminMember) {
          const admin = await storage.getProfessional(adminMember.professionalId);
          if (admin && admin.planType === 'free') {
            return res.status(403).json({ 
              error: "Limite du plan Gratuit atteinte",
              message: "Le plan Gratuit permet uniquement 1 professionnel. Cette clinique ne peut accepter d'autres professionnels. L'administrateur doit passer au plan Pro.",
              limitReached: true
            });
          }
        }
      }

      // Create user
      const user = await storage.createUser({
        username: email,
        email,
        password,
        firstName,
        lastName,
      });

      // Create professional profile
      const professional = await storage.createProfessional({
        userId: user.id,
        clinicId: invitation.clinicId,
        firstName,
        lastName,
        professions: (professions && professions.length > 0) ? professions : ["Professionnel de santé"],
        speciality,
        phone,
        email,
        address,
        city,
        postalCode,
        province,
        description,
        isActive: true,
      });

      // Add as clinic member
      await storage.addClinicMember({
        clinicId: invitation.clinicId,
        professionalId: professional.id,
        role: invitation.role,
      });

      // Update invitation status
      await storage.updateInvitationStatus(invitation.id, 'accepted', professional.id);

      // Get clinic admin to update subscription quantity
      const members = await storage.getClinicMembers(invitation.clinicId);
      const adminMember = members.find(m => m.role === 'Admin');
      if (adminMember) {
        await updateSubscriptionQuantity(adminMember.professionalId);
      }

      // Set session
      req.session.userId = user.id;
      req.session.professionalId = professional.id;

      res.json({ 
        message: "Invitation acceptée avec succès",
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
        professional,
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Erreur lors de l'acceptation de l'invitation" });
    }
  });

  // Send appointment reminder
  app.post("/api/appointments/:id/send-reminder", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const appointmentId = req.params.id;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get appointment details
      const appointment = await storage.getAppointment(appointmentId);

      if (!appointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé" });
      }

      if (appointment.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Get professional details
      const professional = await storage.getProfessional(professionalId);

      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Send reminder email
      await sendAppointmentReminder({
        patientFirstName: appointment.firstName,
        patientLastName: appointment.lastName,
        patientEmail: appointment.email,
        professionalFirstName: professional.firstName,
        professionalLastName: professional.lastName,
        professionalEmail: professional.email || '',
        profession: professional.profession,
        appointmentDate: new Date(appointment.appointmentDate),
        appointmentTime: appointment.startTime || '',
        notes: appointment.notes || undefined,
      });

      // Update appointment to mark reminder as sent
      await storage.updateAppointment(appointmentId, {
        reminderSent: true,
        reminderSentAt: new Date(),
      });

      res.json({ message: "Rappel envoyé avec succès" });
    } catch (error) {
      console.error("Error sending reminder:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi du rappel" });
    }
  });

  // Reschedule appointment
  app.post("/api/appointments/:id/reschedule", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const appointmentId = req.params.id;
      const { appointmentDate, startTime, endTime, professionalServiceId, notes, targetProfessionalId } = req.body;

      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get original appointment
      const originalAppointment = await storage.getAppointment(appointmentId);
      if (!originalAppointment) {
        return res.status(404).json({ error: "Rendez-vous non trouvé" });
      }

      // Check authorization (professional must have access to patient)
      const professional = await storage.getProfessional(professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const patient = originalAppointment.patientId 
        ? await storage.getPatient(originalAppointment.patientId)
        : null;

      if (patient) {
        const hasAccess = patient.professionalId === professionalId ||
          (professional.clinicId && patient.clinicId === professional.clinicId);
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Non autorisé" });
        }
      } else if (originalAppointment.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Use target professional or keep original
      const newProfessionalId = targetProfessionalId || originalAppointment.professionalId;

      // Parse date correctly to avoid timezone issues
      // appointmentDate comes as 'YYYY-MM-DD', we need to create a date at noon UTC to avoid timezone shifts
      const [year, month, day] = appointmentDate.split('-').map(Number);
      const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

      // Check for conflicts with existing confirmed appointments (excluding the current one)
      const allConflicts = await storage.checkAppointmentConflict(
        newProfessionalId,
        parsedDate,
        startTime,
        endTime
      );

      // Filter out the current appointment from conflicts
      const conflicts = allConflicts.filter(c => c.id !== appointmentId);

      if (conflicts.length > 0) {
        return res.status(409).json({ 
          error: "Ce créneau n'est pas disponible", 
          conflicts 
        });
      }

      // Mark the original appointment as rescheduled
      console.log(`[RESCHEDULE] Marking appointment ${appointmentId} as rescheduled`);
      const updatedOldAppointment = await storage.updateAppointment(appointmentId, {
        status: "rescheduled",
        rescheduledBy: "professional",
        rescheduledAt: new Date(),
      });
      console.log(`[RESCHEDULE] Updated old appointment:`, {
        id: updatedOldAppointment.id,
        status: updatedOldAppointment.status,
        rescheduledBy: updatedOldAppointment.rescheduledBy,
        rescheduledAt: updatedOldAppointment.rescheduledAt,
      });

      // Create a new appointment with the new details
      const newAppointment = await storage.createAppointment({
        userId: originalAppointment.userId,
        professionalId: newProfessionalId,
        patientId: originalAppointment.patientId,
        professionalServiceId: professionalServiceId || originalAppointment.professionalServiceId,
        rescheduledFromId: appointmentId,
        appointmentDate: parsedDate,
        startTime,
        endTime,
        firstName: originalAppointment.firstName,
        lastName: originalAppointment.lastName,
        email: originalAppointment.email,
        phone: originalAppointment.phone,
        status: "confirmed",
        notes: notes || originalAppointment.notes,
        appointmentType: originalAppointment.appointmentType,
        cancellationToken: crypto.randomBytes(32).toString('hex'),
        beneficiaryName: originalAppointment.beneficiaryName,
        beneficiaryRelation: originalAppointment.beneficiaryRelation,
        beneficiaryPhone: originalAppointment.beneficiaryPhone,
        beneficiaryEmail: originalAppointment.beneficiaryEmail,
      });

      if (!newAppointment) {
        return res.status(500).json({ error: "Erreur lors de la création du nouveau rendez-vous" });
      }

      // Get target professional info for emails
      const targetProfessional = await storage.getProfessional(newProfessionalId);
      if (!targetProfessional) {
        return res.status(404).json({ error: "Professionnel cible non trouvé" });
      }

      // Get service name if applicable
      let serviceName: string | undefined;
      if (newAppointment.professionalServiceId) {
        const service = await storage.getProfessionalService(newAppointment.professionalServiceId);
        serviceName = service?.name;
      }

      const appointmentTime = `${startTime} - ${endTime}`;

      // Send confirmation email to patient about the rescheduled appointment
      Promise.all([
        sendAppointmentConfirmationToPatient({
          patientFirstName: newAppointment.firstName,
          patientLastName: newAppointment.lastName,
          patientEmail: newAppointment.email,
          professionalFirstName: targetProfessional.firstName,
          professionalLastName: targetProfessional.lastName,
          professionalEmail: targetProfessional.email || '',
          profession: targetProfessional.profession,
          appointmentDate: parsedDate,
          appointmentTime,
          notes: newAppointment.notes || undefined,
          serviceName,
          cancellationToken: newAppointment.cancellationToken || '',
        }),
        targetProfessional.email ? sendAppointmentNotificationToProfessional({
          patientFirstName: newAppointment.firstName,
          patientLastName: newAppointment.lastName,
          patientEmail: newAppointment.email,
          professionalFirstName: targetProfessional.firstName,
          professionalLastName: targetProfessional.lastName,
          professionalEmail: targetProfessional.email,
          profession: targetProfessional.profession,
          appointmentDate: parsedDate,
          appointmentTime,
          notes: newAppointment.notes || undefined,
          serviceName,
        }) : Promise.resolve(),
      ]).catch(error => {
        console.error("Error sending reschedule emails:", error);
      });

      // Send SMS confirmation to client (non-blocking) if professional has PRO plan
      if (newAppointment.phone) {
        canSendSMS(newProfessionalId).then(hasSMSAccess => {
          if (hasSMSAccess) {
            sendAppointmentConfirmationSMS({
              patientPhone: newAppointment.phone,
              patientFirstName: newAppointment.firstName,
              professionalFirstName: targetProfessional.firstName,
              professionalLastName: targetProfessional.lastName,
              profession: targetProfessional.profession,
              appointmentDate: formatInTimeZone(parsedDate, 'America/Toronto', 'EEEE d MMMM yyyy', { locale: fr }),
              appointmentTime: startTime,
              serviceName,
            }).then(() => {
              console.log(`✅ SMS confirmation sent to ${newAppointment.phone} for rescheduled appointment`);
            }).catch(error => {
              console.error(`❌ Error sending SMS to ${newAppointment.phone}:`, error);
            });
          } else {
            console.log('⚠️ SMS not sent (professional does not have PRO plan)');
          }
        });
      }

      res.json({ 
        message: "Rendez-vous reporté avec succès",
        appointment: newAppointment 
      });
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      if (error instanceof Error && error.message === "APPOINTMENT_LIMIT_REACHED") {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Vous avez atteint la limite de 100 rendez-vous du plan Gratuit. Passez au plan Pro pour continuer.",
          limitReached: true
        });
      }
      res.status(500).json({ error: "Erreur lors du report du rendez-vous" });
    }
  });

  // Get professional services
  app.get("/api/professional/services", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const services = await storage.getProfessionalServices(professionalId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  // Get public services for a professional (for search/booking)
  // Public endpoint for booking - only visible services
  app.get("/api/professionals/:id/services/public", async (req, res) => {
    try {
      const { id } = req.params;
      const services = await storage.getProfessionalServices(id);
      const visibleServices = services.filter((s: ProfessionalService) => s.isVisible);
      res.json(visibleServices);
    } catch (error) {
      console.error("Error fetching public services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  app.get("/api/professionals/:id/services", async (req, res) => {
    try {
      const { id } = req.params;
      const services = await storage.getProfessionalServices(id);
      const visibleServices = services.filter((s: ProfessionalService) => s.isVisible);
      res.json(visibleServices);
    } catch (error) {
      console.error("Error fetching public services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  // Create professional service
  app.post("/api/professional/services", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const validated = insertProfessionalServiceSchema.parse({
        ...req.body,
        professionalId
      });

      const service = await storage.createProfessionalService(validated);
      res.json(service);
    } catch (error: any) {
      console.error("Error creating service:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création du service" });
    }
  });

  // Update professional service
  app.put("/api/professional/services/:id", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify service belongs to professional
      const service = await storage.getProfessionalService(id);
      if (!service || service.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Validate request body
      const validated = insertProfessionalServiceSchema.partial().parse(req.body);

      const updated = await storage.updateProfessionalService(id, validated);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating service:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la mise à jour du service" });
    }
  });

  // Delete professional service
  app.delete("/api/professional/services/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify service belongs to professional
      const service = await storage.getProfessionalService(id);
      if (!service || service.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      await storage.deleteProfessionalService(id);
      res.json({ message: "Service supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du service" });
    }
  });

  // Copy professional service to another professional (Admin only)
  app.post("/api/professional/services/:id/copy", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      const { targetProfessionalId } = req.body;
      
      if (!professionalId || !targetProfessionalId) {
        return res.status(400).json({ error: "Informations manquantes" });
      }

      // Get the source service
      const service = await storage.getProfessionalService(id);
      if (!service || service.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Verify both professionals are in the same clinic and requester is admin
      const professional = await storage.getProfessional(professionalId);
      const targetProfessional = await storage.getProfessional(targetProfessionalId);

      if (!professional?.clinicId || !targetProfessional?.clinicId || 
          professional.clinicId !== targetProfessional.clinicId) {
        return res.status(403).json({ error: "Les professionnels doivent être dans la même clinique" });
      }

      // Verify requester is admin
      const members = await storage.getClinicMembers(professional.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent assigner des services" });
      }

      // Create a copy of the service for the target professional
      const newService = await storage.createProfessionalService({
        professionalId: targetProfessionalId,
        name: service.name,
        duration: service.duration,
        price: service.price,
        description: service.description || null,
        category: service.category || null,
        color: service.color || null,
        isVisible: service.isVisible,
        bufferTime: service.bufferTime,
        displayOrder: service.displayOrder || 1,
      });

      res.json(newService);
    } catch (error: any) {
      console.error("Error copying service:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la copie du service" });
    }
  });

  // Unassign (delete) a service from another professional (Admin only)
  app.post("/api/professional/services/:id/unassign", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      const { targetProfessionalId } = req.body;
      
      if (!professionalId || !targetProfessionalId) {
        return res.status(400).json({ error: "Informations manquantes" });
      }

      // Get the source service
      const sourceService = await storage.getProfessionalService(id);
      if (!sourceService || sourceService.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Verify both professionals are in the same clinic and requester is admin
      const professional = await storage.getProfessional(professionalId);
      const targetProfessional = await storage.getProfessional(targetProfessionalId);

      if (!professional?.clinicId || !targetProfessional?.clinicId || 
          professional.clinicId !== targetProfessional.clinicId) {
        return res.status(403).json({ error: "Les professionnels doivent être dans la même clinique" });
      }

      // Verify requester is admin
      const members = await storage.getClinicMembers(professional.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent désassigner des services" });
      }

      // Find and delete the matching service from the target professional
      const targetServices = await storage.getProfessionalServices(targetProfessionalId);
      const serviceToDelete = targetServices.find(s => 
        s.name === sourceService.name && 
        s.duration === sourceService.duration && 
        s.price === sourceService.price
      );

      if (serviceToDelete) {
        await storage.deleteProfessionalService(serviceToDelete.id);
        res.json({ message: "Service désassigné avec succès" });
      } else {
        res.status(404).json({ error: "Service non trouvé chez ce professionnel" });
      }
    } catch (error: any) {
      console.error("Error unassigning service:", error);
      res.status(500).json({ error: "Erreur lors de la désassignation du service" });
    }
  });

  // Clinic services routes (Admin only)
  // Get all clinic services
  app.get("/api/clinics/:clinicId/services", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { clinicId } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify user is admin of this clinic
      const members = await storage.getClinicMembers(clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut gérer les services de la clinique" });
      }

      const services = await storage.getClinicServices(clinicId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching clinic services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  // Create clinic service
  app.post("/api/clinics/:clinicId/services", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { clinicId } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Verify user is admin of this clinic
      const members = await storage.getClinicMembers(clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut créer des services" });
      }

      const validated = insertClinicServiceSchema.parse({
        ...req.body,
        clinicId,
        createdBy: professionalId
      });

      const service = await storage.createClinicService(validated);
      res.json(service);
    } catch (error: any) {
      console.error("Error creating clinic service:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création du service" });
    }
  });

  // Update clinic service
  app.put("/api/clinic-services/:id", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get the service to verify ownership
      const service = await storage.getClinicService(id);
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }

      // Verify user is admin of the clinic
      const members = await storage.getClinicMembers(service.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut modifier les services" });
      }

      const validated = insertClinicServiceSchema.partial().parse(req.body);
      const updated = await storage.updateClinicService(id, validated);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating clinic service:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la mise à jour du service" });
    }
  });

  // Delete clinic service
  app.delete("/api/clinic-services/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { id } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get the service to verify ownership
      const service = await storage.getClinicService(id);
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }

      // Verify user is admin of the clinic
      const members = await storage.getClinicMembers(service.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut supprimer les services" });
      }

      // Check if service has professionals assigned
      const assignments = await storage.getClinicServiceAssignments(id);
      if (assignments.length > 0) {
        // Get professional names for better error message
        const professionalNames = await Promise.all(
          assignments.map(async (a) => {
            const prof = await storage.getProfessional(a.professionalId);
            return prof ? `${prof.firstName} ${prof.lastName}` : 'Professionnel inconnu';
          })
        );
        
        return res.status(400).json({ 
          error: "Professionnels assignés",
          message: `Ce service ne peut pas être supprimé car ${assignments.length} professionnel(s) y sont assignés. Veuillez d'abord désassigner les professionnels avant de supprimer le service.`,
          assignedProfessionals: professionalNames,
          assignmentCount: assignments.length
        });
      }

      // Check if service has appointments
      const appointmentCount = await storage.countAppointmentsForClinicService(id);
      if (appointmentCount > 0) {
        return res.status(409).json({ 
          error: "Ce service ne peut pas être supprimé",
          message: `Ce service ne peut pas être supprimé car il est utilisé par ${appointmentCount} rendez-vous. Veuillez d'abord annuler ou modifier ces rendez-vous.`,
          appointmentCount
        });
      }

      await storage.deleteClinicService(id);
      res.json({ message: "Service supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting clinic service:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du service" });
    }
  });

  // Service assignment routes (Admin assigns services to professionals)
  // Assign a service to a professional
  app.post("/api/clinic-services/:serviceId/assign", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { serviceId } = req.params;
      const { professionalId } = req.body;
      
      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get the service
      const service = await storage.getClinicService(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }

      // Verify requester is admin of the clinic
      const members = await storage.getClinicMembers(service.clinicId);
      const requesterMember = members.find(m => m.professionalId === requesterId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut assigner des services" });
      }

      // Verify target professional exists and belongs to the clinic
      const targetProfessional = await storage.getProfessional(professionalId);
      if (!targetProfessional || targetProfessional.clinicId !== service.clinicId) {
        return res.status(400).json({ error: "Le professionnel n'appartient pas à cette clinique" });
      }

      // Verify target professional is an active member and not a secretary
      const targetMember = members.find(m => m.professionalId === professionalId);
      if (!targetMember || targetMember.cancelled) {
        return res.status(400).json({ error: "Le professionnel n'est pas un membre actif de la clinique" });
      }
      
      if (targetMember.role === "Secrétaire") {
        return res.status(400).json({ error: "Impossible d'assigner des services aux secrétaires" });
      }

      const validated = insertProfessionalServiceAssignmentSchema.parse({
        clinicServiceId: serviceId,
        professionalId,
        isVisible: true,
        displayOrder: 1
      });

      const assignment = await storage.createServiceAssignment(validated);
      res.json(assignment);
    } catch (error: any) {
      console.error("Error assigning service:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      if (error.message?.includes('unique')) {
        return res.status(400).json({ error: "Ce service est déjà assigné à ce professionnel" });
      }
      res.status(500).json({ error: "Erreur lors de l'assignation du service" });
    }
  });

  // Unassign a service from a professional
  app.delete("/api/clinic-services/:serviceId/assign/:professionalId", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { serviceId, professionalId } = req.params;
      
      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get the service
      const service = await storage.getClinicService(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }

      // Verify requester is admin of the clinic
      const members = await storage.getClinicMembers(service.clinicId);
      const requesterMember = members.find(m => m.professionalId === requesterId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut retirer des services" });
      }

      // Verify target professional belongs to the clinic
      const targetProfessional = await storage.getProfessional(professionalId);
      if (!targetProfessional || targetProfessional.clinicId !== service.clinicId) {
        return res.status(400).json({ error: "Le professionnel n'appartient pas à cette clinique" });
      }

      await storage.deleteServiceAssignment(serviceId, professionalId);
      res.json({ message: "Service retiré avec succès" });
    } catch (error) {
      console.error("Error unassigning service:", error);
      res.status(500).json({ error: "Erreur lors du retrait du service" });
    }
  });

  // Get assignments for a specific clinic service
  app.get("/api/clinic-services/:serviceId/assignments", requireAuth, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { serviceId } = req.params;
      
      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get the service
      const service = await storage.getClinicService(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }

      // Verify requester is admin of the clinic
      const members = await storage.getClinicMembers(service.clinicId);
      const requesterMember = members.find(m => m.professionalId === requesterId);
      
      if (!requesterMember || requesterMember.cancelled || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seul l'admin peut voir les assignations" });
      }

      const assignments = await storage.getClinicServiceAssignments(serviceId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching service assignments:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des assignations" });
    }
  });

  // Get clinic services assigned to a professional
  app.get("/api/professional/clinic-services", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const professional = await storage.getProfessional(professionalId);
      if (!professional?.clinicId) {
        return res.json([]);
      }

      // Get all clinic services
      const clinicServices = await storage.getClinicServices(professional.clinicId);
      
      // Filter to only those assigned to this professional
      const assignedServices: any[] = [];
      for (const service of clinicServices) {
        const assignments = await storage.getClinicServiceAssignments(service.id);
        const isAssigned = assignments.some(a => 
          a.professionalId === professionalId && a.isVisible
        );
        if (isAssigned) {
          assignedServices.push(service);
        }
      }

      res.json(assignedServices);
    } catch (error) {
      console.error("Error fetching assigned clinic services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  // Secretary assignment routes
  // Create secretary assignment (Admin only)
  app.post("/api/secretary/assignments", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      
      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      const { secretaryId, professionalId } = req.body;

      // Get professional's clinic
      const requester = await storage.getProfessional(requesterId);
      if (!requester?.clinicId) {
        return res.status(403).json({ error: "Vous devez être membre d'une clinique" });
      }

      // Check if requester is admin
      const members = await storage.getClinicMembers(requester.clinicId);
      const requesterMember = members.find(m => m.professionalId === requesterId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent gérer les assignations" });
      }

      // Verify secretary is a member of the clinic with Secrétaire role
      const secretaryMember = members.find(m => m.professionalId === secretaryId);
      if (!secretaryMember || secretaryMember.role !== "Secrétaire") {
        return res.status(400).json({ error: "Le secrétaire doit être membre de la clinique" });
      }

      // Verify assigned professional is a member of the clinic
      const assignedMember = members.find(m => m.professionalId === professionalId);
      if (!assignedMember) {
        return res.status(400).json({ error: "Le professionnel doit être membre de la clinique" });
      }

      const validated = insertSecretaryAssignmentSchema.parse({
        secretaryId,
        professionalId: professionalId,
        clinicId: requester.clinicId,
      });

      const assignment = await storage.createSecretaryAssignment(validated);
      res.json(assignment);
    } catch (error: any) {
      console.error("Error creating secretary assignment:", error);
      if (error.code === '23505') {
        return res.status(409).json({ error: "Cette assignation existe déjà" });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création de l'assignation" });
    }
  });

  // Get secretary assignments (Admin only)
  app.get("/api/secretary/assignments/:secretaryId", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      const { secretaryId } = req.params;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional's clinic
      const professional = await storage.getProfessional(professionalId);
      if (!professional?.clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const members = await storage.getClinicMembers(professional.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent voir les assignations" });
      }

      const assignments = await storage.getSecretaryAssignments(secretaryId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching secretary assignments:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des assignations" });
    }
  });

  // Delete secretary assignment (Admin only)
  app.delete("/api/secretary/assignments/:secretaryId/:professionalId", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const requesterId = req.session.professionalId;
      const { secretaryId, professionalId } = req.params;
      
      if (!requesterId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get requester's clinic
      const requester = await storage.getProfessional(requesterId);
      if (!requester?.clinicId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      // Check if requester is admin
      const members = await storage.getClinicMembers(requester.clinicId);
      const requesterMember = members.find(m => m.professionalId === requesterId);
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent supprimer les assignations" });
      }

      await storage.deleteSecretaryAssignment(secretaryId, professionalId);
      res.json({ message: "Assignation supprimée avec succès" });
    } catch (error) {
      console.error("Error deleting secretary assignment:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de l'assignation" });
    }
  });

  // Get assigned professionals for current secretary
  app.get("/api/secretary/assigned-professionals", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional's clinic membership
      const professional = await storage.getProfessional(professionalId);
      if (!professional?.clinicId) {
        return res.json([]); // No clinic, no assignments
      }

      const members = await storage.getClinicMembers(professional.clinicId);
      const member = members.find(m => m.professionalId === professionalId);
      
      // Only secretaries can access this endpoint
      if (!member || member.role !== "Secrétaire") {
        return res.status(403).json({ error: "Accessible uniquement aux secrétaires" });
      }

      const assignedProfessionals = await storage.getAssignedProfessionals(professionalId);
      res.json(assignedProfessionals);
    } catch (error) {
      console.error("Error fetching assigned professionals:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des professionnels assignés" });
    }
  });

  // Helper function to verify secretary has access to professional within same clinic
  async function verifySecretaryAccess(secretaryId: string, targetProfessionalId: string): Promise<{ hasAccess: boolean; clinicId?: string }> {
    // Get secretary and professional
    const secretary = await storage.getProfessional(secretaryId);
    const targetProfessional = await storage.getProfessional(targetProfessionalId);
    
    // Both must exist and belong to same clinic
    if (!secretary || !targetProfessional || !secretary.clinicId || secretary.clinicId !== targetProfessional.clinicId) {
      return { hasAccess: false };
    }
    
    // Get clinic members to check roles
    const members = await storage.getClinicMembers(secretary.clinicId);
    const userMember = members.find(m => m.professionalId === secretaryId);
    
    // Admins have access to all professionals in their clinic
    if (userMember?.role === "Admin") {
      return { hasAccess: true, clinicId: secretary.clinicId };
    }
    
    // Secretaries must have the 'Secrétaire' role and a specific assignment
    if (!userMember || userMember.role !== "Secrétaire") {
      return { hasAccess: false };
    }
    
    // Check if assignment exists
    const assignments = await storage.getSecretaryAssignments(secretaryId);
    const hasAssignment = assignments.some(a => a.professionalId === targetProfessionalId && a.clinicId === secretary.clinicId);
    
    return { hasAccess: hasAssignment, clinicId: secretary.clinicId };
  }

  // Secretary: Get appointments for assigned professional
  app.get("/api/secretary/appointments", requireAuth, async (req, res) => {
    try {
      const secretaryId = req.session.professionalId;
      const { professionalId } = req.query;
      
      if (!secretaryId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!professionalId || typeof professionalId !== 'string') {
        return res.status(400).json({ error: "professionalId requis" });
      }

      // Verify secretary has access to this professional (includes clinic scoping and role check)
      const { hasAccess } = await verifySecretaryAccess(secretaryId, professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé à ce professionnel" });
      }

      const appointments = await storage.getProfessionalAppointments(professionalId);
      const appointmentsWithLocalTime = appointments.map(convertAppointmentToLocalTime);
      res.json(appointmentsWithLocalTime);
    } catch (error) {
      console.error("Error fetching secretary appointments:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des rendez-vous" });
    }
  });

  // Secretary: Get clients for assigned professional
  app.get("/api/secretary/clients", requireAuth, async (req, res) => {
    try {
      const secretaryId = req.session.professionalId;
      const { professionalId } = req.query;
      
      if (!secretaryId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!professionalId || typeof professionalId !== 'string') {
        return res.status(400).json({ error: "professionalId requis" });
      }

      // Verify secretary has access to this professional (includes clinic scoping and role check)
      const { hasAccess } = await verifySecretaryAccess(secretaryId, professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé à ce professionnel" });
      }

      const clients = await storage.getProfessionalPatientsWithInfo(professionalId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching secretary clients:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des clients" });
    }
  });

  // Secretary: Get schedules for assigned professional (read-only)
  app.get("/api/secretary/schedules", requireAuth, async (req, res) => {
    try {
      const secretaryId = req.session.professionalId;
      const { professionalId } = req.query;
      
      if (!secretaryId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!professionalId || typeof professionalId !== 'string') {
        return res.status(400).json({ error: "professionalId requis" });
      }

      // Verify secretary has access to this professional (includes clinic scoping and role check)
      const { hasAccess } = await verifySecretaryAccess(secretaryId, professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé à ce professionnel" });
      }

      const schedules = await storage.getProfessionalSchedules(professionalId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching secretary schedules:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des horaires" });
    }
  });

  // Secretary: Get breaks for assigned professional (read-only)
  app.get("/api/secretary/breaks", requireAuth, async (req, res) => {
    try {
      const secretaryId = req.session.professionalId;
      const { professionalId } = req.query;
      
      if (!secretaryId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!professionalId || typeof professionalId !== 'string') {
        return res.status(400).json({ error: "professionalId requis" });
      }

      // Verify secretary has access to this professional (includes clinic scoping and role check)
      const { hasAccess } = await verifySecretaryAccess(secretaryId, professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé à ce professionnel" });
      }

      const breaks = await storage.getProfessionalBreaks(professionalId);
      res.json(breaks);
    } catch (error) {
      console.error("Error fetching secretary breaks:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des pauses" });
    }
  });

  // Secretary/Admin: Get services for assigned professional (read-only)
  app.get("/api/secretary/services", requireAuth, async (req, res) => {
    try {
      const userId = req.session.professionalId;
      const { professionalId } = req.query;
      
      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      if (!professionalId || typeof professionalId !== 'string') {
        return res.status(400).json({ error: "professionalId requis" });
      }

      // Verify user (admin or secretary) has access to this professional
      const { hasAccess } = await verifySecretaryAccess(userId, professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé à ce professionnel" });
      }

      const services = await storage.getProfessionalServices(professionalId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching secretary services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  // Waitlist routes
  
  // Public: Add to waitlist
  app.post("/api/waitlist", async (req, res) => {
    try {
      const validatedData = insertWaitlistEntrySchema.parse(req.body);
      
      // Validate that preferred date is not in the past (in Toronto timezone)
      const nowInToronto = toZonedTime(new Date(), 'America/Toronto');
      const todayStrToronto = formatInTimeZone(nowInToronto, 'America/Toronto', 'yyyy-MM-dd');
      const preferredDateStr = formatInTimeZone(new Date(validatedData.preferredDate), 'America/Toronto', 'yyyy-MM-dd');
      
      if (preferredDateStr < todayStrToronto) {
        return res.status(400).json({ error: "La date préférée ne peut pas être dans le passé" });
      }
      
      // Generate unique token for this waitlist entry
      const token = crypto.randomBytes(32).toString('hex');
      
      const entry = await storage.createWaitlistEntry({
        ...validatedData,
        token,
        status: 'pending',
        notifiedAt: null,
        expiresAt: null
      } as any);
      
      // Get professional information for email
      const professional = await storage.getProfessional(entry.professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }
      
      // Get service name if serviceId is provided
      let serviceName = undefined;
      if (entry.professionalServiceId) {
        const service = await storage.getProfessionalService(entry.professionalServiceId);
        serviceName = service?.name;
      }
      
      // Format preferred time range if available
      let preferredTimeRange = undefined;
      if (entry.preferredTimeStart && entry.preferredTimeEnd) {
        preferredTimeRange = `${entry.preferredTimeStart} - ${entry.preferredTimeEnd}`;
      }
      
      // Send confirmation email to client only if email is provided
      if (entry.email) {
        await sendWaitlistConfirmation({
          firstName: entry.firstName,
          lastName: entry.lastName,
          email: entry.email,
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          profession: professional.profession,
          serviceName,
          preferredDate: new Date(entry.preferredDate),
          preferredTimeRange
        });
      }

      // Send notification email to professional
      if (professional.userId) {
        const professionalUser = await storage.getUser(professional.userId);
        if (professionalUser && professionalUser.email) {
          await sendWaitlistNotificationToProfessional({
            professionalEmail: professionalUser.email,
            professionalFirstName: professional.firstName,
            professionalLastName: professional.lastName,
            clientFirstName: entry.firstName,
            clientLastName: entry.lastName,
            clientEmail: entry.email || undefined,
            clientPhone: entry.phone,
            serviceName,
            preferredDate: new Date(entry.preferredDate),
            preferredTimeRange,
            notes: entry.notes || undefined
          });
        }
      }
      
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      console.error("Error creating waitlist entry:", error);
      res.status(500).json({ error: "Erreur lors de l'inscription à la liste d'attente" });
    }
  });

  // Professional: Get waitlist entries
  app.get("/api/professional/waitlist", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      const { status } = req.query;
      const entries = await storage.getProfessionalWaitlistEntries(
        professionalId, 
        status as string | undefined
      );
      
      res.json(entries);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la liste d'attente" });
    }
  });

  // Professional: Update waitlist entry status
  app.patch("/api/professional/waitlist/:id/status", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      const { id } = req.params;
      const { status } = req.body;
      
      // Validate status - only allow valid waitlist statuses
      const statusSchema = z.enum(['pending', 'notified', 'fulfilled', 'expired', 'cancelled']);
      const validatedStatus = statusSchema.parse(status);
      
      // Verify entry belongs to this professional
      const entry = await storage.getWaitlistEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Entrée non trouvée" });
      }
      
      if (entry.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      
      // Calculate expiration (24h from now if status is 'notified')
      let notifiedAt: Date | undefined = undefined;
      let expiresAt: Date | undefined = undefined;
      
      if (validatedStatus === 'notified') {
        notifiedAt = new Date();
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      }
      
      const updated = await storage.updateWaitlistEntryStatus(id, validatedStatus, notifiedAt, expiresAt);
      
      // TODO: Send notification email if status is 'notified'
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Statut invalide", details: error.errors });
      }
      console.error("Error updating waitlist status:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut" });
    }
  });

  // Professional: Delete waitlist entry
  app.delete("/api/professional/waitlist/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      const { id } = req.params;
      
      // Verify entry belongs to this professional
      const entry = await storage.getWaitlistEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Entrée non trouvée" });
      }
      
      if (entry.professionalId !== professionalId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      
      await storage.deleteWaitlistEntry(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting waitlist entry:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de l'entrée" });
    }
  });

  // Public: Get waitlist entry with priority token (for booking page)
  app.get("/api/waitlist/priority/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const entry = await storage.getWaitlistEntryByToken(token);
      if (!entry) {
        return res.status(404).json({ error: "Entrée non trouvée ou token invalide" });
      }
      
      // Get professional information
      const professional = await storage.getProfessional(entry.professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }
      
      // Get service information if available
      let service = null;
      if (entry.professionalServiceId) {
        service = await storage.getProfessionalService(entry.professionalServiceId);
      }
      
      // Check if should be expired (only update if currently notified)
      let currentStatus = entry.status;
      if (entry.status === 'notified' && entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        // Update status to expired
        await storage.updateWaitlistEntryStatus(entry.id, 'expired');
        currentStatus = 'expired';
      }
      
      res.json({
        ...entry,
        professional,
        service,
        status: currentStatus
      });
    } catch (error) {
      console.error("Error fetching waitlist entry:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de l'entrée" });
    }
  });

  // Public: Confirm priority booking with available slot
  app.post("/api/waitlist/priority/:token/confirm", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Get and validate waitlist entry
      const entry = await storage.getWaitlistEntryByToken(token);
      if (!entry) {
        return res.status(404).json({ error: "Entrée non trouvée ou token invalide" });
      }
      
      // Check if entry is in notified status
      if (entry.status !== 'notified') {
        return res.status(400).json({ error: "Cette entrée n'est pas disponible pour réservation prioritaire" });
      }
      
      // Check if expired
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        await storage.updateWaitlistEntryStatus(entry.id, 'expired');
        return res.status(410).json({ error: "Ce lien a expiré" });
      }

      // Validate that available slot details exist
      if (!entry.availableDate || !entry.availableStartTime || !entry.availableEndTime) {
        return res.status(400).json({ error: "Détails du créneau disponible manquants" });
      }

      // Validate that professional service exists
      if (!entry.professionalServiceId) {
        return res.status(400).json({ error: "Service non spécifié" });
      }
      
      // Get service details
      const service = await storage.getProfessionalService(entry.professionalServiceId);
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }
      
      // Get professional
      const professional = await storage.getProfessional(entry.professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }
      
      // Create appointment with available slot details (client is booking for themselves)
      const appointmentData = {
        professionalId: entry.professionalId,
        professionalServiceId: entry.professionalServiceId,
        appointmentDate: new Date(entry.availableDate),
        startTime: entry.availableStartTime,
        firstName: entry.firstName,
        lastName: entry.lastName,
        email: entry.email,
        phone: entry.phone || '',
        beneficiaryName: `${entry.firstName} ${entry.lastName}`,
        beneficiaryRelation: 'self',
        notes: entry.notes || null,
        status: 'confirmed'
      };
      
      const appointment = await storage.createAppointment(appointmentData);
      
      // Mark waitlist entry as fulfilled
      await storage.updateWaitlistEntryStatus(entry.id, 'fulfilled');
      
      // Send confirmation email only if email is provided
      if (entry.email) {
        await sendAppointmentConfirmationToPatient({
          patientFirstName: entry.firstName,
          patientLastName: entry.lastName,
          patientEmail: entry.email,
          patientPhone: entry.phone || '',
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          professionalEmail: professional.email || '',
          profession: professional.profession,
          appointmentDate: new Date(entry.availableDate),
          appointmentTime: entry.availableStartTime,
          serviceName: service.name,
          beneficiaryName: `${entry.firstName} ${entry.lastName}`,
          beneficiaryRelation: 'self',
          cancellationToken: appointment.cancellationToken || ''
        });
      }

      // Send SMS confirmation to client (non-blocking) if professional has PRO plan
      if (entry.phone) {
        canSendSMS(entry.professionalId).then(hasSMSAccess => {
          if (hasSMSAccess) {
            sendAppointmentConfirmationSMS({
              patientPhone: entry.phone,
              patientFirstName: entry.firstName,
              professionalFirstName: professional.firstName,
              professionalLastName: professional.lastName,
              profession: professional.profession,
              appointmentDate: formatInTimeZone(new Date(entry.availableDate), 'America/Toronto', 'EEEE d MMMM yyyy', { locale: fr }),
              appointmentTime: entry.availableStartTime,
              serviceName: service.name,
            }).then(() => {
              console.log(`✅ SMS confirmation sent to ${entry.phone} for waitlist priority booking`);
            }).catch(error => {
              console.error(`❌ Error sending SMS to ${entry.phone}:`, error);
            });
          } else {
            console.log('⚠️ SMS not sent (professional does not have PRO plan)');
          }
        });
      }
      
      res.json({ success: true, message: "Rendez-vous confirmé avec succès" });
    } catch (error) {
      console.error("Error confirming priority booking:", error);
      if (error instanceof Error && error.message === "APPOINTMENT_LIMIT_REACHED") {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Vous avez atteint la limite de 100 rendez-vous du plan Gratuit. Passez au plan Pro pour continuer.",
          limitReached: true
        });
      }
      res.status(500).json({ error: "Erreur lors de la confirmation de la réservation" });
    }
  });

  // Public: Release priority booking slot (pass to next person in waitlist)
  app.post("/api/waitlist/priority/:token/release", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Get and validate waitlist entry
      const entry = await storage.getWaitlistEntryByToken(token);
      if (!entry) {
        return res.status(404).json({ error: "Entrée non trouvée ou token invalide" });
      }
      
      // Check if entry is in notified status
      if (entry.status !== 'notified') {
        return res.status(400).json({ error: "Cette entrée n'est pas disponible pour libération" });
      }
      
      // Check if expired
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        await storage.updateWaitlistEntryStatus(entry.id, 'expired');
        return res.status(410).json({ error: "Ce lien a expiré" });
      }

      // Mark this entry as cancelled (user chose to release)
      await storage.updateWaitlistEntryStatus(entry.id, 'cancelled');
      
      // Create a temporary appointment object to trigger waitlist notification for next person
      // This simulates a cancelled appointment with the available slot details
      if (entry.availableDate && entry.availableStartTime && entry.availableEndTime && entry.professionalServiceId) {
        const tempAppointment = {
          professionalId: entry.professionalId,
          professionalServiceId: entry.professionalServiceId,
          appointmentDate: entry.availableDate,
          startTime: entry.availableStartTime,
          endTime: entry.availableEndTime
        };
        
        // Notify next person in waitlist
        await notifyWaitlistForCancelledAppointment(tempAppointment as any);
      }
      
      res.json({ success: true, message: "Créneau libéré avec succès" });
    } catch (error) {
      console.error("Error releasing priority slot:", error);
      res.status(500).json({ error: "Erreur lors de la libération du créneau" });
    }
  });

  // Get waitlist entries for a professional (used by professional dashboard)
  app.get("/api/waitlist/:professionalId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.professionalId;
      const { professionalId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Verify access
      const { hasAccess } = await verifySecretaryAccess(userId, professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
      
      const entries = await storage.getProfessionalWaitlistEntries(professionalId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la liste d'attente" });
    }
  });

  // Cancel waitlist entry (used by professional dashboard)
  app.delete("/api/waitlist/:id", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const userId = req.session.professionalId;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Get entry and verify access
      const entry = await storage.getWaitlistEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Entrée non trouvée" });
      }
      
      const { hasAccess } = await verifySecretaryAccess(userId, entry.professionalId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
      
      // Send cancellation email only if email is provided
      const professional = await storage.getProfessional(entry.professionalId);
      if (professional && entry.email) {
        await sendWaitlistCancelled({
          firstName: entry.firstName,
          lastName: entry.lastName,
          email: entry.email,
          professionalFirstName: professional.firstName,
          professionalLastName: professional.lastName,
          profession: professional.profession,
          preferredDate: new Date(entry.preferredDate)
        });
      }
      
      // Update status to cancelled instead of deleting
      await storage.updateWaitlistEntryStatus(id, "cancelled");
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling waitlist entry:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation" });
    }
  });

  // Cleanup expired waitlist entries (can be called by cron or manually)
  app.post("/api/waitlist/cleanup", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const userId = req.session.professionalId;
      
      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Verify user is authenticated (any professional can trigger cleanup)
      const professional = await storage.getProfessional(userId);
      if (!professional) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
      
      // Expire stale entries
      const expiredCount = await storage.expireStaleWaitlistEntries();
      
      res.json({ 
        success: true, 
        expiredCount,
        message: `${expiredCount} entrée(s) expirée(s)` 
      });
    } catch (error) {
      console.error("Error cleaning up waitlist:", error);
      res.status(500).json({ error: "Erreur lors du nettoyage" });
    }
  });

  // ============= WIDGET CONFIGURATION ROUTES =============
  
  // Professional: Get widget configuration
  app.get("/api/professional/widget", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Get professional to retrieve clinicId
      const professional = await storage.getProfessional(professionalId);
      if (!professional || !professional.clinicId) {
        return res.status(404).json({ error: "Widget non trouvé" });
      }
      
      const widget = await storage.getWidgetByClinic(professional.clinicId);
      
      if (!widget) {
        return res.status(404).json({ error: "Widget non trouvé" });
      }
      
      res.json(widget);
    } catch (error) {
      console.error("Error fetching widget:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du widget" });
    }
  });

  // Professional: Create widget configuration
  app.post("/api/professional/widget", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Get professional to retrieve clinicId and plan
      const professional = await storage.getProfessional(professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Check if professional has a clinic (required for widgets)
      if (!professional.clinicId) {
        return res.status(400).json({ error: "Vous devez d'abord créer votre clinique avant de créer un widget" });
      }
      
      // Check if widget already exists for this clinic
      const existingWidget = await storage.getWidgetByClinic(professional.clinicId);
      if (existingWidget) {
        return res.status(400).json({ 
          error: "Un widget existe déjà pour cette clinique. Supprimez-le pour en créer un nouveau." 
        });
      }
      
      // Note: Pro gets unlimited widgets through unlimited clinics (1 widget per clinic)
      
      // Validate request body - use clinicId instead of professionalId for clinic-wide widget
      const widgetData = insertWidgetConfigurationSchema.parse({
        ...req.body,
        clinicId: professional.clinicId,
        professionalId: null // Don't set professionalId for clinic-wide widgets
      });
      
      // Check slug availability
      const slugAvailable = await storage.checkSlugAvailability(widgetData.slug);
      if (!slugAvailable) {
        return res.status(409).json({ error: "Ce slug est déjà utilisé" });
      }
      
      const widget = await storage.createWidget(widgetData);
      res.json(widget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      console.error("Error creating widget:", error);
      res.status(500).json({ error: "Erreur lors de la création du widget" });
    }
  });

  // Professional: Update widget configuration
  app.patch("/api/professional/widget", requireAuth, requireWriteAccess, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Get professional to retrieve clinicId
      const professional = await storage.getProfessional(professionalId);
      if (!professional || !professional.clinicId) {
        return res.status(404).json({ error: "Widget non trouvé" });
      }
      
      const widget = await storage.getWidgetByClinic(professional.clinicId);
      if (!widget) {
        return res.status(404).json({ error: "Widget non trouvé" });
      }
      
      // If slug is being changed, check availability
      if (req.body.slug && req.body.slug !== widget.slug) {
        const slugAvailable = await storage.checkSlugAvailability(req.body.slug);
        if (!slugAvailable) {
          return res.status(409).json({ error: "Ce slug est déjà utilisé" });
        }
      }
      
      const updated = await storage.updateWidget(widget.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating widget:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du widget" });
    }
  });

  // Professional: Check slug availability
  app.get("/api/professional/widget/check-slug/:slug", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const available = await storage.checkSlugAvailability(slug);
      res.json({ available });
    } catch (error) {
      console.error("Error checking slug:", error);
      res.status(500).json({ error: "Erreur lors de la vérification du slug" });
    }
  });

  // ============= PUBLIC API ROUTES (NO AUTH) =============
  
  // Public: Get widget configuration by slug
  app.get("/api/public/widget/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const widget = await storage.getWidgetBySlug(slug);
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget non trouvé ou inactif" });
      }
      
      // Get professional or clinic info
      let professional = null;
      let clinic = null;
      
      if (widget.professionalId) {
        professional = await storage.getProfessional(widget.professionalId);
      } else if (widget.clinicId) {
        clinic = await storage.getClinic(widget.clinicId);
      }
      
      res.json({
        widget,
        professional,
        clinic
      });
    } catch (error) {
      console.error("Error fetching widget:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du widget" });
    }
  });

  // Public: Get services for a widget (CLINIC SERVICES ONLY)
  app.get("/api/public/:slug/services", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const widget = await storage.getWidgetBySlug(slug);
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget non trouvé ou inactif" });
      }
      
      let services: any[] = [];
      
      if (widget.professionalId) {
        // Single professional mode - get their clinic services via assignments
        const professional = await storage.getProfessional(widget.professionalId);
        if (professional?.clinicId) {
          const clinicServices = await storage.getClinicServices(professional.clinicId);
          
          // Filter to only services assigned to this professional
          const assignedServices: any[] = [];
          for (const service of clinicServices) {
            const assignments = await storage.getClinicServiceAssignments(service.id);
            const isAssigned = assignments.some(a => 
              a.professionalId === widget.professionalId && a.isVisible
            );
            if (isAssigned) {
              assignedServices.push(service);
            }
          }
          services = assignedServices;
        }
      } else if (widget.clinicId) {
        // Clinic mode - get all clinic services that are assigned to at least one active professional
        const allClinicServices = await storage.getClinicServices(widget.clinicId);
        
        // Filter to only include services that have at least one visible assignment to an active professional
        const servicesWithAssignments: any[] = [];
        for (const service of allClinicServices) {
          const assignments = await storage.getClinicServiceAssignments(service.id);
          
          // Check if at least one assignment is visible and the professional is active and not deleted
          const hasValidAssignment = await Promise.all(
            assignments.map(async (a) => {
              if (!a.isVisible) return false;
              const prof = await storage.getProfessional(a.professionalId);
              return prof && prof.isActive && !prof.deletedAt;
            })
          );
          
          if (hasValidAssignment.some(v => v)) {
            servicesWithAssignments.push(service);
          }
        }
        services = servicesWithAssignments;
      }
      
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des services" });
    }
  });

  // Public: Get professionals for a service (with filtering)
  app.get("/api/public/:slug/professionals", async (req, res) => {
    try {
      const { slug } = req.params;
      const { serviceId } = req.query;
      
      const widget = await storage.getWidgetBySlug(slug);
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget non trouvé ou inactif" });
      }
      
      let professionals: any[] = [];
      
      if (widget.professionalId) {
        // Single professional mode - return the professional if they offer this service
        const professional = await storage.getProfessional(widget.professionalId);
        if (professional) {
          if (serviceId) {
            // Check if professional offers this service
            const services = await storage.getProfessionalServices(widget.professionalId);
            const hasService = services.some(s => s.id === serviceId);
            if (hasService) {
              professionals = [professional];
            }
          } else {
            professionals = [professional];
          }
        }
      } else if (widget.clinicId) {
        // Clinic mode - get all professionals who offer this service (CLINIC SERVICES ONLY)
        const members = await storage.getClinicMembers(widget.clinicId);
        
        // Preload clinic service assignments if filtering by service
        let clinicServiceProfessionalIds: Set<string> = new Set();
        if (serviceId) {
          const assignments = await storage.getClinicServiceAssignments(serviceId as string);
          clinicServiceProfessionalIds = new Set(
            assignments.filter(a => a.isVisible).map(a => a.professionalId)
          );
        }
        
        for (const member of members) {
          if (member.cancelled) continue;
          
          // Skip secretaries - they don't offer services
          if (member.role === "Secrétaire") continue;
          
          // Skip members without professionalId
          if (!member.professionalId) continue;
          
          const professional = await storage.getProfessional(member.professionalId);
          if (!professional || !professional.isActive || professional.deletedAt) continue;
          
          if (serviceId) {
            // Check if professional offers this CLINIC service
            const hasClinicService = clinicServiceProfessionalIds.has(member.professionalId);
            
            if (hasClinicService) {
              professionals.push(professional);
            }
          } else {
            // No filter - return all active professionals
            professionals.push(professional);
          }
        }
      }
      
      // Filter out professionals in read-only mode (they can't accept new appointments)
      const visibleProfessionals = await filterPubliclyVisibleProfessionals(professionals);
      
      res.json(visibleProfessionals);
    } catch (error) {
      console.error("Error fetching professionals:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des professionnels" });
    }
  });

  // Public: Get availability for "anyone available" - aggregates all professionals
  app.get("/api/public/:slug/availability/anyone", async (req, res) => {
    try {
      const { slug } = req.params;
      const { serviceId } = req.query;
      
      const widget = await storage.getWidgetBySlug(slug);
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget non trouvé ou inactif" });
      }
      
      if (!serviceId) {
        return res.status(400).json({ error: "serviceId requis" });
      }
      
      // Get service details
      let service: any = await storage.getProfessionalService(serviceId as string);
      if (!service) {
        service = await storage.getClinicService(serviceId as string);
      }
      if (!service) {
        return res.status(404).json({ error: "Service non trouvé" });
      }
      
      // Get all professionals who offer this service
      const members = await storage.getClinicMembers(widget.clinicId!);
      const professionalData: Array<{
        professional: any;
        appointments: any[];
        schedules: any[];
        breaks: any[];
      }> = [];
      
      // Preload clinic service assignments
      const assignments = await storage.getClinicServiceAssignments(serviceId as string);
      const clinicServiceProfessionalIds = new Set(
        assignments.filter(a => a.isVisible).map(a => a.professionalId)
      );
      
      for (const member of members) {
        if (member.cancelled) continue;
        if (member.role === "Secrétaire") continue;
        if (!member.professionalId) continue;
        
        const professional = await storage.getProfessional(member.professionalId);
        if (!professional || !professional.isActive) continue;
        
        // Check if professional offers this service
        const hasClinicService = clinicServiceProfessionalIds.has(member.professionalId);
        const professionalServices = await storage.getProfessionalServices(member.professionalId);
        const hasProfessionalService = professionalServices.some(s => s.id === serviceId && s.isVisible !== false);
        
        if (hasClinicService || hasProfessionalService) {
          const appointments = await storage.getProfessionalAppointments(member.professionalId);
          const schedules = await storage.getProfessionalSchedules(member.professionalId);
          const breaks = await storage.getProfessionalBreaks(member.professionalId);
          
          professionalData.push({
            professional,
            appointments,
            schedules,
            breaks
          });
        }
      }
      
      // Filter out professionals in read-only mode (they can't accept new appointments)
      const professionalsList = professionalData.map(pd => pd.professional);
      const visibleProfessionals = await filterPubliclyVisibleProfessionals(professionalsList);
      const visibleProfessionalIds = new Set(visibleProfessionals.map(p => p.id));
      
      const visibleProfessionalData = professionalData.filter(pd => 
        visibleProfessionalIds.has(pd.professional.id)
      );
      
      res.json({
        service,
        professionals: visibleProfessionalData
      });
    } catch (error) {
      console.error("Error fetching anyone availability:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des disponibilités" });
    }
  });

  // Public: Get availability for a professional
  app.get("/api/public/:slug/availability", async (req, res) => {
    try {
      const { slug } = req.params;
      const { professionalId, serviceId, date } = req.query;
      
      const widget = await storage.getWidgetBySlug(slug);
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget non trouvé ou inactif" });
      }
      
      if (!professionalId) {
        return res.status(400).json({ error: "professionalId requis" });
      }
      
      // Get professional
      const professional = await storage.getProfessional(professionalId as string);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }
      
      // Get service details for duration (optional - if not provided, use professional's default)
      let service = null;
      if (serviceId) {
        service = await storage.getProfessionalService(serviceId as string);
        if (!service) {
          service = await storage.getClinicService(serviceId as string);
        }
        if (!service) {
          return res.status(404).json({ error: "Service non trouvé" });
        }
      }
      
      // Get appointments, schedules, and breaks
      const appointments = await storage.getProfessionalAppointments(professionalId as string);
      const schedules = await storage.getProfessionalSchedules(professionalId as string);
      const breaks = await storage.getProfessionalBreaks(professionalId as string);
      
      res.json({
        service,
        professional,
        appointments,
        schedules,
        breaks
      });
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des disponibilités" });
    }
  });

  // Public: Create appointment from widget
  app.post("/api/public/:slug/appointments", async (req, res) => {
    try {
      const { slug } = req.params;
      const { 
        professionalId, 
        serviceId, 
        date, 
        time, 
        firstName, 
        lastName, 
        email, 
        phone, 
        notes,
        isNewClient,
        isForSomeoneElse,
        beneficiaryName,
        beneficiaryRelation,
        beneficiaryPhone,
        beneficiaryEmail
      } = req.body;
      
      const widget = await storage.getWidgetBySlug(slug);
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget non trouvé ou inactif" });
      }
      
      // Validate required fields
      if (!professionalId || !date || !time || !firstName || !lastName || !phone) {
        return res.status(400).json({ error: "Champs requis manquants" });
      }
      
      // Get professional
      const professional = await storage.getProfessional(professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }
      
      let service: any = null;
      let professionalServiceId: string | null = null;
      let appointmentDuration = professional.appointmentDuration || 30;
      
      // If serviceId is provided, get service details
      if (serviceId) {
        // Check if serviceId is a clinic service
        const clinicService = await storage.getClinicService(serviceId);
        
        if (clinicService) {
          // It's a clinic service - need to create/find a professional service for this appointment
          service = clinicService;
          appointmentDuration = service.duration;
          
          // First check if we already created one with same properties to avoid duplicates
          const existingProfServices = await db
            .select()
            .from(professionalServices)
            .where(
              and(
                eq(professionalServices.professionalId, professionalId),
                eq(professionalServices.name, service.name),
                eq(professionalServices.duration, service.duration),
                eq(professionalServices.price, service.price)
              )
            );
          
          if (existingProfServices.length > 0) {
            professionalServiceId = existingProfServices[0].id;
          } else {
            // Create a professional service based on clinic service
            const newProfService = await storage.createProfessionalService({
              professionalId,
              name: service.name,
              duration: service.duration,
              bufferTime: service.bufferTime,
              price: service.price,
              description: service.description || null,
              category: service.category || null,
              color: service.color || '#4bb3fd',
              displayOrder: service.displayOrder || 1,
              isVisible: true,
            });
            professionalServiceId = newProfService.id;
          }
        } else {
          // Try to get as professional service
          service = await storage.getProfessionalService(serviceId);
          if (!service) {
            return res.status(404).json({ error: "Service non trouvé" });
          }
          appointmentDuration = service.duration;
          professionalServiceId = serviceId;
        }
      }
      
      // Parse date and time
      const appointmentDate = new Date(date);
      const [hours, minutes] = time.split(':').map(Number);
      const endHours = Math.floor((hours * 60 + minutes + appointmentDuration) / 60);
      const endMinutes = (hours * 60 + minutes + appointmentDuration) % 60;
      
      const startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      
      // Find or create patient with clinic context (use widget clinicId if available)
      const patient = await storage.findOrCreatePatient(
        professionalId,
        email,
        firstName,
        lastName,
        phone,
        widget.clinicId ?? professional.clinicId ?? undefined
      );
      
      // Check appointment limit for Free plan
      const limitReached = await hasReachedAppointmentLimit(professionalId);
      if (limitReached) {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Ce professionnel a atteint la limite de 100 rendez-vous du plan Gratuit.",
          limitReached: true
        });
      }
      
      // Create appointment with cancellation token
      const cancellationToken = crypto.randomBytes(32).toString('hex');
      
      const appointment = await storage.createAppointment({
        professionalId,
        patientId: patient.id,
        professionalServiceId,
        appointmentDate,
        startTime,
        endTime,
        status: 'confirmed',
        cancellationToken,
        firstName,
        lastName,
        email,
        phone,
        beneficiaryName: isForSomeoneElse ? (beneficiaryName || null) : null,
        beneficiaryRelation: isForSomeoneElse ? (beneficiaryRelation || null) : null,
        beneficiaryPhone: isForSomeoneElse ? (beneficiaryPhone || null) : null,
        beneficiaryEmail: isForSomeoneElse ? (beneficiaryEmail || null) : null,
        notes: notes || null,
      });
      
      // Send confirmation emails only if email is provided
      if (email) {
        await sendAppointmentConfirmationToPatient({
          patientEmail: email,
          patientFirstName: firstName,
          patientLastName: lastName,
          patientPhone: phone,
          professionalFirstName: professional.firstName!,
          professionalLastName: professional.lastName!,
          professionalEmail: professional.email!,
          profession: professional.profession,
          appointmentDate,
          appointmentTime: startTime,
          cancellationToken,
          beneficiaryName: isForSomeoneElse ? beneficiaryName : undefined,
          beneficiaryRelation: isForSomeoneElse ? beneficiaryRelation : undefined,
          beneficiaryPhone: isForSomeoneElse ? beneficiaryPhone : undefined,
          beneficiaryEmail: isForSomeoneElse ? beneficiaryEmail : undefined,
        });
      }
      
      await sendAppointmentNotificationToProfessional({
        patientEmail: email || undefined,
        patientFirstName: firstName,
        patientLastName: lastName,
        patientPhone: phone,
        professionalFirstName: professional.firstName!,
        professionalLastName: professional.lastName!,
        professionalEmail: professional.email!,
        profession: professional.profession,
        appointmentDate,
        appointmentTime: startTime,
        beneficiaryName: isForSomeoneElse ? beneficiaryName : undefined,
        beneficiaryRelation: isForSomeoneElse ? beneficiaryRelation : undefined,
        beneficiaryPhone: isForSomeoneElse ? beneficiaryPhone : undefined,
        beneficiaryEmail: isForSomeoneElse ? beneficiaryEmail : undefined,
      });
      
      // Send SMS confirmation to CLIENT ONLY if professional has PRO plan
      const hasSMSAccess = await canSendSMS(professionalId);
      if (hasSMSAccess) {
        await sendAppointmentConfirmationSMS({
          patientPhone: phone,
          patientFirstName: firstName,
          professionalFirstName: professional.firstName!,
          professionalLastName: professional.lastName!,
          profession: professional.profession,
          appointmentDate: formatInTimeZone(appointmentDate, 'America/Toronto', 'EEEE d MMMM yyyy', { locale: fr }),
          appointmentTime: startTime,
          serviceName: service.name,
        });
      } else {
        console.log('⚠️ SMS not sent (professional does not have PRO plan)');
      }
      
      res.json({
        success: true,
        appointment,
        message: "Rendez-vous créé avec succès"
      });
    } catch (error) {
      console.error("Error creating appointment:", error);
      if (error instanceof Error && error.message === "APPOINTMENT_LIMIT_REACHED") {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Ce professionnel a atteint la limite de 100 rendez-vous du plan Gratuit.",
          limitReached: true
        });
      }
      res.status(500).json({ error: "Erreur lors de la création du rendez-vous" });
    }
  });

  // Migration endpoint: Update existing patients with clinicId from their professional
  app.post("/api/admin/migrate-patient-clinics", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional and verify admin
      const professional = await storage.getProfessional(professionalId);
      if (!professional?.clinicId) {
        return res.status(403).json({ error: "Accès refusé - clinique requise" });
      }

      const members = await storage.getClinicMembers(professional.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Accès refusé - admin requis" });
      }

      // Find all patients without clinicId
      const allPatients = await db
        .select()
        .from(patients)
        .where(isNull(patients.clinicId));

      let updatedCount = 0;
      
      // For each patient, check if they have appointments with professionals from this clinic
      for (const patient of allPatients) {
        if (!patient.professionalId) continue;
        
        // Get the professional's clinicId
        const prof = await storage.getProfessional(patient.professionalId);
        
        // If professional is in a clinic, update patient with that clinicId
        if (prof?.clinicId === professional.clinicId) {
          await db
            .update(patients)
            .set({ clinicId: prof.clinicId })
            .where(eq(patients.id, patient.id));
          updatedCount++;
        }
      }

      res.json({
        success: true,
        updated: updatedCount,
        message: `${updatedCount} patient(s) mis à jour avec le clinicId`
      });
    } catch (error) {
      console.error("Error migrating patient clinics:", error);
      res.status(500).json({ error: "Erreur lors de la migration" });
    }
  });

  // Migrate service prices from dollars to cents (one-time migration)
  // This endpoint should only be run ONCE on existing data created before the price fix
  app.post("/api/admin/migrate-service-prices", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional and verify admin
      const professional = await storage.getProfessional(professionalId);
      if (!professional?.clinicId) {
        return res.status(403).json({ error: "Accès refusé - clinique requise" });
      }

      const members = await storage.getClinicMembers(professional.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Accès refusé - admin requis" });
      }

      // Define cutoff date: October 13, 2025, 10:00 PM (time of price fix)
      // Services created before this were likely stored in dollars, after this in cents
      const cutoffDate = new Date('2025-10-13T22:00:00-04:00'); // EDT timezone
      
      // Find all clinic services created before cutoff with prices < 1000 (likely in dollars)
      const allServices = await db
        .select()
        .from(clinicServices)
        .where(eq(clinicServices.clinicId, professional.clinicId));

      const servicesToFix = allServices.filter(service => {
        const createdAt = new Date(service.createdAt!);
        return createdAt < cutoffDate && service.price < 1000;
      });

      let updatedCount = 0;
      
      // Update each service by multiplying price by 100
      for (const service of servicesToFix) {
        await db
          .update(clinicServices)
          .set({ price: service.price * 100 })
          .where(eq(clinicServices.id, service.id));
        updatedCount++;
      }

      res.json({
        success: true,
        updated: updatedCount,
        message: `${updatedCount} service(s) de clinique mis à jour (prix convertis en centimes)`,
        cutoffDate: cutoffDate.toISOString()
      });
    } catch (error) {
      console.error("Error migrating service prices:", error);
      res.status(500).json({ error: "Erreur lors de la migration" });
    }
  });

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Chat AI Assistant Routes
  
  // Get or create conversation
  app.get("/api/chat/conversation", async (req, res) => {
    try {
      const userId = req.session.userId;
      const sessionId = req.sessionID;
      const forceNew = req.query.reset === 'true';
      
      let conversation;
      
      if (!forceNew) {
        // Try to find existing active conversation for this user/session
        conversation = await db
          .select()
          .from(chatConversations)
          .where(
            userId 
              ? eq(chatConversations.userId, userId)
              : eq(chatConversations.sessionId, sessionId)
          )
          .orderBy(chatConversations.createdAt)
          .limit(1);
      }

      if (forceNew || !conversation || conversation.length === 0) {
        // Create new conversation
        const newConversation = await db
          .insert(chatConversations)
          .values({
            userId: userId || null,
            sessionId: sessionId,
            status: "active",
            metadata: { state: 'awaiting_specialty' }
          })
          .returning();
        
        conversation = newConversation;
      }

      res.json(conversation[0]);
    } catch (error) {
      console.error("Error getting/creating conversation:", error);
      res.status(500).json({ error: "Erreur lors de la création de la conversation" });
    }
  });

  // Get messages for a conversation
  app.get("/api/chat/messages/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId))
        .orderBy(chatMessages.createdAt);

      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des messages" });
    }
  });

  // Get quick actions for conversation
  app.get("/api/chat/quick-actions/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Get conversation metadata
      const [conversation] = await db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.id, conversationId));

      if (!conversation) {
        return res.json([]);
      }

      const metadata = (conversation.metadata as any) || {};
      const quickActions = [];

      // Determine which quick actions to show based on conversation state
      if (!metadata.state || metadata.state === 'awaiting_specialty') {
        // Initial state - show specialty options
        quickActions.push(
          { label: "🦴 Ostéopathe", value: "SPECIALTY:Ostéopathe", type: 'specialty' },
          { label: "🧠 Psychologue", value: "SPECIALTY:Psychologue", type: 'specialty' },
          { label: "🦷 Chiropraticien", value: "SPECIALTY:Chiropraticien", type: 'specialty' },
          { label: "💪 Kinésithérapeute", value: "SPECIALTY:Kinésithérapeute", type: 'specialty' },
          { label: "🥗 Nutritionniste", value: "SPECIALTY:Nutritionniste", type: 'specialty' }
        );
      } else if (metadata.state === 'awaiting_professional' && metadata.specialty) {
        // Show professionals for the chosen specialty
        const professionals = await storage.searchProfessionals(metadata.specialty);
        quickActions.push(
          ...professionals.slice(0, 5).map((p: any) => ({
            label: `${p.firstName} ${p.lastName} - ${p.city}`,
            value: `PROFESSIONAL:${p.id}:${p.firstName} ${p.lastName}`,
            type: 'professional',
            data: { professionalId: p.id, name: `${p.firstName} ${p.lastName}` }
          }))
        );
      } else if (metadata.state === 'awaiting_datetime' && metadata.professionalId) {
        // Show date/time options
        quickActions.push(
          { label: "📅 Aujourd'hui", value: "DATE:today", type: 'datetime' },
          { label: "📅 Demain", value: "DATE:tomorrow", type: 'datetime' },
          { label: "📅 Cette semaine", value: "DATE:this_week", type: 'datetime' },
          { label: "📅 Les prochaines semaines", value: "DATE:next_weeks", type: 'datetime' }
        );
      } else if (metadata.state === 'awaiting_time' && metadata.professionalId) {
        // Show time slot buttons
        if (metadata.selectedDate) {
          // Single day - show time buttons for that day
          const targetDate = new Date(metadata.selectedDate);
          const slots = await storage.getAvailableTimeSlots(
            metadata.professionalId,
            targetDate,
            targetDate
          );
          quickActions.push(
            ...slots.slice(0, 15).map(s => ({
              label: s.startTime,
              value: `HEURE:${s.startTime}`,
              type: 'datetime'
            }))
          );
        } else {
          // Week view - get all slots for the week and create buttons with date+time
          const today = new Date();
          const dayOfWeek = today.getDay();
          const monday = new Date(today);
          monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          const friday = new Date(monday);
          friday.setDate(monday.getDate() + 4);
          
          const slots = await storage.getAvailableTimeSlots(
            metadata.professionalId,
            monday,
            friday
          );
          
          // Create buttons for time slots with date
          const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
          quickActions.push(
            ...slots.slice(0, 20).map(slot => {
              const slotDate = new Date(slot.slotDate);
              const dayName = dayNames[slotDate.getDay()];
              const day = slotDate.getDate();
              return {
                label: `${dayName} ${day} - ${slot.startTime}`,
                value: `HEURE:${slotDate.toISOString().split('T')[0]}:${slot.startTime}`,
                type: 'datetime'
              };
            })
          );
        }
      } else if (metadata.state === 'awaiting_phone') {
        // Show "no phone" option
        quickActions.push({
          label: "Je n'en ai pas",
          value: "Je n'en ai pas",
          type: 'text'
        });
      }

      res.json(quickActions);
    } catch (error) {
      console.error("Error getting quick actions:", error);
      res.json([]);
    }
  });

  // Send message and get response
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const { conversationId, content } = req.body;

      if (!conversationId || !content) {
        return res.status(400).json({ error: "conversationId et content requis" });
      }

      // Save user message
      const userContent = content.startsWith('SPECIALTY:') || content.startsWith('PROFESSIONAL:') || content.startsWith('DATE:')
        ? content.split(':').slice(1).join(' ')
        : content;
      
      await db.insert(chatMessages).values({
        conversationId,
        role: "user",
        content: userContent,
      });

      // Get conversation
      const [conversation] = await db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.id, conversationId));

      const metadata = (conversation.metadata as any) || {};
      let responseMessage = "";
      let newMetadata = { ...metadata };

      // Handle different command types
      if (content.startsWith('SPECIALTY:')) {
        const specialty = content.substring(10);
        newMetadata = {
          ...newMetadata,
          specialty,
          state: 'awaiting_professional'
        };
        responseMessage = `Parfait ! Voici les ${specialty}s disponibles. Choisissez un professionnel :`;
      } else if (content.startsWith('PROFESSIONAL:')) {
        const parts = content.split(':');
        const professionalId = parts[1];
        const professionalName = parts.slice(2).join(':');
        newMetadata = {
          ...newMetadata,
          professionalId,
          professionalName,
          state: 'awaiting_datetime'
        };
        responseMessage = `Excellent ! Vous avez choisi ${professionalName}. Quand souhaitez-vous votre rendez-vous ?`;
      } else if (content.startsWith('DATE:')) {
        const dateChoice = content.substring(5);
        
        if (dateChoice === 'this_week' || dateChoice === 'next_weeks') {
          // Helper function to group slots by day
          const groupSlotsByDay = (slots: any[]) => {
            const slotsByDay: { [key: string]: { date: string, dayName: string, times: string[] } } = {};
            const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
            const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
            
            for (const slot of slots) {
              const slotDate = new Date(slot.slotDate);
              const dateKey = slotDate.toISOString().split('T')[0];
              
              if (!slotsByDay[dateKey]) {
                const day = slotDate.getDate();
                const month = monthNames[slotDate.getMonth()];
                const dayName = dayNames[slotDate.getDay()];
                slotsByDay[dateKey] = {
                  date: dateKey,
                  dayName: `${dayName} ${day} ${month}`,
                  times: []
                };
              }
              slotsByDay[dateKey].times.push(slot.startTime);
            }
            return slotsByDay;
          };
          
          let monday: Date, friday: Date;
          let weekLabel = "";
          let foundSlots: any[] = [];
          
          if (dateChoice === 'this_week') {
            // For "this week", find Monday to Friday of current week
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
            monday = new Date(today);
            monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            monday.setHours(0, 0, 0, 0); // Start of day
            friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);
            friday.setHours(23, 59, 59, 999); // End of day
            weekLabel = "cette semaine";
            
            // Get all time slots for the week
            foundSlots = await storage.getAvailableTimeSlots(
              newMetadata.professionalId,
              monday,
              friday
            );
          } else {
            // For "next_weeks", search for the next available week (up to 8 weeks)
            const today = new Date();
            const dayOfWeek = today.getDay();
            const currentMonday = new Date(today);
            currentMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            
            for (let weekOffset = 1; weekOffset <= 8; weekOffset++) {
              monday = new Date(currentMonday);
              monday.setDate(currentMonday.getDate() + (weekOffset * 7));
              monday.setHours(0, 0, 0, 0); // Start of day
              friday = new Date(monday);
              friday.setDate(monday.getDate() + 4);
              friday.setHours(23, 59, 59, 999); // End of day
              
              const slots = await storage.getAvailableTimeSlots(
                newMetadata.professionalId,
                monday,
                friday
              );
              
              if (slots.length > 0) {
                foundSlots = slots;
                const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                weekLabel = `la semaine du ${monday.getDate()} ${monthNames[monday.getMonth()]}`;
                break;
              }
            }
          }
          
          if (foundSlots.length > 0) {
            const slotsByDay = groupSlotsByDay(foundSlots);
            
            // Build response message
            let message = `Voici les disponibilités ${weekLabel} :\n\n`;
            const days = Object.values(slotsByDay).slice(0, 5); // Max 5 days
            
            for (const day of days) {
              message += `**${day.dayName}** : ${day.times.slice(0, 10).join(', ')}\n`;
            }
            
            message += "\nChoisissez une heure au format HEURE:YYYY-MM-DD:HH:MM (ex: HEURE:2025-10-14:10:00)";
            responseMessage = message;
            newMetadata.state = 'awaiting_time';
          } else {
            if (dateChoice === 'this_week') {
              responseMessage = "Désolé, aucun créneau disponible cette semaine.";
            } else {
              responseMessage = "Désolé, aucun créneau disponible dans les prochaines semaines. Veuillez contacter directement le professionnel.";
            }
            newMetadata.state = 'awaiting_datetime';
          }
        } else {
          // For specific day choices (today, tomorrow)
          let targetDate = new Date();
          
          if (dateChoice === 'tomorrow') {
            targetDate.setDate(targetDate.getDate() + 1);
          }
          
          newMetadata = {
            ...newMetadata,
            selectedDate: targetDate.toISOString().split('T')[0],
            state: 'awaiting_time'
          };
          
          // Get available time slots
          const slots = await storage.getAvailableTimeSlots(
            newMetadata.professionalId,
            targetDate,
            targetDate
          );
          
          if (slots.length > 0) {
            responseMessage = `Voici les créneaux disponibles le ${targetDate.toLocaleDateString('fr-CA')} :\n\n${slots.slice(0, 10).map(s => `• ${s.startTime}`).join('\n')}\n\nChoisissez une heure ou tapez "HEURE:HH:MM" (ex: HEURE:10:00)`;
          } else {
            responseMessage = "Désolé, aucun créneau disponible ce jour-là. Essayez une autre date.";
            newMetadata.state = 'awaiting_datetime';
          }
        }
      } else if (content.startsWith('HEURE:') || content.match(/^\d{1,2}:\d{2}$/)) {
        let time: string;
        let selectedDate: string;
        
        if (content.startsWith('HEURE:')) {
          const parts = content.substring(6).split(':');
          if (parts.length === 3) {
            // Format: HEURE:2025-10-14:10:00
            selectedDate = parts[0];
            time = `${parts[1]}:${parts[2]}`;
          } else {
            // Format: HEURE:10:00
            time = content.substring(6);
            selectedDate = newMetadata.selectedDate;
          }
        } else {
          // Format: 10:00
          time = content;
          selectedDate = newMetadata.selectedDate;
        }
        
        newMetadata = {
          ...newMetadata,
          selectedDate,
          selectedTime: time,
          state: 'awaiting_name'
        };
        responseMessage = `Parfait ! Rendez-vous le ${selectedDate} à ${time} avec ${newMetadata.professionalName}.\n\nQuel est votre prénom et nom ?`;
      } else if (metadata.state === 'awaiting_name') {
        // User provides their name
        const nameParts = content.trim().split(' ');
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');
          newMetadata = {
            ...newMetadata,
            firstName,
            lastName,
            state: 'awaiting_email'
          };
          responseMessage = `Merci ${firstName} ! Quelle est votre adresse email ?`;
        } else {
          responseMessage = "Veuillez fournir votre prénom et nom (ex: Jean Dupont)";
        }
      } else if (metadata.state === 'awaiting_email') {
        // User provides their email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(content.trim())) {
          newMetadata = {
            ...newMetadata,
            email: content.trim(),
            state: 'awaiting_phone'
          };
          responseMessage = `Parfait ! Quel est votre numéro de téléphone ?`;
        } else {
          responseMessage = "Veuillez fournir une adresse email valide (ex: exemple@email.com)";
        }
      } else if (metadata.state === 'awaiting_phone') {
        // User provides their phone or says they don't have one
        const phone = content.trim().toLowerCase() === "je n'en ai pas" || content.trim().toLowerCase() === "aucun" 
          ? null 
          : content.trim();
        
        // Get available slot
        const targetDate = new Date(newMetadata.selectedDate);
        const slots = await storage.getAvailableTimeSlots(
          newMetadata.professionalId,
          targetDate,
          targetDate
        );
        const slot = slots.find(s => s.startTime === newMetadata.selectedTime);
        
        if (slot) {
          // Create appointment
          const appointment = await storage.createAppointment({
            professionalId: newMetadata.professionalId,
            timeSlotId: slot.id,
            professionalServiceId: null,
            appointmentDate: targetDate,
            startTime: newMetadata.selectedTime,
            firstName: newMetadata.firstName,
            lastName: newMetadata.lastName,
            email: newMetadata.email,
            phone: phone || undefined,
            status: "confirmed",
          });
          
          responseMessage = `✅ Rendez-vous confirmé !\n\nVous avez rendez-vous avec ${newMetadata.professionalName} le ${newMetadata.selectedDate} à ${newMetadata.selectedTime}.\n\nUn email de confirmation a été envoyé à ${newMetadata.email}.`;
          newMetadata = { state: 'completed' };
        } else {
          responseMessage = "Désolé, ce créneau n'est plus disponible. Veuillez recommencer.";
          newMetadata = {};
        }
      } else {
        // Provide context-specific error messages
        if (metadata.state === 'awaiting_specialty') {
          responseMessage = "Cette entrée n'est pas reconnue. Veuillez choisir une spécialité parmi les options proposées.";
        } else if (metadata.state === 'awaiting_professional') {
          responseMessage = "Cette entrée n'est pas reconnue. Veuillez choisir un professionnel parmi les options proposées.";
        } else if (metadata.state === 'awaiting_datetime') {
          responseMessage = "Cette entrée n'est pas reconnue. Veuillez choisir une option de date parmi les choix proposés.";
        } else if (metadata.state === 'awaiting_time') {
          responseMessage = "Cette entrée n'est pas reconnue. Veuillez choisir une heure parmi les créneaux disponibles ou écrire au format HEURE:HH:MM (ex: HEURE:10:00).";
        } else {
          responseMessage = "Cette entrée n'est pas reconnue. Veuillez choisir parmi les options proposées ou écrire au format demandé.";
        }
      }

      // Update conversation metadata
      await db
        .update(chatConversations)
        .set({ 
          metadata: newMetadata as any,
          lastActivityAt: new Date() 
        })
        .where(eq(chatConversations.id, conversationId));

      // Save assistant response
      const savedMessage = await db.insert(chatMessages).values({
        conversationId,
        role: "assistant",
        content: responseMessage,
      }).returning();

      res.json(savedMessage[0]);
    } catch (error) {
      console.error("Error processing chat message:", error);
      if (error instanceof Error && error.message === "APPOINTMENT_LIMIT_REACHED") {
        return res.status(403).json({ 
          error: "Limite de rendez-vous atteinte",
          message: "Ce professionnel a atteint la limite de 100 rendez-vous du plan Gratuit.",
          limitReached: true
        });
      }
      res.status(500).json({ error: "Erreur lors du traitement du message" });
    }
  });

  // Stripe subscription routes
  const stripeConfig = getStripeConfig();
  const stripe = new Stripe(stripeConfig.secretKey || '', {
    apiVersion: '2025-09-30.clover'
  });

  // Get current subscription status
  app.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get monthly appointment count
      const monthlyAppointmentCount = await getMonthlyAppointmentCount(professional.id);

      return res.json({
        planType: professional.planType || 'legacy',
        subscriptionStatus: professional.subscriptionStatus || 'legacy',
        trialEndsAt: professional.trialEndsAt,
        subscriptionEndsAt: professional.subscriptionEndsAt,
        cancelAtPeriodEnd: professional.cancelAtPeriodEnd || false,
        stripeSubscriptionId: professional.stripeSubscriptionId,
        stripeCustomerId: professional.stripeCustomerId,
        monthlyAppointmentCount
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return res.status(500).json({ error: "Erreur lors de la récupération de l'abonnement" });
    }
  });

  // Get payment method info from Stripe
  app.get("/api/subscription/payment-method", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      console.log("[PAYMENT METHOD] Professional:", {
        id: professional.id,
        stripeCustomerId: professional.stripeCustomerId,
        stripeSubscriptionId: professional.stripeSubscriptionId
      });

      // If no Stripe customer ID, no payment method
      if (!professional.stripeCustomerId) {
        console.log("[PAYMENT METHOD] No customer ID found");
        return res.json({ hasPaymentMethod: false });
      }

      let defaultPaymentMethodId: string | null = null;

      // First, try to get payment method from subscription if subscription ID exists
      if (professional.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(professional.stripeSubscriptionId);
          console.log("[PAYMENT METHOD] Subscription retrieved:", {
            id: subscription.id,
            default_payment_method: subscription.default_payment_method,
            status: subscription.status
          });
          if (subscription.default_payment_method && typeof subscription.default_payment_method === 'string') {
            defaultPaymentMethodId = subscription.default_payment_method;
            console.log("[PAYMENT METHOD] Found payment method from subscription:", defaultPaymentMethodId);
          }
        } catch (error) {
          console.log("[PAYMENT METHOD] Could not retrieve subscription, falling back to customer default payment method", error);
        }
      }

      // If no payment method from subscription, try to get from customer
      if (!defaultPaymentMethodId) {
        const customer = await stripe.customers.retrieve(professional.stripeCustomerId);
        
        if (customer.deleted) {
          console.log("[PAYMENT METHOD] Customer is deleted");
          return res.json({ hasPaymentMethod: false });
        }

        console.log("[PAYMENT METHOD] Customer retrieved:", {
          id: customer.id,
          default_payment_method: customer.invoice_settings?.default_payment_method
        });

        const customerDefaultPM = customer.invoice_settings?.default_payment_method;
        if (customerDefaultPM && typeof customerDefaultPM === 'string') {
          defaultPaymentMethodId = customerDefaultPM;
          console.log("[PAYMENT METHOD] Found payment method from customer:", defaultPaymentMethodId);
        }
      }
      
      if (!defaultPaymentMethodId) {
        console.log("[PAYMENT METHOD] No payment method found anywhere");
        return res.json({ hasPaymentMethod: false });
      }

      // Retrieve payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
      console.log("[PAYMENT METHOD] Payment method details:", {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? { brand: paymentMethod.card.brand, last4: paymentMethod.card.last4 } : null
      });
      
      if (paymentMethod.type === 'card' && paymentMethod.card) {
        return res.json({
          hasPaymentMethod: true,
          type: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year
        });
      }

      console.log("[PAYMENT METHOD] Payment method exists but is not a card");
      return res.json({ hasPaymentMethod: false });
    } catch (error) {
      console.error("[PAYMENT METHOD] Error fetching payment method:", error);
      return res.status(500).json({ error: "Erreur lors de la récupération du moyen de paiement" });
    }
  });

  // Select free plan - schedule cancellation at period end to preserve Pro access until paid period ends
  app.post("/api/subscription/select-free-plan", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      let subscriptionEndsAt: Date | null = null;

      // If there's an active Stripe subscription, schedule cancellation at period end
      if (professional.stripeSubscriptionId && professional.stripeCustomerId) {
        try {
          // Set cancel_at_period_end instead of canceling immediately
          console.log(`[DOWNGRADE] Setting cancel_at_period_end for subscription ${professional.stripeSubscriptionId}`);
          const updatedSubscription = await stripe.subscriptions.update(
            professional.stripeSubscriptionId,
            { cancel_at_period_end: true }
          );
          
          // Get the end date of the current period
          // Use current_period_end, or fall back to cancel_at, or current timestamp
          if (updatedSubscription.current_period_end) {
            subscriptionEndsAt = new Date(updatedSubscription.current_period_end * 1000);
          } else if (updatedSubscription.cancel_at) {
            subscriptionEndsAt = new Date(updatedSubscription.cancel_at * 1000);
          } else {
            // Fallback to current time if neither is available
            subscriptionEndsAt = new Date();
          }
          console.log(`[DOWNGRADE] Subscription will remain active until ${subscriptionEndsAt.toISOString()}`)
        } catch (error: any) {
          console.error("[DOWNGRADE] Error scheduling subscription cancellation:", error);
          return res.status(500).json({ 
            error: "Erreur lors de la planification de l'annulation de l'abonnement" 
          });
        }
      }

      // Keep planType as 'pro' and set cancelAtPeriodEnd flag
      // The cron job will change planType to 'free' when subscriptionEndsAt is reached
      await storage.updateProfessionalSubscription(professional.id, {
        cancelAtPeriodEnd: true,
        subscriptionEndsAt,
        subscriptionStatus: 'active',
      });

      console.log(`[DOWNGRADE] Professional ${professional.id} scheduled for downgrade on ${subscriptionEndsAt?.toISOString()}`);

      return res.json({ 
        success: true, 
        message: "Votre abonnement Pro restera actif jusqu'à la fin de votre période de facturation",
        subscriptionEndsAt: subscriptionEndsAt?.toISOString()
      });
    } catch (error) {
      console.error("Error scheduling downgrade:", error);
      return res.status(500).json({ error: "Erreur lors de la planification du changement de plan" });
    }
  });

  // Cancel scheduled downgrade - reactivate Pro subscription
  app.post("/api/subscription/cancel-downgrade", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Check if there's actually a downgrade scheduled
      if (!professional.cancelAtPeriodEnd) {
        return res.status(400).json({ error: "Aucun downgrade planifié" });
      }

      // If there's an active Stripe subscription, cancel the scheduled cancellation
      if (professional.stripeSubscriptionId && professional.stripeCustomerId) {
        try {
          console.log(`[CANCEL DOWNGRADE] Cancelling scheduled downgrade for subscription ${professional.stripeSubscriptionId}`);
          await stripe.subscriptions.update(
            professional.stripeSubscriptionId,
            { cancel_at_period_end: false }
          );
          console.log(`[CANCEL DOWNGRADE] Subscription will continue normally`);
        } catch (error: any) {
          console.error("[CANCEL DOWNGRADE] Error cancelling scheduled downgrade:", error);
          return res.status(500).json({ 
            error: "Erreur lors de l'annulation du downgrade" 
          });
        }
      }

      // Remove cancelAtPeriodEnd flag and subscriptionEndsAt
      await storage.updateProfessionalSubscription(professional.id, {
        cancelAtPeriodEnd: false,
        subscriptionEndsAt: null,
        subscriptionStatus: 'active',
      });

      console.log(`[CANCEL DOWNGRADE] Professional ${professional.id} downgrade cancelled, subscription reactivated`);

      return res.json({ 
        success: true, 
        message: "Votre abonnement Pro a été réactivé"
      });
    } catch (error) {
      console.error("Error cancelling downgrade:", error);
      return res.status(500).json({ error: "Erreur lors de l'annulation du downgrade" });
    }
  });

  // Upgrade to Pro with existing payment method
  app.post("/api/subscription/upgrade-to-pro", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Verify customer has a payment method
      if (!professional.stripeCustomerId) {
        return res.status(400).json({ error: "Aucun moyen de paiement enregistré" });
      }

      // Get default payment method
      const customer = await stripe.customers.retrieve(professional.stripeCustomerId);
      if (!customer || customer.deleted || !customer.invoice_settings?.default_payment_method) {
        return res.status(400).json({ error: "Aucun moyen de paiement par défaut" });
      }

      // Calculate number of seats (professional members only, excluding secretaries)
      let numberOfSeats = 1;
      if (professional.clinicId) {
        const members = await storage.getClinicMembers(professional.clinicId);
        const professionalMembers = members.filter(m => m.role !== 'Secrétaire');
        numberOfSeats = professionalMembers.length || 1;
      }

      // Get price IDs
      const basePriceId = stripeConfig.proPriceId;
      const additionalSeatPriceId = stripeConfig.additionalSeatPriceId;

      // Build subscription items
      const items: Array<{ price: string; quantity: number }> = [
        {
          price: basePriceId!,
          quantity: 1,
        },
      ];

      const additionalSeats = numberOfSeats - 1;
      if (additionalSeats > 0) {
        if (!additionalSeatPriceId) {
          return res.status(500).json({ 
            error: "Configuration Stripe manquante : STRIPE_ADDITIONAL_SEAT_PRICE_ID requis" 
          });
        }
        items.push({
          price: additionalSeatPriceId,
          quantity: additionalSeats,
        });
      }

      // Check if professional already has an active subscription
      let subscription: Stripe.Subscription;
      let existingSubscription: Stripe.Subscription | null = null;

      if (professional.stripeSubscriptionId) {
        console.log(`[UPGRADE] Professional ${professional.id} already has subscription ${professional.stripeSubscriptionId}, checking status...`);
        
        try {
          existingSubscription = await stripe.subscriptions.retrieve(professional.stripeSubscriptionId);
          console.log(`[UPGRADE] Existing subscription status: ${existingSubscription.status}`);
          
          // If subscription is active or trialing, update it instead of creating a new one
          if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
            console.log(`[UPGRADE] Updating existing subscription ${existingSubscription.id}...`);
            
            // Find subscription items
            const baseItem = existingSubscription.items.data.find(item => item.price.id === basePriceId);
            const seatItem = existingSubscription.items.data.find(item => item.price.id === additionalSeatPriceId);
            
            const updateItems: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [];
            
            // Handle base plan item
            if (baseItem) {
              updateItems.push({ id: baseItem.id, quantity: 1 });
            } else {
              // Add base item if missing (Stripe will create it)
              updateItems.push({ price: basePriceId!, quantity: 1 });
            }
            
            // Handle additional seats item
            if (additionalSeats > 0) {
              if (seatItem) {
                // Update existing seat item quantity
                updateItems.push({ id: seatItem.id, quantity: additionalSeats });
              } else if (additionalSeatPriceId) {
                // Add new seat item (Stripe will create it)
                updateItems.push({ price: additionalSeatPriceId, quantity: additionalSeats });
              }
            } else if (seatItem) {
              // Remove seat item if no longer needed
              updateItems.push({ id: seatItem.id, deleted: true });
            }
            
            // Update subscription with all items
            subscription = await stripe.subscriptions.update(existingSubscription.id, {
              items: updateItems,
              metadata: {
                professionalId: professional.id,
                planType: 'pro',
                clinicId: professional.clinicId || '',
                numberOfSeats: numberOfSeats.toString()
              },
              proration_behavior: 'always_invoice', // Important: ensure prorated charges are invoiced
              expand: ['latest_invoice.payment_intent']
            });
            
            console.log(`[UPGRADE] Successfully updated subscription ${subscription.id}`);
          } else {
            // Subscription exists but is not active (canceled, incomplete, etc.)
            console.log(`[UPGRADE] Existing subscription is ${existingSubscription.status}, canceling it and creating new one...`);
            
            try {
              await stripe.subscriptions.cancel(existingSubscription.id);
              console.log(`[UPGRADE] Canceled old subscription ${existingSubscription.id}`);
            } catch (cancelError: any) {
              console.error(`[UPGRADE] Error canceling old subscription: ${cancelError.message}`);
            }
            
            // Create new subscription
            subscription = await stripe.subscriptions.create({
              customer: professional.stripeCustomerId,
              items,
              metadata: {
                professionalId: professional.id,
                planType: 'pro',
                clinicId: professional.clinicId || '',
                numberOfSeats: numberOfSeats.toString()
              },
              expand: ['latest_invoice.payment_intent']
            });
            
            console.log(`[UPGRADE] Created new subscription ${subscription.id}`);
          }
        } catch (retrieveError: any) {
          // Subscription doesn't exist in Stripe (maybe deleted manually)
          console.log(`[UPGRADE] Could not retrieve subscription: ${retrieveError.message}, creating new one...`);
          
          subscription = await stripe.subscriptions.create({
            customer: professional.stripeCustomerId,
            items,
            metadata: {
              professionalId: professional.id,
              planType: 'pro',
              clinicId: professional.clinicId || '',
              numberOfSeats: numberOfSeats.toString()
            },
            expand: ['latest_invoice.payment_intent']
          });
          
          console.log(`[UPGRADE] Created new subscription ${subscription.id}`);
        }
      } else {
        // No existing subscription, create new one
        console.log(`[UPGRADE] No existing subscription for professional ${professional.id}, creating new one...`);
        
        subscription = await stripe.subscriptions.create({
          customer: professional.stripeCustomerId,
          items,
          metadata: {
            professionalId: professional.id,
            planType: 'pro',
            clinicId: professional.clinicId || '',
            numberOfSeats: numberOfSeats.toString()
          },
          expand: ['latest_invoice.payment_intent']
        });
        
        console.log(`[UPGRADE] Created new subscription ${subscription.id}`);
      }

      // Check if subscription requires additional action (SCA, etc.)
      if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
        console.log(`[UPGRADE] Subscription requires action for professional ${professional.id}`);
        return res.status(400).json({ 
          error: "Le paiement nécessite une action supplémentaire. Veuillez utiliser le formulaire de paiement.",
          requiresAction: true
        });
      }

      // Only update if subscription is active or trialing
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await storage.updateProfessionalSubscription(professional.id, {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          planType: 'pro',
          trialEndsAt: null
        });

        console.log(`[UPGRADE] Professional ${professional.id} upgraded to Pro with existing payment method`);

        return res.json({ success: true, subscription });
      }

      // Unexpected status
      console.error(`[UPGRADE] Unexpected subscription status: ${subscription.status}`);
      return res.status(500).json({ 
        error: "État d'abonnement inattendu. Veuillez réessayer ou contacter le support.",
        status: subscription.status
      });
    } catch (error) {
      console.error("Error upgrading to Pro:", error);
      return res.status(500).json({ error: "Erreur lors de l'upgrade vers Pro" });
    }
  });

  // Create checkout session for new subscription
  app.post("/api/subscription/create-checkout", requireAuth, async (req, res) => {
    try {
      const { planType } = req.body;
      
      if (!planType || !['pro'].includes(planType)) {
        return res.status(400).json({ error: "Plan invalide" });
      }

      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Calculate number of seats (professional members only, excluding secretaries)
      let numberOfSeats = 1;
      if (professional.clinicId) {
        const members = await storage.getClinicMembers(professional.clinicId);
        const professionalMembers = members.filter(m => m.role !== 'Secrétaire');
        numberOfSeats = professionalMembers.length || 1;
      }

      // Create or get Stripe customer
      let customerId = professional.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: professional.email || undefined,
          name: `${professional.firstName} ${professional.lastName}`,
          metadata: {
            professionalId: professional.id,
            userId: req.session.userId!,
            clinicId: professional.clinicId || ''
          }
        });
        customerId = customer.id;
        await storage.updateProfessionalSubscription(professional.id, {
          stripeCustomerId: customerId
        });
      }

      // Get price IDs for base plan and additional seats
      const basePriceId = stripeConfig.proPriceId;
      
      const additionalSeatPriceId = stripeConfig.additionalSeatPriceId;

      // Build line items: base plan + additional seats (if any)
      const lineItems: Array<{ price: string; quantity: number }> = [
        {
          price: basePriceId!,
          quantity: 1, // Base plan is always 1
        },
      ];

      // Add additional seats if there are more than 1 member
      const additionalSeats = numberOfSeats - 1;
      if (additionalSeats > 0) {
        if (!additionalSeatPriceId) {
          return res.status(500).json({ 
            error: "Configuration Stripe manquante : STRIPE_ADDITIONAL_SEAT_PRICE_ID requis" 
          });
        }
        lineItems.push({
          price: additionalSeatPriceId,
          quantity: additionalSeats,
        });
      }

      // Build base URL with proper scheme
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      // Only offer trial to users who have never had a subscription (legacy status)
      const shouldOfferTrial = professional.subscriptionStatus === 'legacy' || !professional.subscriptionStatus;

      const sessionConfig: any = {
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: lineItems,
        success_url: `${baseUrl}/dashboard?success=true`,
        cancel_url: `${baseUrl}/dashboard`,
        metadata: {
          professionalId: professional.id,
          planType,
          clinicId: professional.clinicId || '',
          numberOfSeats: numberOfSeats.toString()
        },
        customer_update: {
          name: 'auto'
        },
        custom_text: {
          submit: {
            message: 'Profitez de 21 jours d\'essai gratuit'
          }
        }
      };

      // Add trial only for new users (legacy status)
      if (shouldOfferTrial) {
        sessionConfig.subscription_data = {
          trial_period_days: 21,
          metadata: {
            professionalId: professional.id,
            planType,
            clinicId: professional.clinicId || '',
            numberOfSeats: numberOfSeats.toString()
          }
        };
      } else {
        sessionConfig.subscription_data = {
          metadata: {
            professionalId: professional.id,
            planType,
            clinicId: professional.clinicId || '',
            numberOfSeats: numberOfSeats.toString()
          }
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      return res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({ error: "Erreur lors de la création de la session de paiement" });
    }
  });

  // Helper function to update subscription quantity based on clinic members
  async function updateSubscriptionQuantity(professionalId: string) {
    try {
      const professional = await storage.getProfessional(professionalId);
      if (!professional || !professional.stripeSubscriptionId) {
        console.log('No subscription to update for professional:', professionalId);
        return;
      }

      // Get clinic members count (professional members only, excluding secretaries)
      let numberOfSeats = 1;
      if (professional.clinicId) {
        const members = await storage.getClinicMembers(professional.clinicId);
        const professionalMembers = members.filter(m => m.role !== 'Secrétaire');
        numberOfSeats = professionalMembers.length || 1;
      }

      // Get the subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(professional.stripeSubscriptionId);
      
      // Get price ID (only Pro plan has paid subscriptions)
      const basePriceId = stripeConfig.proPriceId;
      const additionalSeatPriceId = stripeConfig.additionalSeatPriceId;

      // Find subscription items by price
      const baseItem = subscription.items.data.find(item => item.price.id === basePriceId);
      const seatItem = subscription.items.data.find(item => item.price.id === additionalSeatPriceId);

      if (!baseItem) {
        console.error('No base plan item found in subscription');
        return;
      }

      const additionalSeats = numberOfSeats - 1;
      const updateItems: Array<{ id: string; quantity?: number; deleted?: boolean }> = [
        {
          id: baseItem.id,
          quantity: 1, // Base plan is always quantity 1
        }
      ];

      // Handle additional seats item
      if (additionalSeats > 0) {
        if (seatItem) {
          // Update existing seat item
          updateItems.push({
            id: seatItem.id,
            quantity: additionalSeats,
          });
        } else {
          // Add new seat item (this shouldn't happen in normal flow, but handle it)
          if (additionalSeatPriceId) {
            // Note: We can't add new items via update, need to use subscriptionItems API
            await stripe.subscriptionItems.create({
              subscription: professional.stripeSubscriptionId,
              price: additionalSeatPriceId,
              quantity: additionalSeats,
            });
          }
        }
      } else if (seatItem) {
        // Remove seat item if no additional seats needed
        updateItems.push({
          id: seatItem.id,
          deleted: true,
        });
      }

      // Update subscription
      await stripe.subscriptions.update(professional.stripeSubscriptionId, {
        items: updateItems,
        proration_behavior: 'always_invoice' // Immediate proration
      });

      console.log(`Updated subscription: ${numberOfSeats} total seats (${additionalSeats} additional) for professional ${professionalId}`);
    } catch (error) {
      console.error('Error updating subscription quantity:', error);
    }
  }

  // Downgrade to Starter by removing all clinic members except Admin
  app.post("/api/subscription/downgrade-to-starter", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional || !professional.clinicId) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      // Get all clinic members
      const members = await storage.getClinicMembers(professional.clinicId);
      
      // Find the Admin
      const admin = members.find(m => m.role === 'Admin');
      if (!admin) {
        return res.status(500).json({ error: "Aucun administrateur trouvé dans la clinique" });
      }

      // Verify current user is the Admin
      if (admin.professionalId !== professional.id) {
        return res.status(403).json({ error: "Seul l'administrateur peut rétrograder vers le plan Starter" });
      }

      // Delete all members except Admin
      const membersToDelete = members.filter(m => m.role !== 'Admin');
      
      for (const member of membersToDelete) {
        await storage.deleteClinicMemberCompletely(professional.clinicId, member.professionalId);
      }

      console.log(`Downgraded clinic ${professional.clinicId} to Starter: removed ${membersToDelete.length} members`);

      return res.json({ 
        success: true, 
        deletedCount: membersToDelete.length 
      });
    } catch (error) {
      console.error("Error downgrading to Starter:", error);
      return res.status(500).json({ error: "Erreur lors de la rétrogradation vers Starter" });
    }
  });

  // Save downgrade feedback
  app.post("/api/subscription/downgrade-feedback", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      const { reason, otherReason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: "La raison est requise" });
      }

      await storage.saveDowngradeFeedback({
        professionalId: professional.id,
        reason,
        otherReason: otherReason || null,
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error saving downgrade feedback:", error);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement du feedback" });
    }
  });

  // Create portal session for managing subscription
  app.post("/api/subscription/create-portal", requireAuth, async (req, res) => {
    try {
      const professional = await storage.getProfessionalByUserId(req.session.userId!);
      if (!professional || !professional.stripeCustomerId) {
        return res.status(404).json({ error: "Aucun abonnement trouvé" });
      }

      // Build base URL with proper scheme
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      const session = await stripe.billingPortal.sessions.create({
        customer: professional.stripeCustomerId,
        return_url: `${baseUrl}/dashboard/parametres/abonnement`,
      });

      return res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      return res.status(500).json({ error: "Erreur lors de la création de la session de gestion" });
    }
  });

  // Webhook handler function (shared by both routes)
  const handleStripeWebhook = async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).send('No signature');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`);
    console.log(`[STRIPE WEBHOOK] Full event data:`, JSON.stringify(event.data.object, null, 2));

    // Handle the event
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`[STRIPE WEBHOOK] Subscription metadata:`, subscription.metadata);
          
          const professionalId = subscription.metadata.professionalId;
          const planType = subscription.metadata.planType;

          console.log(`[STRIPE WEBHOOK] Subscription ${event.type} - Professional: ${professionalId}, Plan: ${planType}, Status: ${subscription.status}`);

          if (professionalId && planType) {
            // Get professional data BEFORE updating to check if this is a Pro upgrade
            const existingProfessional = await storage.getProfessional(professionalId);
            
            // For new subscriptions, cancel any OTHER existing subscription to prevent duplicates
            if (event.type === 'customer.subscription.created') {
              if (existingProfessional?.stripeSubscriptionId && 
                  existingProfessional.stripeSubscriptionId !== subscription.id) {
                console.log(`[STRIPE WEBHOOK] Found different existing subscription ${existingProfessional.stripeSubscriptionId}, checking its status...`);
                
                try {
                  const oldSubscription = await stripe.subscriptions.retrieve(existingProfessional.stripeSubscriptionId);
                  
                  // Only cancel if the old subscription is still active/trialing
                  if (oldSubscription.status === 'active' || oldSubscription.status === 'trialing') {
                    console.log(`[STRIPE WEBHOOK] Old subscription is ${oldSubscription.status}, canceling it...`);
                    await stripe.subscriptions.cancel(existingProfessional.stripeSubscriptionId);
                    console.log(`[STRIPE WEBHOOK] Successfully canceled old subscription ${existingProfessional.stripeSubscriptionId}`);
                  } else {
                    console.log(`[STRIPE WEBHOOK] Old subscription is ${oldSubscription.status}, no need to cancel`);
                  }
                } catch (err: any) {
                  console.error(`[STRIPE WEBHOOK] Failed to cancel old subscription: ${err.message}`);
                  // Continue anyway - old subscription might already be canceled
                }
              }
            }

            const periodEnd = (subscription as any).current_period_end;
            const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
            const newSubscriptionStatus = subscription.status === 'trialing' ? 'trial' : subscription.status;
            
            console.log(`[STRIPE WEBHOOK] cancel_at_period_end: ${cancelAtPeriodEnd}`);
            
            await storage.updateProfessionalSubscription(professionalId, {
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: newSubscriptionStatus,
              planType,
              trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
              subscriptionEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
              cancelAtPeriodEnd: cancelAtPeriodEnd
            });
            console.log(`[STRIPE WEBHOOK] Successfully updated professional subscription`);
            
            // Determine if we should send an upgrade email
            const oldPlanType = existingProfessional?.planType;
            const oldStatus = existingProfessional?.subscriptionStatus;
            
            // Case 1: Free → Pro upgrade (plan changes from free to pro)
            const isFreeToProUpgrade = oldPlanType === 'free' && planType === 'pro';
            
            // Case 2: Trial → Active Pro (trial ends, user keeps Pro)
            const isTrialToActivePro = oldStatus === 'trial' && newSubscriptionStatus === 'active' && planType === 'pro';
            
            // Case 3: No subscription → Pro (first time Pro subscriber)
            const isNewProSubscription = !existingProfessional && planType === 'pro' && newSubscriptionStatus === 'active';
            
            const shouldSendProEmail = isFreeToProUpgrade || isTrialToActivePro || isNewProSubscription;
            
            if (shouldSendProEmail) {
              console.log(`[STRIPE WEBHOOK] Sending Pro upgrade email to professional ${professionalId} (Reason: ${
                isFreeToProUpgrade ? 'Free→Pro upgrade' : 
                isTrialToActivePro ? 'Trial→Active Pro' : 
                'New Pro subscription'
              })`);
              try {
                // Get updated professional record after storage update
                const updatedProfessional = await storage.getProfessional(professionalId);
                if (updatedProfessional) {
                  const user = await storage.getUser(updatedProfessional.userId);
                  if (user) {
                    await sendProUpgradeEmail({
                      firstName: user.firstName,
                      lastName: user.lastName,
                      email: user.email,
                    });
                    console.log(`[STRIPE WEBHOOK] Pro upgrade email sent successfully`);
                  }
                }
              } catch (emailError: any) {
                console.error(`[STRIPE WEBHOOK] Failed to send upgrade email: ${emailError.message}`);
              }
            } else {
              console.log(`[STRIPE WEBHOOK] No email needed (oldPlan: ${oldPlanType}, newPlan: ${planType}, oldStatus: ${oldStatus}, newStatus: ${newSubscriptionStatus})`);
            }
          } else {
            console.log(`[STRIPE WEBHOOK] Missing metadata - professionalId: ${professionalId}, planType: ${planType}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const professionalId = subscription.metadata.professionalId;

          console.log(`[STRIPE WEBHOOK] Subscription deleted - Professional: ${professionalId}`);

          if (professionalId) {
            await storage.updateProfessionalSubscription(professionalId, {
              subscriptionStatus: 'cancelled',
              subscriptionEndsAt: new Date(),
              cancelAtPeriodEnd: false as boolean
            });
            console.log(`[STRIPE WEBHOOK] Successfully updated professional to cancelled status`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          const subscriptionId = typeof invoice.subscription === 'string' 
            ? invoice.subscription 
            : invoice.subscription?.id;
          
          console.log(`[STRIPE WEBHOOK] Payment failed - Subscription: ${subscriptionId}`);

          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const professionalId = sub.metadata.professionalId;
            
            if (professionalId) {
              await storage.updateProfessionalSubscription(professionalId, {
                subscriptionStatus: 'past_due'
              });
              console.log(`[STRIPE WEBHOOK] Successfully updated professional to past_due status`);
            }
          }
          break;
        }

        default:
          console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("[STRIPE WEBHOOK] Error handling webhook:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  };

  // Webhook endpoint for Stripe events (primary)
  app.post("/api/webhooks/stripe", handleStripeWebhook);
  
  // Webhook endpoint alias (for backward compatibility if Stripe is configured with old URL)
  app.post("/api/stripe/webhook", handleStripeWebhook);

  // Test webhook endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/admin/test-webhook", requireAuth, async (req, res) => {
      try {
        const professional = await storage.getProfessionalByUserId(req.session.userId!);
        if (!professional) {
          return res.status(404).json({ error: "Professionnel non trouvé" });
        }

        // Simulate a subscription.created event
        const fakeEvent: any = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_test_' + Date.now(),
              customer: professional.stripeCustomerId || 'cus_test',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
              trial_end: null,
              metadata: {
                professionalId: professional.id,
                planType: req.body.planType || 'free',
                clinicId: professional.clinicId || '',
                numberOfSeats: '1'
              }
            }
          }
        };

        console.log('[TEST WEBHOOK] Simulating webhook with event:', JSON.stringify(fakeEvent, null, 2));

        // Call webhook handler logic
        const subscription = fakeEvent.data.object;
        const professionalId = subscription.metadata.professionalId;
        const planType = subscription.metadata.planType;

        console.log(`[TEST WEBHOOK] Professional: ${professionalId}, Plan: ${planType}, Status: ${subscription.status}`);

        if (professionalId && planType) {
          const periodEnd = subscription.current_period_end;
          await storage.updateProfessionalSubscription(professionalId, {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status === 'trialing' ? 'trial' : subscription.status,
            planType,
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            subscriptionEndsAt: periodEnd ? new Date(periodEnd * 1000) : null
          });
          console.log('[TEST WEBHOOK] Successfully updated professional subscription');
        } else {
          console.log(`[TEST WEBHOOK] Missing metadata - professionalId: ${professionalId}, planType: ${planType}`);
        }

        return res.json({ success: true, message: 'Webhook simulé avec succès' });
      } catch (error) {
        console.error('[TEST WEBHOOK] Error:', error);
        return res.status(500).json({ error: 'Erreur lors de la simulation du webhook' });
      }
    });
  }

  // Audit logs endpoint (Admin or self-view)
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional and check if they're admin
      const professional = await storage.getProfessional(professionalId);
      let isAdmin = false;
      
      if (professional?.clinicId) {
        const members = await storage.getClinicMembers(professional.clinicId);
        const currentMember = members.find(m => m.professionalId === professionalId);
        isAdmin = currentMember?.role === "Admin";
      }

      // Admins can view all clinic logs, others can only view their own
      const filters: any = {
        limit: parseInt(req.query.limit as string) || 100,
      };

      if (!isAdmin) {
        // Non-admins can only view their own logs
        filters.professionalId = professionalId;
      }

      if (req.query.action) {
        filters.action = req.query.action as string;
      }

      if (req.query.resourceType) {
        filters.resourceType = req.query.resourceType as string;
      }

      const logs = await storage.getAuditLogs(filters);
      
      // Log this audit log access
      await logAudit({
        userId: req.session.userId,
        professionalId,
        action: 'view_audit_logs',
        details: { filters },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des logs d'audit" });
    }
  });

  // Manual trigger for trial reminder cron (for testing/debugging - Admin only)
  app.post("/api/admin/run-trial-reminders", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional and verify they have a clinic (admin requirement)
      const professional = await storage.getProfessional(professionalId);
      if (!professional?.clinicId) {
        return res.status(403).json({ error: "Accès refusé - clinique requise" });
      }

      // Check if requester is admin of their clinic
      const members = await storage.getClinicMembers(professional.clinicId);
      const requesterMember = members.find(m => m.professionalId === professionalId);
      
      if (!requesterMember || requesterMember.role !== "Admin") {
        return res.status(403).json({ error: "Accès refusé - admin requis" });
      }

      // Run the trial reminders manually
      await runTrialRemindersManually();
      
      res.json({ 
        success: true, 
        message: "Trial reminders processed successfully" 
      });
    } catch (error) {
      console.error("Error running trial reminders manually:", error);
      res.status(500).json({ error: "Erreur lors de l'exécution des rappels d'essai" });
    }
  });

  // Clean up duplicate Stripe subscriptions (Admin only)
  app.post("/api/admin/cleanup-duplicate-subscriptions", requireAuth, async (req, res) => {
    try {
      const professionalId = req.session.professionalId;
      
      if (!professionalId) {
        return res.status(401).json({ error: "Non autorisé" });
      }

      // Get professional
      const professional = await storage.getProfessional(professionalId);
      if (!professional) {
        return res.status(404).json({ error: "Professionnel non trouvé" });
      }

      if (!professional.stripeCustomerId) {
        return res.status(400).json({ error: "Aucun compte Stripe trouvé" });
      }

      console.log(`[CLEANUP] Starting duplicate subscription cleanup for professional ${professionalId}`);
      console.log(`[CLEANUP] Stripe Customer: ${professional.stripeCustomerId}`);
      console.log(`[CLEANUP] Current Subscription: ${professional.stripeSubscriptionId}`);

      // Get all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: professional.stripeCustomerId,
        status: 'all'
      });

      console.log(`[CLEANUP] Found ${subscriptions.data.length} total subscriptions`);

      const canceledSubscriptions: string[] = [];
      const errors: Array<{id: string, error: string}> = [];

      // Cancel all subscriptions except the current one
      for (const sub of subscriptions.data) {
        // Skip the current subscription
        if (sub.id === professional.stripeSubscriptionId) {
          console.log(`[CLEANUP] Keeping current subscription: ${sub.id}`);
          continue;
        }

        // Skip already canceled or incomplete subscriptions
        if (sub.status === 'canceled' || sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
          console.log(`[CLEANUP] Skipping already ${sub.status} subscription: ${sub.id}`);
          continue;
        }

        // Cancel this subscription
        try {
          console.log(`[CLEANUP] Canceling duplicate subscription: ${sub.id} (status: ${sub.status})`);
          await stripe.subscriptions.cancel(sub.id);
          canceledSubscriptions.push(sub.id);
          console.log(`[CLEANUP] Successfully canceled: ${sub.id}`);
        } catch (err: any) {
          console.error(`[CLEANUP] Failed to cancel ${sub.id}:`, err.message);
          errors.push({ id: sub.id, error: err.message });
        }
      }

      res.json({ 
        success: true,
        message: `Nettoyage terminé : ${canceledSubscriptions.length} abonnements annulés`,
        canceled: canceledSubscriptions,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error cleaning up duplicate subscriptions:", error);
      res.status(500).json({ error: "Erreur lors du nettoyage des abonnements" });
    }
  });

  // Log frontend errors endpoint
  app.post("/api/log-error", async (req, res) => {
    try {
      const errorSchema = z.object({
        errorMessage: z.string(),
        errorStack: z.string().optional(),
        path: z.string().optional(),
        userAgent: z.string().optional(),
      });

      const data = errorSchema.parse(req.body);
      
      // Extract user info if available from session
      const userId = req.session?.userId ? parseInt(req.session.userId) : undefined;
      
      // Import and send error notification
      const { sendErrorNotification } = await import('./email');
      await sendErrorNotification({
        errorType: 'frontend',
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
        path: data.path,
        userId,
        userAgent: data.userAgent,
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error logging frontend error:", error);
      // Don't fail if we can't log the error
      res.status(200).json({ success: false });
    }
  });

  // Contact form endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const contactSchema = z.object({
        firstName: z.string().min(1, "Prénom requis"),
        lastName: z.string().min(1, "Nom requis"),
        email: z.string().email("Email invalide"),
        phone: z.string().optional(),
        message: z.string().min(10, "Le message doit contenir au moins 10 caractères"),
      });

      const data = contactSchema.parse(req.body);

      // Send email to operations team
      await sendContactMessage(data);

      // Send confirmation email to client
      await sendContactConfirmation(data);

      res.json({ success: true, message: "Message envoyé avec succès" });
    } catch (error) {
      console.error("Error handling contact form:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de l'envoi du message" });
    }
  });

  // Test endpoint to trigger error notification (development only)
  if (process.env.NODE_ENV === 'development') {
    app.get("/api/test-error", (_req, _res) => {
      throw new Error("Test error for operations team notification");
    });
  }

  // Health check endpoint for Docker
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
