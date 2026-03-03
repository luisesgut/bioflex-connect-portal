import { ReactNode, createContext, useContext, useState } from "react";
import { Sidebar, AdminViewMode } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

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
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      <div className="min-h-screen bg-background">
        {isMobile ? (
          <>
            <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-sidebar px-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-sm font-bold text-sidebar-foreground">Portal</span>
            </header>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border [&>button]:text-sidebar-foreground">
                <Sidebar mobile onNavigate={() => setSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
            <main>
              <div className="min-h-[calc(100vh-3.5rem)] p-4">
                {children}
              </div>
            </main>
          </>
        ) : (
          <>
            <Sidebar />
            <main className="pl-64">
              <div className="min-h-screen p-8">
                {children}
              </div>
            </main>
          </>
        )}
      </div>
    </ViewModeContext.Provider>
  );
}
