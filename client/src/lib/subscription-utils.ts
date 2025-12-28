/**
 * Utility functions for subscription and trial management
 */

/**
 * Check if a trial period has expired
 */
export function isTrialExpired(trialEndsAt: string | Date | null | undefined): boolean {
  if (!trialEndsAt) return false;
  
  const now = new Date();
  const trialEndDate = new Date(trialEndsAt);
  
  return now > trialEndDate;
}

/**
 * Check if user is in an expired trial (trial status but past expiry date)
 */
export function isInExpiredTrial(
  subscriptionStatus: string | undefined,
  trialEndsAt: string | Date | null | undefined
): boolean {
  return subscriptionStatus === 'trial' && isTrialExpired(trialEndsAt);
}

/**
 * Get the appropriate badge text for trial status
 */
export function getTrialBadgeText(trialEndsAt: string | Date | null | undefined): string {
  return isTrialExpired(trialEndsAt) ? 'Essai expiré' : 'Essai';
}

/**
 * Get the appropriate status message for trial
 */
export function getTrialStatusMessage(trialEndsAt: string | Date | null | undefined): {
  title: string;
  description: string;
} {
  if (isTrialExpired(trialEndsAt)) {
    return {
      title: "Période d'essai expirée",
      description: "Votre essai gratuit est terminé. Choisissez un plan pour continuer à utiliser toutes les fonctionnalités."
    };
  }
  
  return {
    title: "Période d'essai en cours",
    description: "Votre essai se termine bientôt. Votre première facturation débutera après cette date."
  };
}
