import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";

interface TimeInput24hProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "data-testid"?: string;
}

export function TimeInput24h({ value, onChange, className, "data-testid": testId }: TimeInput24hProps) {
  const [hours, minutes] = value.split(":").map(v => parseInt(v) || 0);

  const handleHoursChange = (newHours: string) => {
    const h = Math.min(23, Math.max(0, parseInt(newHours) || 0));
    onChange(`${h.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
  };

  const handleMinutesChange = (newMinutes: string) => {
    const m = Math.min(59, Math.max(0, parseInt(newMinutes) || 0));
    onChange(`${hours.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  };

  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <Input
        type="number"
        min="0"
        max="23"
        value={hours.toString().padStart(2, "0")}
        onChange={(e) => handleHoursChange(e.target.value)}
        className="w-14 text-center p-2"
        data-testid={testId ? `${testId}-hours` : undefined}
      />
      <span className="text-muted-foreground">:</span>
      <Input
        type="number"
        min="0"
        max="59"
        value={minutes.toString().padStart(2, "0")}
        onChange={(e) => handleMinutesChange(e.target.value)}
        className="w-14 text-center p-2"
        data-testid={testId ? `${testId}-minutes` : undefined}
      />
      <Clock className="h-4 w-4 text-muted-foreground ml-1" />
    </div>
  );
}
