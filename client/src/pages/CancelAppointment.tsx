import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Calendar, Clock, User, CheckCircle2, X, Edit, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, parseISO, addDays, addWeeks, startOfDay, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { formatTime } from "@/lib/timeUtils";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";
import type { TimeSlot } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CancelAppointment() {
  const params = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'cancelled' | 'rescheduled' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [cancellationError, setCancellationError] = useState<{ message: string; minimumHours?: number; remainingHours?: number } | null>(null);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (params.token) {
      fetchAppointmentDetails();
    }
  }, [params.token]);

  const fetchAppointmentDetails = async () => {
    try {
      const response = await fetch(`/api/appointments/by-token/${params.token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Rendez-vous non trouvé');
      }

      setAppointmentDetails(data);
      setStatus('loaded');
    } catch (error: any) {
      console.error('Error fetching appointment:', error);
      setErrorMessage(error.message || 'Une erreur est survenue');
      setStatus('error');
    }
  };

  // Calculate the week start (Monday) based on offset
  const today = startOfDay(new Date());
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addWeeks(currentWeekMonday, weekOffset);
  const weekEnd = addDays(weekStart, 6);

  // Fetch timeslots for the professional when reschedule modal is open
  const { data: timeSlots = [], isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/professionals/${appointmentDetails?.professionalId}/timeslots`, weekStart, weekEnd, appointmentDetails?.id, appointmentDetails?.professionalServiceId],
    queryFn: async () => {
      if (!appointmentDetails?.professionalId) return [];
      
      const params = new URLSearchParams({
        fromDate: weekStart.toISOString(),
        toDate: weekEnd.toISOString(),
      });
      
      if (appointmentDetails?.id) {
        params.append('excludeAppointmentId', appointmentDetails.id);
      }
      
      if (appointmentDetails?.professionalServiceId) {
        params.append('professionalServiceId', appointmentDetails.professionalServiceId);
      }
      
      const response = await fetch(
        `/api/professionals/${appointmentDetails.professionalId}/timeslots?${params.toString()}`
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: showRescheduleModal && !!appointmentDetails?.professionalId,
  });

  // Group slots by date
  const slotsByDate: Record<string, TimeSlot[]> = {};
  timeSlots.forEach(slot => {
    const slotDate = new Date(slot.slotDate);
    const dateKey = format(slotDate, 'yyyy-MM-dd');
    
    const shouldIncludeSlot = weekOffset > 0 || slotDate >= startOfDay(today);
    
    if (shouldIncludeSlot) {
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(slot);
    }
  });

  // Generate weekdays (Mon-Fri) and conditionally add Saturday/Sunday if slots exist
  const saturdayDate = addDays(weekStart, 5);
  const sundayDate = addDays(weekStart, 6);
  const saturdayKey = format(saturdayDate, 'yyyy-MM-dd');
  const sundayKey = format(sundayDate, 'yyyy-MM-dd');
  const hasSaturdaySlots = slotsByDate[saturdayKey]?.length > 0;
  const hasSundaySlots = slotsByDate[sundayKey]?.length > 0;
  
  const displayDays: Date[] = [];
  for (let i = 0; i < 5; i++) {
    displayDays.push(addDays(weekStart, i)); // Mon-Fri
  }
  if (hasSaturdaySlots) {
    displayDays.push(saturdayDate);
  }
  if (hasSundaySlots) {
    displayDays.push(sundayDate);
  }

  const getWeekTitle = () => {
    if (weekOffset === 0) return "Cette semaine";
    if (weekOffset === 1) return "La semaine prochaine";
    return "Dans plus d'une semaine";
  };

  const handleCancel = async () => {
    if (!params.token) return;

    setStatus('loading');
    setCancellationError(null);

    try {
      const response = await fetch(`/api/appointments/cancel/${params.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a cancellation delay error (409)
        if (response.status === 409) {
          setCancellationError({
            message: data.message || 'Délai d\'annulation insuffisant',
            minimumHours: data.minimumHours,
            remainingHours: data.remainingHours
          });
          setStatus('loaded');
          return;
        }
        throw new Error(data.error || 'Erreur lors de l\'annulation');
      }

      setAppointmentDetails(data.appointment);
      setStatus('cancelled');
    } catch (error: any) {
      console.error('Cancellation error:', error);
      setErrorMessage(error.message || 'Une erreur est survenue lors de l\'annulation');
      setStatus('error');
    }
  };

  const rescheduleMutation = useMutation({
    mutationFn: async (data: { appointmentDate: string; startTime: string; endTime: string }) => {
      return await apiRequest("POST", `/api/appointments/reschedule/${params.token}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const firstKey = key[0]?.toString() || '';
        return (
          (firstKey.startsWith('/api/professionals/') && firstKey.includes('/timeslots')) ||
          (firstKey === '/api/professionals' && key[2] === 'timeslots')
        );
      }});
      setAppointmentDetails(data);
      setStatus('rescheduled');
      setShowRescheduleModal(false);
      setSelectedSlot(null);
      toast({
        title: "Rendez-vous modifié",
        description: "Votre rendez-vous a été modifié avec succès.",
      });
    },
    onError: (error: any) => {
      console.error('Reschedule error:', error);
      toast({
        title: "Erreur",
        description: error.message || 'Une erreur est survenue lors de la modification',
        variant: "destructive",
      });
    },
  });

  const handleReschedule = async () => {
    if (!selectedSlot) return;

    const slotDate = new Date(selectedSlot.slotDate);
    const appointmentDate = format(slotDate, 'yyyy-MM-dd');

    rescheduleMutation.mutate({
      appointmentDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    });
  };

  const formatAppointmentDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, convertDateFormat(dateFormat), { locale: fr });
    } catch {
      return dateString;
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Rendez-vous annulé</CardTitle>
            <CardDescription>
              Votre rendez-vous a été annulé avec succès
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatAppointmentDate(appointmentDetails?.appointmentDate)}
                  </p>
                </div>
              </div>
              {appointmentDetails?.startTime && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Heure</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(appointmentDetails.startTime)}
                      {appointmentDetails.endTime && ` - ${formatTime(appointmentDetails.endTime)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Un email de confirmation a été envoyé. Le professionnel de santé a également été informé de cette annulation.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              onClick={() => setLocation('/')}
              data-testid="button-home"
            >
              Retour à l'accueil
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (status === 'rescheduled') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Rendez-vous modifié</CardTitle>
            <CardDescription>
              Votre rendez-vous a été modifié avec succès
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nouvelle date</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatAppointmentDate(appointmentDetails?.appointmentDate)}
                  </p>
                </div>
              </div>
              {appointmentDetails?.startTime && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nouvelle heure</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(appointmentDetails.startTime)}
                      {appointmentDetails.endTime && ` - ${formatTime(appointmentDetails.endTime)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Un email de confirmation a été envoyé avec les nouvelles informations.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              onClick={() => setLocation('/')}
              data-testid="button-home"
            >
              Retour à l'accueil
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <X className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">Erreur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setLocation('/')} data-testid="button-home">
              Retour à l'accueil
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Gérer votre rendez-vous</CardTitle>
          <CardDescription>
            Vous pouvez modifier ou annuler ce rendez-vous
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Professionnel</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {appointmentDetails?.professionalName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {appointmentDetails?.professions && appointmentDetails.professions.length > 0 
                    ? appointmentDetails.professions.join(', ') 
                    : 'Profession non spécifiée'}
                </p>
              </div>
            </div>
            {appointmentDetails?.serviceName && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Service</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {appointmentDetails.serviceName}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatAppointmentDate(appointmentDetails?.appointmentDate)}
                </p>
              </div>
            </div>
            {appointmentDetails?.startTime && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Heure</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatTime(appointmentDetails.startTime)}
                    {appointmentDetails.endTime && ` - ${formatTime(appointmentDetails.endTime)}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 justify-center flex-col">
          {cancellationError && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Annulation impossible</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{cancellationError.message}</p>
                {cancellationError.minimumHours && (
                  <p className="text-xs">
                    Politique d'annulation : au moins {cancellationError.minimumHours}h à l'avance. 
                    Des frais peuvent s'appliquer pour les annulations tardives.
                  </p>
                )}
                <p className="text-xs mt-2">
                  Vous pouvez modifier votre rendez-vous pour choisir une autre date.
                </p>
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            onClick={() => setShowRescheduleModal(true)}
            className="w-full"
            data-testid="button-reschedule"
          >
            <Edit className="mr-2 h-4 w-4" />
            Modifier le rendez-vous
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            className="w-full"
            data-testid="button-confirm-cancel"
          >
            <X className="mr-2 h-4 w-4" />
            Annuler le rendez-vous
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation('/')}
            className="w-full"
            data-testid="button-back"
          >
            Retour à l'accueil
          </Button>
        </CardFooter>
      </Card>

      {/* Reschedule Modal with Real Availability */}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Modifier le rendez-vous</DialogTitle>
            <DialogDescription>
              Sélectionnez une nouvelle date et heure parmi les disponibilités du professionnel
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                disabled={weekOffset === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Semaine précédente
              </Button>
              <span className="text-sm font-medium">{getWeekTitle()}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(weekOffset + 1)}
                disabled={weekOffset >= 3}
              >
                Semaine suivante
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className={`grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 ${
                displayDays.length === 7 ? 'md:grid-cols-7' :
                displayDays.length === 6 ? 'md:grid-cols-6' :
                'md:grid-cols-5'
              }`}>
                {displayDays.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const daySlots = slotsByDate[dateKey] || [];
                  const isPast = day < startOfDay(today);
                  
                  return (
                    <div key={dateKey} className="space-y-2">
                      <div className="text-center">
                        <p className="text-sm font-medium capitalize">
                          {format(day, 'EEEE', { locale: fr })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(day, 'd MMM', { locale: fr })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {isPast ? (
                          <p className="text-xs text-gray-400 text-center py-2">Passé</p>
                        ) : daySlots.length > 0 ? (
                          daySlots.slice(0, 4).map(slot => (
                            <Button
                              key={slot.id}
                              variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {formatTime(slot.startTime)}
                            </Button>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-2">Aucune dispo</p>
                        )}
                        {daySlots.length > 4 && (
                          <p className="text-xs text-gray-500 text-center">
                            +{daySlots.length - 4} autres
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <Alert>
                <AlertDescription>
                  Nouveau rendez-vous: <strong>{format(new Date(selectedSlot.slotDate), convertDateFormat(dateFormat), { locale: fr })}</strong> à <strong>{formatTime(selectedSlot.startTime)}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRescheduleModal(false);
                setSelectedSlot(null);
                setWeekOffset(0);
              }}
              data-testid="button-cancel-reschedule"
            >
              Annuler
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!selectedSlot || rescheduleMutation.isPending}
              data-testid="button-confirm-reschedule"
            >
              {rescheduleMutation.isPending ? "Modification..." : "Confirmer la modification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
