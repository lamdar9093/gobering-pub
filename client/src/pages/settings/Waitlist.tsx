import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Professional } from "@shared/schema";
import SettingsLayout from "./SettingsLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function WaitlistSettings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: professional, isLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Redirect free plan users
  useEffect(() => {
    if (!isLoading && professional?.planType === 'free') {
      setLocation("/dashboard/parametres/general");
    }
  }, [isLoading, professional?.planType, setLocation]);

  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [waitlistPriorityHours, setWaitlistPriorityHours] = useState(24);

  // Sync state with professional data when it loads
  useEffect(() => {
    if (professional) {
      setWaitlistEnabled(professional.waitlistEnabled ?? true);
      setWaitlistPriorityHours(professional.waitlistPriorityHours || 24);
    }
  }, [professional]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/professional/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Paramètres enregistrés",
        description: "Vos paramètres de liste d'attente ont été mis à jour.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      waitlistEnabled,
      waitlistPriorityHours,
    });
  };

  if (isLoading) {
    return (
      <SettingsLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingAnimation />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Liste d'attente</h2>
            <p className="text-muted-foreground text-xs">
              Configuration du système de liste d'attente
            </p>
          </div>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-waitlist"
          >
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Paramètres de la liste d'attente</CardTitle>
            <CardDescription className="text-xs">
              Configurez le fonctionnement de votre liste d'attente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="waitlist-enabled" className="font-medium">
                  Activer la liste d'attente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permettre aux clients de rejoindre une liste d'attente quand aucun créneau n'est disponible
                </p>
              </div>
              <Switch 
                id="waitlist-enabled" 
                checked={waitlistEnabled}
                onCheckedChange={setWaitlistEnabled}
                data-testid="switch-waitlist-enabled" 
              />
            </div>

            {waitlistEnabled && (
              <div className="space-y-2">
                <Label htmlFor="priority-hours">Durée de priorité (heures)</Label>
                <Input
                  id="priority-hours"
                  type="number"
                  min="1"
                  max="168"
                  value={waitlistPriorityHours}
                  onChange={(e) => setWaitlistPriorityHours(parseInt(e.target.value) || 24)}
                  data-testid="input-priority-hours"
                />
                <p className="text-xs text-muted-foreground">
                  Lorsqu'un créneau se libère, la première personne sur la liste d'attente dispose de {waitlistPriorityHours}h pour réserver avant que le créneau soit proposé à la suivante
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Comment ça fonctionne</CardTitle>
            <CardDescription className="text-xs">
              Comprendre le système de liste d'attente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span className="font-bold text-primary">1.</span>
              <p>Lorsqu'aucun créneau n'est disponible, les clients peuvent rejoindre la liste d'attente</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-primary">2.</span>
              <p>Si un rendez-vous est annulé, le système notifie automatiquement la première personne en attente</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-primary">3.</span>
              <p>Cette personne reçoit un email avec un lien pour réserver le créneau en priorité</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-primary">4.</span>
              <p>Si elle ne réserve pas dans le délai configuré, le créneau est proposé à la personne suivante</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
