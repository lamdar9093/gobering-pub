import { db } from "../server/db";
import { 
  users, 
  professionals, 
  appointments, 
  patients, 
  professionalSchedules,
  professionalBreaks,
  timeSlots,
  professionalServices,
  professionalServiceAssignments,
  waitlistEntries,
  clinicMembers,
  teamInvitations,
  secretaryAssignments,
  passwordResetTokens,
  chatConversations,
  chatMessages,
  auditLogs,
  widgetConfigurations,
  downgradeFeedback,
  clinicServices
} from "../shared/schema";
import { eq, or, and } from "drizzle-orm";
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

interface DeletionStats {
  email: string;
  userId: string | null;
  professionalId: string | null;
  counts: {
    auditLogs: number;
    waitlistEntries: number;
    appointments: number;
    professionalServiceAssignments: number;
    professionalServices: number;
    timeSlots: number;
    professionalBreaks: number;
    professionalSchedules: number;
    secretaryAssignments: number;
    clinicMembers: number;
    patients: number;
    teamInvitations: number;
    widgetConfigurations: number;
    downgradeFeedback: number;
    clinicServices: number;
    passwordResetTokens: number;
    chatMessages: number;
    chatConversations: number;
    professionals: number;
    users: number;
  };
}

async function findUserAndProfessional(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  });

  const professional = await db.query.professionals.findFirst({
    where: eq(professionals.email, email)
  });

  return { user, professional };
}

async function countDependencies(userId: string | null, professionalId: string | null): Promise<DeletionStats['counts']> {
  const counts: DeletionStats['counts'] = {
    auditLogs: 0,
    waitlistEntries: 0,
    appointments: 0,
    professionalServiceAssignments: 0,
    professionalServices: 0,
    timeSlots: 0,
    professionalBreaks: 0,
    professionalSchedules: 0,
    secretaryAssignments: 0,
    clinicMembers: 0,
    patients: 0,
    teamInvitations: 0,
    widgetConfigurations: 0,
    downgradeFeedback: 0,
    clinicServices: 0,
    passwordResetTokens: 0,
    chatMessages: 0,
    chatConversations: 0,
    professionals: 0,
    users: 0
  };

  if (professionalId) {
    // Count all tables referencing professional
    const [
      auditLogsCount,
      waitlistCount,
      appointmentsCount,
      serviceAssignmentsCount,
      servicesCount,
      timeSlotsCount,
      breaksCount,
      schedulesCount,
      secretaryCount,
      membersCount,
      patientsCount,
      invitationsCount,
      widgetsCount,
      feedbackCount,
      clinicServicesCount
    ] = await Promise.all([
      db.select().from(auditLogs).where(eq(auditLogs.professionalId, professionalId)),
      db.select().from(waitlistEntries).where(eq(waitlistEntries.professionalId, professionalId)),
      db.select().from(appointments).where(eq(appointments.professionalId, professionalId)),
      db.select().from(professionalServiceAssignments).where(eq(professionalServiceAssignments.professionalId, professionalId)),
      db.select().from(professionalServices).where(eq(professionalServices.professionalId, professionalId)),
      db.select().from(timeSlots).where(eq(timeSlots.professionalId, professionalId)),
      db.select().from(professionalBreaks).where(eq(professionalBreaks.professionalId, professionalId)),
      db.select().from(professionalSchedules).where(eq(professionalSchedules.professionalId, professionalId)),
      db.select().from(secretaryAssignments).where(
        or(
          eq(secretaryAssignments.secretaryId, professionalId),
          eq(secretaryAssignments.professionalId, professionalId)
        )
      ),
      db.select().from(clinicMembers).where(eq(clinicMembers.professionalId, professionalId)),
      db.select().from(patients).where(eq(patients.professionalId, professionalId)),
      db.select().from(teamInvitations).where(
        or(
          eq(teamInvitations.invitedBy, professionalId),
          eq(teamInvitations.professionalId, professionalId)
        )
      ),
      db.select().from(widgetConfigurations).where(eq(widgetConfigurations.professionalId, professionalId)),
      db.select().from(downgradeFeedback).where(eq(downgradeFeedback.professionalId, professionalId)),
      db.select().from(clinicServices).where(eq(clinicServices.createdBy, professionalId))
    ]);

    counts.auditLogs = auditLogsCount.length;
    counts.waitlistEntries = waitlistCount.length;
    counts.appointments = appointmentsCount.length;
    counts.professionalServiceAssignments = serviceAssignmentsCount.length;
    counts.professionalServices = servicesCount.length;
    counts.timeSlots = timeSlotsCount.length;
    counts.professionalBreaks = breaksCount.length;
    counts.professionalSchedules = schedulesCount.length;
    counts.secretaryAssignments = secretaryCount.length;
    counts.clinicMembers = membersCount.length;
    counts.patients = patientsCount.length;
    counts.teamInvitations = invitationsCount.length;
    counts.widgetConfigurations = widgetsCount.length;
    counts.downgradeFeedback = feedbackCount.length;
    counts.clinicServices = clinicServicesCount.length;
    counts.professionals = 1;
  }

  if (userId) {
    const [
      userAuditLogsCount,
      userAppointmentsCount,
      resetTokensCount,
      conversationsCount
    ] = await Promise.all([
      db.select().from(auditLogs).where(eq(auditLogs.userId, userId)),
      db.select().from(appointments).where(eq(appointments.userId, userId)),
      db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)),
      db.select().from(chatConversations).where(eq(chatConversations.userId, userId))
    ]);

    counts.auditLogs += userAuditLogsCount.length;
    counts.appointments = Math.max(counts.appointments, userAppointmentsCount.length);
    counts.passwordResetTokens = resetTokensCount.length;
    counts.chatConversations = conversationsCount.length;

    // Count chat messages for each conversation
    let totalMessages = 0;
    for (const conv of conversationsCount) {
      const messages = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, conv.id));
      totalMessages += messages.length;
    }
    counts.chatMessages = totalMessages;
    counts.users = 1;
  }

  return counts;
}

