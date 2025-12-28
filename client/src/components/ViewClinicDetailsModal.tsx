import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, MapPin, Phone, Mail, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { Clinic } from "@shared/schema";

interface ViewClinicDetailsModalProps {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  clinic?: Clinic | null;
}

export default function ViewClinicDetailsModal({ open, onClose, clinicId, clinic: clinicProp }: ViewClinicDetailsModalProps) {
  const { toast } = useToast();
  
  const { data: clinicFetched, isLoading } = useQuery<Clinic>({
    queryKey: [`/api/clinics/${clinicId}`],
    enabled: open && !!clinicId && !clinicProp,
    retry: false,
  });

  const clinic = clinicProp || clinicFetched;

  const handleError = (error: any) => {
    if (error.status === 403) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas l'autorisation d'accéder à cette clinique.",
        variant: "destructive",
      });
    } else if (error.status === 404) {
      toast({
        title: "Clinique introuvable",
        description: "Cette clinique n'existe pas ou a été supprimée.",
        variant: "destructive",
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="title-clinic-details">
            <Building2 className="h-5 w-5" />
            Détails de la clinique
          </DialogTitle>
          <DialogDescription>
            Informations complètes de votre clinique
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <LoadingAnimation />
          ) : clinic ? (
            <>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1" data-testid="text-clinic-name">
                      {clinic.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Clinique médicale
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Adresse</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-clinic-address">
                          {clinic.address}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {clinic.city}, {clinic.postalCode}
                        </p>
                      </div>
                    </div>

                    {clinic.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Téléphone</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-clinic-phone">
                            {clinic.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    {clinic.email && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Email</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-clinic-email">
                            {clinic.email}
                          </p>
                        </div>
                      </div>
                    )}

                    {clinic.description && (
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Description</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-clinic-description">
                            {clinic.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Impossible de charger les détails de la clinique
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose} data-testid="button-close-details">
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
