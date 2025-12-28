import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState("");

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/auth/account');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé définitivement",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le compte",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmation === "SUPPRIMER") {
      deleteAccountMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-delete-account">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Supprimer mon compte
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible et supprimera définitivement toutes vos données
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention !</strong> La suppression de votre compte entraînera :
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>La suppression de tous vos rendez-vous</li>
              <li>La suppression de vos informations professionnelles</li>
              <li>La perte d'accès à votre clinique</li>
              <li>La suppression de tous vos patients et dossiers</li>
            </ul>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleDelete} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Pour confirmer, tapez <strong className="text-destructive">SUPPRIMER</strong> ci-dessous :
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="SUPPRIMER"
              data-testid="input-delete-confirmation"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={deleteAccountMutation.isPending || confirmation !== "SUPPRIMER"}
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