async function deleteProfessionalAndUser(email: string, dryRun: boolean = false): Promise<DeletionStats> {
  const { user, professional } = await findUserAndProfessional(email);

  const stats: DeletionStats = {
    email,
    userId: user?.id || null,
    professionalId: professional?.id || null,
    counts: await countDependencies(user?.id || null, professional?.id || null)
  };

  if (dryRun) {
    return stats;
  }

  // Execute deletion in transaction
  await db.transaction(async (tx) => {
    const professionalId = professional?.id;
    const userId = user?.id;

    // FIRST: Delete all audit logs for both user and professional
    if (userId || professionalId) {
      const conditions = [];
      if (userId) conditions.push(eq(auditLogs.userId, userId));
      if (professionalId) conditions.push(eq(auditLogs.professionalId, professionalId));
      
      if (conditions.length > 0) {
        await tx.delete(auditLogs).where(or(...conditions));
      }
    }

    if (professionalId) {
      // Delete in correct order to avoid FK violations

      // 2. Waitlist entries
      await tx.delete(waitlistEntries).where(eq(waitlistEntries.professionalId, professionalId));

      // 3. Appointments
      await tx.delete(appointments).where(
        or(
          eq(appointments.professionalId, professionalId),
          userId ? eq(appointments.userId, userId) : undefined
        )
      );

      // 4. Professional service assignments
      await tx.delete(professionalServiceAssignments).where(
        eq(professionalServiceAssignments.professionalId, professionalId)
      );

      // 5. Professional services
      await tx.delete(professionalServices).where(
        eq(professionalServices.professionalId, professionalId)
      );

      // 6. Time slots
      await tx.delete(timeSlots).where(eq(timeSlots.professionalId, professionalId));

      // 7. Professional breaks
      await tx.delete(professionalBreaks).where(eq(professionalBreaks.professionalId, professionalId));

      // 8. Professional schedules
      await tx.delete(professionalSchedules).where(eq(professionalSchedules.professionalId, professionalId));

      // 9. Secretary assignments
      await tx.delete(secretaryAssignments).where(
        or(
          eq(secretaryAssignments.secretaryId, professionalId),
          eq(secretaryAssignments.professionalId, professionalId)
        )
      );

      // 10. Clinic members
      await tx.delete(clinicMembers).where(eq(clinicMembers.professionalId, professionalId));

      // 11. Patients
      await tx.delete(patients).where(eq(patients.professionalId, professionalId));

      // 12. Team invitations
      await tx.delete(teamInvitations).where(
        or(
          eq(teamInvitations.invitedBy, professionalId),
          eq(teamInvitations.professionalId, professionalId)
        )
      );

      // 13. Widget configurations
      await tx.delete(widgetConfigurations).where(eq(widgetConfigurations.professionalId, professionalId));

      // 14. Downgrade feedback
      await tx.delete(downgradeFeedback).where(eq(downgradeFeedback.professionalId, professionalId));

      // 15. Clinic services (delete them since they belong to this professional)
      await tx.delete(clinicServices).where(eq(clinicServices.createdBy, professionalId));

      // 16. Delete professional
      await tx.delete(professionals).where(eq(professionals.id, professionalId));
    }

    if (userId) {
      // 17. Password reset tokens
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

      // 18. Chat messages (via conversations)
      const conversations = await tx.select().from(chatConversations).where(eq(chatConversations.userId, userId));
      for (const conv of conversations) {
        await tx.delete(chatMessages).where(eq(chatMessages.conversationId, conv.id));
      }

      // 19. Chat conversations
      await tx.delete(chatConversations).where(eq(chatConversations.userId, userId));

      // 20. Delete user
      await tx.delete(users).where(eq(users.id, userId));
    }
  });

  return stats;
}

