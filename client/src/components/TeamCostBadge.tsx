import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Crown, Zap, AlertCircle } from "lucide-react";
import type { Professional, ClinicMember } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getTrialBadgeText, isTrialExpired } from "@/lib/subscription-utils";

interface TeamCostBadgeProps {
  professional?: Professional;
}

export function TeamCostBadge({ professional }: TeamCostBadgeProps) {
  const { data: members = [] } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  // Get clinic subscription status (for inherited subscription model)
  const { data: clinicSubscription } = useQuery<{
    planType: string;
    subscriptionStatus: string;
    trialEndsAt?: string;
    adminName?: string;
  }>({
    queryKey: [`/api/clinics/${professional?.clinicId}/subscription-status`],
    enabled: !!professional?.clinicId,
  });

  if (!professional) return null;

  // Count all members except secretaries (Admin and any other roles are billable seats)
  const professionalMembers = members.filter(m => m.role !== 'Secrétaire');
  const numberOfSeats = professionalMembers.length || 1;
  const isAdmin = members.find(m => m.professionalId === professional.id)?.role === 'Admin';
  
  // Use clinic's subscription status (inherited from Admin) for non-Admins
  const planType = isAdmin ? (professional.planType || 'legacy') : (clinicSubscription?.planType || 'legacy');
  const subscriptionStatus = isAdmin ? professional.subscriptionStatus : clinicSubscription?.subscriptionStatus;
  const trialEndsAt = isAdmin ? professional.trialEndsAt : clinicSubscription?.trialEndsAt;
  
  // Calculate monthly cost: base + (seats - 1) × 15$
  const basePrice = planType === 'pro' ? 39 : 0;
  const additionalSeats = Math.max(numberOfSeats - 1, 0);
  const monthlyCost = basePrice + (additionalSeats * 15);
  const isInTrial = subscriptionStatus === 'trial';
  const trialExpired = isTrialExpired(trialEndsAt);
  const trialBadgeText = getTrialBadgeText(trialEndsAt);

  // Don't show for legacy users
  if (planType === 'legacy') return null;

  // Badge content (shared between clickable and non-clickable versions)
  const badgeContent = (
    <div className={`
      flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 
      ${planType === 'pro' 
        ? 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30' 
        : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      }
      backdrop-blur-sm
    `}>
      {/* Icon */}
      <div className="p-1.5 rounded-md bg-white/20">
        {isInTrial ? (
          trialExpired ? (
            <AlertCircle className="h-4 w-4 text-red-300" />
          ) : (
            <Zap className="h-4 w-4 text-yellow-300" />
          )
        ) : (
          planType === 'pro' ? (
            <Crown className="h-4 w-4 text-yellow-300" />
          ) : (
            <Users className="h-4 w-4 text-blue-100" />
          )
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold uppercase tracking-wide text-white">
          {planType === 'pro' ? 'Pro' : 'Basic'}
        </span>
      </div>

      {/* Trial Badge - positioned on the right */}
      {isInTrial && (
        <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
          trialExpired
            ? 'bg-red-400 text-red-950 border-red-300'
            : 'bg-emerald-400 text-emerald-950 border-emerald-300'
        }`}>
          {trialBadgeText}
        </span>
      )}

      {/* Arrow indicator on hover (only for admins) */}
      {isAdmin && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );

  // If admin: clickable badge
  if (isAdmin) {
    return (
      <Link href="/dashboard/parametres/abonnement">
        <div className="group cursor-pointer transition-all duration-200 hover:scale-[1.02]">
          {badgeContent}
        </div>
      </Link>
    );
  }

  // If not admin: informational badge with tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">
            {badgeContent}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Géré par l'administrateur</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
