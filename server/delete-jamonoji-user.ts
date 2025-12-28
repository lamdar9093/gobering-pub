
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
} from "@shared/schema";
import { eq } from "drizzle-orm";

async function deleteUser() {
  const emailToDelete = "jamonoji@yahoo.com";

  console.log(`\nRecherche de l'utilisateur avec l'email: ${emailToDelete}`);

  // Trouver l'utilisateur par email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailToDelete));

  if (!user) {
    console.log(`❌ Aucun utilisateur trouvé avec l'email: ${emailToDelete}`);
    return;
  }

  console.log(`✅ Utilisateur trouvé: ${user.id} - ${user.email}`);

  // Trouver le profil professionnel
  const [professional] = await db
    .select()
    .from(professionals)
    .where(eq(professionals.userId, user.id));

  if (!professional) {
    console.log(`❌ Aucun profil professionnel trouvé pour cet utilisateur`);
    
    // Supprimer quand même l'utilisateur et ses données
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    console.log(`✅ Utilisateur supprimé (sans profil professionnel)`);
    return;
  }

  console.log(`✅ Profil professionnel trouvé: ${professional.id}`);

  // Supprimer toutes les données liées dans le bon ordre

  // 1. Supprimer les conversations de chat
  const userConversations = await db.select({ id: chatConversations.id })
    .from(chatConversations)
    .where(eq(chatConversations.userId, user.id));
  
  if (userConversations.length > 0) {
    const conversationIds = userConversations.map(c => c.id);
    for (const convId of conversationIds) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, convId));
    }
  }
  await db.delete(chatConversations).where(eq(chatConversations.userId, user.id));
  console.log(`✅ Conversations de chat supprimées`);

  // 2. Supprimer les logs d'audit
  await db.delete(auditLogs).where(eq(auditLogs.professionalId, professional.id));
  console.log(`✅ Logs d'audit supprimés`);

  // 3. Supprimer les widgets
  await db.delete(widgetConfigurations).where(eq(widgetConfigurations.professionalId, professional.id));
  console.log(`✅ Widgets supprimés`);

  // 4. Supprimer les assignations de secrétaire (où ce professionnel est le secrétaire)
  const deletedSecretaryAssignments = await db
    .delete(secretaryAssignments)
    .where(eq(secretaryAssignments.secretaryId, professional.id))
    .returning();
  console.log(`✅ ${deletedSecretaryAssignments.length} assignations de secrétaire supprimées (en tant que secrétaire)`);

  // 5. Supprimer les assignations de secrétaire (où ce professionnel est assigné)
  const deletedAssignedAssignments = await db
    .delete(secretaryAssignments)
    .where(eq(secretaryAssignments.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedAssignedAssignments.length} assignations de secrétaire supprimées (en tant que professionnel assigné)`);

  // 6. Supprimer les entrées de liste d'attente
  const deletedWaitlistEntries = await db
    .delete(waitlistEntries)
    .where(eq(waitlistEntries.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedWaitlistEntries.length} entrées de liste d'attente supprimées`);

  // 7. Supprimer les assignations de services professionnels
  const deletedServiceAssignments = await db
    .delete(professionalServiceAssignments)
    .where(eq(professionalServiceAssignments.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedServiceAssignments.length} assignations de services supprimées`);

  // 8. Supprimer les services de clinique créés par ce professionnel
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

    const deletedClinicServices = await db
      .delete(clinicServices)
      .where(eq(clinicServices.createdBy, professional.id))
      .returning();
    console.log(`✅ ${deletedClinicServices.length} services de clinique supprimés`);
  }

  // 9. Supprimer les services professionnels
  const deletedServices = await db
    .delete(professionalServices)
    .where(eq(professionalServices.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedServices.length} services professionnels supprimés`);

  // 10. Supprimer les créneaux horaires
  const deletedSlots = await db
    .delete(timeSlots)
    .where(eq(timeSlots.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedSlots.length} créneaux horaires supprimés`);

  // 11. Supprimer les pauses
  const deletedBreaks = await db
    .delete(professionalBreaks)
    .where(eq(professionalBreaks.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedBreaks.length} pauses supprimées`);

  // 12. Supprimer les horaires
  const deletedSchedules = await db
    .delete(professionalSchedules)
    .where(eq(professionalSchedules.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedSchedules.length} horaires supprimés`);

  // 13. Supprimer les rendez-vous
  const deletedAppointments = await db
    .delete(appointments)
    .where(eq(appointments.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedAppointments.length} rendez-vous supprimés`);

  // 14. Supprimer les patients
  const deletedPatients = await db
    .delete(patients)
    .where(eq(patients.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedPatients.length} patients supprimés`);

  // 15. Supprimer les invitations d'équipe (en tant qu'inviteur)
  const deletedInvitations = await db
    .delete(teamInvitations)
    .where(eq(teamInvitations.invitedBy, professional.id))
    .returning();
  console.log(`✅ ${deletedInvitations.length} invitations d'équipe supprimées (en tant qu'inviteur)`);

  // 16. Supprimer les invitations d'équipe (en tant qu'invité)
  const deletedInvitationsAsInvitee = await db
    .delete(teamInvitations)
    .where(eq(teamInvitations.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedInvitationsAsInvitee.length} invitations d'équipe supprimées (en tant qu'invité)`);

  // 17. Supprimer les membres de clinique
  const deletedMemberships = await db
    .delete(clinicMembers)
    .where(eq(clinicMembers.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedMemberships.length} appartenances à une clinique supprimées`);

  // 18. Supprimer les tokens de réinitialisation de mot de passe
  const deletedTokens = await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))
    .returning();
  console.log(`✅ ${deletedTokens.length} tokens de réinitialisation supprimés`);

  // 19. Supprimer le profil professionnel
  await db.delete(professionals).where(eq(professionals.id, professional.id));
  console.log(`✅ Profil professionnel supprimé`);

  // 20. Supprimer l'utilisateur
  await db.delete(users).where(eq(users.id, user.id));
  console.log(`✅ Utilisateur supprimé`);

  console.log(`\n✅ Suppression terminée avec succès pour ${emailToDelete}`);
}

deleteUser()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
