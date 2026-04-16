import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
export function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    async function submit(e) {
        e.preventDefault();
        setError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            navigate('/');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }
    return (_jsxs("form", { onSubmit: submit, children: [_jsx("h1", { children: "Sign up" }), _jsx("input", { value: email, onChange: (e) => setEmail(e.target.value), placeholder: "email" }), _jsx("input", { value: password, onChange: (e) => setPassword(e.target.value), placeholder: "password", type: "password" }), _jsx("button", { type: "submit", children: "Create account" }), error && _jsx("pre", { children: error }), _jsx("p", { children: _jsx(Link, { to: "/login", children: "Login" }) })] }));
}
