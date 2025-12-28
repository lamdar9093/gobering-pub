import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    let errorData: any = null;
    
    try {
      const text = await res.text();
      if (text) {
        // Try to parse as JSON first
        try {
          const json = JSON.parse(text);
          errorData = json; // Preserve full JSON data
          errorMessage = json.error || json.message || text;
        } catch {
          // If not JSON, use the text directly
          errorMessage = text;
        }
      }
    } catch (e) {
      console.error('Failed to read error response:', e);
    }
    
    // Create user-friendly error message
    const userFriendlyError = res.status >= 500
      ? "Une erreur serveur s'est produite. Veuillez réessayer."
      : errorMessage;
    
    // Create error object with attached data
    const error: any = new Error(userFriendlyError);
    error.status = res.status;
    error.data = errorData;
    
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
