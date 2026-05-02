
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CreateJobPage } from './pages/CreateJobPage';
import { AdminPage } from './pages/AdminPage';

// A simple navigation component that shows relevant links based on auth state
function Navigation() {
  const { user, role } = useAuth();
  return (
    <nav>
      <Link to="/">Home</Link>
      {user ? (
        <>
          | <Link to="/create">Create Job</Link>
          {role === 'admin' && ( | <Link to="/admin">Admin</Link>)}
          {/* Add a sign-out button here */}
        </>
      ) : (
        <>
          | <Link to="/login">Login</Link>| <Link to="/signup">Sign up</Link>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navigation />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Routes */}
          <Route
            path="/create"
            element={<ProtectedRoute allowedRoles={['admin', 'user']}><CreateJobPage /></ProtectedRoute>}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminPage /></ProtectedRoute>}
          />

          {/* General Home Route and Error/Info Routes */}
          <Route path="/unauthorized" element={<div>Unauthorized</div>} />
          <Route path="/" element={<div>Welcome to URAI Studio</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
