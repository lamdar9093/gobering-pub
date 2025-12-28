import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, Lock, Ban } from "lucide-react";

interface DowngradePlanWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numberOfMembers: number;
  numberOfProfessionals: number;
  numberOfSecretaries: number;
  onContinueWithFree: () => void;
  onChoosePro: () => void;
  isLoading?: boolean;
}

export function DowngradePlanWarningDialog({
  open,
  onOpenChange,
  numberOfMembers,
  numberOfProfessionals,
  numberOfSecretaries,
  onContinueWithFree,
  onChoosePro,
  isLoading = false,
}: DowngradePlanWarningDialogProps) {
  // Calculate how many members will go read-only
  // Free plan allows: 1 professional (Admin) + 1 secretary
  // So: extra professionals = (numberOfProfessionals - 1)
  // And: extra secretaries = max(0, numberOfSecretaries - 1)
  const extraProfessionals = numberOfProfessionals > 1 ? numberOfProfessionals - 1 : 0;
  const extraSecretaries = numberOfSecretaries > 1 ? numberOfSecretaries - 1 : 0;
  const totalReadOnly = extraProfessionals + extraSecretaries;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <DialogTitle className="text-xl">Attention au changement de plan</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-4 space-y-4">
            {totalReadOnly > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white mb-1">
                    {totalReadOnly} {totalReadOnly > 1 ? 'membres passeront' : 'membre passera'} en lecture seule
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Le plan Gratuit permet 1 professionnel + 1 secrétaire. Les membres supplémentaires conserveront leur accès à leurs rendez-vous mais ne pourront plus effectuer de modifications.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="font-medium text-slate-900 dark:text-white">
                En passant au plan Gratuit, vous perdrez :
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Ban className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Liste d'attente intelligente</strong> - Vos patients ne pourront plus s'inscrire sur liste d'attente</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Ban className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Notifications SMS</strong> - Seulement les emails seront envoyés</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Ban className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Rendez-vous illimités</strong> - Limité à 100 rendez-vous par mois</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Ban className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Widgets multiples</strong> - Seulement 1 widget de réservation disponible</span>
                </li>
              </ul>

              {totalReadOnly > 0 && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    💡 <strong>Vos données sont protégées :</strong> Aucun membre ne sera supprimé. Ils conserveront leur accès en consultation uniquement.
                  </p>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onContinueWithFree}
            disabled={isLoading}
            data-testid="button-continue-free"
            className="border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20"
          >
            Passer au plan Gratuit
          </Button>
          <Button
            onClick={onChoosePro}
            disabled={isLoading}
            data-testid="button-choose-pro"
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Rester sur Pro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
