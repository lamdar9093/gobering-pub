import { Input } from "@/components/ui/input";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function TimeInput({ value, onChange, disabled, className, "data-testid": testId }: TimeInputProps) {
  const [hours = "09", minutes = "00"] = value ? value.split(":") : ["09", "00"];

  const handleHoursChange = (newHours: string) => {
    const h = Math.max(0, Math.min(23, parseInt(newHours) || 0));
    onChange(`${h.toString().padStart(2, "0")}:${minutes}`);
  };

  const handleMinutesChange = (newMinutes: string) => {
    const m = Math.max(0, Math.min(59, parseInt(newMinutes) || 0));
    onChange(`${hours}:${m.toString().padStart(2, "0")}`);
  };

  return (
    <div className={`flex items-center gap-1 ${className || ""}`} data-testid={testId}>
      <Input
        type="number"
        min="0"
        max="23"
        value={hours}
        onChange={(e) => handleHoursChange(e.target.value)}
        onBlur={(e) => {
          const val = e.target.value;
          if (val.length === 1) {
            handleHoursChange("0" + val);
          }
        }}
        disabled={disabled}
        className="w-16 text-center"
        placeholder="HH"
      />
      <span className="text-lg font-semibold">:</span>
      <Input
        type="number"
        min="0"
        max="59"
        value={minutes}
        onChange={(e) => handleMinutesChange(e.target.value)}
        onBlur={(e) => {
          const val = e.target.value;
          if (val.length === 1) {
            handleMinutesChange("0" + val);
          }
        }}
        disabled={disabled}
        className="w-16 text-center"
        placeholder="MM"
      />
    </div>
  );
}
