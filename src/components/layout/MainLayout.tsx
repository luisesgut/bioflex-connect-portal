import { ReactNode, createContext, useContext, useState } from "react";
import { Sidebar, AdminViewMode } from "./Sidebar";

interface ViewModeContextType {
  viewMode: AdminViewMode;
  setViewMode: (mode: AdminViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    return { viewMode: 'all' as AdminViewMode, setViewMode: () => {} };
  }
  return context;
}

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [viewMode, setViewMode] = useState<AdminViewMode>('all');

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="pl-64">
          <div className="min-h-screen p-8">
            {children}
          </div>
        </main>
      </div>
    </ViewModeContext.Provider>
  );
}
