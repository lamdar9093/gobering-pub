import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Professional, ProfessionalBreak } from "@shared/schema";
import SettingsLayout from "./SettingsLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { TimeInput24h } from "@/components/TimeInput24h";
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Lundi", value: 1 },
  { key: "tuesday", label: "Mardi", value: 2 },
  { key: "wednesday", label: "Mercredi", value: 3 },
  { key: "thursday", label: "Jeudi", value: 4 },
  { key: "friday", label: "Vendredi", value: 5 },
  { key: "saturday", label: "Samedi", value: 6 },
  { key: "sunday", label: "Dimanche", value: 0 },
];

interface WeeklyBreaks {
  [key: number]: {
    isEnabled: boolean;
    startTime: string;
    endTime: string;
    breakId?: string;
  };
}

export default function ReservationSettings() {
  const { toast } = useToast();

  const { data: professional, isLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const [workingHours, setWorkingHours] = useState({
    monday: { start: "09:00", end: "17:00", enabled: false },
    tuesday: { start: "09:00", end: "17:00", enabled: false },
    wednesday: { start: "09:00", end: "17:00", enabled: false },
    thursday: { start: "09:00", end: "17:00", enabled: false },
    friday: { start: "09:00", end: "17:00", enabled: false },
    saturday: { start: "09:00", end: "12:00", enabled: false },
    sunday: { start: "09:00", end: "17:00", enabled: false },
  });

  const [cancellationDelay, setCancellationDelay] = useState(24);
  const [appointmentDuration, setAppointmentDuration] = useState(30);

  const [weeklyBreaks, setWeeklyBreaks] = useState<WeeklyBreaks>({
    0: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    1: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    2: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    3: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    4: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    5: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    6: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
  });

  const { data: breaks } = useQuery<ProfessionalBreak[]>({
    queryKey: ["/api/professional/breaks"],
  });

  // Sync state with professional data when it loads
  useEffect(() => {
    if (professional) {
      setCancellationDelay(professional.cancellationDelay ?? 24);
      setAppointmentDuration(professional.appointmentDuration ?? 30);
      setWorkingHours(professional.workingHours || {
        monday: { start: "09:00", end: "17:00", enabled: false },
        tuesday: { start: "09:00", end: "17:00", enabled: false },
        wednesday: { start: "09:00", end: "17:00", enabled: false },
        thursday: { start: "09:00", end: "17:00", enabled: false },
        friday: { start: "09:00", end: "17:00", enabled: false },
        saturday: { start: "09:00", end: "12:00", enabled: false },
        sunday: { start: "09:00", end: "17:00", enabled: false },
      });
    }
  }, [professional]);

  // Load breaks from server
  useEffect(() => {
    if (breaks !== undefined) {
      const newBreaks: WeeklyBreaks = {
        0: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        1: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        2: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        3: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        4: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        5: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        6: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
      };
      
      breaks.forEach(breakItem => {
        newBreaks[breakItem.dayOfWeek] = {
          isEnabled: true,
          startTime: breakItem.startTime,
          endTime: breakItem.endTime,
          breakId: breakItem.id,
        };
      });
      
      setWeeklyBreaks(newBreaks);
    }
  }, [breaks]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/professional/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/schedules"] });
      toast({
        title: "Paramètres enregistrés",
        description: "Vos paramètres de réservation ont été mis à jour.",
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

  const saveBreaksMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(weeklyBreaks).map(async ([dayStr, data]) => {
        const day = parseInt(dayStr);
        
        if (data.isEnabled) {
          if (data.breakId) {
            return await apiRequest("PATCH", `/api/professional/breaks/${data.breakId}`, {
              dayOfWeek: day,
              startTime: data.startTime,
              endTime: data.endTime,
            });
          } else {
            return await apiRequest("POST", "/api/professional/breaks", {
              dayOfWeek: day,
              startTime: data.startTime,
              endTime: data.endTime,
            });
          }
        } else if (data.breakId) {
          return await apiRequest("DELETE", `/api/professional/breaks/${data.breakId}`, {});
        }
      });
      
      return await Promise.all(promises.filter(p => p !== undefined));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/breaks"] });
      toast({
        title: "Pauses enregistrées",
        description: "Vos périodes de pause ont été mises à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les pauses",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    await Promise.all([
      updateMutation.mutateAsync({
        workingHours,
        cancellationDelay,
        appointmentDuration,
      }),
      saveBreaksMutation.mutateAsync()
    ]);
  };

  const handleBreakChange = (dayOfWeek: number, field: string, value: string | boolean) => {
    setWeeklyBreaks(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
      },
    }));
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
            <h2 className="text-lg font-semibold">Paramètres de réservation</h2>
            <p className="text-muted-foreground text-xs">
              Horaires de disponibilité et politique de réservation
            </p>
          </div>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-reservation"
          >
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>

        {/* Desktop Layout */}
        <Card className="hidden md:block">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Horaires de disponibilité</CardTitle>
            <CardDescription className="text-xs">
              Définissez vos heures d'ouverture pour chaque jour de la semaine
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => {
                const dayData = workingHours[day.key as keyof typeof workingHours] || 
                  { start: "09:00", end: "17:00", enabled: false };

                return (
                  <div key={day.key} className="flex items-center gap-4">
                    <div className="w-32">
                      <Label className="text-sm font-medium">{day.label}</Label>
                    </div>
                    <Switch
                      checked={dayData.enabled}
                      onCheckedChange={(checked) => {
                        setWorkingHours({
                          ...workingHours,
                          [day.key]: { ...dayData, enabled: checked },
                        });
                      }}
                      data-testid={`switch-${day.key}`}
                    />
                    {dayData.enabled ? (
                      <div className="flex items-center gap-2">
                        <TimeInput24h
                          value={dayData.start}
                          onChange={(value) => {
                            setWorkingHours({
                              ...workingHours,
                              [day.key]: { ...dayData, start: value },
                            });
                          }}
                          data-testid={`input-start-${day.key}`}
                        />
                        <span className="text-muted-foreground">à</span>
                        <TimeInput24h
                          value={dayData.end}
                          onChange={(value) => {
                            setWorkingHours({
                              ...workingHours,
                              [day.key]: { ...dayData, end: value },
                            });
                          }}
                          data-testid={`input-end-${day.key}`}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Fermé</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-4">Pause</h3>
              <div className="space-y-4">
                {DAYS_OF_WEEK.map((day) => {
                  const breakData = weeklyBreaks[day.value];

                  return (
                    <div key={`break-${day.key}`} className="flex items-center gap-4">
                      <div className="w-32">
                        <Label className="text-sm font-medium">{day.label}</Label>
                      </div>
                      <Switch
                        checked={breakData.isEnabled}
                        onCheckedChange={(checked) => {
                          handleBreakChange(day.value, 'isEnabled', checked);
                        }}
                        data-testid={`switch-break-${day.key}`}
                      />
                      {breakData.isEnabled ? (
                        <div className="flex items-center gap-2">
                          <TimeInput24h
                            value={breakData.startTime}
                            onChange={(value) => {
                              handleBreakChange(day.value, 'startTime', value);
                            }}
                            data-testid={`input-break-start-${day.key}`}
                          />
                          <span className="text-muted-foreground">à</span>
                          <TimeInput24h
                            value={breakData.endTime}
                            onChange={(value) => {
                              handleBreakChange(day.value, 'endTime', value);
                            }}
                            data-testid={`input-break-end-${day.key}`}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Pas de pause</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Layout */}
        <div className="md:hidden">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Horaires de disponibilité</CardTitle>
              <CardDescription className="text-xs">
                Définissez vos heures d'ouverture pour chaque jour de la semaine
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const dayData = workingHours[day.key as keyof typeof workingHours] || 
                { start: "09:00", end: "17:00", enabled: false };
              const breakData = weeklyBreaks[day.value];

              return (
                <Card key={day.key} className="shadow-sm">
                  <CardContent className="pt-5">
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">{day.label}</h3>
                      <Switch
                        checked={dayData.enabled}
                        onCheckedChange={(checked) => {
                          setWorkingHours({
                            ...workingHours,
                            [day.key]: { ...dayData, enabled: checked },
                          });
                        }}
                        data-testid={`switch-${day.key}`}
                      />
                    </div>

                    {dayData.enabled ? (
                      <div className="space-y-3">
                        {/* Ouverture */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-[105px]">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-muted-foreground">Ouverture</span>
                          </div>
                          <TimeInput24h
                            value={dayData.start}
                            onChange={(value) => {
                              setWorkingHours({
                                ...workingHours,
                                [day.key]: { ...dayData, start: value },
                              });
                            }}
                            data-testid={`input-start-${day.key}`}
                          />
                        </div>

                        {/* Fermeture */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-[105px]">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-muted-foreground">Fermeture</span>
                          </div>
                          <TimeInput24h
                            value={dayData.end}
                            onChange={(value) => {
                              setWorkingHours({
                                ...workingHours,
                                [day.key]: { ...dayData, end: value },
                              });
                            }}
                            data-testid={`input-end-${day.key}`}
                          />
                        </div>

                        {/* Pause Section */}
                        <div className="pt-3 border-t mt-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold">Pause</span>
                            <Switch
                              checked={breakData.isEnabled}
                              onCheckedChange={(checked) => {
                                handleBreakChange(day.value, 'isEnabled', checked);
                              }}
                              data-testid={`switch-break-${day.key}`}
                            />
                          </div>

                          {breakData.isEnabled && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 min-w-[105px]">
                                  <Clock className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold text-muted-foreground">Début</span>
                                </div>
                                <TimeInput24h
                                  value={breakData.startTime}
                                  onChange={(value) => {
                                    handleBreakChange(day.value, 'startTime', value);
                                  }}
                                  data-testid={`input-break-start-${day.key}`}
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 min-w-[105px]">
                                  <Clock className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold text-muted-foreground">Fin</span>
                                </div>
                                <TimeInput24h
                                  value={breakData.endTime}
                                  onChange={(value) => {
                                    handleBreakChange(day.value, 'endTime', value);
                                  }}
                                  data-testid={`input-break-end-${day.key}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <span className="text-sm text-muted-foreground font-medium">Fermé ce jour</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Durée des rendez-vous</CardTitle>
            <CardDescription className="text-xs">
              Définissez la durée par défaut de vos rendez-vous (utilisé si aucun service spécifique n'est créé)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDuration">Durée de rendez-vous par défaut (minutes)</Label>
              <Input
                id="appointmentDuration"
                type="number"
                min="15"
                max="240"
                step="15"
                value={appointmentDuration}
                onChange={(e) => setAppointmentDuration(parseInt(e.target.value) || 30)}
                data-testid="input-appointment-duration"
              />
              <p className="text-xs text-muted-foreground">
                Cette durée s'applique lorsque vous n'avez pas créé de services spécifiques dans Gestion de Clinique. Recommandé : 30, 45 ou 60 minutes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Politique d'annulation</CardTitle>
            <CardDescription className="text-xs">
              Définissez le délai minimum pour les annulations de rendez-vous
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancellationDelay">Délai minimum d'annulation (heures)</Label>
              <Input
                id="cancellationDelay"
                type="number"
                min="0"
                max="168"
                value={cancellationDelay}
                onChange={(e) => setCancellationDelay(parseInt(e.target.value) || 0)}
                data-testid="input-cancellation-delay"
              />
              <p className="text-xs text-muted-foreground">
                Les clients doivent annuler au moins {cancellationDelay}h avant le rendez-vous. Les annulations tardives peuvent entraîner des frais.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
