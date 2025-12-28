import { useMemo } from "react";
import type { Appointment, ProfessionalSchedule, ProfessionalBreak } from "@shared/schema";
import { parseISO, isSameDay } from "date-fns";

interface TimeSlot {
  time: string;
  available: boolean;
}

interface UseTimeSlotsParams {
  selectedDate: string; // Format "YYYY-MM-DD"
  schedules: ProfessionalSchedule[];
  appointments: Appointment[];
  breaks?: ProfessionalBreak[]; // Breaks and unavailabilities
  serviceDuration?: number; // Duration in minutes, default 60
}

export function useTimeSlots({
  selectedDate,
  schedules,
  appointments,
  breaks = [],
  serviceDuration = 60,
}: UseTimeSlotsParams): TimeSlot[] {
  return useMemo(() => {
    if (!selectedDate) return [];

    const date = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = date.getDay();

    // Find schedule for this day
    const schedule = schedules.find(s => s.dayOfWeek === dayOfWeek && s.isAvailable);
    if (!schedule) return [];

    // Parse schedule times
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    // Generate all possible time slots
    const slots: TimeSlot[] = [];
    let currentHour = startHour;
    let currentMin = startMin;

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Calculate end time for this slot
      const slotEndMin = currentMin + serviceDuration;
      const slotEndHour = currentHour + Math.floor(slotEndMin / 60);
      const slotEndMinutes = slotEndMin % 60;

      // Check if slot end time fits within schedule
      const fitsInSchedule = slotEndHour < endHour || 
        (slotEndHour === endHour && slotEndMinutes <= endMin);

      if (!fitsInSchedule) {
        break;
      }

      // Check if slot overlaps with existing appointments
      const hasAppointment = appointments.some(apt => {
        // Handle different date formats
        let aptDate: Date;
        const dateValue = apt.appointmentDate as Date | string;
        
        if (typeof dateValue === 'string') {
          const dateStr = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
          aptDate = parseISO(dateStr);
        } else if (dateValue instanceof Date) {
          aptDate = dateValue;
        } else {
          return false;
        }
        
        if (!isSameDay(aptDate, date)) return false;
        if (apt.status === 'cancelled') return false;
        if (!apt.startTime || !apt.endTime) return false;

        const aptStartTime = String(apt.startTime);
        const aptEndTime = String(apt.endTime);
        const [aptStartHour, aptStartMin] = aptStartTime.split(':').map(Number);
        const [aptEndHour, aptEndMin] = aptEndTime.split(':').map(Number);

        // Check overlap
        const slotStart = currentHour * 60 + currentMin;
        const slotEnd = slotEndHour * 60 + slotEndMinutes;
        const aptStart = aptStartHour * 60 + aptStartMin;
        const aptEnd = aptEndHour * 60 + aptEndMin;

        return slotStart < aptEnd && slotEnd > aptStart;
      });

      // Check if slot overlaps with breaks or unavailabilities
      const hasBreak = breaks.some(brk => {
        if (brk.dayOfWeek !== dayOfWeek) return false;
        if (!brk.startTime || !brk.endTime) return false;

        const [brkStartHour, brkStartMin] = brk.startTime.split(':').map(Number);
        const [brkEndHour, brkEndMin] = brk.endTime.split(':').map(Number);

        // Check overlap
        const slotStart = currentHour * 60 + currentMin;
        const slotEnd = slotEndHour * 60 + slotEndMinutes;
        const brkStart = brkStartHour * 60 + brkStartMin;
        const brkEnd = brkEndHour * 60 + brkEndMin;

        return slotStart < brkEnd && slotEnd > brkStart;
      });

      slots.push({
        time: timeStr,
        available: !hasAppointment && !hasBreak,
      });

      // Move to next slot (increment by service duration to avoid overlaps)
      currentMin += serviceDuration;
      while (currentMin >= 60) {
        currentMin -= 60;
        currentHour += 1;
      }
    }

    return slots;
  }, [selectedDate, schedules, appointments, breaks, serviceDuration]);
}
