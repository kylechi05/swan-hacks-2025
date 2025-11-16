import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignIn() {
    const router = useRouter();

    const [formState, setFormState] = useState({
        email: "",
        password: "",
    });

    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const res = await fetch("http://localhost:6969/login", {
                method: "POST", // POST request
                headers: {
                    "Content-Type": "application/json", // tell server it's JSON
                },
                body: JSON.stringify({
                    email: formState.email,
                    password: formState.password,
                }),
            });

            if (!res.ok) {
                // If server returned an error
                const errorData = await res.json();
                setError(
                    errorData.message || "Incorrect username or password.",
                );
                return;
            }

            const data = await res.json();
            localStorage.setItem("token", data.token);
            router.push("/"); 
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
                    type="email"
                    placeholder="Email"
                    value={formState.email}
                    onChange={(e) =>
                        setFormState((prev) => ({
                            ...prev,
                            email: e.target.value,
                        }))
                    }
                    className="rounded-lg border border-(--primary-border-color) p-2"
                    required
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
                    className="rounded-lg border border-(--primary-border-color) p-2"
                    required
                />

                <button
                    type="submit"
                    className="transition-all cursor-pointer rounded-lg hover:bg-blue-600 bg-blue-900 px-4 py-2 text-white hover:scale-105"
                >
                    Sign In
                </button>
            </form>
            {error && (
                <p className="text-sm font-medium text-red-500">{error}</p>
            )}
        </div>
    );
}
