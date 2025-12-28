import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, addDays, addWeeks, startOfDay, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { User, Phone, Mail, ChevronLeft, ChevronRight, X, Calendar, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Professional, TimeSlot, ProfessionalService, ClinicMember, Appointment, Patient } from "@shared/schema";
import { formatTime } from "@/lib/timeUtils";
import { formatPrice } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";

interface ProfessionalBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAppointment?: Appointment;
  selectedDate?: Date;
  selectedStartTime?: string;
  selectedEndTime?: string;
}

const bookingFormSchema = z.object({
  patientId: z.string().optional(),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Numéro de téléphone invalide"),
  notes: z.string().optional(),
  professionalServiceId: z.string().optional(),
  assignedProfessionalId: z.string(),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

interface ClinicMemberWithDetails extends ClinicMember {
  professional?: Professional;
}

export default function ProfessionalBookingModal({ 
  open, 
  onOpenChange, 
  existingAppointment,
  selectedDate,
  selectedStartTime,
  selectedEndTime 
}: ProfessionalBookingModalProps) {
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();

  // Determine if this is a mobile pre-selection (should hide calendar)
  const isMobilePreselection = !existingAppointment && selectedDate && selectedStartTime;

  // Get current professional
  const { data: currentProfessional } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Get clinic members if professional is in a clinic
  const { data: clinicMembers = [] } = useQuery<ClinicMemberWithDetails[]>({
    queryKey: [`/api/clinics/${currentProfessional?.clinicId}/members`],
    enabled: !!currentProfessional?.clinicId && open,
  });

  // Filter only professionals and admins who can have appointments assigned
  const availableProfessionals = clinicMembers.filter(member => 
    (member.role === 'Professionnel' || member.role === 'Admin') && member.professionalId
  );

  // Get patients list
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/professional/patients"],
    enabled: open,
  });

  // Get professional services
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: ["/api/professional/services"],
    enabled: open && !!currentProfessional,
  });

  // Determine which professional's availability to show
  const [assignedProfessionalId, setAssignedProfessionalId] = useState<string>("");

  useEffect(() => {
    if (currentProfessional) {
      if (existingAppointment) {
        setAssignedProfessionalId(existingAppointment.professionalId || currentProfessional.id);
      } else if (!currentProfessional.clinicId || availableProfessionals.length === 0) {
        setAssignedProfessionalId(currentProfessional.id);
      } else {
        const currentUserIsProfessional = availableProfessionals.some(
          t => t.professionalId === currentProfessional.id
        );
        setAssignedProfessionalId(
          currentUserIsProfessional ? currentProfessional.id : (availableProfessionals[0]?.professionalId || "")
        );
      }
    }
  }, [currentProfessional, availableProfessionals, existingAppointment]);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      patientId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      professionalServiceId: "",
      assignedProfessionalId: assignedProfessionalId,
    },
  });

  // Update form when existing appointment changes
  useEffect(() => {
    if (existingAppointment && open) {
      const patient = patients.find(p => p.id === existingAppointment.patientId);
      if (patient) {
        setSelectedPatient(patient);
        setShowNewPatientForm(false);
      }
      
      form.reset({
        patientId: existingAppointment.patientId || "",
        firstName: existingAppointment.firstName,
        lastName: existingAppointment.lastName,
        email: existingAppointment.email || "",
        phone: existingAppointment.phone || "",
        notes: existingAppointment.notes || "",
        professionalServiceId: existingAppointment.professionalServiceId || "",
        assignedProfessionalId: existingAppointment.professionalId || assignedProfessionalId,
      });

      // Set selected slot from existing appointment
      const appointmentDate = new Date(existingAppointment.appointmentDate);
      setSelectedSlot({
        id: "existing",
        professionalId: existingAppointment.professionalId || "",
        slotDate: appointmentDate,
        startTime: existingAppointment.startTime || "",
        endTime: existingAppointment.endTime || "",
        isBooked: false,
        createdAt: new Date(),
      });
    } else if (selectedDate && selectedStartTime) {
      // Pre-select date and time if provided
      let endTime: string;
      
      if (selectedEndTime) {
        // Use provided end time if available
        endTime = selectedEndTime;
      } else {
        // Calculate end time from service duration
        const duration = services[0]?.duration || 60;
        const [hours, minutes] = selectedStartTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60);
        const endMinutes = totalMinutes % 60;
        endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      }

      setSelectedSlot({
        id: "preselected",
        professionalId: assignedProfessionalId,
        slotDate: selectedDate,
        startTime: selectedStartTime,
        endTime: endTime,
        isBooked: false,
        createdAt: new Date(),
      });

      // Auto-select service if only one available
      if (services.length === 1 && !form.getValues("professionalServiceId")) {
        form.setValue("professionalServiceId", services[0].id);
      }
    }
  }, [existingAppointment, patients, open, selectedDate, selectedStartTime, selectedEndTime, services, form, assignedProfessionalId]);

  // Update assignedProfessionalId in form when it changes
  useEffect(() => {
    if (assignedProfessionalId) {
      form.setValue("assignedProfessionalId", assignedProfessionalId);
    }
  }, [assignedProfessionalId, form]);

  // Calculate the week start (Monday) based on offset
  const today = startOfDay(new Date());
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addWeeks(currentWeekMonday, weekOffset);
  const weekEnd = addDays(weekStart, 6);

  // Fetch available time slots for the assigned professional
  const { data: timeSlots = [], isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/professionals/${assignedProfessionalId}/timeslots`, weekStart, weekEnd],
    queryFn: async () => {
      const response = await fetch(
        `/api/professionals/${assignedProfessionalId}/timeslots?fromDate=${weekStart.toISOString()}&toDate=${weekEnd.toISOString()}`
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: !!assignedProfessionalId && open,
  });

  // Filter and sort slots for timeline view
  const availableSlots = timeSlots
    .map(slot => ({
      ...slot,
      slotDate: new Date(slot.slotDate),
    }))
    .filter(slot => weekOffset > 0 || slot.slotDate >= startOfDay(today))
    .sort((a, b) => a.slotDate.getTime() - b.slotDate.getTime() || a.startTime.localeCompare(b.startTime));

  const getWeekTitle = () => {
    if (weekOffset === 0) return "Cette semaine";
    if (weekOffset === 1) return "La semaine prochaine";
    return `Semaine du ${format(weekStart, "d MMM", { locale: fr })}`;
  };

  // Mutation for creating/updating appointment
  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData & { appointmentDate: string; startTime: string; endTime: string }) => {
      if (existingAppointment) {
        return await apiRequest("PATCH", `/api/professional/appointments/${existingAppointment.id}`, {
          patientId: data.patientId || null,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          appointmentDate: data.appointmentDate,
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes,
          professionalServiceId: data.professionalServiceId || null,
          professionalId: data.assignedProfessionalId,
        });
      } else {
        return await apiRequest("POST", "/api/professional/appointments/create-manual", {
          ...data,
          professionalId: data.assignedProfessionalId,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: existingAppointment ? "Rendez-vous modifié !" : "Rendez-vous créé !",
        description: existingAppointment 
          ? "Le rendez-vous a été modifié avec succès."
          : "Le rendez-vous a été créé avec succès.",
        duration: 5000,
      });
      
      // Invalidate all relevant queries to refresh availability everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/professional/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/professional/patients'] });
      
      // Invalidate timeslots queries for all professionals to refresh availability
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0]?.toString() || '';
          return key.startsWith('/api/professionals/') && key.includes('/timeslots');
        }
      });
      
      onOpenChange(false);
      resetModal();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Une erreur est survenue. Veuillez réessayer.";
      
      // Check if it's a conflict error (409)
      const isConflict = errorMessage.includes("déjà réservé") || errorMessage.includes("already booked");
      
      toast({
        title: isConflict ? "Créneau indisponible" : "Erreur",
        description: isConflict 
          ? "Ce créneau horaire est déjà réservé. Veuillez en choisir un autre."
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const resetModal = () => {
    setWeekOffset(0);
    setSelectedSlot(null);
    setSelectedPatient(null);
    setShowNewPatientForm(false);
    form.reset();
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowNewPatientForm(false);
    form.setValue("patientId", patient.id);
    form.setValue("firstName", patient.firstName);
    form.setValue("lastName", patient.lastName);
    form.setValue("email", patient.email || "");
    form.setValue("phone", patient.phone || "");
    setPatientSearchOpen(false);
  };

  const handleSubmit = async (data: BookingFormData) => {
    if (!selectedSlot) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un créneau horaire.",
        variant: "destructive",
      });
      return;
    }
    
    const slotDate = new Date(selectedSlot.slotDate);
    const appointmentDate = format(slotDate, 'yyyy-MM-dd');
    
    await bookingMutation.mutateAsync({
      ...data,
      appointmentDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    });
  };

  // Get assigned professional info
  const assignedProf = availableProfessionals.find(m => m.professionalId === assignedProfessionalId);
  const profInfo = assignedProf?.professional || currentProfessional;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogContent className="max-w-full sm:max-w-[600px] max-h-[95vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {existingAppointment ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Formulaire de réservation de rendez-vous
        </DialogDescription>
        
        {/* Modern Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-4 shadow-lg">
          <h1 className="text-xl font-semibold" aria-hidden="true">
            {existingAppointment ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-72px)] bg-gray-50">
          <div className="p-4 space-y-3">
            {/* Professional Card */}
            {profInfo && (
              <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-base font-semibold">
                  {profInfo.firstName?.[0]}{profInfo.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {profInfo.firstName} {profInfo.lastName}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {profInfo.professions && profInfo.professions.length > 0 
                      ? profInfo.professions.join(', ') 
                      : 'Profession non spécifiée'}
                  </p>
                </div>
                {currentProfessional?.clinicId && availableProfessionals.length > 1 && (
                  <Select value={assignedProfessionalId} onValueChange={setAssignedProfessionalId}>
                    <SelectTrigger className="w-[120px] text-xs" data-testid="select-assigned-professional">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfessionals.map((member) => (
                        <SelectItem key={member.professionalId} value={member.professionalId || ""}>
                          {member.professional?.firstName} {member.professional?.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Date & Time Section */}
            {isMobilePreselection ? (
              /* Compact slot info for mobile pre-selection */
              selectedSlot && (
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <h2 className="text-sm font-semibold text-gray-900">Créneau sélectionné</h2>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-blue-700">
                        {format(new Date(selectedSlot.slotDate), `EEEE ${convertDateFormat(dateFormat)}`, { locale: fr })}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* Full calendar view */
              <div className="bg-white rounded-xl p-4 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Date et heure</h2>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                    disabled={weekOffset === 0}
                    className="h-8"
                    data-testid="button-prev-week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold text-gray-700">
                    {getWeekTitle()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWeekOffset(weekOffset + 1)}
                    className="h-8"
                    data-testid="button-next-week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Timeline Scroll */}
                <div className="relative -mx-4 px-4">
                  {slotsLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="overflow-x-auto pb-2 scrollbar-thin">
                      <div className="flex gap-2 min-w-max px-1">
                        {availableSlots.map((slot) => {
                          const isSelected = selectedSlot?.id === slot.id;
                          return (
                            <button
                              key={slot.id}
                              onClick={() => handleSlotSelect(slot)}
                              className={`min-w-[100px] flex-shrink-0 p-3 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                                  : 'bg-white border-gray-200 text-gray-900 hover:border-blue-300 hover:shadow-sm'
                              }`}
                              data-testid={`button-slot-${slot.id}`}
                            >
                              <div className={`text-base font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                {formatTime(slot.startTime)}
                              </div>
                              <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                {format(slot.slotDate, convertDateFormat(dateFormat), { locale: fr })}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-4">
                      Aucune disponibilité pour cette semaine.
                    </p>
                  )}
                </div>

                {/* Selected Slot Info */}
                {selectedSlot && (
                  <div className="mt-3 bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-0.5">Créneau sélectionné</div>
                      <div className="text-sm font-semibold text-blue-700">
                        {format(new Date(selectedSlot.slotDate), convertDateFormat(dateFormat), { locale: fr })} 
                        {" à "} 
                        {formatTime(selectedSlot.startTime)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Patient Information Section */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-900">Informations client</h2>
              </div>

              {/* Patient selector */}
              {!existingAppointment && !showNewPatientForm && (
                <div className="space-y-2 mb-3">
                  <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between h-10 text-left font-normal text-sm"
                        data-testid="button-select-patient"
                      >
                        {selectedPatient ? (
                          <span className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                        ) : (
                          <span className="text-gray-500">Sélectionner un patient existant</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Rechercher un patient..." />
                        <CommandList>
                          <CommandEmpty>Aucun patient trouvé.</CommandEmpty>
                          <CommandGroup>
                            {patients.map((patient) => (
                              <CommandItem
                                key={patient.id}
                                onSelect={() => handlePatientSelect(patient)}
                                data-testid={`option-patient-${patient.id}`}
                              >
                                {patient.firstName} {patient.lastName} ({patient.email})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setShowNewPatientForm(true);
                      setSelectedPatient(null);
                      form.setValue("patientId", "");
                    }}
                    className="p-0 h-auto text-blue-600"
                    data-testid="button-new-patient"
                  >
                    + Nouveau patient
                  </Button>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
                  {(showNewPatientForm || existingAppointment) && (
                    <>
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-gray-700">
                              Prénom <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="h-10 border-2 rounded-lg text-sm" 
                                placeholder="Jean" 
                                data-testid="input-firstname" 
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
                            <FormLabel className="text-xs font-semibold text-gray-700">
                              Nom <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="h-10 border-2 rounded-lg text-sm" 
                                placeholder="Dupont" 
                                data-testid="input-lastname" 
                              />
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
                            <FormLabel className="text-xs font-semibold text-gray-700">
                              Email <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input 
                                  {...field} 
                                  type="email" 
                                  className="h-10 border-2 rounded-lg pl-10 text-sm" 
                                  placeholder="jean.dupont@exemple.ca" 
                                  data-testid="input-email" 
                                />
                              </div>
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
                            <FormLabel className="text-xs font-semibold text-gray-700">
                              Téléphone <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input 
                                  {...field} 
                                  type="tel" 
                                  className="h-10 border-2 rounded-lg pl-10 text-sm" 
                                  placeholder="+1 514-123-4567" 
                                  data-testid="input-phone" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {services.length > 0 && (
                    <FormField
                      control={form.control}
                      name="professionalServiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-700">Service (optionnel)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10 border-2 rounded-lg text-sm" data-testid="select-service">
                                <SelectValue placeholder="Sélectionnez un service" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {services.map((service) => (
                                <SelectItem key={service.id} value={service.id} data-testid={`option-service-${service.id}`}>
                                  {service.name} - {service.duration} min - {formatPrice(service.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-700">Commentaires (optionnel)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Notes additionnelles..." 
                            rows={2} 
                            className="border-2 rounded-lg resize-none text-sm"
                            data-testid="input-notes" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={bookingMutation.isPending || !selectedSlot}
                    className="w-full h-10 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg mt-4 text-sm"
                    data-testid="button-confirm-booking"
                  >
                    {bookingMutation.isPending 
                      ? "Enregistrement..." 
                      : existingAppointment 
                        ? "Modifier le rendez-vous" 
                        : "Créer le rendez-vous"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
