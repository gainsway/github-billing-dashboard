import { useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { Overview } from "./pages/Overview";
import { ConfigDrawer } from "./components/ConfigDrawer";
import { ConfigProvider } from "./lib/config";

export default function App() {
  useEffect(() => {
    document.documentElement.classList.add("bg-cream");
    return () => document.documentElement.classList.remove("bg-cream");
  }, []);

  return (
    <ConfigProvider>
      <div className="min-h-screen text-charcoal">
        <Navbar />
        <ConfigDrawer />
        <main className="px-5 md:px-10 pt-24 pb-16">
          <Overview />
        </main>
      </div>
    </ConfigProvider>
  );
}
