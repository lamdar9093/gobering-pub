import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Mail, Phone, Plus, CalendarDays, Bell, Building2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Appointment, Professional } from "@shared/schema";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import ProfessionalBookingModal from "@/components/ProfessionalBookingModal";
import AppointmentDetailsModal from "@/components/AppointmentDetailsModal";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat } from "@/lib/dateFormatUtils";

export default function ProDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("calendar");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { toast } = useToast();
  const { dateFormat } = useDateFormat();

  // Fetch current professional data (will come from session)
  const { data: professional, isError, isLoading: isProfessionalLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch appointments
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/professional/appointments"],
  });

  // Fetch clinic overview if professional is in a clinic
  const { data: clinicOverview, isLoading: isClinicLoading } = useQuery<any>({
    queryKey: [`/api/clinics/${professional?.clinicId}/overview`],
    enabled: !!professional?.clinicId,
  });

  // Mutation for sending reminders
  const sendReminderMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      return await apiRequest('POST', `/api/appointments/${appointmentId}/send-reminder`);
    },
    onSuccess: () => {
      toast({
        title: "Rappel envoyé",
        description: "Le rappel par email a été envoyé au patient avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le rappel.",
        variant: "destructive",
      });
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isError || (!professional && !isProfessionalLoading)) {
      setLocation("/login-professionnel");
    }
  }, [isError, professional, isProfessionalLoading, setLocation]);

  // Calculate appointment lists (safe defaults before professional loads)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filterByStatus = (apts: Appointment[]) => {
    if (statusFilter === "all") return apts;
    return apts.filter(apt => apt.status === statusFilter);
  };
  
  const todayAppointments = filterByStatus(appointments.filter(
    (apt) => {
      const aptDate = new Date(apt.appointmentDate);
      aptDate.setHours(0, 0, 0, 0);
      return aptDate.getTime() === today.getTime();
    }
  ));
  
  const upcomingAppointments = filterByStatus(appointments.filter(
    (apt) => {
      const aptDate = new Date(apt.appointmentDate);
      aptDate.setHours(0, 0, 0, 0);
      return aptDate.getTime() > today.getTime();
    }
  ));
  
  const pastAppointments = filterByStatus(appointments.filter(
    (apt) => {
      const aptDate = new Date(apt.appointmentDate);
      aptDate.setHours(0, 0, 0, 0);
      return aptDate.getTime() < today.getTime();
    }
  ));

  if (!professional) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Session expirée</CardTitle>
            <CardDescription>Veuillez vous reconnecter</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowCreateModal(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const statusConfig = {
    pending: { label: "En attente", className: "bg-gray-100 text-gray-700 border-gray-300" },
    confirmed: { label: "Confirmé", className: "bg-green-100 text-green-700 border-green-300" },
    cancelled: { label: "Annulé", className: "bg-red-100 text-red-700 border-red-300" },
    draft: { label: "Brouillon", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  };

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    const status = statusConfig[appointment.status as keyof typeof statusConfig];
    
    return (
      <Card 
        className="mb-4 cursor-pointer hover:shadow-md transition-shadow" 
        data-testid={`appointment-card-${appointment.id}`}
        onClick={() => handleAppointmentClick(appointment)}
      >
        <CardContent className="pt-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-semibold" data-testid={`patient-name-${appointment.id}`}>
                  {appointment.firstName} {appointment.lastName}
                </p>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(appointment.appointmentDate), convertDateFormat(dateFormat), { locale: fr })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {appointment.startTime && appointment.endTime 
                      ? `${appointment.startTime} - ${appointment.endTime}` 
                      : "Horaire à définir"}
                  </span>
                </div>
              </div>
            </div>
            <Badge
              className={status.className}
              data-testid={`status-${appointment.id}`}
            >
              {status.label}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span data-testid={`email-${appointment.id}`}>{appointment.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span data-testid={`phone-${appointment.id}`}>{appointment.phone}</span>
            </div>
            {appointment.notes && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm" data-testid={`notes-${appointment.id}`}>{appointment.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout professionalName={professional ? `Dr ${professional.firstName} ${professional.lastName}` : undefined}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setShowCreateModal(true)}
              data-testid="button-create-appointment"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau rendez-vous
            </Button>
            
            {activeTab !== "calendar" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full max-w-4xl ${professional?.clinicId ? 'grid-cols-6' : 'grid-cols-5'}`}>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendrier
            </TabsTrigger>
            <TabsTrigger value="today" data-testid="tab-today">
              Aujourd'hui ({todayAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              À venir ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              Passés ({pastAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">
              <Bell className="h-4 w-4 mr-2" />
              Rappels
            </TabsTrigger>
            {professional?.clinicId && (
              <TabsTrigger value="clinic" data-testid="tab-clinic">
                <Building2 className="h-4 w-4 mr-2" />
                Clinique
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            <AppointmentCalendar
              appointments={appointments}
              onDayClick={handleDayClick}
              onAppointmentClick={handleAppointmentClick}
            />
          </TabsContent>

          <TabsContent value="today" className="mt-6">
            {isLoading ? (
              <LoadingAnimation />
            ) : todayAppointments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Aucun rendez-vous aujourd'hui
                  </p>
                </CardContent>
              </Card>
            ) : (
              todayAppointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            {isLoading ? (
              <LoadingAnimation />
            ) : upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Aucun rendez-vous à venir
                  </p>
                </CardContent>
              </Card>
            ) : (
              upcomingAppointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {isLoading ? (
              <LoadingAnimation />
            ) : pastAppointments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Aucun rendez-vous passé
                  </p>
                </CardContent>
              </Card>
            ) : (
              pastAppointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))
            )}
          </TabsContent>

          <TabsContent value="reminders" className="mt-6">
            {isLoading ? (
              <LoadingAnimation />
            ) : upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Aucun rendez-vous à venir pour envoyer des rappels
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Rappels automatisés par email
                    </CardTitle>
                    <CardDescription>
                      Envoyez des rappels par email à vos patients pour leurs rendez-vous à venir.
                    </CardDescription>
                  </CardHeader>
                </Card>

                {upcomingAppointments.map((apt) => (
                  <Card 
                    key={apt.id} 
                    className="mb-4"
                    data-testid={`reminder-card-${apt.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-semibold">
                                {apt.firstName} {apt.lastName}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {format(new Date(apt.appointmentDate), convertDateFormat(dateFormat), { locale: fr })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {apt.startTime || "Horaire à définir"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{apt.email}</span>
                            </div>
                            {apt.reminderSent && apt.reminderSentAt && (
                              <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                ✓ Rappel envoyé le {format(new Date(apt.reminderSentAt), convertDateFormat(dateFormat), { locale: fr })} à {format(new Date(apt.reminderSentAt), "HH:mm", { locale: fr })}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            sendReminderMutation.mutate(apt.id);
                          }}
                          disabled={sendReminderMutation.isPending || apt.reminderSent}
                          size="sm"
                          data-testid={`button-send-reminder-${apt.id}`}
                        >
                          {sendReminderMutation.isPending ? (
                            "Envoi..."
                          ) : apt.reminderSent ? (
                            "Rappel envoyé"
                          ) : (
                            <>
                              <Bell className="h-4 w-4 mr-2" />
                              Envoyer un rappel
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {professional?.clinicId && (
            <TabsContent value="clinic" className="mt-6">
              {isClinicLoading ? (
                <LoadingAnimation />
              ) : !clinicOverview ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      Impossible de charger les données de la clinique
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Clinic Statistics */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Rendez-vous
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-total-appointments">
                          {clinicOverview.totalAppointments}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Aujourd'hui
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-today-appointments">
                          {clinicOverview.todayAppointments}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Professionnels
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-total-professionals">
                          {clinicOverview.totalProfessionals}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Patients
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-unique-patients">
                          {clinicOverview.uniquePatients}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Professional Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance des Professionnels</CardTitle>
                      <CardDescription>
                        Statistiques détaillées par professionnel de santé
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {clinicOverview.professionalStats?.map((stat: any) => (
                          <div 
                            key={stat.professionalId} 
                            className="flex items-center justify-between p-4 border rounded-lg"
                            data-testid={`professional-stat-${stat.professionalId}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                  Dr {stat.firstName} {stat.lastName}
                                </p>
                                <Badge variant="outline">{stat.profession}</Badge>
                                {stat.role === 'admin' && (
                                  <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div className="text-center">
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-bold">{stat.totalAppointments}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">Aujourd'hui</p>
                                <p className="font-bold">{stat.todayAppointments}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">À venir</p>
                                <p className="font-bold">{stat.upcomingAppointments}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Appointments */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Rendez-vous Récents de la Clinique</CardTitle>
                      <CardDescription>
                        Les 10 derniers rendez-vous de tous les professionnels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {clinicOverview.recentAppointments?.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          Aucun rendez-vous récent
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {clinicOverview.recentAppointments?.map((apt: Appointment) => (
                            <div 
                              key={apt.id}
                              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                              onClick={() => handleAppointmentClick(apt)}
                              data-testid={`clinic-appointment-${apt.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {apt.firstName} {apt.lastName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(apt.appointmentDate), convertDateFormat(dateFormat), { locale: fr })}
                                    {apt.startTime && ` - ${apt.startTime}`}
                                  </p>
                                </div>
                              </div>
                              <Badge className={statusConfig[apt.status as keyof typeof statusConfig]?.className}>
                                {statusConfig[apt.status as keyof typeof statusConfig]?.label}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Modals */}
      <ProfessionalBookingModal
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            setSelectedDate(undefined);
          }
        }}
        selectedDate={selectedDate}
      />

      <AppointmentDetailsModal
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
      />
    </DashboardLayout>
  );
}
