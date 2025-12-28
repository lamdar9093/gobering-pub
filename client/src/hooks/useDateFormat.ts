import { useQuery } from "@tanstack/react-query";
import type { Professional } from "@shared/schema";

export function useDateFormat() {
  const { data: professional } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const dateFormat = professional?.dateFormat || "dd/MM/yyyy";
  const timeFormat = professional?.timeFormat || "24h";

  return {
    dateFormat,
    timeFormat,
    professional,
  };
}
