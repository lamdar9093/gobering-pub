import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { Appointment } from "@shared/schema";
import { formatTime } from "@/lib/timeUtils";

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const statusColors = {
  pending: "bg-gray-200 text-gray-700 border-gray-300",
  confirmed: "bg-green-100 text-green-700 border-green-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
  draft: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

export default function AppointmentCalendar({ 
  appointments, 
  onDayClick, 
  onAppointmentClick 
}: AppointmentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get all days to display (including leading/trailing days from adjacent months)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());
  
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()));
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(parseISO(apt.appointmentDate.toString()), date)
    );
  };

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            data-testid="button-today"
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={previousMonth}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, dayIdx) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <div
              key={dayIdx}
              className={`
                min-h-[120px] border rounded-lg p-2 transition-colors
                ${isCurrentMonth ? "bg-background" : "bg-muted/30"}
                ${isTodayDate ? "ring-2 ring-primary" : ""}
                hover:bg-accent/50 cursor-pointer
              `}
              onClick={() => onDayClick(day)}
              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`
                    text-sm font-medium
                    ${!isCurrentMonth ? "text-muted-foreground" : ""}
                    ${isTodayDate ? "text-primary font-bold" : ""}
                  `}
                >
                  {format(day, "d")}
                </span>
                {isCurrentMonth && dayAppointments.length === 0 && (
                  <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </div>

              {/* Appointments */}
              <div className="space-y-1">
                {dayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className={`
                      text-xs p-1 rounded border cursor-pointer
                      hover:opacity-80 transition-opacity
                      ${statusColors[apt.status as keyof typeof statusColors]}
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(apt);
                    }}
                    data-testid={`appointment-${apt.id}`}
                  >
                    <div className="font-medium truncate">
                      {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                    </div>
                    <div className="truncate">
                      {apt.firstName} {apt.lastName}
                    </div>
                    {(apt as any).serviceName && <div className="text-xs font-normal opacity-75">{(apt as any).serviceName}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
          <span className="text-sm">Confirmé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
          <span className="text-sm">Brouillon</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300"></div>
          <span className="text-sm">En attente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
          <span className="text-sm">Annulé</span>
        </div>
      </div>
    </Card>
  );
}
