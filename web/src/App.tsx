import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { CreateJobPage } from './pages/CreateJobPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <nav>
          <Link to="/">Jobs</Link> | <Link to="/login">Login</Link> | <Link to="/signup">Sign up</Link>
        </nav>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<ProtectedRoute><CreateJobPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
