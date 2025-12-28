import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReadOnly } from "@/contexts/ReadOnlyContext";

export function MutationErrorHandler() {
  const { triggerReadOnlyDialog } = useReadOnly();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        const error = event.action.error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is a read-only mode error (403)
        if (errorMessage.includes("403")) {
          triggerReadOnlyDialog();
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient, triggerReadOnlyDialog]);

  return null;
}
