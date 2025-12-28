import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users } from "lucide-react";
import { useReadOnly } from "@/contexts/ReadOnlyContext";

interface ReadOnlyModeDialogProps {
  isReadOnly: boolean;
  showFreePlanLimits?: boolean;
  userRole?: string;
  clinicId?: string;
}

const INITIAL_POPUP_SHOWN_KEY = 'readonly-initial-popup-shown';

export function ReadOnlyModeDialog({ isReadOnly, showFreePlanLimits = false, userRole, clinicId }: ReadOnlyModeDialogProps) {
  const [, setLocation] = useLocation();
  const { showReadOnlyDialog, triggerReadOnlyDialog, dismissReadOnlyDialog } = useReadOnly();
  const hasShownInitialPopup = useRef(false);

  // Fetch clinic subscription status to get admin info if user is not admin
  const { data: subscriptionStatus } = useQuery<{
    subscriptionStatus: string;
    planType: string;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    adminName: string;
  }>({
    queryKey: [`/api/clinics/${clinicId}/subscription-status`],
    enabled: !!clinicId && userRole !== 'Admin' && (isReadOnly || showFreePlanLimits),
  });

  useEffect(() => {
    // Show dialog only once per session on initial load when showing free plan limits
    // Check both the ref and sessionStorage to handle page refreshes
    const sessionShown = sessionStorage.getItem(INITIAL_POPUP_SHOWN_KEY);
    
    if (showFreePlanLimits && !hasShownInitialPopup.current && !sessionShown) {
      hasShownInitialPopup.current = true;
      sessionStorage.setItem(INITIAL_POPUP_SHOWN_KEY, 'true');
      triggerReadOnlyDialog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFreePlanLimits]); // Only depend on showFreePlanLimits, not on triggerReadOnlyDialog

  const handleSubscribe = () => {
    dismissReadOnlyDialog();
    setLocation("/dashboard/parametres/abonnement");
  };

  const handleDismiss = () => {
    dismissReadOnlyDialog();
  };

  if (!isReadOnly && !showFreePlanLimits) return null;

  const isAdmin = userRole === 'Admin';
  const adminName = subscriptionStatus?.adminName || 'l\'administrateur';

  return (
    <Dialog open={showReadOnlyDialog} onOpenChange={dismissReadOnlyDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              {isAdmin ? (
                <AlertTriangle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              ) : (
                <Users className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              )}
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Votre essai gratuit est terminé
          </DialogTitle>
          <DialogDescription className="text-center">
            {isAdmin ? (
              "Votre compte est maintenant sur le plan GRATUIT. Vous pouvez continuer à gérer votre clinique avec des fonctionnalités de base. Pour débloquer toutes les fonctionnalités, passez à un plan PRO."
            ) : (
              <>
                La période d'essai de votre clinique est terminée et vous êtes maintenant sur le plan GRATUIT. Veuillez contacter{" "}
                <span className="font-semibold text-foreground">{adminName}</span> pour qu'il active un plan PRO et débloquer l'accès complet pour toute l'équipe.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-4">
          <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
            📊 Sur le plan gratuit, vous pouvez :
          </p>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Consulter vos rendez-vous</li>
            <li>• Voir vos patients</li>
            <li>• Accéder à vos données</li>
          </ul>
          <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mt-3 mb-2">
            ✨ Avec un abonnement PRO{isAdmin ? ', débloquez' : ', votre équipe pourra'} :
          </p>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Créer de nouveaux rendez-vous (au-delà de 100)</li>
            <li>• Gérer complètement l'agenda</li>
            <li>• Utiliser toutes les fonctionnalités PRO</li>
          </ul>
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            data-testid="button-dismiss-readonly"
          >
            Plus tard
          </Button>
          {isAdmin && (
            <Button
              onClick={handleSubscribe}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-subscribe-now"
            >
              Choisir mon abonnement
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
