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

export default function NotificationsSettings() {
  const { toast } = useToast();

  const { data: professional, isLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newAppointmentNotification, setNewAppointmentNotification] = useState(true);
  const [appointmentReminderNotification, setAppointmentReminderNotification] = useState(true);
  const [reminderTiming, setReminderTiming] = useState(24);
  const [cancellationNotification, setCancellationNotification] = useState(true);

  // Sync state with professional data when it loads
  useEffect(() => {
    if (professional) {
      setEmailNotifications(professional.emailNotifications ?? true);
      setNewAppointmentNotification(professional.newAppointmentNotification ?? true);
      setAppointmentReminderNotification(professional.appointmentReminderNotification ?? true);
      setReminderTiming(professional.reminderTiming || 24);
      setCancellationNotification(professional.cancellationNotification ?? true);
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
        description: "Vos préférences de notification ont été mises à jour.",
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
      emailNotifications,
      newAppointmentNotification,
      appointmentReminderNotification,
      reminderTiming,
      cancellationNotification,
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
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-muted-foreground text-xs">
              Configurez vos préférences de notification par email
            </p>
          </div>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-notifications"
          >
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notifications par email</CardTitle>
            <CardDescription className="text-xs">
              Choisissez les notifications que vous souhaitez recevoir
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications" className="font-medium">
                  Activer toutes les notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir des emails pour toutes les activités
                </p>
              </div>
              <Switch 
                id="email-notifications" 
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
                data-testid="switch-email-notifications" 
              />
            </div>

            {emailNotifications && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="new-appointment" className="font-medium">
                      Nouveaux rendez-vous
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un email lors d'une nouvelle réservation
                    </p>
                  </div>
                  <Switch 
                    id="new-appointment" 
                    checked={newAppointmentNotification}
                    onCheckedChange={setNewAppointmentNotification}
                    data-testid="switch-new-appointment" 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="reminder-notifications" className="font-medium">
                      Rappels de rendez-vous
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des rappels avant les rendez-vous
                    </p>
                  </div>
                  <Switch 
                    id="reminder-notifications" 
                    checked={appointmentReminderNotification}
                    onCheckedChange={setAppointmentReminderNotification}
                    data-testid="switch-reminder-notifications" 
                  />
                </div>

                {appointmentReminderNotification && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="reminder-timing">Délai du rappel (heures avant)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="reminder-timing"
                        type="number"
                        min="1"
                        max="168"
                        value={reminderTiming}
                        onChange={(e) => setReminderTiming(parseInt(e.target.value) || 24)}
                        className="w-32"
                        data-testid="input-reminder-timing"
                      />
                      <span className="text-sm text-muted-foreground">
                        Les rappels seront envoyés {reminderTiming}h avant le rendez-vous
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="cancellation-notifications" className="font-medium">
                      Annulations
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Être notifié des annulations de rendez-vous
                    </p>
                  </div>
                  <Switch 
                    id="cancellation-notifications" 
                    checked={cancellationNotification}
                    onCheckedChange={setCancellationNotification}
                    data-testid="switch-cancellation-notifications" 
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
