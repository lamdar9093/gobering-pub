import cron from 'node-cron';
import { storage } from './storage';
import { 
  sendTrialReminderDay14, 
  sendTrialReminderDay19, 
  sendTrialReminderDay21,
  sendFreePlanConfirmationEmail
} from './email';
import Stripe from 'stripe';

// Helper function to get Stripe configuration based on environment
// Uses TESTING_* variables in development, normal variables in production
function getStripeConfig() {
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
  
  const config = {
    secretKey: isProduction 
      ? process.env.STRIPE_SECRET_KEY 
      : process.env.TESTING_STRIPE_SECRET_KEY,
  };
  
  console.log(`[CRON STRIPE CONFIG] Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`[CRON STRIPE CONFIG] Using ${isProduction ? 'live' : 'test'} Stripe keys`);
  
  // Validate required key is present
  const envPrefix = isProduction ? '' : 'TESTING_';
  
  if (!config.secretKey) {
    const errorMsg = `[CRON STRIPE CONFIG ERROR] Missing required environment variable: ${envPrefix}STRIPE_SECRET_KEY. Please configure this secret in Replit.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // Validate Stripe key pattern
  if (!config.secretKey.startsWith('sk_')) {
    throw new Error(`[CRON STRIPE CONFIG ERROR] Invalid ${envPrefix}STRIPE_SECRET_KEY: must start with 'sk_'`);
  }
  
  console.log(`[CRON STRIPE CONFIG] ✓ Stripe secret key validated successfully`);
  
  return config;
}

const stripeConfig = getStripeConfig();
const stripe = new Stripe(stripeConfig.secretKey || '', {
  apiVersion: '2025-09-30.clover'
});

async function processSubscriptionTransitions() {
  try {
    console.log('[CRON] Starting subscription transition check...');
    
    const allProfessionals = await storage.getAllProfessionals();
    
    // Find professionals scheduled for downgrade
    const scheduledForDowngrade = allProfessionals.filter(
      prof => prof.cancelAtPeriodEnd && prof.subscriptionEndsAt
    );
    
    console.log(`[CRON] Found ${scheduledForDowngrade.length} professionals scheduled for downgrade`);
    
    const now = new Date();
    let transitionsProcessed = 0;
    
    for (const professional of scheduledForDowngrade) {
      if (!professional.subscriptionEndsAt) continue;
      
      // Skip LAMDAA accounts - they have permanent Pro access
      if (professional.userId) {
        const user = await storage.getUser(professional.userId);
        if (user?.isLamdaaAccount) {
          console.log(`[CRON] Skipping LAMDAA account ${professional.email} - has permanent Pro access`);
          continue;
        }
      }
      
      const endsAt = new Date(professional.subscriptionEndsAt);
      
      // If subscription period has ended, transition to free plan
      if (endsAt <= now) {
        console.log(`[CRON] Transitioning professional ${professional.id} to free plan (ended at ${endsAt.toISOString()})`);
        
        // Cancel the Stripe subscription if it still exists
        if (professional.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(professional.stripeSubscriptionId);
            console.log(`[CRON] Cancelled Stripe subscription ${professional.stripeSubscriptionId}`);
          } catch (error: any) {
            console.error(`[CRON] Error cancelling subscription:`, error);
            // Continue anyway - subscription might already be cancelled
          }
        }
        
        // Update professional to free plan
        await storage.updateProfessionalSubscription(professional.id, {
          planType: 'free',
          subscriptionStatus: 'active',
          stripeSubscriptionId: undefined,
          subscriptionEndsAt: undefined,
          cancelAtPeriodEnd: false,
        });
        
        // Send confirmation email
        if (professional.email) {
          try {
            await sendFreePlanConfirmationEmail({
              firstName: professional.firstName,
              lastName: professional.lastName,
              email: professional.email,
            });
            console.log(`[CRON] Sent transition confirmation email to ${professional.email}`);
          } catch (emailError) {
            console.error(`[CRON] Error sending confirmation email:`, emailError);
          }
        }
        
        transitionsProcessed++;
      }
    }
    
    console.log(`[CRON] Subscription transition check complete. Processed ${transitionsProcessed} transitions.`);
  } catch (error) {
    console.error('[CRON] Error processing subscription transitions:', error);
  }
}

