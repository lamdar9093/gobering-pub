import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Mail, ChevronLeft, ChevronRight, Calendar, CalendarCheck, Clock } from "lucide-react";
import { useLocation, Link, useSearch } from "wouter";
import { format, addDays, startOfWeek, addWeeks, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";
import type { Professional, TimeSlot, ProfessionalService } from "@shared/schema";
import BookingModal from "@/components/booking-modal";
import WaitlistModal from "@/components/waitlist-modal";
import SearchForm from "@/components/search-form";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";

// Component for each professional in list
function ProfessionalListItem({ professional, searchParams }: { professional: Professional; searchParams: URLSearchParams }) {
  const { dateFormat, timeFormat } = useDateFormat();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<"disponibilites" | "information">("disponibilites");
  
  const today = startOfDay(new Date());
  const todayKey = format(today, 'yyyy-MM-dd');
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addWeeks(currentWeekMonday, weekOffset);
  const weekEnd = addDays(weekStart, 6);
  
  // Fetch professional services (public - visible only)
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: [`/api/professionals/${professional.id}/services/public`],
  });

  // Use first service by default if not selected
  const effectiveServiceId = selectedServiceId || services[0]?.id;

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: [`/api/professionals/${professional.id}/timeslots`, weekStart, weekEnd, effectiveServiceId],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: weekStart.toISOString(),
        toDate: weekEnd.toISOString(),
      });
      
      if (effectiveServiceId) {
        params.append('professionalServiceId', effectiveServiceId);
      }
      
      const response = await fetch(
        `/api/professionals/${professional.id}/timeslots?${params.toString()}`
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: !!professional.id,
  });

  // Group slots by date and filter out past days (only for current week)
  const slotsByDate: Record<string, TimeSlot[]> = {};
  timeSlots.forEach(slot => {
    const slotDate = new Date(slot.slotDate);
    const dateKey = format(slotDate, 'yyyy-MM-dd');
    
    // For current week (weekOffset === 0), only show slots from today onwards
    // For future weeks, show all slots
    const shouldIncludeSlot = weekOffset > 0 || slotDate >= startOfDay(today);
    
    if (shouldIncludeSlot) {
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(slot);
    }
  });

  // Dynamically determine which days to display (Mon-Fri by default, + Sat/Sun if they have slots)
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

  // Update selectedDay when week changes or displayDays change
  useEffect(() => {
    if (displayDays.length === 0) return;
    
    const isCurrentWeek = weekOffset === 0;
    const todayInDisplayDays = displayDays.some(day => format(day, 'yyyy-MM-dd') === todayKey);
    
    if (isCurrentWeek && todayInDisplayDays) {
      // If we're on current week and today is displayed, select today
      setSelectedDay(todayKey);
    } else if (displayDays.length > 0) {
      // Otherwise, select the first displayed day
      setSelectedDay(format(displayDays[0], 'yyyy-MM-dd'));
    }
  }, [weekOffset, todayKey, displayDays.length, timeSlots.length]);

  // Check if at least one day is today or in the future
  const hasAnyFutureOrCurrentDate = displayDays.some(day => day >= startOfDay(today));

  // Count total visible slots after filtering
  const visibleSlotsCount = Object.values(slotsByDate).reduce((total, slots) => total + slots.length, 0);

  // Get week title based on offset
  const getWeekTitle = () => {
    if (weekOffset === 0) return "Cette semaine";
    if (weekOffset === 1) return "La semaine prochaine";
    return "Dans plus d'une semaine";
  };

  // Get initials for avatar
  const getInitials = () => {
    const first = professional.firstName?.charAt(0) || '';
    const last = professional.lastName?.charAt(0) || '';
    return (first + last).toUpperCase();
  };

  return (
    <>
      <Card className="mb-3 shadow-sm hover:shadow-md transition-all duration-200" data-testid={`list-item-professional-${professional.id}`}>
        <CardContent className="p-4">
          {/* Header with professional info */}
          <div className="flex gap-3 mb-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {professional.profilePicture ? (
                <img 
                  src={professional.profilePicture} 
                  alt={`${professional.firstName} ${professional.lastName}`}
                  className="h-24 w-24 rounded-xl object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border-2 border-gray-100">
                  <span className="text-3xl font-bold text-blue-600">{getInitials()}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900 mb-1">
                {professional.firstName} {professional.lastName}
              </h3>
              
              {/* Specialty Badge */}
              {professional.professions && professional.professions.length > 0 && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 mb-1.5 text-xs font-semibold">
                  {professional.professions[0]}
                </Badge>
              )}

              {/* Address */}
              <div className="flex items-center text-xs text-gray-600">
                <MapPin className="h-3 w-3 mr-1 text-blue-500 flex-shrink-0" />
                <span className="truncate">{professional.address}, {professional.city}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-3">
            <button
              className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 ${
                activeTab === "disponibilites"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("disponibilites")}
              data-testid={`tab-availability-${professional.id}`}
            >
              Disponibilités
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 ${
                activeTab === "information"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("information")}
              data-testid={`tab-information-${professional.id}`}
            >
              Information
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "disponibilites" && (
            <div className="space-y-2">
              {/* Service Selector */}
              {services.length > 0 && (
                <Select 
                  value={selectedServiceId || services[0]?.id || ""} 
                  onValueChange={setSelectedServiceId}
                >
                  <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-service-${professional.id}`}>
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
              )}

              {/* Week Navigation - Desktop only */}
              <div className="hidden md:flex items-center justify-between">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  disabled={weekOffset === 0}
                  data-testid={`button-prev-week-${professional.id}`}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs font-semibold text-blue-600">
                  {getWeekTitle()}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  data-testid={`button-next-week-${professional.id}`}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>

              {/* Desktop/Tablet View */}
              <div className="hidden md:block space-y-2">
                {/* Days and slots - Desktop shows dynamic columns (5-7) */}
                <div className={`grid gap-2 ${
                  displayDays.length === 7 ? 'grid-cols-7' :
                  displayDays.length === 6 ? 'grid-cols-6' :
                  'grid-cols-5'
                }`}>
                  {displayDays.map((day, index) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const daySlots = slotsByDate[dateKey] || [];
                    const displaySlots = daySlots.slice(0, 2);
                    const isSelectedDay = dateKey === selectedDay;
                    const isPast = day < startOfDay(today);
                    
                    return (
                      <div 
                        key={index} 
                        className={`text-center p-1 rounded border transition-all ${
                          isPast
                            ? 'cursor-not-allowed opacity-60 bg-slate-100 border-gray-200'
                            : isSelectedDay 
                            ? 'border-blue-600 bg-blue-50 cursor-pointer' 
                            : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (!isPast) {
                            setSelectedDay(dateKey);
                          }
                        }}
                      >
                        <div className={`text-xs font-medium capitalize ${
                          isPast 
                            ? 'text-slate-500' 
                            : isSelectedDay ? 'text-blue-700' : 'text-gray-600'
                        }`}>
                          {format(day, 'EEE', { locale: fr })}
                        </div>
                        <div className={`text-sm font-semibold ${
                          isPast 
                            ? 'text-slate-500' 
                            : isSelectedDay ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {format(day, 'd', { locale: fr })}
                        </div>
                        <div className={`text-xs mb-0.5 capitalize ${
                          isPast 
                            ? 'text-slate-500' 
                            : isSelectedDay ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {format(day, 'MMM', { locale: fr })}
                        </div>
                        <div className="space-y-0.5">
                          {displaySlots.map((slot) => (
                            <button
                              key={slot.id}
                              className="w-full px-1 py-0.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSlot(slot);
                                setBookingModalOpen(true);
                              }}
                              data-testid={`button-slot-${slot.id}`}
                            >
                              {slot.startTime.slice(0, 5)}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {visibleSlotsCount === 0 && hasAnyFutureOrCurrentDate && (
                  <div className="text-center py-2" data-testid={`section-no-slots-${professional.id}`}>
                    <p className="text-xs text-gray-500 mb-2">
                      Aucune disponibilité {weekOffset === 0 ? 'cette semaine' : weekOffset === 1 ? 'la semaine prochaine' : 'cette semaine'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWaitlistModalOpen(true)}
                      data-testid={`button-join-waitlist-preview-${professional.id}`}
                      className="text-xs h-7"
                    >
                      Rejoindre la liste d'attente
                    </Button>
                  </div>
                )}

                {visibleSlotsCount > 0 && (
                  <div className="pt-1">
                    <Button
                      variant="link"
                      className="text-xs text-blue-600 h-auto p-0"
                      onClick={() => setBookingModalOpen(true)}
                      data-testid={`button-all-availability-${professional.id}`}
                    >
                      Voir toutes les disponibilités →
                    </Button>
                  </div>
                )}
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3">
                {/* Date Selection Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-slate-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-blue-500 px-3 py-2 flex items-center justify-between text-white">
                    <button
                      onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                      disabled={weekOffset === 0}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`button-prev-week-mobile-${professional.id}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="font-semibold text-sm">
                      {getWeekTitle()}
                    </h3>
                    <button
                      onClick={() => setWeekOffset(weekOffset + 1)}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors"
                      data-testid={`button-next-week-mobile-${professional.id}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-2">
                    <div className={`grid gap-1.5 ${
                      displayDays.length === 7 ? 'grid-cols-7' :
                      displayDays.length === 6 ? 'grid-cols-6' :
                      'grid-cols-5'
                    }`}>
                      {displayDays.map((day, index) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const daySlots = slotsByDate[dateKey] || [];
                        const hasSlots = daySlots.length > 0;
                        const isSelected = selectedDay === dateKey;
                        const isPast = day < startOfDay(today);
                        
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              if (!isPast) {
                                setSelectedDay(dateKey);
                              }
                            }}
                            disabled={isPast}
                            className={`p-2 rounded-lg text-center transition-all ${
                              isPast
                                ? 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-500 cursor-not-allowed opacity-60'
                                : isSelected && hasSlots
                                ? 'bg-primary text-white'
                                : isSelected && !hasSlots
                                ? 'bg-primary text-white'
                                : !hasSlots
                                ? 'bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-gray-500'
                                : 'bg-slate-50 dark:bg-gray-700 hover:bg-slate-100 dark:hover:bg-gray-600'
                            }`}
                            data-testid={`button-day-mobile-${professional.id}-${dateKey}`}
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
                {selectedDay && (() => {
                  const selectedDaySlots = slotsByDate[selectedDay] || [];
                  const hasSelectedDaySlots = selectedDaySlots.length > 0;
                  
                  if (!hasSelectedDaySlots) {
                    return (
                      <div className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Pas de disponibilité pour cette journée
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-slate-200 dark:border-gray-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Sélectionnez l'heure
                        </h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedDaySlots.map((slot) => (
                          <button
                            key={slot.id}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                            onClick={() => {
                              setSelectedSlot(slot);
                              setBookingModalOpen(true);
                            }}
                            data-testid={`button-slot-${slot.id}`}
                          >
                            {slot.startTime.slice(0, 5)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* No slots available for whole week */}
                {visibleSlotsCount === 0 && hasAnyFutureOrCurrentDate && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                      Pas de disponibilité
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                      onClick={() => setWaitlistModalOpen(true)}
                      data-testid={`button-join-waitlist-mobile-${professional.id}`}
                    >
                      Rejoindre la liste d'attente
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "information" && (
            <div className="space-y-3">
              {/* Section Coordonnées */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  Coordonnées
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Téléphone */}
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center flex-shrink-0">
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                        Téléphone
                      </div>
                      <a 
                        href={`tel:${professional.phone}`} 
                        className="text-xs font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {professional.phone}
                      </a>
                    </div>
                  </div>

                  {/* Email */}
                  {professional.email && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                      <div className="w-8 h-8 bg-white rounded flex items-center justify-center flex-shrink-0">
                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                          Email
                        </div>
                        <a 
                          href={`mailto:${professional.email}`} 
                          className="text-xs font-medium text-blue-600 hover:underline transition-colors truncate block"
                        >
                          {professional.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section À propos */}
              {professional.description && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">
                    À propos
                  </h3>
                  <div className="p-2.5 bg-gray-50 rounded-lg border-l-2 border-blue-500">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {professional.description}
                    </p>
                  </div>
                </div>
              )}


              {/* Section Services proposés */}
              {services && services.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Services proposés
                  </h3>
                  <div className="space-y-1.5">
                    {services.map((service) => (
                      <div 
                        key={service.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded flex items-center justify-center text-sm">
                            {service.emoji || '🩺'}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-900">
                              {service.name}
                            </h4>
                            <div className="text-xs text-gray-500">
                              {service.duration} min
                            </div>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-blue-600">
                          {(service.price / 100).toFixed(2)} $
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Spécialisations */}
              {professional.specializations && professional.specializations.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Spécialisations
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {professional.specializations.map((spec, index) => (
                      <div 
                        key={index}
                        className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700 font-medium"
                      >
                        {spec}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bouton Prendre rendez-vous */}
              <div className="pt-2 flex justify-center">
                <Button
                  onClick={() => setActiveTab("disponibilites")}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs py-2 px-6 rounded-lg shadow transition-all"
                  data-testid={`button-book-appointment-${professional.id}`}
                >
                  Prendre rendez-vous
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Modal */}
      <BookingModal
        open={bookingModalOpen}
        onOpenChange={(open) => {
          setBookingModalOpen(open);
          if (!open) {
            setSelectedSlot(null);
            setSelectedServiceId("");
          }
        }}
        professional={professional}
        initialSlot={selectedSlot}
        initialServiceId={selectedServiceId || services[0]?.id}
      />

      {/* Waitlist Modal */}
      <WaitlistModal
        open={waitlistModalOpen}
        onOpenChange={setWaitlistModalOpen}
        professional={professional}
        selectedDate={weekStart}
        selectedServiceId={effectiveServiceId}
      />
    </>
  );
}

export default function SearchResults() {
  const searchString = useSearch();
  const urlSearchParams = new URLSearchParams(searchString);
  const profession = urlSearchParams.get('profession') || '';
  const city = urlSearchParams.get('city') || '';
  const province = urlSearchParams.get('province') || '';
  const searchParams = urlSearchParams;
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  const { data: professionals = [], isLoading, error } = useQuery({
    queryKey: ['/api/professionals/search', profession, city, province],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (profession) params.append('profession', profession);
      if (city) params.append('city', city);
      if (province) params.append('province', province);
      
      const response = await fetch(`/api/professionals/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      return response.json() as Promise<Professional[]>;
    }
  });

  // Track when search parameters change (new search submitted)
  useEffect(() => {
    setSearchSubmitted(true);
    const timer = setTimeout(() => setSearchSubmitted(false), 100);
    return () => clearTimeout(timer);
  }, [profession, city, province]);

  // Refs for header to exclude from search bar visibility triggers
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Use scroll visibility hook for mobile
  const isSearchBarVisible = useScrollVisibility({ 
    threshold: 10,
    onSearchSubmit: searchSubmitted,
    headerRef: headerRef
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Recherche en cours...</h1>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Erreur de recherche</h1>
            <p className="text-gray-600 mb-4">Une erreur est survenue lors de la recherche.</p>
            <Link to="/">
              <Button>Retour à l'accueil</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Search Bar */}
      <div 
        ref={headerRef}
        className={`bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
          isSearchBarVisible ? 'translate-y-0' : '-translate-y-full md:translate-y-0'
        }`}
        data-testid="search-header"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
            <Link href="/" data-testid="link-home">
              <div className="flex items-center gap-2 cursor-pointer">
                <CalendarCheck className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                <h1 className="text-lg md:text-xl font-bold text-primary" data-testid="logo">Gobering</h1>
              </div>
            </Link>
            
            {/* Search Bar */}
            <div className="w-full md:flex-1 md:max-w-2xl md:mx-8">
              <SearchForm />
            </div>
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div ref={resultsContainerRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-32 md:pt-28">
        {/* Back button */}
        <div className="mb-6">
          <Link to="/">
            <Button variant="outline" className="border-2" data-testid="button-back-home-top">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        {/* Results Header */}
        <div className="mb-6">
          <p className="text-base text-gray-600 mb-4">
            <strong className="text-blue-600 font-bold">{professionals.length}</strong> professionnel{professionals.length > 1 ? 's' : ''} trouvé{professionals.length > 1 ? 's' : ''}
            {profession && ` pour "${profession}"`}
          </p>
          
          {/* Active filters */}
          {profession && (
            <Badge className="bg-blue-600 text-white px-3 py-1">
              Profession: {profession}
              <button className="ml-2 hover:bg-white/20 rounded-full p-0.5">×</button>
            </Badge>
          )}
        </div>

        {/* Results */}
        {professionals.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Aucun professionnel trouvé
              </h2>
              <p className="text-gray-600 mb-6">
                Essayez de modifier vos critères de recherche pour obtenir plus de résultats.
              </p>
              <Link to="/">
                <Button>Retour à l'accueil</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {professionals.map((professional) => (
              <ProfessionalListItem
                key={professional.id}
                professional={professional}
                searchParams={searchParams}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
