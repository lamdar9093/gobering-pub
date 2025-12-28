import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X } from "lucide-react";

const MEDICAL_EMOJIS = [
  { emoji: "🩺", label: "Consultation générale" },
  { emoji: "⭐", label: "Première consultation" },
  { emoji: "📋", label: "Ouverture de dossier" },
  { emoji: "🔙", label: "Mal de dos" },
  { emoji: "💆", label: "Massage" },
  { emoji: "🧘", label: "Yoga/Physio" },
  { emoji: "🦴", label: "Ostéopathie" },
  { emoji: "🦷", label: "Dentaire" },
  { emoji: "💊", label: "Médicament" },
  { emoji: "💉", label: "Injection" },
  { emoji: "❤️", label: "Cardiologie" },
  { emoji: "🧠", label: "Neurologie" },
  { emoji: "👁️", label: "Optométrie" },
  { emoji: "🦵", label: "Podologie" },
  { emoji: "🌿", label: "Naturopathie" },
  { emoji: "🏥", label: "Hôpital" },
  { emoji: "🩹", label: "Soin" },
  { emoji: "🧬", label: "Génétique" },
  { emoji: "🫀", label: "Cœur" },
  { emoji: "🫁", label: "Poumons" },
  { emoji: "🦻", label: "Audiologie" },
  { emoji: "👶", label: "Pédiatrie" },
  { emoji: "🤰", label: "Périnatalité" },
  { emoji: "🧑‍⚕️", label: "Soins généraux" },
  { emoji: "💪", label: "Sport/Réhab" },
  { emoji: "🧖", label: "Spa/Bien-être" },
  { emoji: "🍎", label: "Nutrition" },
];

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start text-left font-normal h-10"
          data-testid="button-emoji-picker"
        >
          {value ? (
            <span className="text-2xl">{value}</span>
          ) : (
            <span className="text-muted-foreground">Choisir un emoji</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Choisir un emoji</h4>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8 px-2"
                data-testid="button-clear-emoji"
              >
                <X className="h-4 w-4 mr-1" />
                Effacer
              </Button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {MEDICAL_EMOJIS.map((item) => (
              <button
                type="button"
                key={item.emoji}
                onClick={() => handleSelect(item.emoji)}
                className={`
                  aspect-square flex items-center justify-center text-2xl 
                  rounded-md hover:bg-accent transition-colors
                  ${value === item.emoji ? "bg-accent ring-2 ring-primary" : ""}
                `}
                title={item.label}
                data-testid={`emoji-option-${item.emoji}`}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