async function processTrialReminders() {
  try {
    console.log('[CRON] Starting trial reminder check...');
    
    const allProfessionals = await storage.getAllProfessionals();
    
    const trialProfessionals = allProfessionals.filter(
      prof => prof.subscriptionStatus === 'trial' && prof.trialEndsAt
    );
    
    console.log(`[CRON] Found ${trialProfessionals.length} professionals in trial period`);
    
    const now = new Date();
    let emailsSent = 0;
    
    for (const professional of trialProfessionals) {
      if (!professional.trialEndsAt) continue;
      
      const trialEndsAt = new Date(professional.trialEndsAt);
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const appointments = await storage.getProfessionalAppointments(professional.id);
      const appointmentsCount = appointments.length;
      
      if (daysRemaining === 7) {
        console.log(`[CRON] Sending Day 14 reminder to ${professional.email} (${daysRemaining} days remaining)`);
        await sendTrialReminderDay14({
          firstName: professional.firstName || 'Professionnel',
          lastName: professional.lastName || '',
          email: professional.email!,
          daysRemaining,
          appointmentsCount
        });
        emailsSent++;
      }
      else if (daysRemaining === 2) {
        console.log(`[CRON] Sending Day 19 reminder to ${professional.email} (${daysRemaining} days remaining)`);
        await sendTrialReminderDay19({
          firstName: professional.firstName || 'Professionnel',
          lastName: professional.lastName || '',
          email: professional.email!,
          daysRemaining,
          appointmentsCount
        });
        emailsSent++;
      }
      else if (daysRemaining === 0) {
        console.log(`[CRON] Sending Day 21 final reminder to ${professional.email} (trial expired)`);
        await sendTrialReminderDay21({
          firstName: professional.firstName || 'Professionnel',
          lastName: professional.lastName || '',
          email: professional.email!,
          daysRemaining: 0,
          appointmentsCount
        });
        emailsSent++;
      }
    }
    
    console.log(`[CRON] Trial reminder check complete. Sent ${emailsSent} emails.`);
  } catch (error) {
    console.error('[CRON] Error processing trial reminders:', error);
  }
}

async function processPermanentDeletions() {
  try {
    console.log('[CRON] Starting permanent deletion check for expired members...');
    
    const deletedCount = await storage.permanentlyDeleteExpiredMembers();
    
    console.log(`[CRON] Permanent deletion check complete. Deleted ${deletedCount} expired member(s).`);
  } catch (error) {
    console.error('[CRON] Error processing permanent deletions:', error);
  }
}

export function initializeCronJobs() {
  // Run daily at 10:00 AM: trial reminders and subscription transitions
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running daily subscription checks at 10:00 AM');
    await processTrialReminders();
    await processSubscriptionTransitions();
  });
  
  // Run every hour: permanent deletion of expired members (48h grace period)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running hourly check for expired member deletions');
    await processPermanentDeletions();
  });
  
  console.log('[CRON] Cron jobs initialized:');
  console.log('[CRON] - Subscription checks: daily at 10:00 AM');
  console.log('[CRON] - Permanent deletions: every hour');
}

export async function runTrialRemindersManually() {
  console.log('[CRON] Manual trial reminder check triggered');
  await processTrialReminders();
}

export async function runPermanentDeletionsManually() {
  console.log('[CRON] Manual permanent deletion check triggered');
  await processPermanentDeletions();
}

export async function runSubscriptionTransitionsManually() {
  console.log('[CRON] Manual subscription transition check triggered');
  await processSubscriptionTransitions();
}
