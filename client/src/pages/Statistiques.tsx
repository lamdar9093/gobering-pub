import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, DollarSign } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { Professional, Appointment, Patient } from "@shared/schema";

export default function Statistiques() {
  const [, setLocation] = useLocation();

  const { data: professional, isError } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/professional/appointments"],
    enabled: !!professional,
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/professional/patients"],
    enabled: !!professional,
  });

  if (isError) {
    setLocation("/login-professionnel");
    return null;
  }

  const isLoading = appointmentsLoading || patientsLoading;

  const confirmedAppointments = appointments.filter(a => a.status === "confirmed").length;
  const pendingAppointments = appointments.filter(a => a.status === "pending").length;
  const completedAppointments = appointments.filter(a => a.status === "completed").length;

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const appointmentsThisMonth = appointments.filter(a => {
    const date = new Date(a.appointmentDate);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  }).length;

  const newPatientsThisMonth = patients.filter(p => {
    if (!p.createdAt) return false;
    const date = new Date(p.createdAt);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  }).length;

  const stats = [
    {
      title: "Total Patients",
      value: patients.length,
      icon: Users,
      description: `+${newPatientsThisMonth} ce mois`,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "RV ce mois",
      value: appointmentsThisMonth,
      icon: Calendar,
      description: `${confirmedAppointments} confirmés`,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "RV Complétés",
      value: completedAppointments,
      icon: TrendingUp,
      description: `${pendingAppointments} en attente`,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Revenus estimés",
      value: "$0",
      icon: DollarSign,
      description: "Fonctionnalité à venir",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-page-title">Statistiques</h1>
          <p className="text-muted-foreground mt-2 text-xs">
            Vue d'ensemble de votre activité
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingAnimation />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {stat.title}
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid={`stat-${stat.title.toLowerCase().replace(/ /g, '-')}`}>
                        {stat.value}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Répartition des rendez-vous</CardTitle>
                  <CardDescription className="text-xs">
                    Par statut
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm">Confirmés</span>
                      </div>
                      <span className="text-sm font-medium" data-testid="stat-confirmed-appointments">
                        {confirmedAppointments}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-sm">En attente</span>
                      </div>
                      <span className="text-sm font-medium" data-testid="stat-pending-appointments">
                        {pendingAppointments}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm">Complétés</span>
                      </div>
                      <span className="text-sm font-medium" data-testid="stat-completed-appointments">
                        {completedAppointments}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Activité récente</CardTitle>
                  <CardDescription className="text-xs">
                    Vos derniers rendez-vous
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun rendez-vous pour le moment
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {appointments
                        .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
                        .slice(0, 5)
                        .map((appointment) => (
                          <div
                            key={appointment.id}
                            className="flex items-center justify-between text-sm"
                            data-testid={`recent-appointment-${appointment.id}`}
                          >
                            <div>
                              <p className="font-medium">{appointment.firstName} {appointment.lastName}</p>
                              <p className="text-muted-foreground text-xs">
                                {new Date(appointment.appointmentDate).toLocaleDateString('fr-CA')}
                              </p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs ${
                              appointment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              appointment.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {appointment.status === 'confirmed' ? 'Confirmé' :
                               appointment.status === 'pending' ? 'En attente' :
                               appointment.status === 'completed' ? 'Complété' : 
                               appointment.status}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
