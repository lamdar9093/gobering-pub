import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Trash2,
  Edit,
  X,
  Plus,
  Check as CheckIcon,
  SquarePlus,
  MousePointerClick,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  Appointment,
  Professional,
  ProfessionalSchedule,
  ProfessionalBreak,
  ProfessionalService,
  ClinicMember,
} from "@shared/schema";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  parseISO,
  isSameDay,
  getDay,
  addDays,
  startOfDay,
  endOfDay,
  addMonths,
  startOfMonth,
  differenceInCalendarWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useDateFormat } from "@/hooks/useDateFormat";
import {
  convertDateFormat,
  convertTimeFormat,
  formatDateTimeInTz,
  formatDate,
} from "@/lib/dateFormatUtils";
import { TimeInput24h } from "@/components/TimeInput24h";
import DashboardLayout from "@/components/DashboardLayout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/timeUtils";
import {
  getTodayInTimeZone,
  getStartOfWeekInTimeZone,
  isSameDayInTimeZone,
  formatDateInTimeZone,
  utcToLocal,
} from "@/lib/timezoneUtils";
import { TimeInput } from "@/components/TimeInput";
import ProfessionalBookingModal from "@/components/ProfessionalBookingModal";
import { useTimeSlots } from "@/hooks/useTimeSlots";
import AvailabilitySelector from "@/components/AvailabilitySelector";
import type { TimeSlot } from "@shared/schema";

// Helper function to format appointment status with cancellation context
function formatAppointmentStatus(appointment: Appointment): string {
  switch (appointment.status) {
    case "confirmed":
      return "Confirmé";
    case "pending":
      return "En attente";
    case "cancelled":
      if (appointment.cancelledBy === "client") {
        return "Annulé par le client";
      } else if (appointment.cancelledBy === "professional") {
        return "Annulé par le professionnel";
      }
      return "Annulé";
    case "draft":
      return "Brouillon";
    case "completed":
      return "Complété";
    case "no-show":
      return "Absent (no-show)";
    default:
      return appointment.status;
  }
}

const appointmentFormSchema = z.object({
  serviceId: z.string().optional(),
  professionalId: z.string().min(1, "Le professionnel est requis"),
  appointmentDate: z.string().min(1, "La date est requise"),
  startTime: z.string().min(1, "L'heure de début est requise"),
  endTime: z.string().min(1, "L'heure de fin est requise"),
  notes: z.string().optional(),
  status: z.enum(["draft", "confirmed", "pending"]).default("confirmed"),
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  phone: z
    .string()
    .min(1, "Le numéro de téléphone est requis")
    .or(z.literal(""))
    .optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  clientNotes: z.string().optional(),
});

const unavailabilityFormSchema = z
  .object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().min(1, "L'heure de début est requise"),
    endTime: z.string().min(1, "L'heure de fin est requise"),
    type: z.string().default("unavailability"),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: "L'heure de fin doit être après l'heure de début",
      path: ["endTime"],
    },
  );

type ViewType = "day" | "week" | "month";
type MobileViewType = "calendar" | "day-list" | "column";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 to 21:00

