import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  time,
  integer,
  boolean,
  unique,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  requirePasswordChange: boolean("require_password_change")
    .notNull()
    .default(false),
  isLamdaaAccount: boolean("is_lamdaa_account")
    .notNull()
    .default(false),
  emailVerified: boolean("email_verified")
    .notNull()
    .default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiresAt: timestamp("verification_token_expires_at"),
  verificationMethod: text("verification_method"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clinics = pgTable("clinics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  email: text("email"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const professionals = pgTable("professionals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  clinicId: varchar("clinic_id").references(() => clinics.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  professions: text("professions").array().notNull(),
  speciality: text("speciality"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  province: text("province"),
  phone: text("phone").notNull().unique(),
  email: text("email").notNull().unique(),
  profilePicture: text("profile_picture"),
  description: text("description"),
  yearsOfExperience: integer("years_of_experience"),
  patientsServed: integer("patients_served"),
  specializations: text("specializations").array(),
  appointmentDuration: integer("appointment_duration").notNull().default(30),
  bufferTime: integer("buffer_time").notNull().default(5),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),

  // Paramètres généraux
  timezone: text("timezone").default("America/Toronto"),
  language: text("language").default("fr"),
  dateFormat: text("date_format").default("dd/MM/yyyy"),
  timeFormat: text("time_format").default("24h"),

  // Paramètres de réservation
  workingHours: json("working_hours").$type<{
    monday?: { start: string; end: string; enabled: boolean };
    tuesday?: { start: string; end: string; enabled: boolean };
    wednesday?: { start: string; end: string; enabled: boolean };
    thursday?: { start: string; end: string; enabled: boolean };
    friday?: { start: string; end: string; enabled: boolean };
    saturday?: { start: string; end: string; enabled: boolean };
    sunday?: { start: string; end: string; enabled: boolean };
  }>(),
  cancellationDelay: integer("cancellation_delay").default(24), // heures

  // Paramètres de notification
  emailNotifications: boolean("email_notifications").default(true),
  newAppointmentNotification: boolean("new_appointment_notification").default(
    true,
  ),
  appointmentReminderNotification: boolean(
    "appointment_reminder_notification",
  ).default(true),
  reminderTiming: integer("reminder_timing").default(24), // heures avant le RDV
  cancellationNotification: boolean("cancellation_notification").default(true),

  // Paramètres d'affichage
  autoConfirmAppointments: boolean("auto_confirm_appointments").default(false),
  showCancelledAppointments: boolean("show_cancelled_appointments").default(
    true,
  ),
  compactView: boolean("compact_view").default(false),

  // Paramètres de liste d'attente
  waitlistEnabled: boolean("waitlist_enabled").default(true),
  waitlistPriorityHours: integer("waitlist_priority_hours").default(24),

  // Paramètres de visibilité publique
  publiclyVisible: boolean("publicly_visible").default(true), // Apparaît dans les recherches publiques Gobering

  // Stripe subscription fields
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("legacy"), // legacy, trial, active, cancelled, past_due
  planType: text("plan_type").default("legacy"), // legacy, free, pro
  intendedPlan: text("intended_plan"), // Plan choisi lors de l'inscription (free ou pro) - utilisé après l'essai
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false), // true si l'abonnement est annulé mais reste actif jusqu'à la fin de la période
  totalAppointmentsCreated: integer("total_appointments_created")
    .notNull()
    .default(0), // Compteur total de RV créés (pour limite plan Free)

  // Onboarding
  hasCompletedOnboarding: boolean("has_completed_onboarding")
    .notNull()
    .default(false), // true si le tour guidé a été complété

  // Soft delete
  deletedAt: timestamp("deleted_at"), // null si actif, timestamp si supprimé
});

export const clinicMembers = pgTable(
  "clinic_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clinicId: varchar("clinic_id")
      .references(() => clinics.id)
      .notNull(),
    professionalId: varchar("professional_id")
      .references(() => professionals.id)
      .notNull(),
    role: text("role").notNull().default("professional"),
    cancelled: boolean("cancelled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueMember: unique().on(table.clinicId, table.professionalId),
  }),
);

export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clinicId: varchar("clinic_id")
    .references(() => clinics.id)
    .notNull(),
  invitedBy: varchar("invited_by")
    .references(() => professionals.id)
    .notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  role: text("role").notNull().default("professional"),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  professionalId: varchar("professional_id").references(() => professionals.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const secretaryAssignments = pgTable(
  "secretary_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    secretaryId: varchar("secretary_id")
      .references(() => professionals.id)
      .notNull(),
    professionalId: varchar("professional_id")
      .references(() => professionals.id)
      .notNull(),
    clinicId: varchar("clinic_id")
      .references(() => clinics.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueAssignment: unique().on(table.secretaryId, table.professionalId),
  }),
);

