import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDateFormat } from "@/hooks/useDateFormat";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: string; // ISO format (yyyy-MM-dd)
  max?: string; // ISO format (yyyy-MM-dd)
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  disabled = false,
  className,
  min,
  max,
}: DatePickerProps) {
  const { dateFormat } = useDateFormat();

  // Convert the date format from database format to date-fns format
  const getDateFnsFormat = (dbFormat: string) => {
    switch (dbFormat) {
      case "dd/MM/yyyy":
        return "dd/MM/yyyy";
      case "MM/dd/yyyy":
        return "MM/dd/yyyy";
      case "yyyy-MM-dd":
        return "yyyy-MM-dd";
      default:
        return "dd/MM/yyyy";
    }
  };

  const displayFormat = getDateFnsFormat(dateFormat);

  // Parse the value string (yyyy-MM-dd) into a Date object
  const selectedDate = value && value.trim()
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  // Validate selectedDate
  const validSelectedDate = selectedDate && isValid(selectedDate) ? selectedDate : undefined;

  // Parse min/max dates for Calendar component
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : undefined;

  // Create disabled matcher for Calendar
  const disabledMatcher = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // Handle date selection from calendar
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Always store in ISO format (yyyy-MM-dd) for backend compatibility
      const isoDate = format(date, "yyyy-MM-dd");
      onChange(isoDate);
    } else {
      onChange("");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {validSelectedDate ? (
            format(validSelectedDate, displayFormat, { locale: fr })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={validSelectedDate}
          onSelect={handleSelect}
          disabled={disabledMatcher}
          initialFocus
          locale={fr}
          fromDate={minDate}
          toDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}