async function main() {
  const emailsToDelete = [
    "test.simplified.H8z2_u@example.com",
    "jamonoji@yahoo.com",
    "leuz20028@yahoo.com",
    "test.verification.8WKKFFGi@example.com",
    "transaction.test.htAaCzwG@example.com",
    "bugfix.test.UnrAekad@example.com"
  ];

  const confirmFlag = process.argv.includes('--confirm');

  console.log("=== ANALYSE DES COMPTES À SUPPRIMER ===\n");

  const allStats: DeletionStats[] = [];

  // Dry run - show what will be deleted
  for (const email of emailsToDelete) {
    console.log(`\n📧 Analyse de: ${email}`);
    const stats = await deleteProfessionalAndUser(email, true);
    
    if (!stats.userId && !stats.professionalId) {
      console.log("  ❌ Compte non trouvé dans la base de données");
      continue;
    }

    allStats.push(stats);

    console.log(`  User ID: ${stats.userId || 'N/A'}`);
    console.log(`  Professional ID: ${stats.professionalId || 'N/A'}`);
    console.log(`\n  Données à supprimer:`);
    
    Object.entries(stats.counts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`    - ${table}: ${count}`);
      }
    });
  }

  // Calculate totals
  const totals = allStats.reduce((acc, stat) => {
    Object.entries(stat.counts).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + value;
    });
    return acc;
  }, {} as Record<string, number>);

  console.log("\n\n=== RÉSUMÉ TOTAL ===");
  console.log(`Comptes trouvés: ${allStats.length}/${emailsToDelete.length}`);
  console.log(`\nDonnées totales à supprimer:`);
  Object.entries(totals).forEach(([table, count]) => {
    if (count > 0) {
      console.log(`  - ${table}: ${count}`);
    }
  });

  if (!confirmFlag) {
    console.log("\n⚠️  Pour confirmer la suppression, relancez avec: npx tsx scripts/delete-professionals.ts --confirm");
    rl.close();
    process.exit(0);
  }

  console.log("\n⚠️  SUPPRESSION CONFIRMÉE - IRRÉVERSIBLE!");
  console.log("🔄 Suppression en cours...\n");

  // Execute actual deletion
  for (const email of emailsToDelete) {
    const { user, professional } = await findUserAndProfessional(email);
    
    if (!user && !professional) {
      console.log(`⏭️  ${email} - Déjà supprimé ou inexistant`);
      continue;
    }

    try {
      await deleteProfessionalAndUser(email, false);
      console.log(`✅ ${email} - Supprimé avec succès`);
    } catch (error) {
      console.error(`❌ ${email} - Erreur:`, error);
    }
  }

  console.log("\n✅ Suppression terminée!");
  rl.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("Erreur fatale:", error);
  rl.close();
  process.exit(1);
});
