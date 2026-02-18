import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Upload, Library, User as UserIcon, LogOut,
  Menu, X, Headphones, ChevronRight, Bell
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AudiobookEntry, getBooks } from "@/lib/audiobookStore";
import UploadSection from "@/components/dashboard/UploadSection";
import AudioLibrary from "@/components/dashboard/AudioLibrary";
import Profile from "@/components/dashboard/Profile";

type Tab = "upload" | "library" | "profile";

const NAV = [
  { id: "upload" as Tab, icon: Upload, label: "Convert PDF" },
  { id: "library" as Tab, icon: Library, label: "My Library" },
  { id: "profile" as Tab, icon: UserIcon, label: "Profile" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("upload");
  const [books, setBooks] = useState<AudiobookEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    setBooks(getBooks(user.id));
  }, [user, navigate]);

  const handleBookCreated = (book: AudiobookEntry) => {
    setBooks((prev) => [book, ...prev]);
    setTab("library");
  };

  const handleDelete = (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const tabTitle: Record<Tab, string> = {
    upload: "Convert PDF to Audio",
    library: "My Audiobooks",
    profile: "Profile & Settings",
  };

  const tabDesc: Record<Tab, string> = {
    upload: "Upload a PDF, choose a language, and create an audiobook in seconds.",
    library: `You have ${books.length} audiobook${books.length !== 1 ? "s" : ""} in your library.`,
    profile: "Manage your account details and preferences.",
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
                <Headphones className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base leading-tight">AudioScribe</p>
                <p className="text-xs text-muted-foreground">PDF to Audio</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1">
            <p className="section-label px-4 mb-3 mt-1">Navigation</p>
            {NAV.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setSidebarOpen(false); }}
                className={`sidebar-item w-full ${tab === id ? "active" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {id === "library" && books.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    tab === id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}>
                    {books.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* User card */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-xs font-bold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h1 className="font-bold text-foreground text-lg leading-tight">{tabTitle[tab]}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{tabDesc[tab]}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-muted px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span className="text-xs font-medium text-muted-foreground">Free plan</span>
            </div>
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xs font-bold">{initials}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
          {tab === "upload" && (
            <div className="space-y-6 animate-fade-up">
              <UploadSection onBookCreated={handleBookCreated} />

              {books.length > 0 && (
                <div className="glass-card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {books.length} audiobook{books.length !== 1 ? "s" : ""} in your library
                    </p>
                    <p className="text-xs text-muted-foreground">Tap to view and listen</p>
                  </div>
                  <button
                    onClick={() => setTab("library")}
                    className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "library" && (
            <div className="animate-fade-up">
              <AudioLibrary books={books} onDelete={handleDelete} />
            </div>
          )}

          {tab === "profile" && (
            <div className="animate-fade-up">
              <Profile />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
