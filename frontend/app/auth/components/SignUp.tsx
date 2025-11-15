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

    const handleSubmit = (e) => {
        e.preventDefault();

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setError(""); // clear errors if successful
        console.log("Sign-up data:", form);
        // TODO: send to server/action
    };

    return (
        <div className="flex flex-col items-center w-full">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 w-full max-w-sm"
            >
                <input
                    type="text"
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="border p-2 rounded w-full"
                    required
                />

                <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="border p-2 rounded w-full"
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="border p-2 rounded w-full"
                    required
                />

                <input
                    type="password"
                    placeholder="Confirm Password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                    }
                    className="border p-2 rounded w-full"
                    required
                />

                {error && (
                    <p className="text-red-500 text-sm font-medium">{error}</p>
                )}

                <button
                    type="submit"
                    className="transition-all cursor-pointer rounded hover:bg-blue-500 bg-blue-400 px-4 py-2 text-white hover:scale-105"
                >
                    Create Account
                </button>
            </form>
        </div>
    );
}