export const patients = pgTable("patients", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id").references(() => professionals.id),
  clinicId: varchar("clinic_id").references(() => clinics.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  professionalId: varchar("professional_id").references(() => professionals.id),
  patientId: varchar("patient_id").references(() => patients.id),
  timeSlotId: varchar("time_slot_id").references(() => timeSlots.id),
  professionalServiceId: varchar("professional_service_id").references(
    () => professionalServices.id,
  ),
  professionalServiceAssignmentId: varchar(
    "professional_service_assignment_id",
  ).references(() => professionalServiceAssignments.id),
  rescheduledFromId: varchar("rescheduled_from_id"),
  appointmentDate: timestamp("appointment_date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  beneficiaryName: text("beneficiary_name"),
  beneficiaryRelation: text("beneficiary_relation"),
  beneficiaryPhone: text("beneficiary_phone"),
  beneficiaryEmail: text("beneficiary_email"),
  appointmentType: text("appointment_type"),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  cancelledBy: text("cancelled_by"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationToken: text("cancellation_token").unique(),
  rescheduledBy: text("rescheduled_by"),
  rescheduledAt: timestamp("rescheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Professional schedule (weekly recurring schedule)
export const professionalSchedules = pgTable("professional_schedules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id").references(() => professionals.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Professional breaks (daily recurring breaks)
export const professionalBreaks = pgTable("professional_breaks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id").references(() => professionals.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  type: varchar("type").notNull().default("break"), // "break" | "unavailability"
  createdAt: timestamp("created_at").defaultNow(),
});

// Available time slots (generated from schedules and filtered by existing appointments)
export const timeSlots = pgTable("time_slots", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id").references(() => professionals.id),
  slotDate: timestamp("slot_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isBooked: boolean("is_booked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Professional services (services offered by professional with pricing)
// DEPRECATED: Use clinicServices and professionalServiceAssignments instead
export const professionalServices = pgTable("professional_services", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id")
    .references(() => professionals.id)
    .notNull(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  duration: integer("duration").notNull(), // in minutes
  bufferTime: integer("buffer_time").notNull().default(5), // buffer time in minutes after each appointment
  price: integer("price").notNull(), // in cents (60$ = 6000)
  description: text("description"),
  category: text("category"),
  color: text("color").default("#4bb3fd"), // color for calendar display
  displayOrder: integer("display_order").default(1),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Clinic services (master services created by admin at clinic level)
export const clinicServices = pgTable("clinic_services", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clinicId: varchar("clinic_id")
    .references(() => clinics.id)
    .notNull(),
  createdBy: varchar("created_by")
    .references(() => professionals.id)
    .notNull(), // Admin who created the service
  name: text("name").notNull(),
  emoji: text("emoji"),
  duration: integer("duration").notNull(), // in minutes
  bufferTime: integer("buffer_time").notNull().default(5), // buffer time in minutes after each appointment
  price: integer("price").notNull(), // in cents (60$ = 6000)
  description: text("description"),
  category: text("category"),
  color: text("color").default("#4bb3fd"), // color for calendar display
  displayOrder: integer("display_order").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Professional service assignments (assigns clinic services to professionals)
export const professionalServiceAssignments = pgTable(
  "professional_service_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clinicServiceId: varchar("clinic_service_id")
      .references(() => clinicServices.id)
      .notNull(),
    professionalId: varchar("professional_id")
      .references(() => professionals.id)
      .notNull(),
    isVisible: boolean("is_visible").notNull().default(true), // Professional can hide assigned services
    displayOrder: integer("display_order").default(1), // Professional can customize order
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueAssignment: unique().on(table.clinicServiceId, table.professionalId),
  }),
);

// Session table for connect-pg-simple (do not modify - managed by connect-pg-simple)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey().notNull(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Waitlist entries for when clients want to join a waiting list for unavailable time slots
export const waitlistEntries = pgTable("waitlist_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id")
    .references(() => professionals.id)
    .notNull(),
  professionalServiceId: varchar("professional_service_id").references(
    () => professionalServices.id,
  ),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  preferredDate: timestamp("preferred_date").notNull(), // Date souhaitée
  preferredTimeStart: time("preferred_time_start"), // Début de plage horaire souhaitée (optionnel)
  preferredTimeEnd: time("preferred_time_end"), // Fin de plage horaire souhaitée (optionnel)
  token: text("token").notNull().unique(), // Token unique pour lien de réservation prioritaire
  status: text("status").notNull().default("pending"), // pending, notified, fulfilled, expired, cancelled
  notifiedAt: timestamp("notified_at"), // Quand le client a été notifié
  expiresAt: timestamp("expires_at"), // Quand l'opportunité expire (24h après notification)
  availableDate: timestamp("available_date"), // Date du créneau disponible (quand notifié)
  availableStartTime: time("available_start_time"), // Heure de début du créneau disponible
  availableEndTime: time("available_end_time"), // Heure de fin du créneau disponible
  notes: text("notes"), // Notes additionnelles du client
  createdAt: timestamp("created_at").defaultNow(),
});

// Widget configurations for external site integration
export const widgetConfigurations = pgTable("widget_configurations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id").references(() => professionals.id),
  clinicId: varchar("clinic_id").references(() => clinics.id),
  slug: text("slug").notNull().unique(), // URL slug for the public booking page (gobering.com/rdv/[slug])
  displayName: text("display_name"), // Custom display name for the public booking page (overrides clinic/professional name)
  bannerImage: text("banner_image"), // Banner image URL
  logoImage: text("logo_image"), // Logo image URL
  buttonLabel: text("button_label").default("Prendre un rendez-vous"), // Customizable button label
  buttonColor: text("button_color").default("#4bb3fd"), // Button color (hex)
  allowAnyProfessional: boolean("allow_any_professional")
    .notNull()
    .default(true), // Allow "n'importe qui disponible" option
  isActive: boolean("is_active").notNull().default(true), // Widget enabled/disabled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat conversations for AI assistant
export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Optional for authenticated clients
  sessionId: text("session_id"), // For tracking anonymous users
  firstName: text("first_name"), // For anonymous users
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  status: text("status").notNull().default("active"), // active, completed, abandoned
  metadata: json("metadata"), // Conversation state and context
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat messages within conversations
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .references(() => chatConversations.id)
    .notNull(),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  metadata: json("metadata"), // For storing extracted entities, function calls, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicSchema = createInsertSchema(clinics).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertProfessionalSchema = createInsertSchema(professionals).omit({
  id: true,
  createdAt: true,
});

export const insertClinicMemberSchema = createInsertSchema(clinicMembers).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

export const insertProfessionalScheduleSchema = createInsertSchema(
  professionalSchedules,
).omit({
  id: true,
  createdAt: true,
});

export const insertProfessionalBreakSchema = createInsertSchema(
  professionalBreaks,
).omit({
  id: true,
  createdAt: true,
});

export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({
  id: true,
  createdAt: true,
});

export const insertTeamInvitationSchema = createInsertSchema(
  teamInvitations,
).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(
  passwordResetTokens,
).omit({
  id: true,
  createdAt: true,
});

export const insertProfessionalServiceSchema = createInsertSchema(
  professionalServices,
).omit({
  id: true,
  createdAt: true,
});

export const insertSecretaryAssignmentSchema = createInsertSchema(
  secretaryAssignments,
).omit({
  id: true,
  createdAt: true,
});

export const insertClinicServiceSchema = createInsertSchema(
  clinicServices,
).omit({
  id: true,
  createdAt: true,
});

export const insertProfessionalServiceAssignmentSchema = createInsertSchema(
  professionalServiceAssignments,
).omit({
  id: true,
  createdAt: true,
});

export const insertWaitlistEntrySchema = createInsertSchema(waitlistEntries)
  .omit({
    id: true,
    createdAt: true,
    token: true,
    status: true,
    notifiedAt: true,
    expiresAt: true,
  })
  .extend({
    preferredDate: z.coerce.date(),
  });

export const insertWidgetConfigurationSchema = createInsertSchema(
  widgetConfigurations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinics.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProfessional = z.infer<typeof insertProfessionalSchema>;
export type Professional = typeof professionals.$inferSelect;
export type InsertClinicMember = z.infer<typeof insertClinicMemberSchema>;
export type ClinicMember = typeof clinicMembers.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertProfessionalSchedule = z.infer<
  typeof insertProfessionalScheduleSchema
>;
export type ProfessionalSchedule = typeof professionalSchedules.$inferSelect;
export type InsertProfessionalBreak = z.infer<
  typeof insertProfessionalBreakSchema
>;
export type ProfessionalBreak = typeof professionalBreaks.$inferSelect;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertPasswordResetToken = z.infer<
  typeof insertPasswordResetTokenSchema
>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertProfessionalService = z.infer<
  typeof insertProfessionalServiceSchema
>;
export type ProfessionalService = typeof professionalServices.$inferSelect;
export type InsertSecretaryAssignment = z.infer<
  typeof insertSecretaryAssignmentSchema
>;
export type SecretaryAssignment = typeof secretaryAssignments.$inferSelect;
export type InsertClinicService = z.infer<typeof insertClinicServiceSchema>;
export type ClinicService = typeof clinicServices.$inferSelect;
export type InsertProfessionalServiceAssignment = z.infer<
  typeof insertProfessionalServiceAssignmentSchema
>;
export type ProfessionalServiceAssignment =
  typeof professionalServiceAssignments.$inferSelect;
export type InsertWaitlistEntry = z.infer<typeof insertWaitlistEntrySchema>;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type InsertWidgetConfiguration = z.infer<
  typeof insertWidgetConfigurationSchema
>;
export type WidgetConfiguration = typeof widgetConfigurations.$inferSelect;

export const insertChatConversationSchema = createInsertSchema(
  chatConversations,
).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatConversation = z.infer<
  typeof insertChatConversationSchema
>;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Subscription plan types
export type SubscriptionPlan = "legacy" | "free" | "pro";
export type SubscriptionStatus =
  | "legacy"
  | "trial"
  | "active"
  | "cancelled"
  | "past_due";

export const PLAN_LIMITS = {
  legacy: {
    name: "Legacy",
    price: 0,
    appointments: -1, // unlimited
    services: -1, // unlimited
    widgets: -1, // unlimited
    professionals: -1, // unlimited
    features: ["all"],
    description: "Gratuit à vie pour les utilisateurs historiques",
  },
  free: {
    name: "Gratuit",
    price: 0,
    appointments: 10, // 10 rendez-vous maximum (temporaire pour test)
    services: -1, // unlimited
    widgets: 1, // 1 widget simple
    professionals: 1, // 1 professionnel uniquement
    secretaries: 1, // 1 secrétaire autorisé
    features: [
      "basic_calendar",
      "email_notifications",
      "patient_management",
      "widget",
      "gobering_visibility",
    ],
    description: "Profil professionnel individuel avec fonctionnalités de base",
  },
  pro: {
    name: "Pro",
    price: 39,
    pricePerProfessional: 15, // +15$ par professionnel supplémentaire
    appointments: -1, // unlimited
    services: -1, // unlimited
    widgets: -1, // unlimited
    professionals: -1, // unlimited (via clinic management)
    secretaries: -1, // unlimited
    features: ["all"],
    description: "Accès complet avec fonctionnalités avancées",
  },
} as const;

// Audit logs table for security and compliance
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  professionalId: varchar("professional_id").references(() => professionals.id),
  action: text("action").notNull(), // e.g., "login", "view_patient", "update_appointment"
  resourceType: text("resource_type"), // e.g., "patient", "appointment", "professional"
  resourceId: varchar("resource_id"), // ID of the affected resource
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: json("details").$type<Record<string, any>>(), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const downgradeFeedback = pgTable("downgrade_feedback", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id")
    .references(() => professionals.id)
    .notNull(),
  reason: text("reason").notNull(),
  otherReason: text("other_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DowngradeFeedback = typeof downgradeFeedback.$inferSelect;
export const insertDowngradeFeedbackSchema = createInsertSchema(
  downgradeFeedback,
).omit({
  id: true,
  createdAt: true,
});
export type InsertDowngradeFeedback = z.infer<
  typeof insertDowngradeFeedbackSchema
>;

// Liste des professions de santé au Québec
export const HEALTH_PROFESSIONS = [
  "Acupuncteur",
  "Audiologiste",
  "Audioprothésiste",
  "Chiropraticien",
  "Criminologue",
  "Dentiste",
  "Denturologiste",
  "Diététiste",
  "Ergothérapeute",
  "Hygiéniste dentaire",
  "Infirmier",
  "Infirmier auxiliaire",
  "Infirmier praticien spécialisé",
  "Inhalothérapeute",
  "Kinésiologue",
  "Massothérapeute",
  "Médecin",
  "Naturopathe",
  "Opticien d'ordonnances",
  "Optométriste",
  "Orthésiste-Prothésiste",
  "Orthophoniste",
  "Ostéopathe",
  "Pharmacien",
  "Physiothérapeute",
  "Podiatre",
  "Psychoéducateur",
  "Psychologue",
  "Sage-femme",
  "Sexologue",
  "Technicien ambulancier paramédical",
  "Technologiste médical",
  "Technologue en imagerie médicale",
  "Technologue en radiologie",
  "Thérapeute en réadaptation physique",
  "Thérapeute du sport",
  "Travailleur social",
] as const;
