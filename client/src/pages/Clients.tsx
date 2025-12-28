import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LoadingAnimation from "@/components/LoadingAnimation";
import {
  Search,
  Plus,
  ArrowUpDown,
  Info,
  Calendar,
  UserPlus,
  Phone,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import DashboardLayout from "@/components/DashboardLayout";
import { DatePicker } from "@/components/ui/date-picker";
import type { Professional, ClinicMember } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/timeUtils";
import {
  formatDateInTimeZone,
  getTodayInTimeZone,
  isSameDayInTimeZone,
} from "@/lib/timezoneUtils";
import { useDateFormat } from "@/hooks/useDateFormat";
import {
  convertDateFormat,
  formatDate as formatDateUtil,
} from "@/lib/dateFormatUtils";

const patientFormSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(1, "Le téléphone est requis"),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

const PROVINCES_CANADA = [
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "AB", label: "Alberta" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Territoires du Nord-Ouest" },
  { value: "NU", label: "Nunavut" },
];

type PatientFormValues = z.infer<typeof patientFormSchema>;

type SortField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "therapist"
  | "appointmentDate"
  | "status";
type SortDirection = "asc" | "desc";

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAppointmentPrompt, setShowAppointmentPrompt] = useState(false);
  const [newlyCreatedPatient, setNewlyCreatedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [sortField, setSortField] = useState<SortField>("appointmentDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();

  const { data: professional, isError } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch clinic members to determine user role
  const { data: members = [] } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  const userRole =
    members.find((m) => m.professionalId === professional?.id)?.role || null;
  const isSecretary = userRole === "Secrétaire";

  // Fetch assigned professionals for secretaries
  const { data: assignedProfessionals = [] } = useQuery<Professional[]>({
    queryKey: ["/api/secretary/assigned-professionals"],
    enabled: isSecretary,
  });

  // Fetch all clinic professionals for filter dropdown
  const { data: allClinicProfessionals = [] } = useQuery<Professional[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/professionals`],
    enabled: !!professional?.clinicId,
  });

  // State for selected professional (for secretaries)
  const [selectedProfessionalId, setSelectedProfessionalId] =
    useState<string>("");
  const hasRestoredRef = useRef(false);

  // Restore selection from localStorage once professional is loaded
  useEffect(() => {
    if (
      professional?.id &&
      isSecretary &&
      !selectedProfessionalId &&
      !hasRestoredRef.current &&
      assignedProfessionals.length > 0
    ) {
      const stored = localStorage.getItem(
        `secretary-selected-professional-${professional.id}`,
      );
      // Verify the stored professional is still in the assigned list
      if (stored && assignedProfessionals.some((p) => p.id === stored)) {
        setSelectedProfessionalId(stored);
        hasRestoredRef.current = true;
      } else if (stored) {
        // Stored professional is no longer assigned, clear it from localStorage
        localStorage.removeItem(
          `secretary-selected-professional-${professional.id}`,
        );
      }
    }
  }, [
    professional,
    isSecretary,
    selectedProfessionalId,
    assignedProfessionals,
  ]);

  // Validate current selection is still in assigned professionals
  useEffect(() => {
    if (isSecretary && selectedProfessionalId) {
      const isStillAssigned =
        assignedProfessionals.length > 0 &&
        assignedProfessionals.some((p) => p.id === selectedProfessionalId);
      if (!isStillAssigned) {
        // Current selection is no longer valid (removed or no assignments), reset
        hasRestoredRef.current = false;
        setSelectedProfessionalId("");
        if (professional?.id) {
          localStorage.removeItem(
            `secretary-selected-professional-${professional.id}`,
          );
        }
      }
    }
  }, [
    isSecretary,
    selectedProfessionalId,
    assignedProfessionals,
    professional,
  ]);

  // Persist selectedProfessionalId to localStorage
  useEffect(() => {
    if (selectedProfessionalId && professional?.id && isSecretary) {
      localStorage.setItem(
        `secretary-selected-professional-${professional.id}`,
        selectedProfessionalId,
      );
    }
  }, [selectedProfessionalId, professional, isSecretary]);

  // Set default selected professional when assignedProfessionals loads (only if no stored value was restored)
  useEffect(() => {
    if (
      isSecretary &&
      assignedProfessionals.length > 0 &&
      !selectedProfessionalId &&
      !hasRestoredRef.current
    ) {
      setSelectedProfessionalId(assignedProfessionals[0].id);
    }
  }, [isSecretary, assignedProfessionals, selectedProfessionalId]);

  const { data: patients = [], isLoading } = useQuery<any[]>({
    queryKey: isSecretary
      ? ["/api/secretary/clients", selectedProfessionalId]
      : ["/api/professional/patients"],
    queryFn: async () => {
      if (isSecretary && selectedProfessionalId) {
        const response = await fetch(
          `/api/secretary/clients?professionalId=${selectedProfessionalId}`,
          {
            credentials: "include",
          },
        );
        if (!response.ok) throw new Error("Failed to fetch clients");
        return response.json();
      } else {
        const response = await fetch("/api/professional/patients", {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch patients");
        return response.json();
      }
    },
    enabled: isSecretary ? !!selectedProfessionalId : !!professional,
  });

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      dateOfBirth: "",
      notes: "",
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (data: PatientFormValues) => {
      const payload =
        isSecretary && selectedProfessionalId
          ? { ...data, professionalId: selectedProfessionalId }
          : data;
      return await apiRequest("POST", "/api/professional/patients", payload);
    },
    onSuccess: (response: any) => {
      if (isSecretary && selectedProfessionalId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/secretary/clients", selectedProfessionalId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["/api/professional/patients"],
        });
      }
      toast({
        title: "Dossier créé",
        description: `Le dossier de ${response.firstName} ${response.lastName} a été créé avec succès`,
      });

      // Store the newly created patient info and show appointment prompt
      setNewlyCreatedPatient({
        id: response.id,
        firstName: response.firstName,
        lastName: response.lastName,
      });
      setShowCreateModal(false);
      setShowAppointmentPrompt(true);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le client",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PatientFormValues) => {
    createPatientMutation.mutate(data);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredPatients = patients.filter((patient) => {
    // Search filter
    const search = searchQuery.toLowerCase();
    const matchesSearch =
      patient.firstName?.toLowerCase().includes(search) ||
      patient.lastName?.toLowerCase().includes(search) ||
      patient.email?.toLowerCase().includes(search) ||
      patient.phone?.includes(search);
    if (!matchesSearch) return false;

    // Professional filter
    if (professionalFilter !== "all") {
      if (
        !patient.professionalId ||
        patient.professionalId !== professionalFilter
      ) {
        return false;
      }
    }

    // Status filter (check both nextAppointment and nextAppointments for robustness)
    if (statusFilter === "with-appointment") {
      const hasAppointment =
        patient.nextAppointment ||
        (patient.nextAppointments && patient.nextAppointments.length > 0);
      if (!hasAppointment) return false;
    } else if (statusFilter === "without-appointment") {
      const hasAppointment =
        patient.nextAppointment ||
        (patient.nextAppointments && patient.nextAppointments.length > 0);
      if (hasAppointment) return false;
    }

    return true;
  });

  // Reset page when search query or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, professionalFilter, statusFilter]);

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "firstName":
        aValue = a.firstName;
        bValue = b.firstName;
        break;
      case "lastName":
        aValue = a.lastName;
        bValue = b.lastName;
        break;
      case "email":
        aValue = a.email;
        bValue = b.email;
        break;
      case "phone":
        aValue = a.phone;
        bValue = b.phone;
        break;
      case "therapist":
        aValue = `${a.professionalFirstName || ""} ${a.professionalLastName || ""}`;
        bValue = `${b.professionalFirstName || ""} ${b.professionalLastName || ""}`;
        break;
      case "appointmentDate":
        aValue = a.nextAppointment?.appointmentDate || "";
        bValue = b.nextAppointment?.appointmentDate || "";
        break;
      case "status":
        aValue = a.nextAppointment?.status || "";
        bValue = b.nextAppointment?.status || "";
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatients = sortedPatients.slice(startIndex, endIndex);

  // Clamp currentPage when totalPages changes (e.g., professional switch, query change)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      pending: { label: "En attente", variant: "secondary" },
      confirmed: { label: "Confirmé", variant: "default" },
      scheduled: { label: "Planifié", variant: "default" },
      completed: { label: "Terminé", variant: "outline" },
      cancelled: { label: "Annulé", variant: "destructive" },
      "no-show": { label: "No-show", variant: "destructive" },
    };

    const config = statusConfig[status] || {
      label: status,
      variant: "secondary" as const,
    };
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return "-";

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const totalMinutes =
      endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
    }
    return `${totalMinutes}min`;
  };

  if (isError) {
    setLocation("/login-professionnel");
    return null;
  }

  return (
    <DashboardLayout
      professionalName={
        professional
          ? `Dr ${professional.firstName} ${professional.lastName}`
          : undefined
      }
    >
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-lg font-bold mb-1">Gestion des Clients</h1>
          <p className="text-muted-foreground text-xs">
            Gérez vos clients et consultez leur historique
          </p>
        </div>

        {/* Add Client Button */}
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => setShowCreateModal(true)}
            data-testid="button-add-patient"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un client
          </Button>
        </div>

        {isSecretary && assignedProfessionals.length === 0 && (
          <Alert variant="info" className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Aucun professionnel ne vous a été assigné. Veuillez contacter
              l'administrateur de votre clinique pour obtenir des accès aux
              clients.
            </AlertDescription>
          </Alert>
        )}

        {/* Professional selector for secretaries */}
        {isSecretary && assignedProfessionals.length > 0 && (
          <div className="mb-4">
            <label
              htmlFor="professional-select-clients"
              className="block text-sm font-medium mb-2"
            >
              Sélectionner un professionnel
            </label>
            <Select
              value={selectedProfessionalId}
              onValueChange={setSelectedProfessionalId}
            >
              <SelectTrigger
                id="professional-select-clients"
                className="w-full max-w-md"
                data-testid="select-professional-clients"
              >
                <SelectValue placeholder="Choisir un professionnel" />
              </SelectTrigger>
              <SelectContent>
                {assignedProfessionals.map((prof) => (
                  <SelectItem
                    key={prof.id}
                    value={prof.id}
                    data-testid={`option-professional-${prof.id}`}
                  >
                    {prof.firstName} {prof.lastName} -{" "}
                    {prof.professions && prof.professions.length > 0
                      ? prof.professions.join(", ")
                      : "Profession non spécifiée"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex gap-3 flex-col sm:flex-row">
          <div className="flex-1">
            <Select
              value={professionalFilter}
              onValueChange={setProfessionalFilter}
            >
              <SelectTrigger data-testid="select-filter-professional">
                <SelectValue placeholder="Filtrer par professionnel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-professional-all">
                  Tous les professionnels
                </SelectItem>
                {allClinicProfessionals.map((prof) => (
                  <SelectItem
                    key={prof.id}
                    value={prof.id}
                    data-testid={`option-professional-filter-${prof.id}`}
                  >
                    {prof.firstName} {prof.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-status-all">
                  Tous les statuts
                </SelectItem>
                <SelectItem
                  value="with-appointment"
                  data-testid="option-status-with"
                >
                  Avec rendez-vous
                </SelectItem>
                <SelectItem
                  value="without-appointment"
                  data-testid="option-status-without"
                >
                  Sans rendez-vous
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-patients"
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Total clients
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold">
                {filteredPatients.length}
              </div>
              {searchQuery && filteredPatients.length < patients.length && (
                <p className="text-sm text-muted-foreground mt-1">
                  sur {patients.length} au total
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Patients List */}
        {isLoading ? (
          <div className="text-center py-8">
            <LoadingAnimation />
          </div>
        ) : sortedPatients.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? "Aucun client trouvé"
                  : "Aucun client pour le moment"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="block md:hidden space-y-2">
              {paginatedPatients.map((patient) => {
                const nextAppts = patient.nextAppointments || [];
                return (
                  <Card
                    key={patient.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setLocation(`/clients/${patient.id}`)}
                    data-testid={`patient-card-${patient.id}`}
                  >
                    <CardContent className="p-3">
                      {/* Header: Name */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-sm">
                            {patient.firstName} {patient.lastName}
                          </h3>
                        </div>
                        {nextAppts.length > 0 && (
                          <Badge variant="default" className="ml-2">
                            {nextAppts.length} RDV
                          </Badge>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span>{patient.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{patient.email}</span>
                        </div>
                      </div>

                      {/* Next Appointment */}
                      {nextAppts.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Prochain rendez-vous
                              </p>
                              {nextAppts.slice(0, 2).map((appt: any) => (
                                <div key={appt.id} className="text-sm">
                                  <span className="font-medium">
                                    {formatDateInTimeZone(
                                      new Date(appt.appointmentDate),
                                      "d MMM yyyy",
                                      undefined,
                                      fr,
                                    )}
                                  </span>
                                  {appt.startTime && (
                                    <span className="text-muted-foreground ml-2">
                                      {formatTime(appt.startTime)}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {nextAppts.length > 2 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  +{nextAppts.length - 2} autre
                                  {nextAppts.length - 2 > 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop View - Table */}
            <Card className="hidden md:block">
              <CardContent className="p-0 text-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer h-9 py-2"
                          onClick={() => handleSort("firstName")}
                          data-testid="header-firstName"
                        >
                          <div className="flex items-center gap-1 text-xs">
                            Prénom
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer h-9 py-2"
                          onClick={() => handleSort("lastName")}
                          data-testid="header-lastName"
                        >
                          <div className="flex items-center gap-1 text-xs">
                            Nom
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer h-9 py-2"
                          onClick={() => handleSort("phone")}
                          data-testid="header-phone"
                        >
                          <div className="flex items-center gap-1 text-xs">
                            Téléphone
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer h-9 py-2"
                          onClick={() => handleSort("email")}
                          data-testid="header-email"
                        >
                          <div className="flex items-center gap-1 text-xs">
                            Email
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer h-9 py-2"
                          onClick={() => handleSort("appointmentDate")}
                          data-testid="header-lastAppointment"
                        >
                          <div className="flex items-center gap-1 text-xs">
                            Dernier RDV
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer h-9 py-2"
                          onClick={() => handleSort("appointmentDate")}
                          data-testid="header-nextAppointment"
                        >
                          <div className="flex items-center gap-1 text-xs">
                            Prochain RDV
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPatients.map((patient) => {
                        const nextAppt = patient.nextAppointment;
                        const lastAppt = patient.lastAppointment;
                        return (
                          <TableRow
                            key={patient.id}
                            data-testid={`patient-row-${patient.id}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() =>
                              setLocation(`/clients/${patient.id}`)
                            }
                          >
                            <TableCell
                              className="font-medium py-2"
                              data-testid={`cell-firstName-${patient.id}`}
                            >
                              {patient.firstName}
                            </TableCell>
                            <TableCell
                              className="font-medium py-2"
                              data-testid={`cell-lastName-${patient.id}`}
                            >
                              {patient.lastName}
                            </TableCell>
                            <TableCell className="py-2" data-testid={`cell-phone-${patient.id}`}>
                              {patient.phone}
                            </TableCell>
                            <TableCell className="py-2" data-testid={`cell-email-${patient.id}`}>
                              {patient.email}
                            </TableCell>
                            <TableCell
                              data-testid={`cell-lastAppointment-${patient.id}`}
                            >
                              {lastAppt ? (
                                <div>
                                  <div className="font-medium">
                                    {formatDateInTimeZone(
                                      new Date(lastAppt.appointmentDate),
                                      "d MMM yyyy",
                                      undefined,
                                      fr,
                                    )}
                                  </div>
                                  {lastAppt.startTime && (
                                    <div className="text-sm text-muted-foreground">
                                      {formatTime(lastAppt.startTime)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell
                              data-testid={`cell-nextAppointment-${patient.id}`}
                            >
                              {patient.nextAppointments &&
                              patient.nextAppointments.length > 0 ? (
                                <div className="space-y-1">
                                  {patient.nextAppointments.map(
                                    (appt: any, index: number) => (
                                      <div key={appt.id}>
                                        <div className="font-medium">
                                          {formatDateInTimeZone(
                                            new Date(appt.appointmentDate),
                                            "d MMM yyyy",
                                            undefined,
                                            fr,
                                          )}
                                        </div>
                                        {appt.startTime && (
                                          <div className="text-sm text-muted-foreground">
                                            {formatTime(appt.startTime)}
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Pagination Controls */}
        {!isLoading && sortedPatients.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Affichage de {startIndex + 1} à{" "}
              {Math.min(endIndex, sortedPatients.length)} sur{" "}
              {sortedPatients.length} clients
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                Précédent
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1);

                    if (!showPage) {
                      // Show ellipsis
                      if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return (
                          <span key={page} className="px-2">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        data-testid={`button-page-${page}`}
                      >
                        {page}
                      </Button>
                    );
                  },
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}

        {/* Create Patient Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-2xl max-h-screen md:max-h-[85vh] p-0 overflow-hidden flex flex-col">
            {/* Modern Header with Gradient */}
            <div className="gradient-bg px-6 py-5 md:py-8 text-white flex-shrink-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl md:text-2xl font-bold text-white">
                    Créer un dossier client
                  </DialogTitle>
                  <DialogDescription className="text-white/90 mt-1 text-sm md:text-base">
                    Ajouter le dossier d'un nouveau patient
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Jean"
                              data-testid="input-firstName"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Tremblay"
                              data-testid="input-lastName"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              {...field}
                              placeholder="jean.tremblay@exemple.com"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="514-555-1234"
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de naissance</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Sélectionner une date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="123 Rue Principale"
                            data-testid="input-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Montréal"
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="province"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Province</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-province">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PROVINCES_CANADA.map((province) => (
                                <SelectItem
                                  key={province.value}
                                  value={province.value}
                                >
                                  {province.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code postal</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="H1A 2B3"
                              data-testid="input-postalCode"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Informations supplémentaires..."
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateModal(false)}
                      data-testid="button-cancel"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={createPatientMutation.isPending}
                      data-testid="button-submit"
                    >
                      {createPatientMutation.isPending ? "Ajout..." : "Ajouter"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Appointment Prompt Dialog */}
        <Dialog
          open={showAppointmentPrompt}
          onOpenChange={setShowAppointmentPrompt}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Prendre rendez-vous ?
              </DialogTitle>
              <DialogDescription>
                Le dossier de {newlyCreatedPatient?.firstName}{" "}
                {newlyCreatedPatient?.lastName} a été créé avec succès.
                Souhaitez-vous prendre rendez-vous maintenant ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAppointmentPrompt(false);
                  setNewlyCreatedPatient(null);
                }}
                data-testid="button-later"
              >
                Plus tard
              </Button>
              <Button
                onClick={() => {
                  setShowAppointmentPrompt(false);
                  setLocation(`/dashboard?patient=${newlyCreatedPatient?.id}`);
                  setNewlyCreatedPatient(null);
                }}
                data-testid="button-book-now"
                className="gradient-button"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Prendre rendez-vous
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
