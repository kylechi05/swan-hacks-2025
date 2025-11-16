"use client";

import {
    createContext,
    useContext,
    useState,
    useMemo,
    ReactNode,
    useEffect,
} from "react";

type DecodedToken = {
    userid?: number;
    email?: string;
    name?: string;
    exp?: number;
    [key: string]: any;
};

type AuthContextType = {
    token: string;
    user: DecodedToken | null;
    setToken: (token: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeJwt(token: string): DecodedToken | null {
    try {
        const base64Url = token.split(".")[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
                .join("")
        );

        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenState] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("token") || "";
        }
        return "";
    });

    const user = useMemo(() => {
        return token ? decodeJwt(token) : null;
    }, [token]);

    useEffect(() => {
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token");
        }
    }, [token]);

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                setToken: setTokenState,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
