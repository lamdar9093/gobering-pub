import { Calendar } from "lucide-react";

export default function LoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="relative">
        <Calendar className="h-12 w-12 text-primary animate-spin" />
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-primary animate-pulse">Gobering</span>
      </div>
    </div>
  );
}