export default function Calendrier() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();

  const {
    data: professional,
    isError,
    isLoading: isProfessionalLoading,
  } = useQuery<Professional>({
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
  const isAdmin = userRole === "Admin";
  const canSwitchProfessionals = isSecretary || isAdmin;

  // Fetch assigned professionals for secretaries
  const { data: assignedProfessionals = [] } = useQuery<Professional[]>({
    queryKey: ["/api/secretary/assigned-professionals"],
    enabled: isSecretary,
  });

  // Fetch all clinic professionals for admins
  const { data: clinicProfessionals = [] } = useQuery<Professional[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/professionals`],
    enabled: isAdmin && !!professional?.clinicId,
  });

  // State for selected professional (for secretaries and admins)
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

  // Set default selected professional when data loads (only if no stored value was restored)
  useEffect(() => {
    if (
      isSecretary &&
      assignedProfessionals.length > 0 &&
      !selectedProfessionalId &&
      !hasRestoredRef.current
    ) {
      setSelectedProfessionalId(assignedProfessionals[0].id);
    } else if (isAdmin && professional?.id && !selectedProfessionalId) {
      // For admins, default to their own calendar
      setSelectedProfessionalId(professional.id);
    }
  }, [
    isSecretary,
    isAdmin,
    assignedProfessionals,
    professional,
    selectedProfessionalId,
  ]);

  useEffect(() => {
    if (isError || (!professional && !isProfessionalLoading)) {
      setLocation("/login-professionnel");
    }
  }, [isError, professional, isProfessionalLoading, setLocation]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("week");
  const [selectedSlot, setSelectedSlot] = useState<{
    day: Date;
    hour: number;
  } | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showUnavailabilityForm, setShowUnavailabilityForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [selectedBreak, setSelectedBreak] = useState<ProfessionalBreak | null>(null);
  const [showBreakDetails, setShowBreakDetails] = useState(false);
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0);
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>("");
  const [timelineDate, setTimelineDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [showConfirmationSummary, setShowConfirmationSummary] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<z.infer<
    typeof appointmentFormSchema
  > | null>(null);
  const [mobileView, setMobileView] = useState<MobileViewType>("calendar");
  const [selectedDayForMobileViews, setSelectedDayForMobileViews] =
    useState<Date>(getTodayInTimeZone());

  // Detect mobile and set default view to "day-list" for mobile devices
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setMobileView("day-list");
    }
  }, []);
  const [showTimeSlotPicker, setShowTimeSlotPicker] = useState(false);
  const [selectedHourForSlotPicker, setSelectedHourForSlotPicker] = useState<{
    date: Date;
    hour: number;
  } | null>(null);

  // Modal state for mobile slot selection
  const [showMobileBookingModal, setShowMobileBookingModal] = useState(false);
  const [mobileSelectedSlot, setMobileSelectedSlot] = useState<{
    date: Date;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Read-only mode dialog state
  const [showReadOnlyDialog, setShowReadOnlyDialog] = useState(false);

  // Appointment limit reached dialog state
  const [showLimitReachedDialog, setShowLimitReachedDialog] = useState(false);

  const appointmentForm = useForm<z.infer<typeof appointmentFormSchema>>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      serviceId: "",
      professionalId: "",
      appointmentDate: "",
      startTime: "",
      endTime: "",
      notes: "",
      status: "confirmed",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      clientNotes: "",
    },
  });

  const unavailabilityForm = useForm<z.infer<typeof unavailabilityFormSchema>>({
    resolver: zodResolver(unavailabilityFormSchema),
    defaultValues: {
      dayOfWeek: 0,
      startTime: "",
      endTime: "",
      type: "unavailability",
    },
  });

  // Handle pre-selected patient from URL parameter (from client creation flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get("patient");

    if (patientId && !showAppointmentForm) {
      // Note: patientId field doesn't exist in appointmentFormSchema
      // This would need to be refactored to fetch patient data and pre-fill name/email/phone
      // appointmentForm.setValue("patientId", patientId);
      setShowAppointmentForm(true);

      // Clean up URL parameter after reading it
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [appointmentForm, showAppointmentForm]);

  // Determine which professional ID to use for queries
  const effectiveProfessionalId = canSwitchProfessionals
    ? selectedProfessionalId
    : professional?.id;

  // Determine which professional to display in the form
  const displayedProfessional =
    canSwitchProfessionals && selectedProfessionalId
      ? (isAdmin ? clinicProfessionals : assignedProfessionals).find(
          (p) => p.id === selectedProfessionalId,
        ) || professional
      : professional;

  const { data: allAppointments = [] } = useQuery<Appointment[]>({
    queryKey: isSecretary
      ? ["/api/secretary/appointments", selectedProfessionalId]
      : isAdmin && selectedProfessionalId !== professional?.id
        ? ["/api/secretary/appointments", selectedProfessionalId]
        : ["/api/professional/appointments"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[1]
        ? `${queryKey[0]}?professionalId=${queryKey[1]}`
        : (queryKey[0] as string);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok)
        throw new Error(
          `${res.status}: ${(await res.text()) || res.statusText}`,
        );
      return await res.json();
    },
    enabled: canSwitchProfessionals ? !!selectedProfessionalId : true,
  });

  // Filter out rescheduled appointments from calendar view (they still appear in history)
  const appointments = allAppointments.filter(
    (apt) => apt.status !== "rescheduled",
  );

  const { data: schedules = [] } = useQuery<ProfessionalSchedule[]>({
    queryKey: isSecretary
      ? ["/api/secretary/schedules", selectedProfessionalId]
      : isAdmin && selectedProfessionalId !== professional?.id
        ? ["/api/secretary/schedules", selectedProfessionalId]
        : ["/api/professional/schedules"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[1]
        ? `${queryKey[0]}?professionalId=${queryKey[1]}`
        : (queryKey[0] as string);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok)
        throw new Error(
          `${res.status}: ${(await res.text()) || res.statusText}`,
        );
      return await res.json();
    },
    enabled: canSwitchProfessionals ? !!selectedProfessionalId : true,
  });

  const { data: breaks = [] } = useQuery<ProfessionalBreak[]>({
    queryKey: isSecretary
      ? ["/api/secretary/breaks", selectedProfessionalId]
      : isAdmin && selectedProfessionalId !== professional?.id
        ? ["/api/secretary/breaks", selectedProfessionalId]
        : ["/api/professional/breaks"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[1]
        ? `${queryKey[0]}?professionalId=${queryKey[1]}`
        : (queryKey[0] as string);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok)
        throw new Error(
          `${res.status}: ${(await res.text()) || res.statusText}`,
        );
      return await res.json();
    },
    enabled: canSwitchProfessionals ? !!selectedProfessionalId : true,
  });

  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey:
      canSwitchProfessionals && selectedProfessionalId !== professional?.id
        ? ["/api/secretary/services", selectedProfessionalId]
        : ["/api/professional/services"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[1]
        ? `${queryKey[0]}?professionalId=${queryKey[1]}`
        : (queryKey[0] as string);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok)
        throw new Error(
          `${res.status}: ${(await res.text()) || res.statusText}`,
        );
      return await res.json();
    },
    enabled: canSwitchProfessionals
      ? !!selectedProfessionalId
      : !!professional && !isSecretary,
  });

  // Auto-select service based on count (when form opens)
  useEffect(() => {
    if (showAppointmentForm && !editingAppointment) {
      // Only auto-select on new appointments, not edits
      const currentServiceId = appointmentForm.getValues("serviceId");

      // Skip auto-selection if a service is already set (e.g., from quick booking)
      if (currentServiceId) {
        return;
      }

      if (services.length === 0) {
        appointmentForm.setValue("serviceId", "");
      } else if (services.length === 1) {
        appointmentForm.setValue("serviceId", services[0].id);
      } else if (services.length > 1) {
        // Pre-select first service only if none selected
        appointmentForm.setValue("serviceId", services[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAppointmentForm, editingAppointment, services]);

  const handlePrevious = () => {
    const newDate = subWeeks(currentDate, 1);
    setCurrentDate(newDate);
    
    // Update mobile day selection: select Monday of the new week
    const newWeekStart = getStartOfWeekInTimeZone(newDate);
    setSelectedDayForMobileViews(newWeekStart);
  };

  const handleNext = () => {
    const newDate = addWeeks(currentDate, 1);
    setCurrentDate(newDate);
    
    // Update mobile day selection: select Monday of the new week
    const newWeekStart = getStartOfWeekInTimeZone(newDate);
    setSelectedDayForMobileViews(newWeekStart);
  };

  const handleToday = () => {
    const today = getTodayInTimeZone();
    setCurrentDate(today);
    
    // When going to today, select today
    setSelectedDayForMobileViews(today);
  };

  const getVisibleDays = () => {
    const start = getStartOfWeekInTimeZone(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getDayTitle = () => {
    const start = getStartOfWeekInTimeZone(currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${format(start, "d MMM", { locale: fr })} - ${format(end, "d MMM yyyy", { locale: fr })}`;
  };

  const handleSlotClick = (day: Date, hour: number) => {
    setSelectedSlot({ day, hour });
    // Secretaries can only create appointments, not unavailabilities
    if (isSecretary) {
      handleCreateAppointment();
    } else {
      setShowEventDialog(true);
    }
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof appointmentFormSchema>) => {
      if (editingAppointment) {
        // Update existing appointment
        return await apiRequest(
          "PATCH",
          `/api/professional/appointments/${editingAppointment.id}`,
          data,
        );
      } else {
        // Create new appointment
        return await apiRequest(
          "POST",
          "/api/professional/appointments/create-manual",
          data,
        );
      }
    },
    onSuccess: (_, variables) => {
      // Close confirmation dialog and clear pending data
      setShowConfirmationSummary(false);
      setPendingAppointmentData(null);

      // Invalidate appropriate cache based on user role
      if (isSecretary && selectedProfessionalId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/secretary/appointments", selectedProfessionalId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["/api/professional/appointments"],
        });
      }

      let description = editingAppointment
        ? "Le rendez-vous a été modifié avec succès"
        : "Le rendez-vous a été ajouté à votre calendrier";

      // Only show notification message when creating new appointment (not editing)
      if (!editingAppointment) {
        const hasEmail = variables.email && variables.email.trim() !== "";
        const hasPhone = variables.phone && variables.phone.trim() !== "";

        if (hasEmail && hasPhone) {
          description =
            "Le rendez-vous a été créé avec succès. Le client a reçu une confirmation par email et SMS.";
        } else if (hasEmail) {
          description =
            "Le rendez-vous a été créé avec succès. Le client a reçu une confirmation par email.";
        } else if (hasPhone) {
          description =
            "Le rendez-vous a été créé avec succès. Le client a reçu une confirmation par SMS.";
        } else {
          description = "Le rendez-vous a été créé avec succès.";
        }
      }

      toast({
        title: editingAppointment ? "Rendez-vous modifié" : "Rendez-vous créé",
        description,
      });
      setShowAppointmentForm(false);
      setEditingAppointment(null);
      appointmentForm.reset();
    },
    onError: (error: any) => {
      // Close confirmation dialog
      setShowConfirmationSummary(false);
      setPendingAppointmentData(null);

      // Check if this is a read-only mode error
      if (error?.status === 403 && error?.data?.readOnlyMode) {
        setShowReadOnlyDialog(true);
        return;
      }

      // Check if this is an appointment limit reached error
      if (error?.status === 403 && error?.data?.limitReached) {
        setShowLimitReachedDialog(true);
        return;
      }

      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le rendez-vous",
        variant: "destructive",
      });
    },
  });

  const handleCreateAppointment = () => {
    const targetProfessionalId = isSecretary
      ? selectedProfessionalId
      : professional?.id;
    if (selectedSlot && targetProfessionalId) {
      setShowEventDialog(false);
      const startTime = `${selectedSlot.hour.toString().padStart(2, "0")}:00`;
      const endTime = `${(selectedSlot.hour + 1).toString().padStart(2, "0")}:00`;
      appointmentForm.reset({
        serviceId: "",
        professionalId: targetProfessionalId,
        appointmentDate: format(selectedSlot.day, "yyyy-MM-dd"),
        startTime,
        endTime,
        notes: "",
        status: "confirmed",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postalCode: "",
        clientNotes: "",
      });
      
      // Calculate week offset for mobile view
      const today = getTodayInTimeZone();
      const currentWeekStart = getStartOfWeekInTimeZone(today);
      const weekOffset = differenceInCalendarWeeks(selectedSlot.day, currentWeekStart, { weekStartsOn: 1 });
      setMobileWeekOffset(Math.max(0, weekOffset));
      
      // Pre-select the clicked day
      setMobileSelectedDay(format(selectedSlot.day, 'yyyy-MM-dd'));
      
      setShowAppointmentForm(true);
    }
  };

  const onSubmitAppointment = (data: z.infer<typeof appointmentFormSchema>) => {
    // Store the data and show confirmation summary
    setPendingAppointmentData(data);
    setShowConfirmationSummary(true);
  };

  const handleConfirmAppointment = () => {
    if (pendingAppointmentData) {
      createAppointmentMutation.mutate(pendingAppointmentData);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmationSummary(false);
    setPendingAppointmentData(null);
  };

  const createUnavailabilityMutation = useMutation({
    mutationFn: async (data: z.infer<typeof unavailabilityFormSchema>) => {
      return await apiRequest("POST", "/api/professional/breaks", data);
    },
    onSuccess: () => {
      // Invalidate appropriate cache based on user role
      if (isSecretary && selectedProfessionalId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/secretary/breaks", selectedProfessionalId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["/api/professional/breaks"],
        });
      }
      toast({
        title: "Indisponibilité créée",
        description: "La plage horaire a été marquée comme indisponible",
      });
      setShowUnavailabilityForm(false);
      unavailabilityForm.reset({
        dayOfWeek: 0,
        startTime: "",
        endTime: "",
        type: "unavailability",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'indisponibilité",
        variant: "destructive",
      });
    },
  });

  const handleCreateUnavailability = () => {
    if (selectedSlot) {
      setShowEventDialog(false);
      const dayOfWeek = getDay(selectedSlot.day);
      const startTime = `${selectedSlot.hour.toString().padStart(2, "0")}:00`;
      const endTime = `${(selectedSlot.hour + 1).toString().padStart(2, "0")}:00`;
      unavailabilityForm.reset({
        dayOfWeek,
        startTime,
        endTime,
        type: "unavailability",
      });
      setShowUnavailabilityForm(true);
    }
  };

  const onSubmitUnavailability = (
    data: z.infer<typeof unavailabilityFormSchema>,
  ) => {
    createUnavailabilityMutation.mutate(data);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  const handleBreakClick = (breakItem: ProfessionalBreak) => {
    setSelectedBreak(breakItem);
    setShowBreakDetails(true);
  };

  const visibleDays = getVisibleDays();
  const professionalName = professional
    ? `${professional.firstName} ${professional.lastName}`
    : undefined;

  // Generate time slots for the timeline view
  const selectedServiceId = appointmentForm.watch("serviceId");
  const selectedService = services.find((s) => s.id === selectedServiceId);
  const serviceDuration = selectedService?.duration || 60;

  const selectedDate = appointmentForm.watch("appointmentDate");

  const timeSlots = useTimeSlots({
    selectedDate: selectedDate || "",
    schedules: schedules,
    appointments: appointments,
    breaks: breaks,
    serviceDuration: serviceDuration,
  });

  // Mobile week timeslots calculation
  const today = startOfDay(new Date());
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const mobileWeekStart = addWeeks(currentWeekMonday, mobileWeekOffset);
  const mobileWeekEnd = addDays(mobileWeekStart, 6);

  // Fetch timeslots for mobile week view
  const { data: mobileTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: [
      `/api/professionals/${displayedProfessional?.id || professional?.id}/timeslots`,
      mobileWeekStart,
      mobileWeekEnd,
      selectedServiceId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: mobileWeekStart.toISOString(),
        toDate: mobileWeekEnd.toISOString(),
      });

      if (selectedServiceId) {
        params.append("professionalServiceId", selectedServiceId);
      }

      const response = await fetch(
        `/api/professionals/${displayedProfessional?.id || professional?.id}/timeslots?${params.toString()}`,
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: !!(displayedProfessional?.id || professional?.id),
  });

  // Group mobile slots by date
  const mobileSlotsByDate: Record<string, TimeSlot[]> = {};
  mobileTimeSlots.forEach((slot) => {
    const slotDate = new Date(slot.slotDate);
    const dateKey = format(slotDate, "yyyy-MM-dd");
    const slotDateOnly = startOfDay(slotDate);
    const todayDateOnly = startOfDay(today);
    const shouldIncludeSlot = mobileWeekOffset > 0 || slotDateOnly >= todayDateOnly;

    if (shouldIncludeSlot) {
      if (!mobileSlotsByDate[dateKey]) {
        mobileSlotsByDate[dateKey] = [];
      }
      mobileSlotsByDate[dateKey].push(slot);
    }
  });

  // Generate mobile display days (Mon-Sun)
  const mobileDisplayDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    mobileDisplayDays.push(addDays(mobileWeekStart, i));
  }

  // Auto-select first available day when form opens or week changes
  useEffect(() => {
    if (showAppointmentForm && mobileDisplayDays.length > 0) {
      // Find first day with available slots
      const firstAvailableDay = mobileDisplayDays.find((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const daySlots = mobileSlotsByDate[dateKey] || [];
        return daySlots.length > 0 && day >= today;
      });

      if (firstAvailableDay) {
        const dateKey = format(firstAvailableDay, "yyyy-MM-dd");
        // Only auto-select if no day is currently selected or the selected day has no slots
        if (
          !mobileSelectedDay ||
          !mobileSlotsByDate[mobileSelectedDay]?.length
        ) {
          setMobileSelectedDay(dateKey);
        }
      }
    }
  }, [showAppointmentForm, mobileWeekOffset, mobileTimeSlots.length]);

  // Handler for timeline slot selection (mobile)
  const handleTimeSlotClick = (timeStr: string) => {
    // Parse the time string
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Calculate end time based on service duration
    const endMinutes = minutes + serviceDuration;
    const endHours = hours + Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTimeStr = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

    // Update form fields
    appointmentForm.setValue("startTime", timeStr);
    appointmentForm.setValue("endTime", endTimeStr);
    setSelectedTimeSlot(timeStr);
  };

  // Handler for AvailabilitySelector slot selection (desktop)
  const handleSlotSelect = (slot: TimeSlot) => {
    const slotDate = format(new Date(slot.slotDate), "yyyy-MM-dd");

    // Update form fields
    appointmentForm.setValue("appointmentDate", slotDate);
    appointmentForm.setValue("startTime", slot.startTime);
    appointmentForm.setValue("endTime", slot.endTime);
    setSelectedTimeSlot(slot.startTime);
  };

  // Handler for clicking on "Disponible" in Day List View
  const handleAvailableSlotClick = (date: Date, hour: number) => {
    setSelectedHourForSlotPicker({ date, hour });
    setShowTimeSlotPicker(true);
  };

  // Handler for selecting a time slot from the picker dialog
  const handleTimeSlotSelection = (
    startTime: string,
    endTime: string,
    serviceId?: string,
  ) => {
    if (!selectedHourForSlotPicker) return;

    const targetProfessionalId = isSecretary
      ? selectedProfessionalId
      : professional?.id;

    if (!targetProfessionalId) return;

    const formattedDate = format(selectedHourForSlotPicker.date, "yyyy-MM-dd");

    // Calculate week offset for mobile view
    const today = getTodayInTimeZone();
    const currentWeekStart = getStartOfWeekInTimeZone(today);
    const weekOffset = differenceInCalendarWeeks(selectedHourForSlotPicker.date, currentWeekStart, { weekStartsOn: 1 });
    setMobileWeekOffset(Math.max(0, weekOffset));
    
    // Pre-select the clicked day
    setMobileSelectedDay(formattedDate);

    // Reset the form with the selected time slot and service (if provided)
    appointmentForm.reset({
      serviceId: serviceId || "",
      professionalId: targetProfessionalId,
      appointmentDate: formattedDate,
      startTime,
      endTime,
      notes: "",
      status: "confirmed",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      clientNotes: "",
    });

    setSelectedTimeSlot(startTime);
    setShowTimeSlotPicker(false);
    setSelectedHourForSlotPicker(null); // Clear selection
    setShowAppointmentForm(true);
  };

  if (isProfessionalLoading) {
    return (
      <DashboardLayout professionalName={professionalName}>
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout professionalName={professionalName}>
      <div className="p-8 max-w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-lg font-bold mb-4">Calendrier</h1>

          {isSecretary && assignedProfessionals.length === 0 && (
            <Alert variant="info" className="mb-6">
              <Info className="h-5 w-5" />
              <AlertDescription>
                Aucun professionnel ne vous a été assigné. Veuillez contacter
                l'administrateur de votre clinique pour obtenir des accès au
                calendrier.
              </AlertDescription>
            </Alert>
          )}

          {canSwitchProfessionals && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Calendrier de
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full max-w-md justify-between"
                    data-testid="button-select-professional"
                  >
                    {selectedProfessionalId
                      ? (() => {
                          const allProfessionals = isAdmin
                            ? clinicProfessionals
                            : assignedProfessionals;
                          const selectedProf = allProfessionals.find(
                            (p) => p.id === selectedProfessionalId,
                          );
                          return selectedProf
                            ? `${selectedProf.firstName} ${selectedProf.lastName}`
                            : "Sélectionner un professionnel";
                        })()
                      : "Sélectionner un professionnel"}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80" align="start">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                    Professionnels
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {(isAdmin
                      ? clinicProfessionals
                      : assignedProfessionals
                    ).map((prof) => (
                      <DropdownMenuItem
                        key={prof.id}
                        onClick={() => setSelectedProfessionalId(prof.id)}
                        data-testid={`option-professional-${prof.id}`}
                        className="flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span>
                            {prof.firstName} {prof.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {prof.professions && prof.professions.length > 0
                              ? prof.professions.join(", ")
                              : "Profession non spécifiée"}
                          </span>
                        </div>
                        {selectedProfessionalId === prof.id && (
                          <CheckIcon className="h-4 w-4 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="icon"
              data-testid="button-previous"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              data-testid="button-today"
              onClick={handleToday}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              data-testid="button-next"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2
            className="hidden md:block text-xl font-semibold mt-4"
            data-testid="text-current-period"
          >
            {getDayTitle()}
          </h2>
        </div>

        {/* Mobile View Toggle (md:hidden) */}
        <div className="md:hidden bg-white rounded-xl p-2 shadow-sm mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMobileView("calendar")}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                mobileView === "calendar"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-transparent text-gray-600 hover:bg-gray-50"
              }`}
              data-testid="button-view-calendar"
            >
              Calendrier
            </button>
            <button
              onClick={() => setMobileView("day-list")}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                mobileView === "day-list"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-transparent text-gray-600 hover:bg-gray-50"
              }`}
              data-testid="button-view-day-list"
            >
              Jour
            </button>
            <button
              onClick={() => setMobileView("column")}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                mobileView === "column"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-transparent text-gray-600 hover:bg-gray-50"
              }`}
              data-testid="button-view-column"
            >
              Colonne
            </button>
          </div>
        </div>

        {/* Desktop Week Agenda View (hidden md:block) */}
        <div className="hidden md:block">
          <WeekAgendaView
            visibleDays={visibleDays}
            appointments={appointments}
            schedules={schedules}
            breaks={breaks}
            onSlotClick={handleSlotClick}
            onAppointmentClick={handleAppointmentClick}
            onBreakClick={handleBreakClick}
          />
        </div>

        {/* Mobile Views (md:hidden) */}
        <div className="md:hidden">
          {mobileView === "calendar" && (
            <WeekAgendaView
              visibleDays={visibleDays}
              appointments={appointments}
              schedules={schedules}
              breaks={breaks}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              onBreakClick={handleBreakClick}
            />
          )}

          {mobileView === "day-list" && (
            <DayListView
              currentWeekStart={getStartOfWeekInTimeZone(currentDate)}
              selectedDay={selectedDayForMobileViews}
              onSelectDay={setSelectedDayForMobileViews}
              appointments={appointments}
              schedules={schedules}
              breaks={breaks}
              onAppointmentClick={handleAppointmentClick}
              onAvailableSlotClick={handleAvailableSlotClick}
              dateFormat={dateFormat}
              onPreviousWeek={handlePrevious}
              onNextWeek={handleNext}
              onToday={handleToday}
            />
          )}

          {mobileView === "column" && (
            <ColumnView
              currentWeekStart={getStartOfWeekInTimeZone(currentDate)}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
              dateFormat={dateFormat}
            />
          )}
        </div>

        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent
            className="max-w-[95vw] sm:max-w-[90vw] md:max-w-md p-4 sm:p-6"
            data-testid="dialog-add-event"
          >
            <DialogHeader>
              <DialogTitle className="text-xl">
                Ajouter un nouvel événement
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-center text-gray-700">
                Quel genre d'événement aimeriez-vous ajouter?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={handleCreateUnavailability}
                  data-testid="button-create-unavailability"
                >
                  Indisponible
                </Button>
                <Button
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
                  onClick={handleCreateAppointment}
                  data-testid="button-create-appointment"
                >
                  Rendez-vous
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showAppointmentForm}
          onOpenChange={setShowAppointmentForm}
        >
          <DialogContent
            className="w-full rounded-none sm:max-w-4xl sm:rounded-lg max-h-[90vh] overflow-y-auto p-0"
            data-testid="dialog-appointment-form"
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 sm:px-6 py-4 shadow-md">
              <h2 className="text-lg font-semibold">
                {editingAppointment
                  ? "Modifier le rendez-vous"
                  : "Nouveau rendez-vous"}
              </h2>
            </div>
            <Form {...appointmentForm}>
              <form
                onSubmit={appointmentForm.handleSubmit(onSubmitAppointment)}
                className="p-0"
              >
                {/* TIMELINE VIEW */}
                <div className="bg-gray-50">
                  {/* Professional Card */}
                  <div className="bg-white p-3 flex items-center gap-3 border-b">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                      {displayedProfessional?.firstName?.[0]}
                      {displayedProfessional?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">
                        {displayedProfessional?.firstName}{" "}
                        {displayedProfessional?.lastName}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {displayedProfessional?.professions &&
                        displayedProfessional.professions.length > 0
                          ? displayedProfessional.professions.join(", ")
                          : "Profession non spécifiée"}
                      </p>
                    </div>
                  </div>

                  {/* Choose Slot Section */}
                  <div className="p-3 space-y-3">
                    {/* Service Section - Show selector if multiple, info if single */}
                    {services.length === 1 && (
                      <div className="bg-blue-50 rounded-lg p-2.5 flex items-start gap-2.5">
                        <svg
                          className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-blue-900 mb-0.5">
                            Service sélectionné
                          </div>
                          <div className="text-sm text-blue-800">
                            {services[0].name} ({services[0].duration} min)
                          </div>
                        </div>
                      </div>
                    )}

                    {services.length > 1 && (
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2.5">
                          <svg
                            className="w-4 h-4 text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          </svg>
                          <h2 className="text-sm font-semibold text-gray-900">
                            Service
                          </h2>
                        </div>

                        <FormField
                          control={appointmentForm.control}
                          name="serviceId"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <SelectTrigger
                                    className="h-10 rounded-lg border-2 text-sm"
                                    data-testid="select-service"
                                  >
                                    <SelectValue placeholder="Sélectionner un service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {services.map((service) => (
                                      <SelectItem
                                        key={service.id}
                                        value={service.id}
                                      >
                                        {service.name} ({service.duration} min)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Mobile View (hidden on desktop) */}
                    <div className="md:hidden space-y-3">
                      {/* Week Selection Card */}
                      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                        <div className="bg-blue-500 px-3 py-2 flex items-center justify-between text-white">
                          <button
                            type="button"
                            onClick={() =>
                              setMobileWeekOffset(
                                Math.max(0, mobileWeekOffset - 1),
                              )
                            }
                            disabled={mobileWeekOffset === 0}
                            className="p-1.5 hover:bg-white/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="button-prev-week-mobile"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <h3 className="font-semibold text-sm">
                            {mobileWeekOffset === 0
                              ? "Cette semaine"
                              : mobileWeekOffset === 1
                                ? "La semaine prochaine"
                                : "Dans plus d'une semaine"}
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              setMobileWeekOffset(mobileWeekOffset + 1)
                            }
                            className="p-1.5 hover:bg-white/20 rounded transition-colors"
                            data-testid="button-next-week-mobile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-2">
                          <div className="grid gap-1.5 grid-cols-7">
                            {mobileDisplayDays.map((day, index) => {
                              const dateKey = format(day, "yyyy-MM-dd");
                              const daySlots = mobileSlotsByDate[dateKey] || [];
                              const hasSlots = daySlots.length > 0;
                              const isSelected = mobileSelectedDay === dateKey;
                              const isPast = day < today;

                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    if (!isPast) {
                                      setMobileSelectedDay(dateKey);
                                    }
                                  }}
                                  disabled={isPast}
                                  className={`p-2 rounded-lg text-center transition-all ${
                                    isPast
                                      ? "bg-slate-100 text-slate-500 cursor-not-allowed opacity-60"
                                      : isSelected && hasSlots
                                        ? "bg-primary text-white"
                                        : isSelected && !hasSlots
                                          ? "bg-primary text-white"
                                          : !hasSlots
                                            ? "bg-slate-100 text-slate-400"
                                            : "bg-slate-50 hover:bg-slate-100"
                                  }`}
                                  data-testid={`button-day-mobile-${dateKey}`}
                                >
                                  <div className="text-[10px] font-medium mb-0.5">
                                    {format(day, "EEE", { locale: fr }).replace(
                                      ".",
                                      "",
                                    )}
                                  </div>
                                  <div className="text-lg font-bold leading-none">
                                    {format(day, "d", { locale: fr })}
                                  </div>
                                  <div className="text-[9px] opacity-80 mt-0.5">
                                    {format(day, "MMM", { locale: fr }).replace(
                                      ".",
                                      "",
                                    )}
                                  </div>
                                  {hasSlots && !isPast && (
                                    <div
                                      className={`text-[10px] mt-0.5 font-semibold ${isSelected ? "text-white" : "text-primary"}`}
                                    >
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
                      {mobileSelectedDay &&
                        (() => {
                          const selectedDaySlots =
                            mobileSlotsByDate[mobileSelectedDay] || [];
                          const hasSelectedDaySlots =
                            selectedDaySlots.length > 0;

                          if (!hasSelectedDaySlots) {
                            return (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                                <p className="text-sm text-gray-600">
                                  Pas de disponibilité pour cette journée
                                </p>
                              </div>
                            );
                          }

                          const formDate =
                            appointmentForm.watch("appointmentDate");
                          const isSlotSelected = (slot: TimeSlot) => {
                            return (
                              selectedTimeSlot === slot.startTime &&
                              formDate === mobileSelectedDay
                            );
                          };

                          return (
                            <div className="bg-white rounded-lg shadow border border-slate-200 p-3">
                              <div className="flex items-center gap-2 mb-3">
                                <svg
                                  className="w-4 h-4 text-primary"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <h4 className="text-sm font-semibold text-gray-900">
                                  Sélectionnez l'heure
                                </h4>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {selectedDaySlots.map((slot) => {
                                  const isSelected = isSlotSelected(slot);
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
                                        isSelected
                                          ? "bg-blue-800 text-white ring-2 ring-blue-400"
                                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                      }`}
                                      onClick={() => {
                                        setMobileSelectedSlot({
                                          date: new Date(mobileSelectedDay),
                                          startTime: slot.startTime,
                                          endTime: slot.endTime,
                                        });
                                        setShowMobileBookingModal(true);
                                      }}
                                      data-testid={`button-slot-${slot.id}`}
                                    >
                                      {slot.startTime.slice(0, 5)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                    </div>

                    {/* Desktop Week View (hidden on mobile) */}
                    <div className="hidden md:block bg-white rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2.5">
                        <svg
                          className="w-4 h-4 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <h2 className="text-sm font-semibold text-gray-900">
                          Choisir un créneau
                        </h2>
                      </div>

                      <AvailabilitySelector
                        professionalId={
                          displayedProfessional?.id || professional?.id || ""
                        }
                        onSlotSelect={handleSlotSelect}
                        selectedSlotId={
                          selectedTimeSlot &&
                          appointmentForm.watch("appointmentDate")
                            ? `${appointmentForm.watch("appointmentDate")}-${selectedTimeSlot}`
                            : undefined
                        }
                        professionalServiceId={selectedServiceId}
                        initialDate={
                          selectedSlot
                            ? format(selectedSlot.day, "yyyy-MM-dd")
                            : undefined
                        }
                      />

                      {/* Selected Slot Info */}
                      {selectedTimeSlot && selectedDate && (
                        <div className="mt-4 bg-blue-50 rounded-xl p-4 flex items-center gap-3">
                          <svg
                            className="w-6 h-6 text-blue-500 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div className="flex-1">
                            <div className="text-xs text-gray-600 mb-1">
                              Rendez-vous sélectionné
                            </div>
                            <div className="text-base font-semibold text-blue-700">
                              {formatDate(
                                new Date(selectedDate),
                                convertDateFormat(dateFormat),
                              )}{" "}
                              à {selectedTimeSlot}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Client Information - Desktop only (Mobile uses popup) */}
                    <div className="hidden md:block bg-white rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <svg
                          className="w-5 h-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <h2 className="text-base font-semibold text-gray-900">
                          Informations client
                        </h2>
                      </div>

                      {/* All fields in single column */}
                      <div className="space-y-4">
                        <FormField
                          control={appointmentForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                Prénom <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <svg
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                  </svg>
                                  <Input
                                    {...field}
                                    className="h-12 pl-12 rounded-xl border-2"
                                    placeholder="Jean"
                                    data-testid="input-timeline-firstname"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={appointmentForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                Nom <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <svg
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                  </svg>
                                  <Input
                                    {...field}
                                    className="h-12 pl-12 rounded-xl border-2"
                                    placeholder="Dupont"
                                    data-testid="input-timeline-lastname"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={appointmentForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                Courriel (optionnel)
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                  <Input
                                    type="email"
                                    {...field}
                                    className="h-12 pl-12 rounded-xl border-2"
                                    placeholder="jean.dupont@email.com"
                                    data-testid="input-timeline-email"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={appointmentForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                Téléphone (optionnel)
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    className="h-12 pl-12 rounded-xl border-2"
                                    placeholder="+1 514-123-4567"
                                    data-testid="input-timeline-phone"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Confirm Button - Desktop only (Mobile uses popup) */}
                    <Button
                      type="submit"
                      disabled={createAppointmentMutation.isPending}
                      className="hidden md:block w-full h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg text-base"
                      data-testid="button-confirm-timeline"
                    >
                      {createAppointmentMutation.isPending
                        ? "Enregistrement..."
                        : "Confirmer le rendez-vous"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Summary Dialog */}
        <Dialog
          open={showConfirmationSummary}
          onOpenChange={handleCancelConfirmation}
        >
          <DialogContent
            className="w-full rounded-none sm:max-w-lg sm:rounded-lg"
            data-testid="dialog-confirmation-summary"
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">
                Récapitulatif du rendez-vous
              </DialogTitle>
            </DialogHeader>

            {pendingAppointmentData && (
              <div className="space-y-4">
                {/* Service */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <h3 className="font-semibold text-gray-900">Service</h3>
                  </div>
                  <p className="text-gray-700 ml-7">
                    {services.find(
                      (s) => s.id === pendingAppointmentData.serviceId,
                    )?.name || "Service non spécifié"}
                  </p>
                </div>

                {/* Date & Time */}
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="font-semibold text-gray-900">
                      Date et heure
                    </h3>
                  </div>
                  <p className="text-gray-700 ml-7">
                    {formatDate(
                      new Date(pendingAppointmentData.appointmentDate),
                      convertDateFormat(dateFormat),
                    )}
                  </p>
                  <p className="text-gray-700 ml-7 font-semibold">
                    {formatTime(pendingAppointmentData.startTime)} -{" "}
                    {formatTime(pendingAppointmentData.endTime)}
                  </p>
                </div>

                {/* Client Information */}
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-5 h-5 text-purple-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <h3 className="font-semibold text-gray-900">
                      Informations client
                    </h3>
                  </div>
                  <div className="ml-7 space-y-1">
                    <p className="text-gray-700">
                      <span className="font-medium">Nom:</span>{" "}
                      {pendingAppointmentData.firstName}{" "}
                      {pendingAppointmentData.lastName}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Courriel:</span>{" "}
                      {pendingAppointmentData.email}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Téléphone:</span>{" "}
                      {pendingAppointmentData.phone}
                    </p>
                  </div>
                </div>

                {/* Notes (if any) */}
                {pendingAppointmentData.notes && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-5 h-5 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                      <h3 className="font-semibold text-gray-900">Notes</h3>
                    </div>
                    <p className="text-gray-700 ml-7">
                      {pendingAppointmentData.notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelConfirmation}
                    className="flex-1 h-12 rounded-xl border-2"
                    data-testid="button-cancel-confirmation"
                  >
                    Retour
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmAppointment}
                    disabled={createAppointmentMutation.isPending}
                    className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg"
                    data-testid="button-final-confirm"
                  >
                    {createAppointmentMutation.isPending
                      ? "Enregistrement..."
                      : "Confirmer"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={showUnavailabilityForm}
          onOpenChange={setShowUnavailabilityForm}
        >
          <DialogContent
            className="sm:max-w-md"
            data-testid="dialog-unavailability-form"
          >
            <DialogHeader>
              <DialogTitle className="text-xl">
                Marquer comme indisponible
              </DialogTitle>
            </DialogHeader>
            <Form {...unavailabilityForm}>
              <form
                onSubmit={unavailabilityForm.handleSubmit(
                  onSubmitUnavailability,
                )}
                className="space-y-4"
              >
                <p className="text-sm text-gray-600">
                  Cette indisponibilité sera ajoutée de manière récurrente
                  chaque semaine pour ce jour.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={unavailabilityForm.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heure de début</FormLabel>
                        <FormControl>
                          <TimeInput
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-unavailability-starttime"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={unavailabilityForm.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heure de fin</FormLabel>
                        <FormControl>
                          <TimeInput
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-unavailability-endtime"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowUnavailabilityForm(false)}
                    data-testid="button-cancel-unavailability"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUnavailabilityMutation.isPending}
                    data-testid="button-submit-unavailability"
                  >
                    {createUnavailabilityMutation.isPending
                      ? "Création..."
                      : "Créer"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AppointmentDetailsModal
          open={showAppointmentDetails}
          onOpenChange={setShowAppointmentDetails}
          appointment={selectedAppointment}
          professional={professional}
          isEditing={isEditingAppointment}
          isSecretary={isSecretary}
          selectedProfessionalId={selectedProfessionalId}
          dateFormat={dateFormat}
          onEditToggle={(editing) => {
            if (editing && selectedAppointment) {
              // Close details modal and open appointment form with existing data
              setShowAppointmentDetails(false);
              setEditingAppointment(selectedAppointment);

              // Pre-fill the form with appointment data
              const dateValue = selectedAppointment.appointmentDate as
                | string
                | Date;
              const appointmentDate =
                typeof dateValue === "string"
                  ? dateValue.split("T")[0]
                  : format(dateValue, "yyyy-MM-dd");

              appointmentForm.reset({
                serviceId: selectedAppointment.professionalServiceId || "",
                professionalId: selectedAppointment.professionalId || "",
                appointmentDate,
                startTime: selectedAppointment.startTime || "",
                endTime: selectedAppointment.endTime || "",
                notes: selectedAppointment.notes || "",
                status:
                  selectedAppointment.status === "confirmed" ||
                  selectedAppointment.status === "pending" ||
                  selectedAppointment.status === "draft"
                    ? selectedAppointment.status
                    : "confirmed",
                firstName: selectedAppointment.firstName,
                lastName: selectedAppointment.lastName,
                email: selectedAppointment.email || "",
                phone: selectedAppointment.phone || "",
                address: "",
                city: "",
                postalCode: "",
                clientNotes: "",
              });

              setShowAppointmentForm(true);
            } else {
              setIsEditingAppointment(editing);
            }
          }}
        />

        {/* Break/Unavailability Details Modal */}
        <Dialog open={showBreakDetails} onOpenChange={setShowBreakDetails}>
          <DialogContent className="max-w-md" data-testid="dialog-break-details">
            <DialogHeader>
              <DialogTitle>
                {selectedBreak?.type === "break" ? "Pause" : "Indisponibilité"}
              </DialogTitle>
            </DialogHeader>
            {selectedBreak && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Jour:</span>{" "}
                    {["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][selectedBreak.dayOfWeek]}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Horaire:</span>{" "}
                    {formatTime(selectedBreak.startTime)} - {formatTime(selectedBreak.endTime)}
                  </p>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={async () => {
                      if (!selectedBreak?.id) return;
                      try {
                        await apiRequest("DELETE", `/api/professional/breaks/${selectedBreak.id}`, {});
                        queryClient.invalidateQueries({
                          queryKey: ["/api/professional/breaks"],
                        });
                        toast({
                          title: selectedBreak.type === "break" ? "Pause supprimée" : "Indisponibilité supprimée",
                          description: "La modification a été enregistrée",
                        });
                        setShowBreakDetails(false);
                      } catch (error) {
                        toast({
                          title: "Erreur",
                          description: "Impossible de supprimer",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-delete-break"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowBreakDetails(false)}
                    data-testid="button-close-break"
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <TimeSlotPickerDialog
          open={showTimeSlotPicker}
          onOpenChange={(open) => {
            setShowTimeSlotPicker(open);
            if (!open) {
              setSelectedHourForSlotPicker(null);
            }
          }}
          selectedHour={selectedHourForSlotPicker}
          appointments={appointments}
          breaks={breaks}
          professional={professional}
          services={services}
          onSlotSelect={handleTimeSlotSelection}
          dateFormat={dateFormat}
        />

        <ProfessionalBookingModal
          open={showMobileBookingModal}
          onOpenChange={(open) => {
            setShowMobileBookingModal(open);
            if (!open) {
              setMobileSelectedSlot(null);
            }
          }}
          selectedDate={mobileSelectedSlot?.date}
          selectedStartTime={mobileSelectedSlot?.startTime}
          selectedEndTime={mobileSelectedSlot?.endTime}
        />

        {/* Read-only mode dialog */}
        <AlertDialog
          open={showReadOnlyDialog}
          onOpenChange={setShowReadOnlyDialog}
        >
          <AlertDialogContent data-testid="dialog-readonly-mode">
            <AlertDialogHeader>
              <AlertDialogTitle>Compte en lecture seule</AlertDialogTitle>
              <AlertDialogDescription>
                Vous ne pouvez pas créer de rendez-vous car votre compte est en
                mode lecture seule.
                <br />
                <br />
                L'administrateur de votre clinique utilise actuellement le plan
                Gratuit qui permet seulement 1 professionnel et 1 secrétaire
                actifs. Pour débloquer toutes les fonctionnalités, demandez à
                l'administrateur de passer au plan PRO.
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

        {/* Appointment limit reached dialog */}
        <AlertDialog
          open={showLimitReachedDialog}
          onOpenChange={setShowLimitReachedDialog}
        >
          <AlertDialogContent
            data-testid="dialog-limit-reached"
            className="max-w-md"
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl flex items-center gap-2">
                🎯 Limite atteinte !
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                <p className="text-base">
                  Vous avez atteint la limite de <strong>100 rendez-vous</strong>{" "}
                  du plan Gratuit.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    📅 Réinitialisation
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Votre compteur se réinitialisera le{" "}
                    <strong>
                      {format(
                        startOfMonth(addMonths(new Date(), 1)),
                        "d MMMM yyyy",
                        { locale: fr },
                      )}
                    </strong>
                  </p>
                </div>
                <p className="text-base">
                  💎 Passez au plan <strong>PRO</strong> pour profiter de
                  rendez-vous <strong>illimités</strong>, des notifications SMS,
                  et bien plus encore !
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel
                onClick={() => setShowLimitReachedDialog(false)}
                data-testid="button-close-limit"
                className="mt-0"
              >
                Compris
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowLimitReachedDialog(false);
                  setLocation("/dashboard/parametres/abonnement");
                }}
                data-testid="button-upgrade-to-pro"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                ✨ Passer au PRO
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

interface TimeSlotPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHour: { date: Date; hour: number } | null;
  appointments: Appointment[];
  breaks: ProfessionalBreak[];
  professional: Professional | undefined;
  services: ProfessionalService[];
  onSlotSelect: (
    startTime: string,
    endTime: string,
    serviceId?: string,
  ) => void;
  dateFormat: string;
}

function TimeSlotPickerDialog({
  open,
  onOpenChange,
  selectedHour,
  appointments,
  breaks,
  professional,
  services,
  onSlotSelect,
  dateFormat,
}: TimeSlotPickerDialogProps) {
  const [selectedService, setSelectedService] =
    useState<ProfessionalService | null>(null);
  const [showServiceSelection, setShowServiceSelection] = useState(true);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedService(null);
      setShowServiceSelection(true);
    }
  }, [open]);

  // Prepare data for API fetch (must be before early return to respect hooks rules)
  const dayStart = selectedHour ? startOfDay(selectedHour.date) : new Date();
  const dayEnd = selectedHour ? endOfDay(selectedHour.date) : new Date();

  // Determine if we need to show service selection
  const hasServices = services.length > 0;
  const shouldShowServices =
    hasServices && showServiceSelection && !selectedService;

  // Fetch time slots from API for the selected date
  const { data: allDaySlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: [
      `/api/professionals/${professional?.id}/timeslots`,
      dayStart,
      dayEnd,
      selectedService?.id,
    ],
    queryFn: async () => {
      if (!professional?.id) return [];
      
      const params = new URLSearchParams({
        fromDate: dayStart.toISOString(),
        toDate: dayEnd.toISOString(),
      });

      if (selectedService?.id) {
        params.append("professionalServiceId", selectedService.id);
      }

      const response = await fetch(
        `/api/professionals/${professional.id}/timeslots?${params.toString()}`,
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: open && !shouldShowServices && !!professional?.id && !!selectedHour,
  });

  // Early return after all hooks
  if (!selectedHour || !professional) return null;

  const { date, hour } = selectedHour;

  // Filter slots to only show those that start within the clicked hour
  const availableSlots = allDaySlots.filter((slot) => {
    const [slotHour] = slot.startTime.split(":").map(Number);
    return slotHour === hour;
  });

  const handleServiceSelect = (service: ProfessionalService) => {
    setSelectedService(service);
    setShowServiceSelection(false);
  };

  const handleSlotSelect = (startTime: string, endTime: string) => {
    onSlotSelect(startTime, endTime, selectedService?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[80vh]"
        data-testid="dialog-time-slot-picker"
      >
        <DialogHeader>
          <DialogTitle>
            {shouldShowServices ? "Choisir un service" : "Choisir un créneau"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {shouldShowServices ? (
            <>
              <div className="mb-3 text-sm text-gray-600">
                Sélectionnez d'abord le service pour voir les créneaux
                disponibles
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="w-full px-4 py-3 text-left bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-colors"
                    data-testid={`button-service-${service.id}`}
                  >
                    <div className="font-medium text-gray-900">
                      {service.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {service.duration} min
                      {service.price &&
                        ` • ${(service.price / 100).toFixed(2)} $`}
                    </div>
                    {service.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {service.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-sm text-gray-600">
                  {formatDate(date, convertDateFormat(dateFormat))} à partir de{" "}
                  {hour}h
                </div>
                {selectedService && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700">
                      Service: {selectedService.name} (
                      {selectedService.duration} min)
                    </span>
                    {hasServices && (
                      <button
                        onClick={() => {
                          setSelectedService(null);
                          setShowServiceSelection(true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                        data-testid="button-change-service"
                      >
                        Changer
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isLoading ? (
                <div className="text-center py-6 text-gray-500">
                  Chargement des créneaux...
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  Aucun créneau disponible pour cette heure
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() =>
                        handleSlotSelect(slot.startTime, slot.endTime)
                      }
                      className="px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 font-medium transition-colors"
                      data-testid={`button-slot-${slot.id}`}
                    >
                      {slot.startTime} - {slot.endTime}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WeekAgendaView({
  visibleDays,
  appointments,
  schedules,
  breaks,
  onSlotClick,
  onAppointmentClick,
  onBreakClick,
}: {
  visibleDays: Date[];
  appointments: Appointment[];
  schedules: ProfessionalSchedule[];
  breaks: ProfessionalBreak[];
  onSlotClick: (day: Date, hour: number) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onBreakClick?: (breakItem: ProfessionalBreak) => void;
}) {
  // Helper function to check if a time slot is within working hours
  const isWithinWorkingHours = (day: Date, hour: number): boolean => {
    const dayOfWeek = getDay(day);

    const daySchedule = schedules.find(
      (s) => s.dayOfWeek === dayOfWeek && s.isAvailable,
    );
    if (!daySchedule) return false;

    const startHour = parseInt(daySchedule.startTime.split(":")[0]);
    const endHour = parseInt(daySchedule.endTime.split(":")[0]);

    return hour >= startHour && hour < endHour;
  };

  // Helper function to get the break at a specific time slot
  const getBreakAtSlot = (
    day: Date,
    hour: number,
  ): ProfessionalBreak | null => {
    const dayOfWeek = getDay(day);

    const dayBreak = breaks.find((b) => {
      if (b.dayOfWeek !== dayOfWeek) return false;
      const startHour = parseInt(b.startTime.split(":")[0]);
      const endHour = parseInt(b.endTime.split(":")[0]);
      return hour >= startHour && hour < endHour;
    });

    return dayBreak || null;
  };

  // Helper function to get appointments for a specific time slot
  const getAppointmentsForSlot = (day: Date, hour: number): Appointment[] => {
    return appointments.filter((apt) => {
      if (apt.status === "draft") return false;

      const aptDate =
        typeof apt.appointmentDate === "string"
          ? parseISO(apt.appointmentDate)
          : apt.appointmentDate;

      const localAptDate = utcToLocal(aptDate);

      if (!isSameDayInTimeZone(localAptDate, day)) return false;
      if (!apt.startTime) return false;

      const aptHour = parseInt(apt.startTime.split(":")[0]);
      return aptHour === hour;
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header with days */}
            <div className="grid grid-cols-8 border-b bg-gray-50">
              <div className="p-2 border-r">
                <div className="text-xs font-semibold text-gray-600">
                  Toute la journée
                </div>
              </div>
              {visibleDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className="p-2 border-r last:border-r-0"
                >
                  <div className="text-[11px] text-gray-500 capitalize">
                    {format(day, "EEE", { locale: fr })}. {format(day, "dd/MM")}
                  </div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-gray-300 dark:border-gray-700 last:border-b-0"
              >
                {/* Hour label */}
                <div className="p-1.5 border-r bg-gray-50 flex items-start justify-end">
                  <span className="text-xs text-gray-600">{`${hour.toString().padStart(2, "0")}:00`}</span>
                </div>

                {/* Day cells */}
                {visibleDays.map((day) => {
                  const isWorking = isWithinWorkingHours(day, hour);
                  const breakAtSlot = getBreakAtSlot(day, hour);
                  const slotAppointments = getAppointmentsForSlot(day, hour);

                  const isBreakPause = breakAtSlot?.type === "break";
                  const isUnavailable = breakAtSlot?.type === "unavailability";

                  // Check if the slot is in the past
                  const today = getTodayInTimeZone();
                  const isPastDate =
                    day < today && !isSameDayInTimeZone(day, today);
                  // Allow clicking on slots during working hours that are not past dates and not breaks/unavailability
                  const isClickable =
                    isWorking &&
                    !isPastDate &&
                    !breakAtSlot;

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      data-testid={`slot-${format(day, "yyyy-MM-dd")}-${hour}`}
                      onClick={() => isClickable && onSlotClick(day, hour)}
                      className={`
                        min-h-[45px] p-1 border-r last:border-r-0 relative
                        ${isClickable ? "cursor-pointer hover:bg-blue-50" : "cursor-not-allowed"} transition-colors
                        ${!isWorking ? "bg-gray-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)]" : ""}
                        ${isPastDate && isWorking ? "opacity-60" : ""}
                        ${isBreakPause && isWorking ? "bg-green-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(34,197,94,0.1)_5px,rgba(34,197,94,0.1)_10px)]" : ""}
                        ${isUnavailable && isWorking ? "bg-amber-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(251,191,36,0.1)_5px,rgba(251,191,36,0.1)_10px)]" : ""}
                      `}
                    >
                      {/* Time subdivisions - dotted lines every 15 minutes */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="h-1/4 border-b border-dotted border-gray-200 dark:border-gray-600"></div>
                        <div className="h-1/4 border-b border-dotted border-gray-200 dark:border-gray-600"></div>
                        <div className="h-1/4 border-b border-dotted border-gray-200 dark:border-gray-600"></div>
                        <div className="h-1/4"></div>
                      </div>

                      {isBreakPause && isWorking && breakAtSlot && (
                        <div 
                          className="text-[11px] text-green-700 font-medium relative z-10 px-1 cursor-pointer hover:bg-green-200/50 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBreakClick?.(breakAtSlot);
                          }}
                          data-testid={`break-${breakAtSlot.id}`}
                        >
                          <div className="font-semibold">
                            {formatTime(breakAtSlot.startTime)} -{" "}
                            {formatTime(breakAtSlot.endTime)}
                          </div>
                          <div>Pause</div>
                        </div>
                      )}
                      {isUnavailable && isWorking && breakAtSlot && (
                        <div 
                          className="text-[11px] text-amber-700 font-medium relative z-10 px-1 cursor-pointer hover:bg-amber-200/50 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBreakClick?.(breakAtSlot);
                          }}
                          data-testid={`unavailability-${breakAtSlot.id}`}
                        >
                          <div className="font-semibold">
                            {formatTime(breakAtSlot.startTime)} -{" "}
                            {formatTime(breakAtSlot.endTime)}
                          </div>
                          <div>Indisponible</div>
                        </div>
                      )}
                      {isWorking &&
                        !isBreakPause &&
                        !isUnavailable &&
                        slotAppointments.map((apt) => {
                          const isCancelled = apt.status === "cancelled";
                          const isNoShow = apt.status === "no-show";

                          return (
                            <div
                              key={apt.id}
                              data-testid={`appointment-${apt.id}`}
                              className={`
                              rounded px-1.5 py-0.5 text-[11px] mb-0.5 cursor-pointer transition-colors relative z-10
                              ${
                                isCancelled
                                  ? "bg-gray-400 text-gray-700 line-through"
                                  : isNoShow
                                    ? "bg-orange-400 text-white"
                                    : "bg-blue-500 text-white hover:bg-blue-600"
                              }
                            `}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick(apt);
                              }}
                            >
                              <div className="font-semibold">
                                {formatTime(apt.startTime)} -{" "}
                                {formatTime(apt.endTime)}
                              </div>
                              <div className="truncate">
                                {apt.beneficiaryName ||
                                  `${apt.firstName} ${apt.lastName}`}
                              </div>
                              {apt.beneficiaryName && (
                                <div className="text-[9px] opacity-90 truncate">
                                  Par: {apt.firstName} {apt.lastName}
                                </div>
                              )}
                              {isCancelled && (
                                <div className="text-[9px] mt-0.5">
                                  {apt.cancelledBy === "client"
                                    ? "Annulé par client"
                                    : "Annulé par pro"}
                                </div>
                              )}
                              {isNoShow && (
                                <div className="text-[9px] mt-0.5">
                                  Non-présenté
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AppointmentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  professional: Professional | undefined;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
  isSecretary: boolean;
  selectedProfessionalId: string;
  dateFormat: string;
}

const editAppointmentSchema = z.object({
  professionalServiceId: z.string().optional(),
  appointmentDate: z.string().min(1, "La date est requise"),
  startTime: z.string().min(1, "L'heure de début est requise"),
  endTime: z.string().min(1, "L'heure de fin est requise"),
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(1, "Le téléphone est requis"),
  notes: z.string().optional(),
  status: z.string(),
});

function AppointmentDetailsModal({
  open,
  onOpenChange,
  appointment,
  professional,
  isEditing,
  onEditToggle,
  isSecretary,
  selectedProfessionalId,
  dateFormat,
}: AppointmentDetailsModalProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch services
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: ["/api/professional/services"],
    enabled: open && !!professional?.id,
  });

  // Fetch clinic members if in a clinic
  const { data: clinicMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/clinics", professional?.clinicId, "members"],
    enabled: open && !!professional?.clinicId,
  });

  const editForm = useForm<z.infer<typeof editAppointmentSchema>>({
    resolver: zodResolver(editAppointmentSchema),
    defaultValues: {
      professionalServiceId: "",
      appointmentDate: "",
      startTime: "",
      endTime: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      status: "confirmed",
    },
  });

  // Update form when appointment changes or editing starts
  useEffect(() => {
    if (appointment && isEditing) {
      const dateValue = appointment.appointmentDate as string | Date;
      const appointmentDate =
        typeof dateValue === "string"
          ? dateValue.split("T")[0]
          : format(dateValue, "yyyy-MM-dd");

      editForm.reset({
        professionalServiceId: appointment.professionalServiceId || "",
        appointmentDate,
        startTime: appointment.startTime || "",
        endTime: appointment.endTime || "",
        firstName: appointment.firstName,
        lastName: appointment.lastName,
        email: appointment.email || "",
        phone: appointment.phone || "",
        notes: appointment.notes || "",
        status: appointment.status,
      });
    }
  }, [appointment, isEditing, editForm]);

  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editAppointmentSchema>) => {
      if (!appointment) return;
      return await apiRequest(
        "PATCH",
        `/api/professional/appointments/${appointment.id}`,
        data,
      );
    },
    onSuccess: () => {
      // Invalidate appropriate cache based on user role
      if (isSecretary && selectedProfessionalId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/secretary/appointments", selectedProfessionalId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["/api/professional/appointments"],
        });
      }
      toast({
        title: "Rendez-vous modifié",
        description: "Le rendez-vous a été modifié avec succès",
      });
      onEditToggle(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rendez-vous",
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) return;
      return await apiRequest(
        "DELETE",
        `/api/professional/appointments/${appointment.id}`,
        {},
      );
    },
    onSuccess: () => {
      // Invalidate appropriate cache based on user role
      if (isSecretary && selectedProfessionalId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/secretary/appointments", selectedProfessionalId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["/api/professional/appointments"],
        });
      }
      toast({
        title: "Rendez-vous supprimé",
        description: "Le rendez-vous a été supprimé avec succès",
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le rendez-vous",
        variant: "destructive",
      });
    },
  });

  if (!appointment) return null;

  const handleClose = () => {
    onOpenChange(false);
    onEditToggle(false);
  };

  const handleEdit = () => {
    if (appointment) {
      // Open the same appointment form used for creation but pre-filled with appointment data
      onOpenChange(false);
      onEditToggle(true);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteAppointmentMutation.mutate();
  };

  const handleSubmitEdit = (data: z.infer<typeof editAppointmentSchema>) => {
    updateAppointmentMutation.mutate(data);
  };

  const appointmentDate =
    typeof appointment.appointmentDate === "string"
      ? parseISO(appointment.appointmentDate)
      : appointment.appointmentDate;

  if (isEditing) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-blue-600 text-white -mx-6 -mt-6 px-6 py-4 mb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Éditer rendez-vous</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="text-white hover:bg-blue-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleSubmitEdit)}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Détails du rendez-vous
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="professionalServiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {services.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date/heure de début</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              className="flex-1"
                            />
                          </FormControl>
                          <TimeInput24h
                            value={editForm.watch("startTime")}
                            onChange={(value) =>
                              editForm.setValue("startTime", value)
                            }
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Professionnel *</FormLabel>
                    <div className="text-sm py-2 px-3 bg-gray-100 rounded-md">
                      {professional?.firstName} {professional?.lastName}
                    </div>
                  </FormItem>

                  <FormField
                    control={editForm.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date/heure de fin</FormLabel>
                        <div className="flex gap-2">
                          <div className="flex-1 text-sm py-2 px-3 bg-gray-100 rounded-md">
                            {editForm.watch("appointmentDate")
                              ? formatDate(
                                  new Date(editForm.watch("appointmentDate")),
                                  convertDateFormat(dateFormat),
                                )
                              : "-"}
                          </div>
                          <TimeInput24h
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Commentaires</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Brouillon</SelectItem>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="confirmed">Confirmé</SelectItem>
                            <SelectItem value="completed">Complété</SelectItem>
                            <SelectItem value="no-show">
                              Absent (no-show)
                            </SelectItem>
                            <SelectItem value="cancelled">Annulé</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Informations client
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <Input disabled className="bg-gray-100" />
                  </FormItem>

                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <Input disabled className="bg-gray-100" />
                  </FormItem>

                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Code postal</FormLabel>
                    <Input disabled className="bg-gray-100" />
                  </FormItem>

                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro de téléphone *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEditToggle(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={updateAppointmentMutation.isPending}
                >
                  {updateAppointmentMutation.isPending
                    ? "Enregistrement..."
                    : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="-mx-6 -mt-6 px-6 py-4 mb-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            Prise de rendez-vous -{" "}
            {appointment.beneficiaryName ||
              `${appointment.firstName} ${appointment.lastName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            <div className="font-semibold text-gray-700">Début</div>
            <div>
              {formatDateInTimeZone(
                appointmentDate,
                convertDateFormat(dateFormat),
                undefined,
                fr,
              )}{" "}
              {appointment.startTime}
            </div>

            <div className="font-semibold text-gray-700">Fin</div>
            <div>
              {formatDateInTimeZone(
                appointmentDate,
                convertDateFormat(dateFormat),
                undefined,
                fr,
              )}{" "}
              {appointment.endTime}
            </div>

            <div className="font-semibold text-gray-700">Statut</div>
            <div>{formatAppointmentStatus(appointment)}</div>

            {(appointment as any).serviceName && (
              <>
                <div className="font-semibold text-gray-700">Service</div>
                <div>{(appointment as any).serviceName}</div>
              </>
            )}

            {appointment.beneficiaryName && (
              <>
                <div className="font-semibold text-gray-700">Bénéficiaire</div>
                <div>
                  {appointment.beneficiaryName}
                  {appointment.beneficiaryRelation && (
                    <span className="text-gray-500 text-xs ml-2">
                      ({appointment.beneficiaryRelation})
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="font-semibold text-gray-700">Professionnel</div>
            <div>
              {professional?.firstName} {professional?.lastName}
            </div>

            <div className="font-semibold text-gray-700">
              {appointment.beneficiaryName ? "Réservé par" : "Client"}
            </div>
            <div>
              {appointment.firstName} {appointment.lastName}
            </div>

            <div className="font-semibold text-gray-700">Email</div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <a
                href={`mailto:${appointment.email}`}
                className="text-blue-600 hover:underline"
              >
                {appointment.email}
              </a>
            </div>

            <div className="font-semibold text-gray-700">Téléphone</div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-600" />
              <a
                href={`tel:${appointment.phone}`}
                className="text-blue-600 hover:underline"
              >
                {appointment.phone}
              </a>
            </div>

            <div className="font-semibold text-gray-700">Commentaires</div>
            <div>{appointment.notes || "-"}</div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleClose} className="gap-2">
              <X className="h-4 w-4" />
              Fermer
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
            <Button
              onClick={handleEdit}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Edit className="h-4 w-4" />
              Éditer
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-appointment-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer ce rendez-vous ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// Mobile View Components
interface DayListViewProps {
  currentWeekStart: Date;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  appointments: Appointment[];
  schedules: ProfessionalSchedule[];
  breaks: ProfessionalBreak[];
  onAppointmentClick: (appointment: Appointment) => void;
  onAvailableSlotClick: (date: Date, hour: number) => void;
  dateFormat: string;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onToday?: () => void;
}

function DayListView({
  currentWeekStart,
  selectedDay,
  onSelectDay,
  appointments,
  schedules,
  breaks,
  onAppointmentClick,
  onAvailableSlotClick,
  dateFormat,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: DayListViewProps) {
  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  // Check if selected day is in the past
  const today = getTodayInTimeZone();
  const selectedDayStart = startOfDay(selectedDay);
  const todayStart = startOfDay(today);
  const isSelectedDayPast = selectedDayStart < todayStart;

  // Helper function to check if a time slot is within working hours
  const isWithinWorkingHours = (hour: number): boolean => {
    const dayOfWeek = getDay(selectedDay);

    const daySchedule = schedules.find(
      (s) => s.dayOfWeek === dayOfWeek && s.isAvailable,
    );
    if (!daySchedule) return false;

    const startHour = parseInt(daySchedule.startTime.split(":")[0]);
    const endHour = parseInt(daySchedule.endTime.split(":")[0]);

    return hour >= startHour && hour < endHour;
  };

  // Helper function to get the break at a specific time slot
  const getBreakAtSlot = (hour: number): ProfessionalBreak | null => {
    const dayOfWeek = getDay(selectedDay);

    const dayBreak = breaks.find((b) => {
      if (b.dayOfWeek !== dayOfWeek) return false;
      const startHour = parseInt(b.startTime.split(":")[0]);
      const endHour = parseInt(b.endTime.split(":")[0]);
      return hour >= startHour && hour < endHour;
    });

    return dayBreak || null;
  };

  // Helper function to get appointments for a specific time slot
  const getAppointmentsForSlot = (hour: number): Appointment[] => {
    return appointments.filter((apt) => {
      if (apt.status === "draft") return false;

      const aptDate =
        typeof apt.appointmentDate === "string"
          ? parseISO(apt.appointmentDate)
          : apt.appointmentDate;

      const localAptDate = utcToLocal(aptDate);

      if (!isSameDayInTimeZone(localAptDate, selectedDay)) return false;
      if (!apt.startTime) return false;

      const aptHour = parseInt(apt.startTime.split(":")[0]);
      return aptHour === hour;
    });
  };

  // Helper function to check if there's still available space in an hour
  const hasAvailableSpaceInHour = (hour: number): boolean => {
    const hourStart = hour * 60; // Start of hour in minutes
    const hourEnd = (hour + 1) * 60; // End of hour in minutes

    // Get all appointments and breaks in this hour
    const slotAppointments = getAppointmentsForSlot(hour);
    const breakAtSlot = getBreakAtSlot(hour);

    // If there's a break covering the entire hour, no space available
    if (breakAtSlot) {
      const [breakStartHour, breakStartMin] = breakAtSlot.startTime
        .split(":")
        .map(Number);
      const [breakEndHour, breakEndMin] = breakAtSlot.endTime
        .split(":")
        .map(Number);
      const breakStart = breakStartHour * 60 + breakStartMin;
      const breakEnd = breakEndHour * 60 + breakEndMin;

      // If break covers entire hour or more
      if (breakStart <= hourStart && breakEnd >= hourEnd) {
        return false;
      }
    }

    // Create a timeline of occupied minutes within this hour
    const occupiedRanges: { start: number; end: number }[] = [];

    // Add appointments to occupied ranges
    slotAppointments.forEach((apt) => {
      if (apt.status === "cancelled") return;
      if (!apt.startTime || !apt.endTime) return;

      const [startHour, startMin] = apt.startTime.split(":").map(Number);
      const [endHour, endMin] = apt.endTime.split(":").map(Number);
      const start = startHour * 60 + startMin;
      const end = endHour * 60 + endMin;

      occupiedRanges.push({ start, end });
    });

    // Add break to occupied ranges if it exists
    if (breakAtSlot) {
      const [breakStartHour, breakStartMin] = breakAtSlot.startTime
        .split(":")
        .map(Number);
      const [breakEndHour, breakEndMin] = breakAtSlot.endTime
        .split(":")
        .map(Number);
      const breakStart = breakStartHour * 60 + breakStartMin;
      const breakEnd = breakEndHour * 60 + breakEndMin;

      occupiedRanges.push({ start: breakStart, end: breakEnd });
    }

    // Sort ranges by start time
    occupiedRanges.sort((a, b) => a.start - b.start);

    // Check if there's any gap within the hour
    let currentTime = hourStart;

    for (const range of occupiedRanges) {
      // If there's a gap before this range and it's within the hour
      if (currentTime < range.start && currentTime < hourEnd) {
        return true; // Found available space
      }
      currentTime = Math.max(currentTime, range.end);
    }

    // Check if there's space after all ranges
    return currentTime < hourEnd;
  };

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">
            {formatDate(selectedDay, convertDateFormat(dateFormat))}
          </h2>
          {(onPreviousWeek || onNextWeek || onToday) && (
            <div className="flex items-center gap-1">
              {onPreviousWeek && (
                <button
                  onClick={onPreviousWeek}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  data-testid="button-previous-week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {onToday && (
                <button
                  onClick={onToday}
                  className="px-2 py-1 text-xs font-medium hover:bg-gray-100 rounded transition-colors"
                  data-testid="button-today-dayview"
                >
                  Aujourd'hui
                </button>
              )}
              {onNextWeek && (
                <button
                  onClick={onNextWeek}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  data-testid="button-next-week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Semaine du {format(weekDays[0], "d MMM", { locale: fr })} -{" "}
          {format(weekDays[weekDays.length - 1], "d MMM yyyy", { locale: fr })}
        </p>
      </div>

      <div className="overflow-x-auto mb-3 -mx-3 px-3">
        <div className="flex gap-2 pb-1">
          {weekDays.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={`min-w-[60px] px-3 py-2 rounded-lg text-center transition-all flex-shrink-0 ${
                isSameDayInTimeZone(day, selectedDay)
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md border-2 border-blue-500"
                  : "bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100"
              }`}
              data-testid={`button-day-${format(day, "yyyy-MM-dd")}`}
            >
              <div
                className={`text-[10px] font-semibold mb-0.5 ${isSameDayInTimeZone(day, selectedDay) ? "text-white" : "text-gray-500"}`}
              >
                {format(day, "EEE", { locale: fr })}
              </div>
              <div className="text-base font-bold">{format(day, "d")}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Hourly Grid */}
      <div className="space-y-1">
        {HOURS.map((hour) => {
          const isWorking = isWithinWorkingHours(hour);
          const breakAtSlot = getBreakAtSlot(hour);
          const slotAppointments = getAppointmentsForSlot(hour);

          const isBreakPause = breakAtSlot?.type === "break";
          const isUnavailable = breakAtSlot?.type === "unavailability";

          return (
            <div
              key={hour}
              className={`rounded-lg border ${
                !isWorking
                  ? "bg-gray-100 border-gray-200"
                  : isBreakPause
                    ? "bg-green-50 border-green-200"
                    : isUnavailable
                      ? "bg-amber-50 border-amber-200"
                      : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start p-2">
                <div className="w-16 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-600">
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </span>
                </div>
                <div className="flex-1">
                  {!isWorking ? (
                    <div className="text-xs text-gray-400 italic">
                      Non disponible
                    </div>
                  ) : isBreakPause && breakAtSlot ? (
                    <div className="text-xs text-green-700 font-medium">
                      <div className="font-semibold">
                        {formatTime(breakAtSlot.startTime)} -{" "}
                        {formatTime(breakAtSlot.endTime)}
                      </div>
                      <div>Pause</div>
                    </div>
                  ) : isUnavailable && breakAtSlot ? (
                    <div className="text-xs text-amber-700 font-medium">
                      <div className="font-semibold">
                        {formatTime(breakAtSlot.startTime)} -{" "}
                        {formatTime(breakAtSlot.endTime)}
                      </div>
                      <div>Indisponible</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {slotAppointments.length > 0 && (
                        <>
                          {slotAppointments.map((apt) => {
                            const isCancelled = apt.status === "cancelled";
                            const isNoShow = apt.status === "no-show";

                            return (
                              <button
                                key={apt.id}
                                onClick={() => onAppointmentClick(apt)}
                                className={`w-full text-left rounded px-2 py-1.5 text-xs transition-colors ${
                                  isCancelled
                                    ? "bg-gray-400 text-gray-700 line-through"
                                    : isNoShow
                                      ? "bg-orange-400 text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                                data-testid={`appointment-${apt.id}`}
                              >
                                <div className="font-semibold mb-0.5">
                                  {formatTime(apt.startTime)} -{" "}
                                  {formatTime(apt.endTime)}
                                </div>
                                <div className="truncate">
                                  {apt.beneficiaryName ||
                                    `${apt.firstName} ${apt.lastName}`}
                                </div>
                                {apt.beneficiaryName && (
                                  <div className="text-[10px] opacity-90 truncate">
                                    Par: {apt.firstName} {apt.lastName}
                                  </div>
                                )}
                                {isCancelled && (
                                  <div className="text-[10px] mt-0.5">
                                    {apt.cancelledBy === "client"
                                      ? "Annulé par client"
                                      : "Annulé par pro"}
                                  </div>
                                )}
                                {isNoShow && (
                                  <div className="text-[10px] mt-0.5">
                                    Non-présenté
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </>
                      )}
                      {hasAvailableSpaceInHour(hour) && !isSelectedDayPast && (
                        <button
                          onClick={() =>
                            onAvailableSlotClick(selectedDay, hour)
                          }
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer transition-all"
                          data-testid={`button-available-slot-${hour}`}
                        >
                          Disponible
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ColumnViewProps {
  currentWeekStart: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  dateFormat: string;
}

function ColumnView({
  currentWeekStart,
  appointments,
  onAppointmentClick,
  dateFormat,
}: ColumnViewProps) {
  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Semaine</h2>
        <p className="text-xs text-gray-500">
          {format(weekDays[0], "d MMM", { locale: fr })} -{" "}
          {format(weekDays[weekDays.length - 1], "d MMM yyyy", { locale: fr })}
        </p>
      </div>

      <div className="space-y-4">
        {weekDays.map((day, index) => {
          const dayAppointments = appointments.filter((apt) =>
            isSameDayInTimeZone(apt.appointmentDate, day),
          );

          return (
            <div
              key={day.toISOString()}
              className={`pb-4 ${index !== weekDays.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex flex-col items-center justify-center">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase">
                      {format(day, "EEE", { locale: fr })}
                    </div>
                    <div className="text-sm font-bold text-blue-600">
                      {format(day, "d")}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatDate(day, convertDateFormat(dateFormat))}
                  </div>
                </div>
                <div className="text-xs text-gray-600 px-2 py-0.5 bg-gray-100 rounded-full">
                  {dayAppointments.length}
                </div>
              </div>

              {dayAppointments.length > 0 ? (
                <div className="space-y-1">
                  {dayAppointments.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className="w-full text-left p-2 bg-gray-50 rounded-lg border-l-3 border-blue-500 hover:bg-gray-100 transition-colors"
                      data-testid={`appointment-${apt.id}`}
                    >
                      <div className="text-xs font-semibold text-blue-600 mb-0.5">
                        {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {apt.beneficiaryName ||
                          `${apt.firstName} ${apt.lastName}`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-gray-400 text-xs">
                  Aucun rendez-vous
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
