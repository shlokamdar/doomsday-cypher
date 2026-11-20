import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Backend } from "./backend/Backend";
import { createBackend } from "./backend";
import { AINotice, Footer, Header } from "./components/Layout";
import { LoadingScreen } from "./components/LoadingScreen";
import { SealedPopup, WrongFlagPopup } from "./components/Popups";
import { BackendProvider, useBackend } from "./hooks/store";
import { UiProvider } from "./hooks/ui";
import { BreachesPage } from "./pages/Breaches";
import { ChangePasswordPage } from "./pages/ChangePassword";
import { HomePage } from "./pages/Home";
import { LoginPage } from "./pages/Login";
import { TransmissionsPage } from "./pages/Transmissions";
import { WarTablePage } from "./pages/WarTable";

const CommandApp = lazy(() => import("./pages/admin/CommandApp"));

const MIN_LOADING_MS = 1700;

export default function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const boot = useCallback(async () => {
    setError(null);
    const started = Date.now();
    try {
      const b = await createBackend();
      await b.init();
      const wait = MIN_LOADING_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setBackend(b);
      setReady(true);
    } catch (e) {
      const wait = MIN_LOADING_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void boot();
  }, [boot]);

  return (
    <>
      <AINotice />
      <AnimatePresence>{!ready && <LoadingScreen key="loading" error={error} onRetry={boot} />}</AnimatePresence>
      {backend && ready && (
        <BackendProvider backend={backend}>
          <UiProvider>
            <HashRouter>
              <Shell />
            </HashRouter>
          </UiProvider>
        </BackendProvider>
      )}
    </>
  );
}

function Shell() {
  const { view, online } = useBackend();
  const loc = useLocation();
  const mustChange = !!view.me?.mustChangePassword;
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {!online && (
        <div className="bg-breach/90 px-4 py-1.5 text-center text-sm text-white" role="status">
          Connection lost. Retrying…
        </div>
      )}
      <div className="flex-1">
        {mustChange ? (
          <ChangePasswordPage forced />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname.split("/")[1]} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <Routes location={loc}>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/password" element={<RequireUser><ChangePasswordPage /></RequireUser>} />
                <Route path="/breaches" element={<RequirePlayer><BreachesPage /></RequirePlayer>} />
                <Route path="/war-table" element={<WarTablePage />} />
                <Route path="/transmissions" element={<TransmissionsPage />} />
                <Route
                  path="/command/*"
                  element={
                    <RequireAdmin>
                      <Suspense fallback={<div className="p-10 text-center text-steel">Opening Command…</div>}>
                        <CommandApp />
                      </Suspense>
                    </RequireAdmin>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <Footer />
      <WrongFlagPopup />
      <SealedPopup />
    </div>
  );
}

function RequireUser({ children }: { children: ReactNode }) {
  const { view } = useBackend();
  return view.me ? <>{children}</> : <Navigate to="/login" replace />;
}
function RequirePlayer({ children }: { children: ReactNode }) {
  const { view } = useBackend();
  if (!view.me) return <Navigate to="/login" replace />;
  if (view.me.role === "admin") return <Navigate to="/command" replace />;
  return <>{children}</>;
}
function RequireAdmin({ children }: { children: ReactNode }) {
  const { view } = useBackend();
  if (!view.me) return <Navigate to="/login?tab=command" replace />;
  if (view.me.role !== "admin") return <Navigate to="/breaches" replace />;
  return <>{children}</>;
}
