import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarClock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DowngradeFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  subscriptionEndsAt?: string | null;
}

const DOWNGRADE_REASONS = [
  { value: "trop_cher", label: "Trop cher" },
  { value: "fonctionnalites_inutilisees", label: "Fonctionnalités non utilisées" },
  { value: "besoin_temporaire", label: "Besoin temporaire" },
  { value: "probleme_technique", label: "Problème technique" },
  { value: "autre", label: "Autre raison" },
];

export function DowngradeFeedbackDialog({ open, onOpenChange, onComplete, subscriptionEndsAt }: DowngradeFeedbackDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/subscription/downgrade-feedback", {
        reason: selectedReason,
        otherReason: selectedReason === "autre" ? otherReason : null,
      });

      onComplete();
    } catch (error) {
      console.error("Error saving feedback:", error);
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const formattedDate = subscriptionEndsAt 
    ? format(new Date(subscriptionEndsAt), "d MMMM yyyy", { locale: fr })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-downgrade-feedback">
        <DialogHeader>
          <DialogTitle>Avant de partir...</DialogTitle>
          <DialogDescription>
            Pouvez-vous nous dire pourquoi vous quittez le plan Pro ? Cela nous aide à améliorer Gobering.
          </DialogDescription>
        </DialogHeader>

        {formattedDate && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              Votre abonnement Pro restera actif jusqu'au <strong>{formattedDate}</strong>. 
              Après cette date, vous passerez automatiquement au plan Gratuit.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {DOWNGRADE_REASONS.map((reason) => (
              <div key={reason.value} className="flex items-center space-x-2">
                <RadioGroupItem 
                  value={reason.value} 
                  id={reason.value}
                  data-testid={`radio-reason-${reason.value}`}
                />
                <Label htmlFor={reason.value} className="cursor-pointer font-normal">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason === "autre" && (
            <div className="space-y-2">
              <Label htmlFor="other-reason">Précisez</Label>
              <Textarea
                id="other-reason"
                placeholder="Décrivez brièvement votre raison..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                rows={3}
                data-testid="textarea-other-reason"
              />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            data-testid="button-skip-feedback"
          >
            Passer
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedReason || (selectedReason === "autre" && !otherReason.trim()) || isSubmitting}
            data-testid="button-submit-feedback"
          >
            {isSubmitting ? "Envoi..." : "Continuer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
