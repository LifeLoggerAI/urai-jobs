
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import JobBoard from "./pages/JobBoard";
import JobDetail from "./pages/JobDetail";
import Apply from "./pages/Apply";
import { auth } from "./firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import ProtectedRoute from "./components/ProtectedRoute";

const AuthContext = createContext<User | null>(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/jobs" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/jobs" element={<JobBoard />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route
            path="/jobs/:jobId/apply"
            element={<ProtectedRoute><Apply /></ProtectedRoute>}
          />
          <Route path="*" element={<Navigate to="/jobs" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
