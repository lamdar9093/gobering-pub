import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, User, Users, ArrowLeft, ArrowRight, MapPin, Phone, Mail, CheckCircle2, Loader2, UserCircle } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, isSameDay, parseISO, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { fromZonedTime } from "date-fns-tz";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";
import { formatPrice } from "@/lib/utils";
import type { Professional, ProfessionalService, ClinicService, ProfessionalSchedule, ProfessionalBreak, Appointment } from "@shared/schema";
import WaitlistModal from "@/components/waitlist-modal";
import LoadingAnimation from "@/components/LoadingAnimation";

type Service = ProfessionalService | ClinicService;

const bookingFormSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().min(10, "Numéro de téléphone invalide"),
  notes: z.string().optional(),
  bookingFor: z.enum(["self", "other"]).default("self"),
  beneficiaryName: z.string().optional(),
  beneficiaryRelation: z.string().optional(),
  beneficiaryPhone: z.string().optional(),
  beneficiaryEmail: z.string().email("Email invalide").optional().or(z.literal("")),
});

interface WidgetConfig {
  id: string;
  slug: string;
  displayName: string | null;
  professionalId: string | null;
  clinicId: string | null;
  isActive: boolean;
  bannerImageUrl: string | null;
  logoImageUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  bookingSequence: string | null;
}

interface WidgetData {
  widget: WidgetConfig;
  professional: Professional | null;
  clinic: any | null;
}

type BookingStep = "service" | "professional" | "timeslot" | "form";

