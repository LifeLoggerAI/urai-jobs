import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
export function SignupPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const handleSignup = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            // This simply creates the user in Firebase Auth
            await createUserWithEmailAndPassword(auth, email, password);
            // After sign-up, we could also make a call to our backend to create a user profile in Firestore
            // For now, we'll just redirect to the home page.
            navigate('/');
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsxs("div", { children: [_jsx("h1", { children: "Sign Up" }), _jsxs("form", { onSubmit: handleSignup, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", children: "Email:" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", children: "Password:" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })] }), _jsx("button", { type: "submit", disabled: isLoading, children: isLoading ? 'Signing up...' : 'Sign Up' })] }), error && _jsx("p", { style: { color: 'red' }, children: error })] }));
}
