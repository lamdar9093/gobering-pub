import { db } from "./db";
import {
  users,
  professionals,
  appointments,
  patients,
  professionalSchedules,
  professionalBreaks,
  timeSlots,
  professionalServices,
  teamInvitations,
  clinicMembers,
  secretaryAssignments,
  passwordResetTokens,
  waitlistEntries,
  professionalServiceAssignments,
  clinicServices,
  chatConversations,
  chatMessages,
  auditLogs,
  widgetConfigurations,
  downgradeFeedback,
  clinics,
} from "@shared/schema";
import { eq, or, inArray } from "drizzle-orm";

async function deleteUser(emailOrUsername: string) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 Recherche de l'utilisateur: ${emailOrUsername}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Trouver l'utilisateur par email ou username
  const userResults = await db
    .select()
    .from(users)
    .where(or(eq(users.email, emailOrUsername), eq(users.username, emailOrUsername)));

  if (!userResults || userResults.length === 0) {
    console.log(`❌ Aucun utilisateur trouvé: ${emailOrUsername}`);
    return;
  }

  const user = userResults[0];
  console.log(`✅ Utilisateur trouvé: ${user.id} - ${user.email}`);

  // Trouver le profil professionnel
  const professionalResults = await db
    .select()
    .from(professionals)
    .where(eq(professionals.userId, user.id));

  if (!professionalResults || professionalResults.length === 0) {
    console.log(`⚠️  Aucun profil professionnel trouvé`);

    // Supprimer les données utilisateur même sans profil professionnel
    await db.delete(chatConversations).where(eq(chatConversations.userId, user.id));
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    console.log(`✅ Utilisateur supprimé (sans profil professionnel)`);
    return;
  }

  const professional = professionalResults[0];
  console.log(`✅ Profil professionnel trouvé: ${professional.id}`);

  // SUPPRESSION DANS L'ORDRE CORRECT (des références vers les tables principales)

  // 1. Supprimer les messages de chat (dépend de conversations)
  const userConversations = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(eq(chatConversations.userId, user.id));

  if (userConversations.length > 0) {
    const conversationIds = userConversations.map(c => c.id);
    for (const convId of conversationIds) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, convId));
    }
    console.log(`✅ Messages de chat supprimés`);
  }

  // 2. Supprimer les conversations de chat
  await db.delete(chatConversations).where(eq(chatConversations.userId, user.id));
  console.log(`✅ Conversations de chat supprimées`);

  // 3. Supprimer les logs d'audit (professionalId et userId)
  await db.delete(auditLogs).where(eq(auditLogs.professionalId, professional.id));
  await db.delete(auditLogs).where(eq(auditLogs.userId, user.id));
  console.log(`✅ Logs d'audit supprimés`);

  // 4. Supprimer les widgets
  await db.delete(widgetConfigurations).where(eq(widgetConfigurations.professionalId, professional.id));
  console.log(`✅ Widgets supprimés`);

  // 5. Supprimer le feedback de downgrade
  await db.delete(downgradeFeedback).where(eq(downgradeFeedback.professionalId, professional.id));
  console.log(`✅ Feedback de downgrade supprimé`);

  // 6. Supprimer les rendez-vous
  await db.delete(appointments).where(eq(appointments.professionalId, professional.id));
  console.log(`✅ Rendez-vous supprimés`);

  // 7. Supprimer les créneaux horaires
  await db.delete(timeSlots).where(eq(timeSlots.professionalId, professional.id));
  console.log(`✅ Créneaux horaires supprimés`);

  // 8. Supprimer les entrées de liste d'attente
  await db.delete(waitlistEntries).where(eq(waitlistEntries.professionalId, professional.id));
  console.log(`✅ Entrées de liste d'attente supprimées`);

  // 9. Supprimer les patients
  await db.delete(patients).where(eq(patients.professionalId, professional.id));
  console.log(`✅ Patients supprimés`);

  // 10. Supprimer les assignations de services professionnels
  await db.delete(professionalServiceAssignments).where(eq(professionalServiceAssignments.professionalId, professional.id));
  console.log(`✅ Assignations de services supprimées`);

  // 11. Supprimer les services professionnels
  await db.delete(professionalServices).where(eq(professionalServices.professionalId, professional.id));
  console.log(`✅ Services professionnels supprimés`);

  // 12. Supprimer les services de clinique créés par ce professionnel
  if (professional.clinicId) {
    const createdServices = await db
      .select()
      .from(clinicServices)
      .where(eq(clinicServices.createdBy, professional.id));

    for (const service of createdServices) {
      await db
        .delete(professionalServiceAssignments)
        .where(eq(professionalServiceAssignments.clinicServiceId, service.id));
    }

    await db.delete(clinicServices).where(eq(clinicServices.createdBy, professional.id));
    console.log(`✅ Services de clinique supprimés`);
  }

  // 13. Supprimer les pauses
  await db.delete(professionalBreaks).where(eq(professionalBreaks.professionalId, professional.id));
  console.log(`✅ Pauses supprimées`);

  // 14. Supprimer les horaires
  await db.delete(professionalSchedules).where(eq(professionalSchedules.professionalId, professional.id));
  console.log(`✅ Horaires supprimés`);

  // 15. Supprimer les assignations de secrétaire (en tant que secrétaire)
  await db.delete(secretaryAssignments).where(eq(secretaryAssignments.secretaryId, professional.id));
  console.log(`✅ Assignations de secrétaire supprimées (en tant que secrétaire)`);

  // 16. Supprimer les assignations de secrétaire (en tant que professionnel assigné)
  await db.delete(secretaryAssignments).where(eq(secretaryAssignments.professionalId, professional.id));
  console.log(`✅ Assignations de secrétaire supprimées (en tant que professionnel assigné)`);

  // 17. Supprimer les invitations d'équipe (en tant qu'inviteur)
  await db.delete(teamInvitations).where(eq(teamInvitations.invitedBy, professional.id));
  console.log(`✅ Invitations d'équipe supprimées (en tant qu'inviteur)`);

  // 18. Supprimer les invitations d'équipe (en tant qu'invité)
  await db.delete(teamInvitations).where(eq(teamInvitations.professionalId, professional.id));
  console.log(`✅ Invitations d'équipe supprimées (en tant qu'invité)`);

  // 19. Supprimer les membres de clinique
  await db.delete(clinicMembers).where(eq(clinicMembers.professionalId, professional.id));
  console.log(`✅ Appartenances à une clinique supprimées`);

  // 20. Si c'est une clinique, supprimer la clinique si elle n'a plus de membres
  if (professional.clinicId) {
    const remainingMembers = await db
      .select()
      .from(clinicMembers)
      .where(eq(clinicMembers.clinicId, professional.clinicId));

    if (remainingMembers.length === 0) {
      await db.delete(clinics).where(eq(clinics.id, professional.clinicId));
      console.log(`✅ Clinique supprimée (plus de membres)`);
    }
  }

  // 21. Supprimer les tokens de réinitialisation de mot de passe
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  console.log(`✅ Tokens de réinitialisation supprimés`);

  // 22. SUPPRIMER LE PROFESSIONNEL
  await db.delete(professionals).where(eq(professionals.id, professional.id));
  console.log(`✅ Professionnel supprimé: ${professional.id}`);

  // 23. SUPPRIMER L'UTILISATEUR
  await db.delete(users).where(eq(users.id, user.id));
  console.log(`✅ Utilisateur supprimé: ${user.id} - ${user.email}`);

  console.log(`\n✅ Suppression terminée avec succès pour ${emailOrUsername}`);
}

async function deleteAllTestUsers() {
  const emailsToDelete = [
    "test.simplified.Xwdkck@example.com",
    "test.simplified.H8z2_u@example.com",
    "jamonoji@yahoo.com",
    "test.verification.8WKKFFGi@example.com",
    "testduplicateFz1-gb@example.com",
    "testduplicateZYfLib@example.com",
    "bugfix.test.UnrAekad@example.com",
    "jamonoji970"
  ];

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  DÉBUT DE LA SUPPRESSION DES UTILISATEURS DE TEST             ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  let successCount = 0;

  for (const email of emailsToDelete) {
    try {
      await deleteUser(email);
      successCount++;
    } catch (error) {
      console.error(`\n❌ Erreur lors de la suppression de ${email}:`, error);
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  RÉSUMÉ DE LA SUPPRESSION                                     ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log(`✅ Utilisateurs supprimés avec succès: ${successCount}`);
  console.log(`📊 Total d'utilisateurs traités: ${emailsToDelete.length}`);
  console.log("\n✅ Script terminé");
}

deleteAllTestUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur lors de la suppression:", error);
    process.exit(1);
  });