import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User, Mail, Calendar, BookOpen, Loader2, CheckCircle2 } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    // Update user in localStorage
    const stored = JSON.parse(localStorage.getItem("audiobook_user") || "{}");
    stored.name = name;
    localStorage.setItem("audiobook_user", JSON.stringify(stored));
    const users = JSON.parse(localStorage.getItem("audiobook_users") || "[]");
    const updated = users.map((u: any) => u.id === user?.id ? { ...u, name } : u);
    localStorage.setItem("audiobook_users", JSON.stringify(updated));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const initials = (name || user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const fmtDate = (iso?: string) => iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const bookCount = JSON.parse(localStorage.getItem("audiobook_library") || "[]")
    .filter((b: any) => b.userId === user?.id).length;

  return (
    <div className="space-y-6 max-w-lg animate-fade-up">
      {/* Avatar card */}
      <div className="glass-card p-6 flex items-center gap-5">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-xl">{initials}</span>
        </div>
        <div>
          <h3 className="font-bold text-foreground text-lg">{user?.name}</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-xs text-muted-foreground font-medium">Active account</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: BookOpen, label: "Audiobooks", value: bookCount },
          { icon: Calendar, label: "Member since", value: fmtDate(user?.createdAt) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Edit profile */}
      <div className="glass-card p-6 space-y-4">
        <h4 className="font-semibold text-foreground">Edit Profile</h4>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Full name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="input-field pl-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              className="input-field pl-10 opacity-60"
              value={user?.email}
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4" />Saved!</>
          ) : (
            "Save changes"
          )}
        </button>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border border-destructive/20">
        <h4 className="font-semibold text-foreground mb-1">Sign out</h4>
        <p className="text-sm text-muted-foreground mb-4">You'll need to sign back in to access your library.</p>
        <button
          onClick={logout}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
