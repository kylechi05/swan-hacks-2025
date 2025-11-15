import { useState } from "react";

export function SignIn() {
    const [formState, setFormState] = useState({
        email: "",
        password: "",
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // route for login
    };

    return (
        <div className="flex flex-col items-center w-full">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
                <input
                    type="email"
                    placeholder="Email"
                    value={formState.email}
                    onChange={(e) =>
                        setFormState((prev) => ({
                            ...prev,
                            email: e.target.value,
                        }))
                    }
                    className="rounded border p-2"
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={formState.password}
                    onChange={(e) =>
                        setFormState((prev) => ({
                            ...prev,
                            password: e.target.value,
                        }))
                    }
                    className="rounded border p-2"
                />

                <button
                    type="submit"
                    className="transition-all cursor-pointer rounded hover:bg-blue-500 bg-blue-400 px-4 py-2 text-white hover:scale-105"
                >
                    Sign In
                </button>
            </form>
        </div>
    );
}
