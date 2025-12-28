import { Calendar as CalendarIcon, ChevronDown, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat } from "@/lib/dateFormatUtils";

interface TimeSlot {
  time: string; // Format "HH:MM"
  available: boolean;
}

interface TimelineSelectorProps {
  selectedDate: string; // Format "YYYY-MM-DD"
  selectedTime: string | null; // Format "HH:MM"
  timeSlots: TimeSlot[];
  onDateChange: (date: string) => void;
  onTimeSelect: (time: string) => void;
}

export function TimelineSelector({
  selectedDate,
  selectedTime,
  timeSlots,
  onDateChange,
  onTimeSelect,
}: TimelineSelectorProps) {
  const { dateFormat } = useDateFormat();
  
  const formattedDate = selectedDate 
    ? format(new Date(selectedDate), convertDateFormat(dateFormat), { locale: fr })
    : "";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      {/* Date selector */}
      <div className="mb-5">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-3">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            <span className="text-base font-semibold text-gray-800">{formattedDate}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 bg-white rounded-lg shadow-sm"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "date";
              input.value = selectedDate;
              input.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                if (target.value) {
                  onDateChange(target.value);
                }
              };
              input.click();
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline scroll */}
      <div className="overflow-x-auto -mx-5 px-5 pb-3">
        <div className="flex gap-3 min-w-max">
          {timeSlots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              onClick={() => slot.available && onTimeSelect(slot.time)}
              disabled={!slot.available}
              className={`
                min-w-[100px] px-5 py-4 rounded-xl text-center transition-all
                border-2
                ${
                  selectedTime === slot.time
                    ? "bg-blue-500 border-blue-500 text-white"
                    : slot.available
                    ? "bg-white border-gray-200 text-gray-800 hover:border-blue-300"
                    : "bg-gray-50 border-gray-200 text-gray-400 opacity-50 cursor-not-allowed"
                }
              `}
            >
              <div className="text-lg font-bold mb-1">{slot.time}</div>
              <div className="text-xs opacity-80">
                {slot.available ? "Disponible" : "Indisponible"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected info */}
      {selectedTime && (
        <div className="mt-4 bg-blue-50 p-4 rounded-xl flex items-center gap-3">
          <Clock className="h-6 w-6 text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">Rendez-vous sélectionné</div>
            <div className="text-base font-semibold text-blue-600">
              {formattedDate} à {selectedTime}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
