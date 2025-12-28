import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface UpgradeToProConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  totalPrice: number;
  cardType?: string;
  cardLast4?: string;
  isUpgrading: boolean;
}

export function UpgradeToProConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  totalPrice,
  cardType = "card",
  cardLast4,
  isUpgrading,
}: UpgradeToProConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-upgrade-confirm">
        <DialogHeader>
          <DialogTitle>Confirmer le passage au plan Pro</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de passer au plan Pro. Veuillez confirmer les détails de votre abonnement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prix */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Montant mensuel</span>
              <span className="text-2xl font-bold">{totalPrice} $</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Facturé mensuellement, annulable à tout moment
            </p>
          </div>

          {/* Carte de crédit */}
          {cardLast4 && (
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Moyen de paiement</p>
                  <p className="text-sm text-muted-foreground">
                    {cardType.charAt(0).toUpperCase() + cardType.slice(1)} •••• {cardLast4}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            En confirmant, vous autorisez le prélèvement mensuel de {totalPrice} $ sur votre carte.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isUpgrading}
            data-testid="button-cancel-upgrade"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isUpgrading}
            data-testid="button-confirm-upgrade"
          >
            {isUpgrading ? "Activation..." : "Confirmer et passer au Pro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
