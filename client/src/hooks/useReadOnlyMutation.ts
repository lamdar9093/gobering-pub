import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useReadOnly } from "@/contexts/ReadOnlyContext";

export function useReadOnlyMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
) {
  const { triggerReadOnlyDialog } = useReadOnly();

  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onError: (error, variables, context) => {
      // Check if this is a read-only mode error (403 with specific message)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("403") || errorMessage.toLowerCase().includes("read-only") || errorMessage.toLowerCase().includes("lecture seule")) {
        triggerReadOnlyDialog();
      }
      
      // Call the original onError if it exists
      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}
