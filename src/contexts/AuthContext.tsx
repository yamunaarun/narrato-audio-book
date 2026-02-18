import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function hashPassword(password: string): string {
  // Simple deterministic hash for demo (not for production)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `hashed_${Math.abs(hash).toString(36)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("audiobook_token");
    const userData = localStorage.getItem("audiobook_user");
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setIsLoading(false);
  }, []);

  const register = async (name: string, email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const users = JSON.parse(localStorage.getItem("audiobook_users") || "[]");
    if (users.find((u: any) => u.email === email)) {
      throw new Error("Email already registered");
    }
    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: new Date().toISOString(),
    };
    const hashed = hashPassword(password);
    users.push({ ...newUser, password: hashed });
    localStorage.setItem("audiobook_users", JSON.stringify(users));
    const token = `token_${newUser.id}_${Date.now()}`;
    localStorage.setItem("audiobook_token", token);
    localStorage.setItem("audiobook_user", JSON.stringify(newUser));
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const users = JSON.parse(localStorage.getItem("audiobook_users") || "[]");
    const hashed = hashPassword(password);
    const found = users.find((u: any) => u.email === email && u.password === hashed);
    if (!found) throw new Error("Invalid email or password");
    const { password: _, ...userData } = found;
    const token = `token_${userData.id}_${Date.now()}`;
    localStorage.setItem("audiobook_token", token);
    localStorage.setItem("audiobook_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("audiobook_token");
    localStorage.removeItem("audiobook_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
