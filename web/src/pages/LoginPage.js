import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
export function LoginPage() {
    const [email, setEmail] = useState("adam@urailabs.com");
    const [password, setPassword] = useState("");
    const [user, setUser] = useState(null);
    const [claims, setClaims] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => {
        return onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            if (nextUser) {
                const token = await nextUser.getIdTokenResult(true);
                setClaims(token.claims);
            }
            else {
                setClaims(null);
            }
        });
    }, []);
    async function login(event) {
        event.preventDefault();
        setMessage("");
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const token = await result.user.getIdTokenResult(true);
            setClaims(token.claims);
            setMessage("Signed in.");
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Sign in failed.");
        }
    }
    async function logout() {
        await signOut(auth);
        setMessage("Signed out.");
    }
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Live Auth" }), _jsx("h1", { children: "Admin sign in" }), _jsx("p", { children: "Use the seeded admin account to run production job smoke tests." }), user ? (_jsxs("div", { className: "form-stack", children: [_jsxs("div", { className: "notice success", children: [_jsx("strong", { children: "Signed in" }), _jsx("p", { children: user.email })] }), _jsx("pre", { children: JSON.stringify(claims, null, 2) }), _jsx("button", { type: "button", onClick: () => void logout(), children: "Sign out" }), _jsx("a", { href: "/create", children: "Create production smoke job" }), _jsx("a", { href: "/admin", children: "Open admin dashboard" })] })) : (_jsxs("form", { onSubmit: login, className: "form-stack", children: [_jsxs("label", { children: ["Email", _jsx("input", { value: email, onChange: (event) => setEmail(event.target.value) })] }), _jsxs("label", { children: ["Password", _jsx("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value) })] }), _jsx("button", { type: "submit", children: "Sign in" })] })), message && _jsx("div", { className: "notice", children: _jsx("p", { children: message }) })] }) }));
}
