import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ReadOnlyContextType {
  showReadOnlyDialog: boolean;
  triggerReadOnlyDialog: () => void;
  dismissReadOnlyDialog: () => void;
}

const ReadOnlyContext = createContext<ReadOnlyContextType | undefined>(undefined);

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const [showReadOnlyDialog, setShowReadOnlyDialog] = useState(false);

  const triggerReadOnlyDialog = useCallback(() => {
    setShowReadOnlyDialog(true);
  }, []);

  const dismissReadOnlyDialog = useCallback(() => {
    setShowReadOnlyDialog(false);
  }, []);

  return (
    <ReadOnlyContext.Provider 
      value={{ 
        showReadOnlyDialog, 
        triggerReadOnlyDialog, 
        dismissReadOnlyDialog 
      }}
    >
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  const context = useContext(ReadOnlyContext);
  if (context === undefined) {
    throw new Error("useReadOnly must be used within ReadOnlyProvider");
  }
  return context;
}
