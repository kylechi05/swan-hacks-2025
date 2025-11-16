"use client";
import { useState } from "react";

export function SignUp() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setError("");
        try {
            const res = await fetch("https://api.tutorl.ink/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                setError(errorData.message || "Something went wrong.");
                return;
            }

            const data = await res.json();
            window.location.href = "/auth";
        } catch (err) {
            console.error("Request failed:", err);
            setError("Failed to connect to server.");
        }
    };

    return (
        <div className="flex w-full flex-col items-center">
            <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-sm flex-col gap-4"
            >
                <input
                    type="text"
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="rounded-lg border border-(--primary-border-color) p-2"
                    required
                />

                <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="rounded-lg border border-(--primary-border-color) p-2"
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="rounded-lg border border-(--primary-border-color) p-2"
                    required
                />

                <input
                    type="password"
                    placeholder="Confirm Password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            confirmPassword: e.target.value,
                        }))
                    }
                    className="rounded-lg border border-(--primary-border-color) p-2"
                    required
                />

                {error && (
                    <p className="text-sm font-medium text-red-500">{error}</p>
                )}

                <button
                    type="submit"
                    className="transition-all cursor-pointer rounded hover:bg-blue-900 bg-blue-900 px-4 py-2 text-white hover:scale-105"
                >
                    Create Account
                </button>
            </form>
        </div>
    );
}
