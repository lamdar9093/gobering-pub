import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TrialExpirationDialogProps {
  isTrialExpired: boolean;
  subscriptionStatus?: string;
}

const TRIAL_CHOICE_SHOWN_KEY = 'trial-choice-dialog-shown';

export function TrialExpirationDialog({ isTrialExpired, subscriptionStatus }: TrialExpirationDialogProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const hasShownDialog = useRef(false);

  useEffect(() => {
    const sessionShown = sessionStorage.getItem(TRIAL_CHOICE_SHOWN_KEY);
    
    if (isTrialExpired && subscriptionStatus === 'trial' && !hasShownDialog.current && !sessionShown) {
      hasShownDialog.current = true;
      sessionStorage.setItem(TRIAL_CHOICE_SHOWN_KEY, 'true');
      setShowDialog(true);
    }
  }, [isTrialExpired, subscriptionStatus]);

  const selectFreePlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/select-free-plan");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Plan Basic activé",
        description: "Vous êtes maintenant sur le plan Basic. Vous pouvez passer à Pro à tout moment.",
      });
      setShowDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/create-checkout-session", { planType: 'pro', seats: 1 });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectFree = () => {
    selectFreePlanMutation.mutate();
  };

  const handleSelectPro = () => {
    createCheckoutMutation.mutate();
  };

  const isLoading = selectFreePlanMutation.isPending || createCheckoutMutation.isPending;

  return (
    <Dialog open={showDialog} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full">
              <Crown className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            🎉 Votre essai PRO est terminé… mais votre aventure continue !
          </DialogTitle>
          <DialogDescription className="text-center text-sm mt-2 text-foreground">
            Continuez à simplifier votre gestion avec le plan qui vous convient 👇
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {/* Plan Gratuit */}
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/30">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              🌿 Plan Gratuit
            </h3>
            <ul className="space-y-1 text-xs">
              <li className="flex items-start gap-1.5">
                <span className="text-green-600 dark:text-green-400">✅</span>
                <span>100 rendez-vous par mois</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-green-600 dark:text-green-400">✅</span>
                <span>1 professionnel + assistant(e)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-600 dark:text-blue-400">💾</span>
                <span>Toutes vos données préservées</span>
              </li>
            </ul>
          </div>

          {/* Plan PRO */}
          <div className="border-2 border-blue-500 dark:border-blue-400 rounded-lg p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              🚀 Plan PRO
            </h3>
            <ul className="space-y-1 text-xs">
              <li className="flex items-start gap-1.5">
                <span className="text-green-600 dark:text-green-400">✅</span>
                <span>Agenda complet et illimité</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-green-600 dark:text-green-400">✅</span>
                <span>Rendez-vous sans limite</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-green-600 dark:text-green-400">✅</span>
                <span>Multi-professionnels et assistants</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleSelectPro}
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30"
            data-testid="button-upgrade-pro"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-bold">
                {createCheckoutMutation.isPending ? "Redirection..." : "🔓 Passer au PRO maintenant"}
              </span>
            </div>
          </Button>

          <Button
            onClick={handleSelectFree}
            disabled={isLoading}
            variant="outline"
            className="w-full py-3 border-2"
            data-testid="button-stay-free"
          >
            <span className="font-semibold">
              {selectFreePlanMutation.isPending ? "Activation..." : "⏳ Rester sur le plan gratuit"}
            </span>
          </Button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 mt-3">
          <p className="text-xs text-blue-900 dark:text-blue-100 text-center">
            💡 Passez à Pro à tout moment depuis vos paramètres
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