function ProfessionalAvatar({ professional }: { professional: Pick<Professional, 'id' | 'firstName' | 'lastName' | 'profilePicture'> }) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [professional.profilePicture]);

  return (
    <div className="w-24 h-32 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0" data-testid={`avatar-prof-${professional.id}`}>
      {professional.profilePicture && !imageError ? (
        <img
          src={professional.profilePicture}
          alt={`${professional.firstName} ${professional.lastName}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <User className="h-12 w-12 text-gray-600 dark:text-gray-400" />
      )}
    </div>
  );
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();
  
  const [step, setStep] = useState<BookingStep>("service");
  const [isNewClient, setIsNewClient] = useState<boolean | null>(true); // Always true since we removed the client-type step
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSlotProfessionalId, setSelectedSlotProfessionalId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [hasInitializedServices, setHasInitializedServices] = useState(false);
  
  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      bookingFor: "self",
      beneficiaryName: "",
      beneficiaryRelation: "",
      beneficiaryPhone: "",
      beneficiaryEmail: "",
    },
  });

  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<any>(null);

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bookingFormSchema>) => {
      // If "anyone" was selected, use the professional associated with the selected slot
      const professionalId = selectedProfessional?.id === "anyone" 
        ? selectedSlotProfessionalId
        : selectedProfessional?.id;

      const res = await apiRequest(
        "POST",
        `/api/public/${slug}/appointments`,
        {
          professionalId,
          serviceId: selectedService?.id,
          date: selectedDate?.toISOString(),
          time: selectedTime,
          isNewClient,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          notes: data.notes,
          isForSomeoneElse: data.bookingFor === "other",
          beneficiaryName: data.beneficiaryName,
          beneficiaryRelation: data.beneficiaryRelation,
          beneficiaryPhone: data.beneficiaryPhone,
          beneficiaryEmail: data.beneficiaryEmail,
        }
      );

      // Return JSON data from response
      return await res.json();
    },
    onSuccess: (data) => {
      setConfirmedAppointment({
        ...data.appointment,
        service: selectedService,
        professional: selectedProfessional,
        date: selectedDate,
        time: selectedTime,
      });
      setShowConfirmationDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la création du rendez-vous",
        variant: "destructive",
      });
    },
  });

  const handleCloseConfirmation = () => {
    setShowConfirmationDialog(false);
    setConfirmedAppointment(null);
    setStep("service");
    form.reset();
    setIsNewClient(true);
    setSelectedService(null);
    setSelectedProfessional(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedSlotProfessionalId(null);
    setHasInitializedServices(false); // Reset initialization flag to allow re-detection
  };

  const { data: widgetData, isLoading: widgetLoading } = useQuery<WidgetData>({
    queryKey: [`/api/public/widget/${slug}`],
  });

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: [`/api/public/${slug}/services`],
    enabled: !!widgetData?.widget?.isActive,
  });

  // Auto-detect service scenario and adapt initial step (only on first load)
  useEffect(() => {
    if (!services || servicesLoading || hasInitializedServices) return;
    
    const serviceCount = services.length;
    
    if (serviceCount === 0) {
      // No services: skip to professional step
      setStep("professional");
      setSelectedService(null);
    } else if (serviceCount === 1) {
      // One service: pre-select it but stay on service step to show what's being booked
      setSelectedService(services[0]);
      setStep("service");
    } else {
      // Multiple services: normal flow
      setStep("service");
    }
    
    setHasInitializedServices(true);
  }, [services, servicesLoading, hasInitializedServices]);

  const { data: professionals, isLoading: professionalsLoading } = useQuery<Professional[]>({
    queryKey: [`/api/public/${slug}/professionals?serviceId=${selectedService?.id || ''}`],
    enabled: step === "professional" || !!selectedService,
  });

  // Query for "anyone available" - get all professionals' availability
  const { data: anyoneAvailability } = useQuery<{
    service: Service;
    professionals: Array<{
      professional: Professional;
      appointments: Appointment[];
      schedules: ProfessionalSchedule[];
      breaks: ProfessionalBreak[];
    }>;
  }>({
    queryKey: [`/api/public/${slug}/availability/anyone`, selectedService?.id],
    queryFn: async () => {
      if (!selectedService?.id) return null;
      const res = await fetch(`/api/public/${slug}/availability/anyone?serviceId=${selectedService.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    enabled: selectedProfessional?.id === "anyone" && !!selectedService?.id,
  });

  // Query for specific professional availability
  const { data: availability } = useQuery<{
    service: Service | null;
    professional: Professional;
    appointments: Appointment[];
    schedules: ProfessionalSchedule[];
    breaks: ProfessionalBreak[];
  }>({
    queryKey: [`/api/public/${slug}/availability`, selectedProfessional?.id, selectedService?.id],
    queryFn: async () => {
      if (!selectedProfessional?.id) return null;
      const serviceParam = selectedService?.id ? `&serviceId=${selectedService.id}` : '';
      const res = await fetch(
        `/api/public/${slug}/availability?professionalId=${selectedProfessional.id}${serviceParam}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    enabled: selectedProfessional?.id !== "anyone" && !!selectedProfessional?.id,
  });

  // Reset expanded days when week changes
  useEffect(() => {
    setExpandedDays(new Set());
  }, [currentWeekStart]);

  // Auto-select date when entering timeslot step (mobile view)
  useEffect(() => {
    if (step !== "timeslot" || !selectedProfessional) return;
    
    const torontoNow = fromZonedTime(new Date(), "America/Toronto");
    const todayDate = startOfDay(torontoNow);
    
    // Check if today is in the current week
    const isAnyoneSelected = selectedProfessional?.id === "anyone";
    const saturdayDate = addDays(currentWeekStart, 5);
    const sundayDate = addDays(currentWeekStart, 6);
    
    const saturdaySlots = isAnyoneSelected 
      ? getAvailableSlotsWithProfessional(saturdayDate) 
      : getAvailableSlots(saturdayDate);
    const sundaySlots = isAnyoneSelected 
      ? getAvailableSlotsWithProfessional(sundayDate) 
      : getAvailableSlots(sundayDate);
    
    const weekDays: Date[] = [];
    for (let i = 0; i < 5; i++) {
      weekDays.push(addDays(currentWeekStart, i));
    }
    if (saturdaySlots.length > 0) weekDays.push(saturdayDate);
    if (sundaySlots.length > 0) weekDays.push(sundayDate);
    
    // Find today in the week
    const todayInWeek = weekDays.find(day => isSameDay(day, todayDate));
    
    if (todayInWeek) {
      // Check if today has slots
      const todaySlots = isAnyoneSelected 
        ? getAvailableSlotsWithProfessional(todayInWeek)
        : getAvailableSlots(todayInWeek);
      
      if (todaySlots.length > 0) {
        setSelectedDate(todayInWeek);
        return;
      }
    }
    
    // If today has no slots or is not in the week, select Monday (first day)
    const firstDayWithSlots = weekDays.find(day => {
      const slots = isAnyoneSelected 
        ? getAvailableSlotsWithProfessional(day)
        : getAvailableSlots(day);
      return slots.length > 0;
    });
    
    if (firstDayWithSlots) {
      setSelectedDate(firstDayWithSlots);
    }
  }, [step, currentWeekStart, selectedProfessional, availability, anyoneAvailability]);

  if (widgetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingAnimation />
        </div>
      </div>
    );
  }

  if (!widgetData || !widgetData.widget.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Widget non disponible</CardTitle>
            <CardDescription>
              Ce widget de réservation n'est pas disponible actuellement.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { widget, professional, clinic } = widgetData;
  // Use custom displayName if set, otherwise fall back to clinic/professional name
  const displayName = widget.displayName 
    || (widget.clinicId 
      ? clinic?.name || "Clinique"
      : (professional?.firstName && professional?.lastName 
        ? `${professional.firstName} ${professional.lastName}` 
        : "Professionnel"));

  const primaryColor = widget.primaryColor || "hsl(222.2, 47.4%, 11.2%)";

  // Get available slots with professional ID for "anyone" mode
  const getAvailableSlotsWithProfessional = (date: Date): Array<{ time: string; professionalId: string }> => {
    if (!anyoneAvailability || !selectedService) return [];

    // Ne pas afficher de créneaux pour les dates passées
    const torontoNow = fromZonedTime(new Date(), "America/Toronto");
    const torontoDate = fromZonedTime(date, "America/Toronto");
    if (isBefore(startOfDay(torontoDate), startOfDay(torontoNow))) {
      return [];
    }

    const allSlots: Array<{ time: string; professionalId: string }> = [];
    const dayOfWeek = date.getDay();

    const isToday = isSameDay(torontoDate, torontoNow);
    const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 0;

    // Calculate slots for each professional
    for (const profData of anyoneAvailability.professionals) {
      const daySchedule = profData.schedules.find(s => s.dayOfWeek === dayOfWeek);
      if (!daySchedule || !daySchedule.startTime || !daySchedule.endTime) continue;

      // Use service duration if available, otherwise use professional's appointmentDuration
      const serviceDuration = selectedService.duration || profData.professional.appointmentDuration || 30;
      const bufferTime = selectedService.bufferTime ?? profData.professional.bufferTime ?? 0;
      const totalSlotDuration = serviceDuration + bufferTime;

      const [startHour, startMinute] = daySchedule.startTime.split(":").map(Number);
      const [endHour, endMinute] = daySchedule.endTime.split(":").map(Number);
      let currentMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      while (currentMinutes + serviceDuration <= endMinutes) {
        const slotHour = Math.floor(currentMinutes / 60);
        const slotMinute = currentMinutes % 60;
        const slotTime = `${String(slotHour).padStart(2, "0")}:${String(slotMinute).padStart(2, "0")}`;
        const slotDate = new Date(date);
        slotDate.setHours(slotHour, slotMinute, 0, 0);

        if (isToday && currentMinutes <= nowMinutes) {
          currentMinutes += totalSlotDuration;
          continue;
        }

        const slotEnd = new Date(slotDate.getTime() + serviceDuration * 60000);

        // Check for breaks - breaks use dayOfWeek and time (not full timestamps)
        const isInBreak = profData.breaks.some(b => {
          if (!b.startTime || !b.endTime || b.dayOfWeek !== dayOfWeek) return false;
          
          // Combine date with break time
          const breakStartTime = typeof b.startTime === 'string' ? b.startTime : String(b.startTime);
          const breakEndTime = typeof b.endTime === 'string' ? b.endTime : String(b.endTime);
          const [breakStartHour, breakStartMin] = breakStartTime.split(":").map(Number);
          const [breakEndHour, breakEndMin] = breakEndTime.split(":").map(Number);
          
          const breakStart = new Date(date);
          breakStart.setHours(breakStartHour, breakStartMin, 0, 0);
          const breakEnd = new Date(date);
          breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);
          
          return (
            (slotDate >= breakStart && slotDate < breakEnd) ||
            (slotEnd > breakStart && slotEnd <= breakEnd) ||
            (slotDate < breakStart && slotEnd > breakEnd)
          );
        });

        if (!isInBreak) {
          // Check for appointment conflicts
          const hasConflict = profData.appointments.some(apt => {
            if (apt.status === "cancelled" || !apt.startTime || !apt.endTime) return false;
            
            // Appointments have separate date and time fields - combine them
            const aptDate = typeof apt.appointmentDate === 'string' ? parseISO(apt.appointmentDate) : apt.appointmentDate;
            if (!isSameDay(aptDate, date)) return false;
            
            const aptStartTime = typeof apt.startTime === 'string' ? apt.startTime : String(apt.startTime);
            const aptEndTime = typeof apt.endTime === 'string' ? apt.endTime : String(apt.endTime);
            const [aptStartHour, aptStartMin] = aptStartTime.split(":").map(Number);
            const [aptEndHour, aptEndMin] = aptEndTime.split(":").map(Number);
            
            const aptStart = new Date(date);
            aptStart.setHours(aptStartHour, aptStartMin, 0, 0);
            const aptEnd = new Date(date);
            aptEnd.setHours(aptEndHour, aptEndMin, 0, 0);
            
            return (
              (slotDate >= aptStart && slotDate < aptEnd) ||
              (slotEnd > aptStart && slotEnd <= aptEnd) ||
              (slotDate < aptStart && slotEnd > aptEnd)
            );
          });

          if (!hasConflict) {
            allSlots.push({ time: slotTime, professionalId: profData.professional.id });
          }
        }

        currentMinutes += totalSlotDuration;
      }
    }

    return allSlots;
  };

  const getAvailableSlots = (date: Date): string[] => {
    if (!availability) return [];

    // Ne pas afficher de créneaux pour les dates passées
    const torontoNow = fromZonedTime(new Date(), "America/Toronto");
    const torontoDate = fromZonedTime(date, "America/Toronto");
    if (isBefore(startOfDay(torontoDate), startOfDay(torontoNow))) {
      return [];
    }

    const dayOfWeek = date.getDay();
    const daySchedule = availability.schedules.find(s => s.dayOfWeek === dayOfWeek);
    
    if (!daySchedule || !daySchedule.startTime || !daySchedule.endTime) return [];

    const slots: string[] = [];
    
    // Use service duration if available, otherwise use professional's default appointmentDuration
    const serviceDuration = selectedService?.duration || availability.professional.appointmentDuration || 30;
    const bufferTime = selectedService?.bufferTime ?? availability.professional.bufferTime ?? 0;
    const totalSlotDuration = serviceDuration + bufferTime;

    const [startHour, startMinute] = daySchedule.startTime.split(":").map(Number);
    const [endHour, endMinute] = daySchedule.endTime.split(":").map(Number);

    let currentMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    const isToday = isSameDay(torontoDate, torontoNow);
    const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 0;

    while (currentMinutes + serviceDuration <= endMinutes) {
      const slotHour = Math.floor(currentMinutes / 60);
      const slotMinute = currentMinutes % 60;
      const slotTime = `${String(slotHour).padStart(2, "0")}:${String(slotMinute).padStart(2, "0")}`;
      const slotDate = new Date(date);
      slotDate.setHours(slotHour, slotMinute, 0, 0);

      if (isToday && currentMinutes <= nowMinutes) {
        currentMinutes += totalSlotDuration;
        continue;
      }

      const slotEnd = new Date(slotDate.getTime() + serviceDuration * 60000);

      // Check for breaks - breaks use dayOfWeek and time (not full timestamps)
      const isInBreak = availability.breaks.some(b => {
        if (!b.startTime || !b.endTime || b.dayOfWeek !== dayOfWeek) return false;
        
        // Combine date with break time
        const breakStartTime = typeof b.startTime === 'string' ? b.startTime : String(b.startTime);
        const breakEndTime = typeof b.endTime === 'string' ? b.endTime : String(b.endTime);
        const [breakStartHour, breakStartMin] = breakStartTime.split(":").map(Number);
        const [breakEndHour, breakEndMin] = breakEndTime.split(":").map(Number);
        
        const breakStart = new Date(date);
        breakStart.setHours(breakStartHour, breakStartMin, 0, 0);
        const breakEnd = new Date(date);
        breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);
        
        return (
          (slotDate >= breakStart && slotDate < breakEnd) ||
          (slotEnd > breakStart && slotEnd <= breakEnd) ||
          (slotDate < breakStart && slotEnd > breakEnd)
        );
      });

      if (isInBreak) {
        currentMinutes += totalSlotDuration;
        continue;
      }

      // Check for appointment conflicts
      const hasConflict = availability.appointments.some(apt => {
        if (apt.status === "cancelled" || !apt.startTime || !apt.endTime) return false;
        
        // Appointments have separate date and time fields - combine them
        const aptDate = typeof apt.appointmentDate === 'string' ? parseISO(apt.appointmentDate) : apt.appointmentDate;
        if (!isSameDay(aptDate, date)) return false;
        
        const aptStartTime = typeof apt.startTime === 'string' ? apt.startTime : String(apt.startTime);
        const aptEndTime = typeof apt.endTime === 'string' ? apt.endTime : String(apt.endTime);
        const [aptStartHour, aptStartMin] = aptStartTime.split(":").map(Number);
        const [aptEndHour, aptEndMin] = aptEndTime.split(":").map(Number);
        
        const aptStart = new Date(date);
        aptStart.setHours(aptStartHour, aptStartMin, 0, 0);
        const aptEnd = new Date(date);
        aptEnd.setHours(aptEndHour, aptEndMin, 0, 0);
        
        return (
          (slotDate >= aptStart && slotDate < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (slotDate < aptStart && slotEnd > aptEnd)
        );
      });

      if (!hasConflict) {
        slots.push(slotTime);
      }

      currentMinutes += totalSlotDuration;
    }

    return slots;
  };

  const handleStepProgress = (nextStep: BookingStep) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderHeader = () => (
    <div className="relative">
      {widget.bannerImageUrl && (
        <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${widget.bannerImageUrl})` }} />
      )}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center gap-4">
          {widget.logoImageUrl && (
            <img src={widget.logoImageUrl} alt="Logo" className="h-16 w-16 object-contain rounded-lg" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
            <p className="text-gray-600 dark:text-gray-400">Réservation en ligne</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepper = () => {
    // Dynamically build steps based on whether services exist
    const hasServices = services && services.length > 0;
    
    const steps = hasServices 
      ? [
          { key: "service", label: "Service" },
          { key: "professional", label: "Professionnel" },
          { key: "timeslot", label: "Horaire" },
          { key: "form", label: "Confirmation" },
        ]
      : [
          { key: "professional", label: "Professionnel" },
          { key: "timeslot", label: "Horaire" },
          { key: "form", label: "Confirmation" },
        ];

    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      idx <= currentIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="text-xs mt-2 text-center">{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${idx < currentIndex ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderServiceStep = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Choisissez un service</CardTitle>
          <CardDescription>Sélectionnez le type de consultation souhaité</CardDescription>
        </CardHeader>
        <CardContent>
          {servicesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {services?.map((service) => (
                <div
                  key={service.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedService?.id === service.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                  onClick={() => {
                    setSelectedService(service);
                    setSelectedProfessional(null);
                  }}
                  data-testid={`card-service-${service.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      {service.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {service.duration} min
                        </span>
                        <span className="font-medium text-primary">
                          {formatPrice(service.price || 0)}
                        </span>
                      </div>
                    </div>
                    {selectedService?.id === service.id && (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedService && (
            <Button
              onClick={() => handleStepProgress("professional")}
              className="w-full mt-6"
              data-testid="button-next-professional"
            >
              Continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderProfessionalStep = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => handleStepProgress("service")} data-testid="button-back-service">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Choisissez un professionnel</CardTitle>
          <CardDescription>Sélectionnez le professionnel de votre choix</CardDescription>
        </CardHeader>
        <CardContent>
          {professionalsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {widget.clinicId && professionals && professionals.length > 1 && (
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedProfessional?.id === "anyone"
                      ? "border-primary bg-primary/5"
                      : "hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                  onClick={() => {
                    setSelectedProfessional({ id: "anyone" } as any);
                  }}
                  data-testid="card-professional-anyone"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-32 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Users className="h-12 w-12 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">N'importe qui disponible</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Premier professionnel disponible
                        </p>
                      </div>
                    </div>
                    {selectedProfessional?.id === "anyone" && (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </div>
              )}
              {professionals?.map((prof) => (
                <div
                  key={prof.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedProfessional?.id === prof.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                  onClick={() => setSelectedProfessional(prof)}
                  data-testid={`card-professional-${prof.id}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <ProfessionalAvatar professional={prof} />
                      <div>
                        <h3 className="font-semibold">
                          {prof.firstName} {prof.lastName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {prof.professions && prof.professions.length > 0 
                            ? prof.professions.join(', ') 
                            : 'Profession non spécifiée'}
                        </p>
                      </div>
                    </div>
                    {selectedProfessional?.id === prof.id && (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedProfessional && (
            <Button
              onClick={() => handleStepProgress("timeslot")}
              className="w-full mt-6"
              data-testid="button-next-timeslot"
            >
              Continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderTimeslotStep = () => {
    // Generate weekdays (Mon-Fri) and conditionally add Saturday/Sunday if slots exist
    const saturdayDate = addDays(currentWeekStart, 5);
    const sundayDate = addDays(currentWeekStart, 6);
    const isAnyoneSelected = selectedProfessional?.id === "anyone";
    
    const saturdaySlots = isAnyoneSelected 
      ? getAvailableSlotsWithProfessional(saturdayDate) 
      : getAvailableSlots(saturdayDate);
    const sundaySlots = isAnyoneSelected 
      ? getAvailableSlotsWithProfessional(sundayDate) 
      : getAvailableSlots(sundayDate);
    
    const hasSaturdaySlots = saturdaySlots.length > 0;
    const hasSundaySlots = sundaySlots.length > 0;
    
    const weekDays: Date[] = [];
    for (let i = 0; i < 5; i++) {
      weekDays.push(addDays(currentWeekStart, i)); // Mon-Fri
    }
    if (hasSaturdaySlots) {
      weekDays.push(saturdayDate);
    }
    if (hasSundaySlots) {
      weekDays.push(sundayDate);
    }

    // Check if at least one day is today or in the future
    const torontoNow = fromZonedTime(new Date(), "America/Toronto");
    const hasAnyFutureOrCurrentDate = weekDays.some(day => {
      const torontoDate = fromZonedTime(day, "America/Toronto");
      return !isBefore(startOfDay(torontoDate), startOfDay(torontoNow));
    });

    // Check if ANY slots are available in the entire week
    const hasAnySlots = weekDays.some((day) => {
      const anyoneSlots = isAnyoneSelected ? getAvailableSlotsWithProfessional(day) : [];
      const specificSlots = !isAnyoneSelected ? getAvailableSlots(day) : [];
      const displaySlots = isAnyoneSelected
        ? Array.from(new Set(anyoneSlots.map(s => s.time))).sort()
        : specificSlots;
      return displaySlots.length > 0;
    });

    // Get all slots for the selected day for mobile view
    const selectedDaySlots = selectedDate ? (() => {
      const anyoneSlots = isAnyoneSelected ? getAvailableSlotsWithProfessional(selectedDate) : [];
      const specificSlots = !isAnyoneSelected ? getAvailableSlots(selectedDate) : [];
      
      if (isAnyoneSelected) {
        // For "anyone" mode, keep the professional ID with each time slot
        // Remove duplicates by time while keeping first professional ID for each time
        const timeMap = new Map<string, string>();
        anyoneSlots.forEach(slot => {
          if (!timeMap.has(slot.time)) {
            timeMap.set(slot.time, slot.professionalId);
          }
        });
        return Array.from(timeMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([time, professionalId]) => ({ time, professionalId }));
      } else {
        // For specific professional, just return times as strings
        return specificSlots.map(time => ({ time, professionalId: null }));
      }
    })() : [];

    const professionalInfo = selectedProfessional?.id === "anyone" 
      ? availability?.professional || anyoneAvailability?.professionals[0]?.professional
      : selectedProfessional;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        {/* Mobile Header with Professional Info */}
        <div className="md:hidden bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black text-white px-4 py-6">
          <div className="flex items-center gap-4 mb-3">
            {professionalInfo && <ProfessionalAvatar professional={professionalInfo} />}
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                {professionalInfo?.id === "anyone" 
                  ? "Disponible avec un professionnel" 
                  : `${professionalInfo?.firstName || ''} ${professionalInfo?.lastName || ''}`}
              </h2>
              <p className="text-blue-200 text-sm">
                {professionalInfo?.professions && professionalInfo.professions.length > 0 
                  ? professionalInfo.professions.join(', ') 
                  : ''}
              </p>
              {selectedService && (
                <p className="text-blue-300 text-xs mt-1">{selectedService.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Desktop/Tablet View */}
        <div className="hidden md:block max-w-6xl mx-auto px-4 py-12">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => handleStepProgress("professional")} data-testid="button-back-professional">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Choisissez une date et heure</CardTitle>
                  <CardDescription>Sélectionnez le créneau qui vous convient</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}
                    disabled={isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))}
                    data-testid="button-prev-week"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                    data-testid="button-next-week"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-2 ${
                weekDays.length === 7 ? 'grid-cols-7' :
                weekDays.length === 6 ? 'grid-cols-6' :
                'grid-cols-5'
              }`}>
                {weekDays.map((day) => {
                  // Get slots based on whether "anyone" is selected
                  const isAnyoneSelected = selectedProfessional?.id === "anyone";
                  const anyoneSlots = isAnyoneSelected ? getAvailableSlotsWithProfessional(day) : [];
                  const specificSlots = !isAnyoneSelected ? getAvailableSlots(day) : [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  // Display slots (merge duplicates for "anyone" mode)
                  const allSlots = isAnyoneSelected
                    ? Array.from(new Set(anyoneSlots.map(s => s.time))).sort()
                    : specificSlots;

                  const dayKey = format(day, 'yyyy-MM-dd');
                  const isDayExpanded = expandedDays.has(dayKey);
                  const displaySlots = isDayExpanded ? allSlots : allSlots.slice(0, 3);
                  const hasMoreSlots = allSlots.length > 3;

                  return (
                    <div key={day.toISOString()} className="min-h-[200px]">
                      <div className="text-center mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="text-sm font-medium">{format(day, "EEE", { locale: fr })}</div>
                        <div className="text-lg font-bold">{format(day, "d MMM", { locale: fr })}</div>
                      </div>
                      <div className="space-y-2">
                        {displaySlots.length === 0 ? (
                          <div className="text-xs text-center text-gray-500 dark:text-gray-400 py-4">
                            Aucun créneau
                          </div>
                        ) : (
                          <>
                            {displaySlots.map((time) => {
                              // Find the professional ID for this slot (in "anyone" mode)
                              const slotProfId = isAnyoneSelected
                                ? anyoneSlots.find(s => s.time === time)?.professionalId
                                : null;

                              return (
                                <Button
                                  key={time}
                                  variant={isSelected && selectedTime === time ? "default" : "outline"}
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={() => {
                                    setSelectedDate(day);
                                    setSelectedTime(time);
                                    if (slotProfId) {
                                      setSelectedSlotProfessionalId(slotProfId);
                                    }
                                  }}
                                  data-testid={`button-slot-${format(day, "yyyy-MM-dd")}-${time}`}
                                >
                                  {time}
                                </Button>
                              );
                            })}
                            {hasMoreSlots && !isDayExpanded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                                onClick={() => {
                                  setExpandedDays(new Set(expandedDays).add(dayKey));
                                }}
                                data-testid={`button-show-more-${dayKey}`}
                              >
                                +{allSlots.length - 3} disponibilités
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {!hasAnySlots && hasAnyFutureOrCurrentDate && isWaitlistEnabled && (
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Aucun créneau disponible cette semaine
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                    Rejoignez la liste d'attente pour être notifié dès qu'un créneau se libère
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                    onClick={() => setShowWaitlistModal(true)}
                    data-testid="button-join-waitlist"
                  >
                    Rejoindre la liste d'attente
                  </Button>
                </div>
              )}
              
              {selectedDate && selectedTime && (
                <Button
                  onClick={() => handleStepProgress("form")}
                  className="w-full mt-6"
                  data-testid="button-next-form"
                >
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mobile View */}
        <div className="md:hidden p-4 space-y-4 pb-32">
          <div className="mb-4">
            <Button variant="ghost" onClick={() => handleStepProgress("professional")} data-testid="button-back-professional-mobile" className="text-white hover:text-white hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </div>

          {/* Date Selection Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-4 py-3 flex items-center justify-between text-white">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}
                disabled={isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))}
                className="p-2 hover:bg-white/20 rounded-lg text-white"
                data-testid="button-prev-week-mobile"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h3 className="font-bold text-base">
                {format(currentWeekStart, "'Semaine du' d MMM", { locale: fr })}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                className="p-2 hover:bg-white/20 rounded-lg text-white"
                data-testid="button-next-week-mobile"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-3">
              <div className={`grid gap-2 ${
                weekDays.length === 7 ? 'grid-cols-7' :
                weekDays.length === 6 ? 'grid-cols-6' :
                'grid-cols-5'
              }`}>
                {weekDays.map((day) => {
                  const anyoneSlots = isAnyoneSelected ? getAvailableSlotsWithProfessional(day) : [];
                  const specificSlots = !isAnyoneSelected ? getAvailableSlots(day) : [];
                  const allSlots = isAnyoneSelected
                    ? Array.from(new Set(anyoneSlots.map(s => s.time))).sort()
                    : specificSlots;
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const hasSlots = allSlots.length > 0;
                  
                  // Check if day is in the past
                  const torontoDate = fromZonedTime(day, "America/Toronto");
                  const isPast = isBefore(startOfDay(torontoDate), startOfDay(torontoNow));

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        if (hasSlots && !isPast) {
                          setSelectedDate(day);
                          setSelectedTime(null);
                        }
                      }}
                      disabled={!hasSlots || isPast}
                      className={`p-3 rounded-xl text-center transition-all ${
                        !hasSlots || isPast
                          ? 'bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-gray-500 cursor-not-allowed'
                          : isSelected
                            ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900'
                            : 'bg-slate-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 hover:border-blue-300 dark:hover:border-blue-500 border-2 border-transparent'
                      }`}
                      data-testid={`button-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div className="text-xs font-medium mb-1">
                        {format(day, "EEE", { locale: fr }).replace('.', '')}
                      </div>
                      <div className="text-2xl font-bold">{format(day, "d", { locale: fr })}</div>
                      <div className="text-xs opacity-80">{format(day, "MMM", { locale: fr }).replace('.', '')}</div>
                      {(!hasSlots || isPast) && (
                        <div className="text-xs mt-1">Aucun</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time Slots Selection Card */}
          {selectedDate && selectedDaySlots.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-slate-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-800 dark:to-black px-4 py-3 flex items-center gap-2 text-white">
                <Clock className="w-5 h-5" />
                <h3 className="font-bold text-base">Sélectionnez l'heure</h3>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {selectedDaySlots.map((slot) => {
                    return (
                      <button
                        key={slot.time}
                        onClick={() => {
                          setSelectedTime(slot.time);
                          if (slot.professionalId) {
                            setSelectedSlotProfessionalId(slot.professionalId);
                          }
                        }}
                        className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                          selectedTime === slot.time
                            ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900'
                            : 'bg-slate-50 dark:bg-gray-700 text-slate-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600 hover:border-blue-300 dark:hover:border-blue-500 border-2 border-transparent'
                        }`}
                        data-testid={`button-slot-mobile-${slot.time}`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* No slots available message */}
          {!hasAnySlots && hasAnyFutureOrCurrentDate && isWaitlistEnabled && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 shadow-lg">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Aucun créneau disponible cette semaine
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                Rejoignez la liste d'attente pour être notifié dès qu'un créneau se libère
              </p>
              <Button
                variant="outline"
                className="w-full border-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                onClick={() => setShowWaitlistModal(true)}
                data-testid="button-join-waitlist-mobile"
              >
                Rejoindre la liste d'attente
              </Button>
            </div>
          )}
        </div>

        {/* Fixed Confirmation Button (Mobile Only) */}
        {selectedDate && selectedTime && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t-2 border-slate-200 dark:border-gray-700 p-4 shadow-2xl">
            <Button
              onClick={() => handleStepProgress("form")}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2"
              data-testid="button-next-form-mobile"
            >
              <Calendar className="w-5 h-5" />
              Réserver le {format(selectedDate, "d MMM", { locale: fr })} à {selectedTime}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderFormStep = () => {
    // Get the assigned professional for display
    const assignedProfessional = selectedProfessional?.id === "anyone" && selectedSlotProfessionalId
      ? professionals?.find(p => p.id === selectedSlotProfessionalId)
      : selectedProfessional;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        {/* Modern Header with Summary */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 sm:px-6 py-4 shadow-lg">
          <div className="max-w-3xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => handleStepProgress("timeslot")} 
              data-testid="button-back-timeslot"
              className="text-white hover:bg-white/20 mb-3 -ml-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold mb-4">Confirmez votre rendez-vous</h1>
            
            {/* Compact Summary Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {selectedService && (
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 rounded-full p-1.5">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{selectedService.name}</span>
                  </div>
                )}
                {assignedProfessional && (
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 rounded-full p-1.5">
                      <UserCircle className="h-4 w-4" />
                    </div>
                    <span className="font-medium">
                      {assignedProfessional.firstName} {assignedProfessional.lastName}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 rounded-full p-1.5">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span className="font-medium">
                    {selectedDate && format(selectedDate, "d MMM", { locale: fr })} à {selectedTime}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 rounded-full p-1.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="font-medium">
                    {selectedService?.duration || selectedProfessional?.appointmentDuration || 30} min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Form */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createAppointmentMutation.mutate(data))} className="space-y-4">
                    {/* Personal Info Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Vos informations
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Prénom</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-firstName" className="h-10" />
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
                              <FormLabel className="text-xs">Nom</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-lastName" className="h-10" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="bookingFor"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Ce rendez-vous est pour :</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex gap-4"
                              data-testid="radio-booking-for"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="self" id="self" data-testid="radio-for-self" />
                                <Label htmlFor="self" className="font-normal cursor-pointer">Pour moi-même</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="other" id="other" data-testid="radio-for-other" />
                                <Label htmlFor="other" className="font-normal cursor-pointer">Pour quelqu'un d'autre</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("bookingFor") === "other" && (
                      <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">Informations du bénéficiaire</h4>
                        
                        <FormField
                          control={form.control}
                          name="beneficiaryName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom complet</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Louis Vachon" data-testid="input-beneficiary-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="beneficiaryRelation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Relation</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-beneficiary-relation">
                                    <SelectValue placeholder="Choisir une relation" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="enfant">Enfant</SelectItem>
                                  <SelectItem value="parent">Parent</SelectItem>
                                  <SelectItem value="conjoint">Conjoint(e)</SelectItem>
                                  <SelectItem value="ami">Ami(e)</SelectItem>
                                  <SelectItem value="autre">Autre</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="beneficiaryPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Téléphone (optionnel)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" placeholder="+1 514-123-4567" data-testid="input-beneficiary-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="beneficiaryEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email (optionnel)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" placeholder="email@example.ca" data-testid="input-beneficiary-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    {/* Contact Section */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Coordonnées
                      </h3>
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              Téléphone
                            </FormLabel>
                            <FormControl>
                              <Input type="tel" {...field} data-testid="input-phone" placeholder="+1 514-123-4567" className="h-10" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" />
                              Email <span className="text-gray-400 dark:text-gray-500 font-normal">(optionnel)</span>
                            </FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-email" placeholder="email@example.ca" className="h-10" />
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
                          <FormLabel className="text-xs">Notes (optionnel)</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Infos complémentaires..."
                              data-testid="textarea-notes"
                              className="min-h-[80px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 rounded-lg font-semibold text-base shadow-lg" 
                      disabled={createAppointmentMutation.isPending}
                      data-testid="button-confirm-booking"
                    >
                      {createAppointmentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Confirmation en cours...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          Confirmer le rendez-vous
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </div>
    );
  };

  // Determine which professional to use for waitlist
  const waitlistProfessional = selectedProfessional?.id === "anyone"
    ? professionals?.[0]
    : selectedProfessional;

  // Check if waitlist is enabled (Pro plan only)
  const isWaitlistEnabled = waitlistProfessional?.planType === 'pro';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {renderHeader()}
      {renderStepper()}
      {step === "service" && renderServiceStep()}
      {step === "professional" && renderProfessionalStep()}
      {step === "timeslot" && renderTimeslotStep()}
      {step === "form" && renderFormStep()}
      
      {waitlistProfessional && isWaitlistEnabled && (
        <WaitlistModal
          open={showWaitlistModal}
          onOpenChange={setShowWaitlistModal}
          professional={waitlistProfessional}
          selectedDate={currentWeekStart}
          selectedServiceId={selectedService?.id}
        />
      )}

      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Rendez-vous confirmé!
            </DialogTitle>
            <DialogDescription>
              Votre rendez-vous a été créé avec succès. Vous recevrez un email de confirmation.
            </DialogDescription>
          </DialogHeader>
          
          {confirmedAppointment && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                {confirmedAppointment.service && (
                  <>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Service</div>
                      <div className="font-medium">{confirmedAppointment.service.name}</div>
                      <div className="text-sm text-primary font-medium mt-1">
                        {formatPrice(confirmedAppointment.service.price || 0)}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Professionnel</div>
                  <div className="font-medium">
                    {confirmedAppointment.professional?.id === "anyone"
                      ? "N'importe qui disponible"
                      : `${confirmedAppointment.professional?.firstName} ${confirmedAppointment.professional?.lastName}`}
                  </div>
                  {confirmedAppointment.professional && !confirmedAppointment.service && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {confirmedAppointment.professional.professions && confirmedAppointment.professional.professions.length > 0 
                        ? confirmedAppointment.professional.professions.join(', ') 
                        : 'Profession non spécifiée'}
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date et heure
                  </div>
                  <div className="font-medium">
                    {confirmedAppointment.date && format(new Date(confirmedAppointment.date), convertDateFormat(dateFormat), { locale: fr })}
                  </div>
                  <div className="font-medium mt-1">{confirmedAppointment.time}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Réservé pour</div>
                  <div className="font-medium">
                    {confirmedAppointment.beneficiaryName 
                      ? `${confirmedAppointment.beneficiaryName} (${confirmedAppointment.beneficiaryRelation})`
                      : `${confirmedAppointment.firstName} ${confirmedAppointment.lastName}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={handleCloseConfirmation} className="w-full" data-testid="button-close-confirmation">
              Fermer
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                handleCloseConfirmation();
                setLocation("/");
              }} 
              className="w-full"
              data-testid="button-return-home"
            >
              Retour à la page d'accueil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
