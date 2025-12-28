import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import type { ProfessionalSchedule, Professional, ProfessionalBreak } from "@shared/schema";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { TimeInput } from "@/components/TimeInput";

const DAYS_OF_WEEK = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

interface WeeklySchedule {
  [key: number]: {
    isAvailable: boolean;
    startTime: string;
    endTime: string;
    scheduleId?: string;
  };
}

interface WeeklyBreaks {
  [key: number]: {
    isEnabled: boolean;
    startTime: string;
    endTime: string;
    breakId?: string;
  };
}

export default function Horaires() {
  const { toast } = useToast();
  
  const { data: professional } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({
    0: { isAvailable: false, startTime: "09:00", endTime: "17:00" },
    1: { isAvailable: true, startTime: "09:00", endTime: "18:00" },
    2: { isAvailable: true, startTime: "09:00", endTime: "18:00" },
    3: { isAvailable: true, startTime: "09:00", endTime: "18:00" },
    4: { isAvailable: true, startTime: "09:00", endTime: "18:00" },
    5: { isAvailable: true, startTime: "09:00", endTime: "18:00" },
    6: { isAvailable: false, startTime: "09:00", endTime: "13:00" },
  });

  const [weeklyBreaks, setWeeklyBreaks] = useState<WeeklyBreaks>({
    0: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    1: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    2: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    3: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    4: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    5: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
    6: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
  });


  const { data: schedules, isLoading: schedulesLoading } = useQuery<ProfessionalSchedule[]>({
    queryKey: ["/api/professional/schedules"],
  });

  const { data: breaks, isLoading: breaksLoading } = useQuery<ProfessionalBreak[]>({
    queryKey: ["/api/professional/breaks"],
  });

  useEffect(() => {
    if (schedules !== undefined) {
      // Start from clean default state
      const newSchedule: WeeklySchedule = {
        0: { isAvailable: false, startTime: "09:00", endTime: "17:00" },
        1: { isAvailable: false, startTime: "09:00", endTime: "18:00" },
        2: { isAvailable: false, startTime: "09:00", endTime: "18:00" },
        3: { isAvailable: false, startTime: "09:00", endTime: "18:00" },
        4: { isAvailable: false, startTime: "09:00", endTime: "18:00" },
        5: { isAvailable: false, startTime: "09:00", endTime: "18:00" },
        6: { isAvailable: false, startTime: "09:00", endTime: "13:00" },
      };
      
      // Apply only schedules that exist on the server
      schedules.forEach(schedule => {
        newSchedule[schedule.dayOfWeek] = {
          isAvailable: schedule.isAvailable ?? true,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          scheduleId: schedule.id,
        };
      });
      
      setWeeklySchedule(newSchedule);
    }
  }, [schedules]);

  useEffect(() => {
    if (breaks !== undefined) {
      // Start from clean default state
      const newBreaks: WeeklyBreaks = {
        0: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        1: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        2: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        3: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        4: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        5: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
        6: { isEnabled: false, startTime: "12:00", endTime: "13:00" },
      };
      
      // Apply only breaks that exist on the server
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

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(weeklySchedule).map(async ([dayStr, data]) => {
        const day = parseInt(dayStr);
        
        if (data.isAvailable) {
          if (data.scheduleId) {
            return await apiRequest("PATCH", `/api/professional/schedules/${data.scheduleId}`, {
              dayOfWeek: day,
              startTime: data.startTime,
              endTime: data.endTime,
            });
          } else {
            return await apiRequest("POST", "/api/professional/schedules", {
              dayOfWeek: day,
              startTime: data.startTime,
              endTime: data.endTime,
            });
          }
        } else if (data.scheduleId) {
          return await apiRequest("DELETE", `/api/professional/schedules/${data.scheduleId}`, {});
        }
      });
      
      return await Promise.all(promises.filter(p => p !== undefined));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/schedules"] });
      toast({
        title: "Horaires enregistrés",
        description: "Vos horaires de travail ont été mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les horaires",
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


  const handleScheduleChange = (dayOfWeek: number, field: string, value: string | boolean) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
      },
    }));
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

  const handleSaveSchedule = () => {
    const hasErrors = Object.entries(weeklySchedule).some(([_, data]) => {
      if (data.isAvailable && data.startTime >= data.endTime) {
        return true;
      }
      return false;
    });

    if (hasErrors) {
      toast({
        title: "Erreur de validation",
        description: "L'heure de début doit être avant l'heure de fin pour tous les jours actifs",
        variant: "destructive",
      });
      return;
    }

    saveScheduleMutation.mutate();
  };

  const handleSaveBreaks = () => {
    const hasErrors = Object.entries(weeklyBreaks).some(([_, data]) => {
      if (data.isEnabled && data.startTime >= data.endTime) {
        return true;
      }
      return false;
    });

    if (hasErrors) {
      toast({
        title: "Erreur de validation",
        description: "L'heure de début doit être avant l'heure de fin pour toutes les pauses actives",
        variant: "destructive",
      });
      return;
    }

    saveBreaksMutation.mutate();
  };


  if (schedulesLoading || breaksLoading) {
    return (
      <DashboardLayout professionalName={professional ? `${professional.firstName} ${professional.lastName}` : undefined}>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <LoadingAnimation />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout professionalName={professional ? `${professional.firstName} ${professional.lastName}` : undefined}>
      <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">Gestion des horaires</h1>
          <p className="text-gray-600 mt-2 text-xs">
            Configurez vos horaires de travail et vos périodes de pause
          </p>
        </div>

      {/* Planning de travail */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Planning de travail</CardTitle>
          <CardDescription className="text-xs">
            Indiquer ici les jours et les heures pendant lesquels vous acceptez les rendez-vous. Il est
            possible de fixer vous-même un rendez-vous en dehors des heures de travail tandis que les
            clients ne pourront pas prendre d'eux-mêmes un rendez-vous en dehors des périodes de travail
            indiquées ici. Ce planning de travail sera celui proposé par défaut pour chaque nouvel
            enregistrement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="hidden md:grid grid-cols-[120px_1fr_1fr] gap-4 font-semibold text-gray-700 border-b pb-2">
              <div>JOUR</div>
              <div>DÉBUT</div>
              <div>FIN</div>
            </div>
            
            {DAYS_OF_WEEK.map(({ value, label }) => (
              <div
                key={value}
                className="flex flex-col md:grid md:grid-cols-[120px_1fr_1fr] gap-3 md:gap-4 items-start md:items-center py-3 md:py-2 border-b last:border-b-0"
                data-testid={`schedule-row-${value}`}
              >
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  <Checkbox
                    checked={weeklySchedule[value]?.isAvailable || false}
                    onCheckedChange={(checked) => 
                      handleScheduleChange(value, "isAvailable", checked as boolean)
                    }
                    data-testid={`checkbox-day-${value}`}
                  />
                  <label className="text-sm font-medium">{label}</label>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:contents">
                  <div className="flex-1 md:flex-none">
                    <label className="text-xs text-gray-600 mb-1 block md:hidden">Début</label>
                    <TimeInput
                      value={weeklySchedule[value]?.startTime || "09:00"}
                      onChange={(val) => handleScheduleChange(value, "startTime", val)}
                      disabled={!weeklySchedule[value]?.isAvailable}
                      className="max-w-xs w-full"
                      data-testid={`input-start-${value}`}
                    />
                  </div>
                  
                  <div className="flex-1 md:flex-none">
                    <label className="text-xs text-gray-600 mb-1 block md:hidden">Fin</label>
                    <TimeInput
                      value={weeklySchedule[value]?.endTime || "17:00"}
                      onChange={(val) => handleScheduleChange(value, "endTime", val)}
                      disabled={!weeklySchedule[value]?.isAvailable}
                      className="max-w-xs w-full"
                      data-testid={`input-end-${value}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 sm:mt-8 flex justify-end">
            <Button
              onClick={handleSaveSchedule}
              disabled={saveScheduleMutation.isPending}
              className="px-6 sm:px-8 w-full sm:w-auto"
              data-testid="button-save-schedule"
            >
              {saveScheduleMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pauses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pauses</CardTitle>
          <CardDescription className="text-xs">
            Indiquer ici les périodes des pauses quotidiennes. Ces pauses seront disponibles à chaque
            nouvel enregistrement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="hidden md:grid grid-cols-[120px_1fr_1fr] gap-4 font-semibold text-gray-700 border-b pb-2">
              <div>JOUR</div>
              <div>DÉBUT</div>
              <div>FIN</div>
            </div>
            
            {DAYS_OF_WEEK.map(({ value, label }) => (
              <div
                key={value}
                className="flex flex-col md:grid md:grid-cols-[120px_1fr_1fr] gap-3 md:gap-4 items-start md:items-center py-3 md:py-2 border-b last:border-b-0"
                data-testid={`break-row-${value}`}
              >
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  <Checkbox
                    checked={weeklyBreaks[value]?.isEnabled || false}
                    onCheckedChange={(checked) => 
                      handleBreakChange(value, "isEnabled", checked as boolean)
                    }
                    data-testid={`checkbox-break-${value}`}
                  />
                  <label className="text-sm font-medium">{label}</label>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:contents">
                  <div className="flex-1 md:flex-none">
                    <label className="text-xs text-gray-600 mb-1 block md:hidden">Début</label>
                    <TimeInput
                      value={weeklyBreaks[value]?.startTime || "12:00"}
                      onChange={(val) => handleBreakChange(value, "startTime", val)}
                      disabled={!weeklyBreaks[value]?.isEnabled}
                      className="max-w-xs w-full"
                      data-testid={`input-break-start-${value}`}
                    />
                  </div>
                  
                  <div className="flex-1 md:flex-none">
                    <label className="text-xs text-gray-600 mb-1 block md:hidden">Fin</label>
                    <TimeInput
                      value={weeklyBreaks[value]?.endTime || "13:00"}
                      onChange={(val) => handleBreakChange(value, "endTime", val)}
                      disabled={!weeklyBreaks[value]?.isEnabled}
                      className="max-w-xs w-full"
                      data-testid={`input-break-end-${value}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSaveBreaks}
              disabled={saveBreaksMutation.isPending}
              className="px-6 sm:px-8 w-full sm:w-auto"
              data-testid="button-save-breaks"
            >
              {saveBreaksMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
