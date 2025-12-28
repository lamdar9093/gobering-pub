import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { format, addDays, addWeeks, startOfDay, startOfWeek, differenceInWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeSlot } from "@shared/schema";
import { formatTime } from "@/lib/timeUtils";

interface AvailabilitySelectorProps {
  professionalId: string;
  onSlotSelect: (slot: TimeSlot) => void;
  selectedSlotId?: string;
  excludeAppointmentId?: string;
  professionalServiceId?: string;
  excludeSlotDate?: string;
  excludeSlotTime?: string;
  currentAppointmentProfessionalId?: string;
  initialDate?: string;
}

export default function AvailabilitySelector({ 
  professionalId, 
  onSlotSelect,
  selectedSlotId,
  excludeAppointmentId,
  professionalServiceId,
  excludeSlotDate,
  excludeSlotTime,
  currentAppointmentProfessionalId,
  initialDate
}: AvailabilitySelectorProps) {
  const today = startOfDay(new Date());
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  
  // Calculate initial week offset based on initialDate if provided
  const calculateInitialOffset = () => {
    if (!initialDate) return 0;
    const targetDate = startOfDay(new Date(initialDate));
    const targetWeekMonday = startOfWeek(targetDate, { weekStartsOn: 1 });
    return differenceInWeeks(targetWeekMonday, currentWeekMonday);
  };
  
  const [weekOffset, setWeekOffset] = useState(calculateInitialOffset());
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || format(today, 'yyyy-MM-dd'));

  const weekStart = addWeeks(currentWeekMonday, weekOffset);
  const weekEnd = addDays(weekStart, 6);

  const { data: timeSlots = [], isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/professionals/${professionalId}/timeslots`, weekStart, weekEnd, excludeAppointmentId, professionalServiceId],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: weekStart.toISOString(),
        toDate: weekEnd.toISOString(),
      });
      
      if (excludeAppointmentId) {
        params.append('excludeAppointmentId', excludeAppointmentId);
      }
      
      if (professionalServiceId) {
        params.append('professionalServiceId', professionalServiceId);
      }
      
      const response = await fetch(
        `/api/professionals/${professionalId}/timeslots?${params.toString()}`
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
  });

  const slotsByDate: Record<string, TimeSlot[]> = {};
  timeSlots.forEach(slot => {
    const slotDate = new Date(slot.slotDate);
    const dateKey = format(slotDate, 'yyyy-MM-dd');
    
    const shouldIncludeSlot = weekOffset > 0 || slotDate >= startOfDay(today);
    
    // Exclude the exact slot being rescheduled (same date, time, AND professional)
    // Only exclude if we're showing slots for the same professional as the current appointment
    const isExcludedSlot = excludeSlotDate && excludeSlotTime && 
      currentAppointmentProfessionalId === professionalId &&
      format(slotDate, 'yyyy-MM-dd') === excludeSlotDate && 
      slot.startTime === excludeSlotTime;
    
    if (shouldIncludeSlot && !isExcludedSlot) {
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

  // Update selectedDate when week changes
  useEffect(() => {
    // Check if today is in the currently displayed days
    const todayKey = format(today, 'yyyy-MM-dd');
    const isCurrentWeek = weekOffset === 0;
    const todayInDisplayDays = displayDays.some(day => format(day, 'yyyy-MM-dd') === todayKey);
    
    if (isCurrentWeek && todayInDisplayDays) {
      // If we're on current week and today is displayed, select today
      setSelectedDate(todayKey);
    } else {
      // Otherwise, select the first displayed day
      setSelectedDate(format(displayDays[0], 'yyyy-MM-dd'));
    }
  }, [weekOffset, today]);

  const getWeekTitle = () => {
    if (weekOffset === 0) return "Cette semaine";
    if (weekOffset === 1) return "La semaine prochaine";
    return "Dans plus d'une semaine";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
          disabled={weekOffset === 0}
          data-testid="button-prev-week"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-blue-600 min-w-[180px] text-center">
          {getWeekTitle()}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(weekOffset + 1)}
          data-testid="button-next-week"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {slotsLoading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className={`grid gap-2 ${
            displayDays.length === 7 ? 'grid-cols-7' :
            displayDays.length === 6 ? 'grid-cols-6' :
            'grid-cols-5'
          }`}>
            {displayDays.map((day, index) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const daySlots = slotsByDate[dateKey] || [];
              const isSelectedDay = dateKey === selectedDate;
              
              return (
                <div 
                  key={index} 
                  className={`text-center border-2 rounded-lg p-2 cursor-pointer transition-all ${
                    isSelectedDay 
                      ? 'border-blue-600 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <div className={`font-medium text-xs capitalize mb-0.5 ${
                    isSelectedDay ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    {format(day, 'EEE', { locale: fr })}.
                  </div>
                  <div className={`text-base font-bold mb-0.5 ${
                    isSelectedDay ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {format(day, 'd', { locale: fr })}
                  </div>
                  <div className={`text-[10px] mb-2 capitalize ${
                    isSelectedDay ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {format(day, 'MMM', { locale: fr })}.
                  </div>
                  <div className="space-y-1.5">
                    {daySlots.length > 0 ? (
                      daySlots.map((slot) => (
                        <button
                          key={slot.id}
                          className={`w-full px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                            selectedSlotId === slot.id
                              ? 'bg-blue-700 text-white'
                              : 'text-white bg-blue-500 hover:bg-blue-600'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlotSelect(slot);
                          }}
                          data-testid={`button-slot-${slot.id}`}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))
                    ) : (
                      <div className="text-[10px] text-gray-400 py-1.5">
                        Aucun
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {timeSlots.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Aucune disponibilité pour cette semaine.
            </p>
          )}
        </>
      )}
    </div>
  );
}
