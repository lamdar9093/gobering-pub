import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, User, Mail, Phone, Calendar, Pencil, Check, X, MapPin, CalendarX, CalendarClock, Home, Hash, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, addWeeks, startOfWeek, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { DatePicker } from "@/components/ui/date-picker";
import type { Professional, ProfessionalService } from "@shared/schema";
import { formatDateInTimeZone } from "@/lib/timezoneUtils";
import { formatTime } from "@/lib/timeUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";
import { TimeInput } from "@/components/TimeInput";
import type { TimeSlot, ProfessionalSchedule, ProfessionalBreak, Appointment } from "@shared/schema";
import { useTimeSlots } from "@/hooks/useTimeSlots";
import AvailabilitySelector from "@/components/AvailabilitySelector";

export default function PatientDetails() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/clients/:id");
  const patientId = params?.id;
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();

  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatientData, setEditedPatientData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    dateOfBirth: "",
    notes: "",
  });

  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<TimeSlot | null>(null);
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState<string>("");
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState<string | null>(null);
  const [rescheduleData, setRescheduleData] = useState({
    appointmentDate: "",
    startTime: "",
    endTime: "",
    professionalServiceId: "",
    targetProfessionalId: "",
    notes: "",
  });
  const [availabilityError, setAvailabilityError] = useState("");
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  const [showReadOnlyDialog, setShowReadOnlyDialog] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCreateSlot, setSelectedCreateSlot] = useState<TimeSlot | null>(null);
  const [selectedCreateDate, setSelectedCreateDate] = useState<string>("");
  const [selectedCreateTime, setSelectedCreateTime] = useState<string | null>(null);
  const [createMobileWeekOffset, setCreateMobileWeekOffset] = useState(0);
  const [createMobileSelectedDay, setCreateMobileSelectedDay] = useState<string>("");
  const [createData, setCreateData] = useState({
    professionalServiceId: "",
    targetProfessionalId: "",
    notes: "",
  });

  const { data: professional, isError } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const { data: patient, isLoading } = useQuery<any>({
    queryKey: ["/api/professional/patients", patientId],
    enabled: !!professional && !!patientId,
  });

  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: ["/api/professional/services"],
    enabled: !!professional,
  });

  const { data: clinicProfessionals = [] } = useQuery<any[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  const { data: allAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/professional/appointments"],
    enabled: !!professional,
  });

  const { data: schedules = [] } = useQuery<ProfessionalSchedule[]>({
    queryKey: ["/api/professional/schedules"],
    enabled: !!professional,
  });

  const { data: breaks = [] } = useQuery<ProfessionalBreak[]>({
    queryKey: ["/api/professional/breaks"],
    enabled: !!professional,
  });

  // Get user's role from clinic members
  const userRole = useMemo(() => {
    return clinicProfessionals.find((m: any) => m.professionalId === professional?.id)?.role || null;
  }, [clinicProfessionals, professional]);

  // Filter out secretaries from professional selection (secretaries are not healthcare professionals)
  // For regular professionals (non-Admin), only show themselves
  const healthcareProfessionals = useMemo(() => {
    const filtered = clinicProfessionals.filter((member: any) => member.role !== "Secrétaire");
    
    // If user is Admin or Secrétaire, show all healthcare professionals
    // Otherwise (regular professional), only show themselves
    if (userRole === "Admin" || userRole === "Secrétaire") {
      return filtered;
    }
    
    // Regular professional: only show themselves
    return filtered.filter((member: any) => member.professional?.id === professional?.id);
  }, [clinicProfessionals, professional, userRole]);

  // Generate time slots for the create appointment modal
  const selectedServiceId = createData.professionalServiceId;
  const selectedService = services.find(s => s.id === selectedServiceId);
  const serviceDuration = selectedService?.duration || 60;
  
  const createTimeSlots = useTimeSlots({
    selectedDate: selectedCreateDate || '',
    schedules: schedules,
    appointments: allAppointments,
    breaks: breaks,
    serviceDuration: serviceDuration,
  });

  // Generate time slots for the reschedule appointment modal
  const rescheduleServiceId = rescheduleData.professionalServiceId;
  const rescheduleService = services.find(s => s.id === rescheduleServiceId);
  const rescheduleDuration = rescheduleService?.duration || 60;
  
  const rescheduleTimeSlots = useTimeSlots({
    selectedDate: selectedRescheduleDate || '',
    schedules: schedules,
    appointments: allAppointments,
    breaks: breaks,
    serviceDuration: rescheduleDuration,
  });

  // Mobile week timeslots calculation for create modal
  const today = startOfDay(new Date());
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const createMobileWeekStart = addWeeks(currentWeekMonday, createMobileWeekOffset);
  const createMobileWeekEnd = addDays(createMobileWeekStart, 6);

  // Fetch timeslots for mobile week view (create modal)
  const { data: createMobileTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: [`/api/professionals/${createData.targetProfessionalId || professional?.id}/timeslots`, createMobileWeekStart, createMobileWeekEnd, createData.professionalServiceId],
    queryFn: async () => {
      const profId = createData.targetProfessionalId || professional?.id;
      if (!profId) return [];
      
      const params = new URLSearchParams({
        fromDate: createMobileWeekStart.toISOString(),
        toDate: createMobileWeekEnd.toISOString(),
      });
      
      if (createData.professionalServiceId) {
        params.append('professionalServiceId', createData.professionalServiceId);
      }
      
      const response = await fetch(
        `/api/professionals/${profId}/timeslots?${params.toString()}`
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: !!(createData.targetProfessionalId || professional?.id) && createModalOpen,
  });

  // Group mobile slots by date for create modal
  const createMobileSlotsByDate: Record<string, TimeSlot[]> = {};
  createMobileTimeSlots.forEach(slot => {
    const slotDate = new Date(slot.slotDate);
    const dateKey = format(slotDate, 'yyyy-MM-dd');
    const shouldIncludeSlot = createMobileWeekOffset > 0 || slotDate >= today;
    
    if (shouldIncludeSlot) {
      if (!createMobileSlotsByDate[dateKey]) {
        createMobileSlotsByDate[dateKey] = [];
      }
      createMobileSlotsByDate[dateKey].push(slot);
    }
  });

  // Generate mobile display days (Mon-Sun) for create modal
  const createMobileDisplayDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    createMobileDisplayDays.push(addDays(createMobileWeekStart, i));
  }

  // Auto-select first available day when create modal opens or when service/professional/week changes
  // Also validate that the currently selected slot still exists
  useEffect(() => {
    if (createModalOpen && createMobileDisplayDays.length > 0) {
      // First, check if the currently selected slot is still valid
      if (createMobileSelectedDay && selectedCreateTime) {
        const currentDaySlots = createMobileSlotsByDate[createMobileSelectedDay] || [];
        const slotStillExists = currentDaySlots.some(
          slot => slot.startTime === selectedCreateTime
        );
        
        if (!slotStillExists) {
          // Current selection is obsolete, clear it
          setSelectedCreateTime(null);
          setSelectedCreateSlot(null);
          setCreateMobileSelectedDay("");
        }
      }
      
      // Find first available day with slots
      const firstAvailableDay = createMobileDisplayDays.find(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const daySlots = createMobileSlotsByDate[dateKey] || [];
        return daySlots.length > 0 && day >= today;
      });

      if (firstAvailableDay) {
        const dateKey = format(firstAvailableDay, 'yyyy-MM-dd');
        // Auto-select if no day selected OR current selected day has no slots
        if (!createMobileSelectedDay || !createMobileSlotsByDate[createMobileSelectedDay]?.length) {
          setCreateMobileSelectedDay(dateKey);
          // Clear time selection when day changes
          setSelectedCreateTime(null);
          setSelectedCreateSlot(null);
        }
      }
    }
  }, [createModalOpen, createMobileWeekOffset, createMobileTimeSlots, createData.professionalServiceId, createData.targetProfessionalId]);

  // Handler for timeline slot selection in create modal (mobile)
  const handleCreateTimeSlotClick = (timeStr: string, endTimeStr: string) => {
    setSelectedCreateTime(timeStr);
    setSelectedCreateDate(createMobileSelectedDay);
    
    // Create a TimeSlot object for compatibility with existing logic
    setSelectedCreateSlot({
      id: `${createMobileSelectedDay}-${timeStr}`,
      professionalId: createData.targetProfessionalId || professional?.id || '',
      slotDate: new Date(createMobileSelectedDay),
      startTime: timeStr,
      endTime: endTimeStr,
      isBooked: false,
      createdAt: null,
    } as TimeSlot);
  };

  // Handler for timeline slot selection in reschedule modal
  const handleRescheduleTimeSlotClick = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    const endMinutes = minutes + rescheduleDuration;
    const endHours = hours + Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
    
    setSelectedRescheduleTime(timeStr);
    
    // Create a TimeSlot object for compatibility with existing logic
    const slot: TimeSlot = {
      id: `${selectedRescheduleDate}-${timeStr}`,
      professionalId: rescheduleData.targetProfessionalId || professional?.id || '',
      slotDate: new Date(selectedRescheduleDate),
      startTime: timeStr,
      endTime: endTimeStr,
      isBooked: false,
      createdAt: null,
    };
    
    setSelectedRescheduleSlot(slot);
    const appointmentDate = format(new Date(selectedRescheduleDate), 'yyyy-MM-dd');
    
    setRescheduleData({
      ...rescheduleData,
      appointmentDate,
      startTime: timeStr,
      endTime: endTimeStr,
    });
    setAvailabilityError("");
  };

  // Handler for AvailabilitySelector slot selection in create modal (desktop)
  const handleCreateSlotSelect = (slot: TimeSlot) => {
    setSelectedCreateSlot(slot);
    setSelectedCreateDate(format(new Date(slot.slotDate), 'yyyy-MM-dd'));
    setSelectedCreateTime(slot.startTime);
  };

  // Handler for AvailabilitySelector slot selection in reschedule modal (desktop)
  const handleRescheduleSlotSelect = (slot: TimeSlot) => {
    setSelectedRescheduleSlot(slot);
    setSelectedRescheduleDate(format(new Date(slot.slotDate), 'yyyy-MM-dd'));
    setSelectedRescheduleTime(slot.startTime);
    const appointmentDate = format(new Date(slot.slotDate), 'yyyy-MM-dd');
    
    setRescheduleData({
      ...rescheduleData,
      appointmentDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    setAvailabilityError("");
  };

  // Initialize editedPatientData when patient loads
  useEffect(() => {
    if (patient) {
      setEditedPatientData({
        firstName: patient.firstName || "",
        lastName: patient.lastName || "",
        email: patient.email || "",
        phone: patient.phone || "",
        address: patient.address || "",
        city: patient.city || "",
        postalCode: patient.postalCode || "",
        dateOfBirth: patient.dateOfBirth || "",
        notes: patient.notes || "",
      });
    }
  }, [patient]);

  const updatePatientMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/professional/patients/${patientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients", patientId] });
      setIsEditingPatient(false);
      toast({
        title: "Informations mises à jour",
        description: "Les informations du client ont été mises à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les informations",
        variant: "destructive",
      });
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!patient || !selectedCreateSlot) {
        throw new Error("Patient ou créneau non sélectionné");
      }

      const slotDate = new Date(selectedCreateSlot.slotDate);
      const appointmentDate = format(slotDate, 'yyyy-MM-dd');

      return await apiRequest("POST", "/api/professional/appointments/create-manual", {
        professionalId: data.targetProfessionalId || professional?.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        appointmentDate,
        startTime: selectedCreateSlot.startTime,
        endTime: selectedCreateSlot.endTime,
        serviceId: data.professionalServiceId && data.professionalServiceId.trim() !== '' ? data.professionalServiceId : undefined,
        notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
        status: "confirmed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const firstKey = key[0]?.toString() || '';
        return (
          (firstKey.startsWith('/api/professionals/') && firstKey.includes('/timeslots')) ||
          (firstKey === '/api/professionals' && key[2] === 'timeslots')
        );
      }});
      setCreateModalOpen(false);
      setSelectedCreateSlot(null);
      setCreateData({ professionalServiceId: "", targetProfessionalId: "", notes: "" });
      toast({
        title: "Rendez-vous créé",
        description: "Le rendez-vous a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      // Check if this is a read-only mode error
      if (error?.status === 403 && error?.data?.readOnlyMode) {
        setShowReadOnlyDialog(true);
        return;
      }
      
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le rendez-vous",
        variant: "destructive",
      });
    },
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      return await apiRequest("PATCH", `/api/professional/appointments/${appointmentId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const firstKey = key[0]?.toString() || '';
        return (
          (firstKey.startsWith('/api/professionals/') && firstKey.includes('/timeslots')) ||
          (firstKey === '/api/professionals' && key[2] === 'timeslots')
        );
      }});
      toast({
        title: "Rendez-vous annulé",
        description: "Le rendez-vous a été annulé avec succès et le client a été notifié par email",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le rendez-vous",
        variant: "destructive",
      });
    },
  });

  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, data }: { appointmentId: string; data: any }) => {
      const response = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error("Ce créneau n'est pas disponible. Veuillez choisir une autre date/heure.");
        }
        throw new Error(errorData.error || "Impossible de reporter le rendez-vous");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const firstKey = key[0]?.toString() || '';
        return (
          (firstKey.startsWith('/api/professionals/') && firstKey.includes('/timeslots')) ||
          (firstKey === '/api/professionals' && key[2] === 'timeslots')
        );
      }});
      setRescheduleModalOpen(false);
      setSelectedAppointment(null);
      setSelectedRescheduleSlot(null);
      setAvailabilityError("");
      toast({
        title: "Rendez-vous reporté",
        description: "Le rendez-vous a été reporté avec succès. L'ancien rendez-vous a été archivé.",
      });
    },
    onError: (error: any) => {
      setAvailabilityError(error.message);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de reporter le rendez-vous",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = () => {
    setIsEditingPatient(true);
  };

  const handleCancelEdit = () => {
    if (patient) {
      setEditedPatientData({
        firstName: patient.firstName || "",
        lastName: patient.lastName || "",
        email: patient.email || "",
        phone: patient.phone || "",
        address: patient.address || "",
        city: patient.city || "",
        postalCode: patient.postalCode || "",
        dateOfBirth: patient.dateOfBirth || "",
        notes: patient.notes || "",
      });
    }
    setIsEditingPatient(false);
  };

  const handleSavePatient = () => {
    updatePatientMutation.mutate(editedPatientData);
  };

  const handleCancelAppointment = (appointmentId: string) => {
    setAppointmentToCancel(appointmentId);
    setShowCancelConfirm(true);
  };

  const confirmCancelAppointment = () => {
    if (appointmentToCancel) {
      cancelAppointmentMutation.mutate(appointmentToCancel);
      setShowCancelConfirm(false);
      setAppointmentToCancel(null);
    }
  };

  const handleOpenReschedule = (appointment: any) => {
    setSelectedAppointment(appointment);
    setSelectedRescheduleSlot(null);
    setSelectedRescheduleTime(null);
    const appointmentDate = new Date(appointment.appointmentDate);
    setSelectedRescheduleDate(format(appointmentDate, "yyyy-MM-dd"));
    setRescheduleData({
      appointmentDate: format(appointmentDate, "yyyy-MM-dd"),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      professionalServiceId: appointment.professionalServiceId || "",
      targetProfessionalId: appointment.professionalId || "",
      notes: appointment.notes || "",
    });
    setAvailabilityError("");
    setRescheduleModalOpen(true);
  };

  const handleReschedule = () => {
    if (!selectedAppointment || !selectedRescheduleSlot) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un créneau horaire",
        variant: "destructive",
      });
      return;
    }

    rescheduleAppointmentMutation.mutate({
      appointmentId: selectedAppointment.id,
      data: rescheduleData,
    });
  };

  const handleOpenCreateModal = () => {
    setSelectedCreateSlot(null);
    setSelectedCreateTime(null);
    setSelectedCreateDate(format(new Date(), 'yyyy-MM-dd'));
    setCreateMobileWeekOffset(0); // Reset to current week
    setCreateMobileSelectedDay(""); // Clear selected day
    setCreateData({
      professionalServiceId: services.length > 0 ? services[0].id : "",
      targetProfessionalId: professional?.id || "",
      notes: "",
    });
    setCreateModalOpen(true);
  };

  const handleCreateAppointment = () => {
    if (!selectedCreateSlot) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un créneau horaire",
        variant: "destructive",
      });
      return;
    }

    // Additional validation: verify the selected slot still exists in the current timeslot data
    if (createMobileSelectedDay && selectedCreateTime) {
      const currentDaySlots = createMobileSlotsByDate[createMobileSelectedDay] || [];
      const slotStillExists = currentDaySlots.some(
        slot => slot.startTime === selectedCreateTime
      );
      
      if (!slotStillExists) {
        toast({
          title: "Créneau non disponible",
          description: "Ce créneau n'est plus disponible. Veuillez en sélectionner un autre.",
          variant: "destructive",
        });
        // Clear the obsolete selection
        setSelectedCreateSlot(null);
        setSelectedCreateTime(null);
        return;
      }
    }

    createAppointmentMutation.mutate(createData);
  };

  if (isError) {
    setLocation("/login-professionnel");
    return null;
  }

  const getStatusLabel = (status: string, cancelledBy?: string | null) => {
    if (status === 'cancelled') {
      if (cancelledBy === 'client') {
        return 'Annulé par le client';
      } else if (cancelledBy === 'professional') {
        return 'Annulé par le professionnel';
      }
      return 'Annulé';
    }
    
    const statusLabels: Record<string, string> = {
      confirmed: "Confirmé",
      pending: "En attente",
      draft: "Brouillon",
      completed: "Complété",
      rescheduled: "Reporté",
      "no-show": "Absent (no-show)",
    };
    return statusLabels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
      draft: "bg-gray-100 text-gray-800",
      completed: "bg-blue-100 text-blue-800",
      rescheduled: "bg-purple-100 text-purple-800",
      "no-show": "bg-orange-100 text-orange-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const canModifyAppointment = (appointment: any) => {
    return appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointment.status !== 'draft' && appointment.status !== 'rescheduled';
  };

  const filteredAppointments = patient?.appointments?.filter((appointment: any) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "confirmed") return appointment.status === "confirmed";
    if (statusFilter === "pending") return appointment.status === "pending";
    if (statusFilter === "cancelled") return appointment.status === "cancelled";
    if (statusFilter === "draft") return appointment.status === "draft";
    if (statusFilter === "rescheduled") return appointment.status === "rescheduled";
    return true;
  }) || [];

  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/clients")}
            data-testid="button-back-to-clients"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste des clients
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><LoadingAnimation /></div>
        ) : !patient ? (
          <div className="text-center py-12">Client non trouvé</div>
        ) : (
          <div className="space-y-6">
            {/* Patient Information Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-6 pb-5 border-b-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl md:text-2xl font-bold">Informations du client</CardTitle>
                  </div>
                  {!isEditingPatient ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStartEdit}
                      data-testid="button-edit-patient"
                      aria-label="Modifier"
                      className="h-11 w-11 bg-gray-50 hover:bg-gray-100 rounded-xl"
                    >
                      <Pencil className="h-5 w-5 text-blue-600" />
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCancelEdit}
                        data-testid="button-cancel-edit"
                        aria-label="Annuler"
                        className="h-11 w-11 bg-gray-50 hover:bg-gray-100 rounded-xl"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                      <Button
                        size="icon"
                        onClick={handleSavePatient}
                        disabled={updatePatientMutation.isPending}
                        data-testid="button-save-patient"
                        aria-label={updatePatientMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                        className="h-11 w-11 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl"
                      >
                        {updatePatientMutation.isPending ? (
                          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Prénom
                    </div>
                    {isEditingPatient ? (
                      <Input
                        value={editedPatientData.firstName}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, firstName: e.target.value })}
                        data-testid="input-edit-firstName"
                      />
                    ) : (
                      <div className="text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center" data-testid="text-patient-firstname">{patient.firstName}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Nom
                    </div>
                    {isEditingPatient ? (
                      <Input
                        value={editedPatientData.lastName}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, lastName: e.target.value })}
                        data-testid="input-edit-lastName"
                      />
                    ) : (
                      <div className="text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center" data-testid="text-patient-lastname">{patient.lastName}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                    {isEditingPatient ? (
                      <Input
                        type="email"
                        value={editedPatientData.email}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, email: e.target.value })}
                        data-testid="input-edit-email"
                      />
                    ) : (
                      <a href={`mailto:${patient.email}`} className="text-base font-medium text-blue-600 hover:text-blue-700 bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center block" data-testid="text-patient-email">
                        {patient.email}
                      </a>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      Téléphone
                    </div>
                    {isEditingPatient ? (
                      <Input
                        value={editedPatientData.phone}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, phone: e.target.value })}
                        data-testid="input-edit-phone"
                      />
                    ) : (
                      <a href={`tel:${patient.phone}`} className="text-base font-medium text-blue-600 hover:text-blue-700 bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center block" data-testid="text-patient-phone">
                        {patient.phone}
                      </a>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Date de naissance
                    </div>
                    {isEditingPatient ? (
                      <DatePicker
                        value={editedPatientData.dateOfBirth}
                        onChange={(value) => setEditedPatientData({ ...editedPatientData, dateOfBirth: value })}
                      />
                    ) : (
                      <div className={`text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center ${!patient.dateOfBirth ? 'text-gray-400' : ''}`} data-testid="text-patient-dateOfBirth">
                        {patient.dateOfBirth ? formatDateInTimeZone(new Date(patient.dateOfBirth), convertDateFormat(dateFormat), undefined, fr) : "-"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      Adresse
                    </div>
                    {isEditingPatient ? (
                      <Input
                        value={editedPatientData.address}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, address: e.target.value })}
                        data-testid="input-edit-address"
                      />
                    ) : (
                      <div className={`text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center ${!patient.address ? 'text-gray-400' : ''}`} data-testid="text-patient-address">{patient.address || "-"}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <Home className="h-4 w-4" />
                      Ville
                    </div>
                    {isEditingPatient ? (
                      <Input
                        value={editedPatientData.city}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, city: e.target.value })}
                        data-testid="input-edit-city"
                      />
                    ) : (
                      <div className={`text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center ${!patient.city ? 'text-gray-400' : ''}`} data-testid="text-patient-city">{patient.city || "-"}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <Hash className="h-4 w-4" />
                      Code postal
                    </div>
                    {isEditingPatient ? (
                      <Input
                        value={editedPatientData.postalCode}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, postalCode: e.target.value })}
                        data-testid="input-edit-postalCode"
                      />
                    ) : (
                      <div className={`text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[48px] flex items-center ${!patient.postalCode ? 'text-gray-400' : ''}`} data-testid="text-patient-postal-code">{patient.postalCode || "-"}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Notes
                    </div>
                    {isEditingPatient ? (
                      <Textarea
                        value={editedPatientData.notes}
                        onChange={(e) => setEditedPatientData({ ...editedPatientData, notes: e.target.value })}
                        rows={3}
                        data-testid="input-edit-notes"
                      />
                    ) : (
                      <div className={`text-base font-medium bg-gray-50 px-3.5 py-3 rounded-xl min-h-[80px] flex items-start leading-relaxed ${!patient.notes ? 'text-gray-400' : ''}`} data-testid="text-patient-notes">{patient.notes || "-"}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appointment History */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-xl md:text-2xl font-bold leading-tight">
                      Historique<br className="md:hidden" />
                      <span className="hidden md:inline"> </span>des rendez-vous
                    </CardTitle>
                  </div>
                  <Button
                    onClick={handleOpenCreateModal}
                    data-testid="button-add-appointment"
                    size="sm"
                    className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md whitespace-nowrap font-semibold"
                  >
                    Nouveau
                  </Button>
                </div>
                <CardDescription className="text-sm mb-4">
                  {filteredAppointments.length} sur {patient.appointments?.length || 0} rendez-vous
                </CardDescription>
                
                {/* Filtres horizontaux scrollables */}
                <div className="overflow-x-auto -mx-6 px-6 pb-1 scrollbar-hide">
                  <div className="flex gap-2 min-w-max">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
                      data-testid="filter-all"
                      className={statusFilter === "all" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" : ""}
                    >
                      Tous
                    </Button>
                    <Button
                      variant={statusFilter === "confirmed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setStatusFilter("confirmed"); setCurrentPage(1); }}
                      data-testid="filter-confirmed"
                      className={statusFilter === "confirmed" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" : ""}
                    >
                      Confirmés
                    </Button>
                    <Button
                      variant={statusFilter === "pending" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setStatusFilter("pending"); setCurrentPage(1); }}
                      data-testid="filter-pending"
                      className={statusFilter === "pending" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" : ""}
                    >
                      En attente
                    </Button>
                    <Button
                      variant={statusFilter === "rescheduled" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setStatusFilter("rescheduled"); setCurrentPage(1); }}
                      data-testid="filter-rescheduled"
                      className={statusFilter === "rescheduled" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" : ""}
                    >
                      Reportés
                    </Button>
                    <Button
                      variant={statusFilter === "cancelled" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setStatusFilter("cancelled"); setCurrentPage(1); }}
                      data-testid="filter-cancelled"
                      className={statusFilter === "cancelled" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" : ""}
                    >
                      Annulés
                    </Button>
                    <Button
                      variant={statusFilter === "draft" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setStatusFilter("draft"); setCurrentPage(1); }}
                      data-testid="filter-draft"
                      className={statusFilter === "draft" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" : ""}
                    >
                      Archives
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucun rendez-vous trouvé pour ce filtre
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {paginatedAppointments.map((appointment: any) => (
                        <div
                          key={appointment.id}
                          className="bg-white border rounded-lg p-4 space-y-3"
                          data-testid={`card-appointment-${appointment.id}`}
                        >
                          {/* Date & Time */}
                          <div className="flex items-center justify-between pb-3 border-b">
                            <div>
                              <div className="text-sm font-semibold text-gray-900" data-testid={`text-date-${appointment.id}`}>
                                {formatDateInTimeZone(
                                  typeof appointment.appointmentDate === 'string'
                                    ? new Date(appointment.appointmentDate)
                                    : appointment.appointmentDate,
                                  convertDateFormat(dateFormat),
                                  undefined,
                                  fr
                                )}
                              </div>
                              <div className="text-sm text-gray-600" data-testid={`text-time-${appointment.id}`}>
                                {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                              </div>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getStatusColor(appointment.status)}`} data-testid={`text-status-${appointment.id}`}>
                              {getStatusLabel(appointment.status, appointment.cancelledBy)}
                            </span>
                          </div>

                          {/* Beneficiary */}
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Pour</div>
                            <div className="text-sm" data-testid={`text-beneficiary-${appointment.id}`}>
                              {appointment.beneficiaryName ? (
                                <div>
                                  <div className="font-medium">{appointment.beneficiaryName}</div>
                                  {appointment.beneficiaryRelation && (
                                    <div className="text-xs text-gray-500">({appointment.beneficiaryRelation})</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-600">{patient.firstName} {patient.lastName}</span>
                              )}
                            </div>
                          </div>

                          {/* Service & Professional */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Service</div>
                              <div className="text-sm" data-testid={`text-service-${appointment.id}`}>
                                {appointment.serviceName || "-"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Professionnel</div>
                              <div className="text-sm" data-testid={`text-professional-${appointment.id}`}>
                                <div className="font-medium">{appointment.professionalFirstName} {appointment.professionalLastName}</div>
                                <div className="text-xs text-gray-500">
                                  {appointment.professionalProfessions && appointment.professionalProfessions.length > 0 
                                    ? appointment.professionalProfessions.join(', ') 
                                    : 'Profession non spécifiée'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {appointment.notes && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Notes</div>
                              <div className="text-sm" data-testid={`text-notes-${appointment.id}`}>
                                {appointment.notes}
                              </div>
                            </div>
                          )}

                          {/* Reschedule Info */}
                          {appointment.rescheduledBy && (
                            <div className="text-xs text-gray-500">
                              Reporté par {appointment.rescheduledBy === 'client' ? 'le client' : 'le professionnel'}
                            </div>
                          )}
                          {appointment.rescheduledFromId && appointment.status !== 'rescheduled' && (
                            <div className="text-xs text-purple-600">
                              Reporté depuis un autre rendez-vous
                            </div>
                          )}

                          {/* Actions */}
                          {canModifyAppointment(appointment) && (
                            <div className="flex gap-2 pt-3 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReschedule(appointment)}
                                data-testid={`button-reschedule-${appointment.id}`}
                                className="flex-1 px-2 sm:px-3"
                              >
                                <CalendarClock className="h-4 w-4 sm:mr-2 text-blue-600" />
                                <span className="hidden xs:inline sm:inline ml-1.5">Reporter</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelAppointment(appointment.id)}
                                data-testid={`button-cancel-${appointment.id}`}
                                className="flex-1 px-2 sm:px-3"
                              >
                                <CalendarX className="h-4 w-4 sm:mr-2 text-red-600" />
                                <span className="hidden xs:inline sm:inline ml-1.5">Annuler</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Heure</TableHead>
                            <TableHead>Pour</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Professionnel</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedAppointments.map((appointment: any) => (
                          <TableRow key={appointment.id} data-testid={`row-appointment-${appointment.id}`}>
                            <TableCell data-testid={`text-date-${appointment.id}`}>
                              {formatDateInTimeZone(
                                typeof appointment.appointmentDate === 'string'
                                  ? new Date(appointment.appointmentDate)
                                  : appointment.appointmentDate,
                                convertDateFormat(dateFormat),
                                undefined,
                                fr
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-time-${appointment.id}`}>
                              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                            </TableCell>
                            <TableCell data-testid={`text-beneficiary-${appointment.id}`}>
                              {appointment.beneficiaryName ? (
                                <div>
                                  <div>{appointment.beneficiaryName}</div>
                                  {appointment.beneficiaryRelation && (
                                    <div className="text-xs text-gray-500">({appointment.beneficiaryRelation})</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">{patient.firstName} {patient.lastName}</span>
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-service-${appointment.id}`}>
                              {appointment.serviceName || "-"}
                            </TableCell>
                            <TableCell data-testid={`text-professional-${appointment.id}`}>
                              {appointment.professionalFirstName} {appointment.professionalLastName}
                              <div className="text-xs text-gray-500">
                                {appointment.professionalProfessions && appointment.professionalProfessions.length > 0 
                                  ? appointment.professionalProfessions.join(', ') 
                                  : 'Profession non spécifiée'}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-status-${appointment.id}`}>
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getStatusColor(appointment.status)}`}>
                                  {getStatusLabel(appointment.status, appointment.cancelledBy)}
                                </span>
                                {appointment.rescheduledBy && (
                                  <span className="text-xs text-gray-500">
                                    Reporté par {appointment.rescheduledBy === 'client' ? 'le client' : 'le professionnel'}
                                  </span>
                                )}
                                {appointment.rescheduledFromId && appointment.status !== 'rescheduled' && (
                                  <span className="text-xs text-purple-600">
                                    Reporté depuis un autre rendez-vous
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-notes-${appointment.id}`}>
                              {appointment.notes || "-"}
                            </TableCell>
                            <TableCell>
                              {canModifyAppointment(appointment) && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenReschedule(appointment)}
                                    data-testid={`button-reschedule-${appointment.id}`}
                                    title="Reporter"
                                  >
                                    <CalendarClock className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCancelAppointment(appointment.id)}
                                    data-testid={`button-cancel-${appointment.id}`}
                                    title="Annuler"
                                  >
                                    <CalendarX className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Précédent
                      </Button>
                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Suivant
                      </Button>
                    </div>
                  )}
                </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reschedule Modal */}
        <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
          <DialogContent className="w-full rounded-none sm:max-w-4xl sm:rounded-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Reporter le rendez-vous</DialogTitle>
              <DialogDescription>
                Sélectionnez un nouveau créneau dans le calendrier du professionnel. L'ancien rendez-vous sera conservé dans l'historique.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedAppointment && (
                <>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Rendez-vous actuel :</strong> {format(new Date(selectedAppointment.appointmentDate), convertDateFormat(dateFormat), { locale: fr })} à {formatTime(selectedAppointment.startTime)}
                    </p>
                  </div>

                  {/* Mobile Timeline Format (hidden on desktop) */}
                  <div className="md:hidden bg-white rounded-2xl p-5 shadow-sm border">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <h2 className="text-base font-semibold text-gray-900">Choisir un nouveau créneau</h2>
                    </div>

                    {/* Date Picker */}
                    <div className="mb-3">
                      <DatePicker
                        value={selectedRescheduleDate}
                        onChange={(value) => {
                          setSelectedRescheduleDate(value);
                          setSelectedRescheduleTime(null);
                          setSelectedRescheduleSlot(null);
                        }}
                        placeholder="Sélectionner une date"
                        className="h-14 rounded-xl border-2 text-base font-medium text-gray-900"
                      />
                    </div>

                    {/* Time Slots Grid */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarClock className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-semibold text-gray-900">Sélectionnez l'heure</h3>
                      </div>

                      {(() => {
                        const availableTimeSlots = rescheduleTimeSlots.filter(slot => slot.available);
                        return availableTimeSlots.length === 0 ? (
                          <div className="text-center text-gray-500 py-6 text-sm">
                            {selectedRescheduleDate ? "Aucun créneau disponible pour cette date" : "Sélectionnez une date pour voir les créneaux disponibles"}
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {availableTimeSlots.map((slot) => (
                              <button
                                key={slot.time}
                                type="button"
                                onClick={() => handleRescheduleTimeSlotClick(slot.time)}
                                className={`
                                  h-10 rounded-lg font-medium text-sm text-white transition-all
                                  ${selectedRescheduleTime === slot.time
                                    ? 'bg-blue-600 shadow-md scale-105'
                                    : 'bg-blue-400 hover:bg-blue-500 hover:shadow-sm'
                                  }
                                `}
                                data-testid={`button-reschedule-timeslot-${slot.time}`}
                              >
                                {slot.time}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Selected Slot Info */}
                    {selectedRescheduleTime && selectedRescheduleDate && (
                      <div className="mt-4 bg-green-50 rounded-xl p-4 flex items-center gap-3">
                        <CalendarClock className="w-6 h-6 text-green-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-gray-600 mb-1">Nouveau créneau</div>
                          <div className="text-base font-semibold text-green-700">
                            {format(new Date(selectedRescheduleDate), convertDateFormat(dateFormat), { locale: fr })} à {selectedRescheduleTime}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop Week View (hidden on mobile) */}
                  <div className="hidden md:block">
                    <h3 className="font-semibold text-lg mb-3">Sélectionnez un nouveau créneau</h3>
                    <AvailabilitySelector
                      key={`${rescheduleData.targetProfessionalId}-${rescheduleData.professionalServiceId}`}
                      professionalId={rescheduleData.targetProfessionalId || selectedAppointment.professionalId}
                      onSlotSelect={handleRescheduleSlotSelect}
                      selectedSlotId={selectedRescheduleSlot?.id}
                      excludeAppointmentId={selectedAppointment.id}
                      professionalServiceId={rescheduleData.professionalServiceId}
                      excludeSlotDate={format(new Date(selectedAppointment.appointmentDate), 'yyyy-MM-dd')}
                      excludeSlotTime={selectedAppointment.startTime}
                      currentAppointmentProfessionalId={selectedAppointment.professionalId}
                    />
                    {selectedRescheduleSlot && (
                      <div className="bg-green-50 p-3 rounded-lg mt-3">
                        <p className="text-sm text-green-800">
                          <strong>Nouveau créneau :</strong> {format(new Date(selectedRescheduleSlot.slotDate), convertDateFormat(dateFormat), { locale: fr })} à {formatTime(selectedRescheduleSlot.startTime)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {healthcareProfessionals.length > 0 && (
                <div>
                  <Label htmlFor="reschedule-professional">Professionnel</Label>
                  <Select
                    value={rescheduleData.targetProfessionalId}
                    onValueChange={(value) => {
                      setRescheduleData({ ...rescheduleData, targetProfessionalId: value });
                      setSelectedRescheduleSlot(null);
                      setSelectedRescheduleTime(null);
                    }}
                  >
                    <SelectTrigger data-testid="select-reschedule-professional">
                      <SelectValue placeholder="Sélectionner un professionnel" />
                    </SelectTrigger>
                    <SelectContent>
                      {healthcareProfessionals.map((prof: any) => (
                        <SelectItem key={prof.professional.id} value={prof.professional.id}>
                          {prof.professional.firstName} {prof.professional.lastName} - {prof.professional.profession}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {services.length > 0 && (
                <div>
                  <Label htmlFor="reschedule-service">Service</Label>
                  <Select
                    value={rescheduleData.professionalServiceId}
                    onValueChange={(value) => {
                      setRescheduleData({ ...rescheduleData, professionalServiceId: value });
                      setSelectedRescheduleTime(null);
                    }}
                  >
                    <SelectTrigger data-testid="select-reschedule-service">
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="reschedule-notes">Notes</Label>
                <Textarea
                  id="reschedule-notes"
                  value={rescheduleData.notes}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, notes: e.target.value })}
                  placeholder="Notes..."
                  data-testid="textarea-reschedule-notes"
                />
              </div>
              {availabilityError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                  {availabilityError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRescheduleModalOpen(false)}
                data-testid="button-cancel-reschedule"
              >
                Annuler
              </Button>
              <Button
                onClick={handleReschedule}
                disabled={rescheduleAppointmentMutation.isPending}
                data-testid="button-confirm-reschedule"
              >
                {rescheduleAppointmentMutation.isPending ? "En cours..." : "Reporter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Appointment Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Nouveau rendez-vous pour {patient?.firstName} {patient?.lastName}</DialogTitle>
              <DialogDescription>
                Sélectionnez un créneau disponible dans le calendrier du professionnel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {healthcareProfessionals.length > 0 && (
                <div>
                  <Label htmlFor="create-professional">Professionnel</Label>
                  <Select
                    value={createData.targetProfessionalId}
                    onValueChange={(value) => {
                      setCreateData({ ...createData, targetProfessionalId: value });
                      setSelectedCreateSlot(null);
                      setSelectedCreateTime(null);
                      setCreateMobileSelectedDay(""); // Reset day selection
                    }}
                  >
                    <SelectTrigger data-testid="select-create-professional">
                      <SelectValue placeholder="Sélectionner un professionnel" />
                    </SelectTrigger>
                    <SelectContent>
                      {healthcareProfessionals.map((prof: any) => (
                        <SelectItem key={prof.professional.id} value={prof.professional.id}>
                          {prof.professional.firstName} {prof.professional.lastName} - {prof.professional.profession}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {services.length > 0 && (
                <div>
                  <Label htmlFor="create-service">Service</Label>
                  <Select
                    value={createData.professionalServiceId}
                    onValueChange={(value) => {
                      setCreateData({ ...createData, professionalServiceId: value });
                      setSelectedCreateTime(null);
                      setSelectedCreateSlot(null);
                      setCreateMobileSelectedDay(""); // Reset day selection
                    }}
                  >
                    <SelectTrigger data-testid="select-create-service">
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Mobile Week View (hidden on desktop) */}
              <div className="md:hidden space-y-3">
                {/* Week Selection Card */}
                <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                  <div className="bg-blue-500 px-3 py-2 flex items-center justify-between text-white">
                    <button
                      type="button"
                      onClick={() => setCreateMobileWeekOffset(Math.max(0, createMobileWeekOffset - 1))}
                      disabled={createMobileWeekOffset === 0}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-prev-week-create-mobile"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="font-semibold text-sm">
                      {createMobileWeekOffset === 0 ? "Cette semaine" : createMobileWeekOffset === 1 ? "La semaine prochaine" : "Dans plus d'une semaine"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCreateMobileWeekOffset(createMobileWeekOffset + 1)}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors"
                      data-testid="button-next-week-create-mobile"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-2">
                    <div className="grid gap-1.5 grid-cols-7">
                      {createMobileDisplayDays.map((day, index) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const daySlots = createMobileSlotsByDate[dateKey] || [];
                        const hasSlots = daySlots.length > 0;
                        const isSelected = createMobileSelectedDay === dateKey;
                        const isPast = day < today;
                        
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              if (!isPast) {
                                setCreateMobileSelectedDay(dateKey);
                              }
                            }}
                            disabled={isPast}
                            className={`p-2 rounded-lg text-center transition-all ${
                              isPast
                                ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-60'
                                : isSelected && hasSlots
                                ? 'bg-primary text-white'
                                : isSelected && !hasSlots
                                ? 'bg-primary text-white'
                                : !hasSlots
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-slate-50 hover:bg-slate-100'
                            }`}
                            data-testid={`button-day-create-mobile-${dateKey}`}
                          >
                            <div className="text-[10px] font-medium mb-0.5">
                              {format(day, "EEE", { locale: fr }).replace('.', '')}
                            </div>
                            <div className="text-lg font-bold leading-none">{format(day, "d", { locale: fr })}</div>
                            <div className="text-[9px] opacity-80 mt-0.5">{format(day, "MMM", { locale: fr }).replace('.', '')}</div>
                            {hasSlots && !isPast && (
                              <div className={`text-[10px] mt-0.5 font-semibold ${isSelected ? 'text-white' : 'text-primary'}`}>
                                {daySlots.length}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Time slots for selected day */}
                {createMobileSelectedDay && (() => {
                  const selectedDaySlots = createMobileSlotsByDate[createMobileSelectedDay] || [];
                  const hasSelectedDaySlots = selectedDaySlots.length > 0;
                  
                  if (!hasSelectedDaySlots) {
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                        <p className="text-sm text-gray-600">
                          Pas de disponibilité pour cette journée
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-white rounded-lg shadow border border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Sélectionnez l'heure
                        </h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedDaySlots.map((slot) => {
                          const isSelected = selectedCreateTime === slot.startTime && selectedCreateDate === createMobileSelectedDay;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              className={`px-3 py-2 text-sm font-medium text-white rounded transition-colors ${
                                isSelected
                                  ? 'bg-blue-700 ring-2 ring-blue-400'
                                  : 'bg-blue-500 hover:bg-blue-600'
                              }`}
                              onClick={() => handleCreateTimeSlotClick(slot.startTime, slot.endTime)}
                              data-testid={`button-create-slot-${slot.id}`}
                            >
                              {slot.startTime.slice(0, 5)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Selected Slot Info */}
                {selectedCreateTime && selectedCreateDate && (
                  <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
                    <CalendarClock className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-1">Créneau sélectionné</div>
                      <div className="text-base font-semibold text-blue-700">
                        {format(new Date(selectedCreateDate), convertDateFormat(dateFormat), { locale: fr })} à {selectedCreateTime}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Week View (hidden on mobile) */}
              <div className="hidden md:block">
                <h3 className="font-semibold text-lg mb-3">Sélectionnez un créneau</h3>
                <AvailabilitySelector
                  professionalId={createData.targetProfessionalId || professional?.id || ""}
                  onSlotSelect={handleCreateSlotSelect}
                  selectedSlotId={selectedCreateSlot?.id}
                  professionalServiceId={createData.professionalServiceId}
                />
                {selectedCreateSlot && (
                  <div className="bg-green-50 p-3 rounded-lg mt-3">
                    <p className="text-sm text-green-800">
                      <strong>Créneau sélectionné :</strong> {format(new Date(selectedCreateSlot.slotDate), convertDateFormat(dateFormat), { locale: fr })} à {formatTime(selectedCreateSlot.startTime)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="create-notes">Notes</Label>
                <Textarea
                  id="create-notes"
                  value={createData.notes}
                  onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                  placeholder="Notes..."
                  data-testid="textarea-create-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                data-testid="button-cancel-create"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateAppointment}
                disabled={createAppointmentMutation.isPending || !selectedCreateSlot}
                data-testid="button-confirm-create"
              >
                {createAppointmentMutation.isPending ? "En cours..." : "Créer le rendez-vous"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent data-testid="dialog-cancel-appointment-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer l'annulation</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir annuler ce rendez-vous ? Le client sera notifié par email.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-cancel">Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmCancelAppointment}
                data-testid="button-confirm-cancel"
                className="bg-red-600 hover:bg-red-700"
              >
                Confirmer l'annulation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showReadOnlyDialog} onOpenChange={setShowReadOnlyDialog}>
          <AlertDialogContent data-testid="dialog-readonly-mode">
            <AlertDialogHeader>
              <AlertDialogTitle>Compte en lecture seule</AlertDialogTitle>
              <AlertDialogDescription>
                Vous ne pouvez pas créer de rendez-vous car votre compte est en mode lecture seule.
                <br /><br />
                L'administrateur de votre clinique utilise actuellement le plan Gratuit qui permet 
                seulement 1 professionnel et 1 secrétaire actifs. Pour débloquer toutes les fonctionnalités, 
                demandez à l'administrateur de passer au plan PRO.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction 
                onClick={() => setShowReadOnlyDialog(false)}
                data-testid="button-close-readonly"
              >
                Compris
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
