"use client";

import { useState } from "react";

import { SignIn } from "./components/SignIn";
import { SignUp } from "./components/SignUp";

export default function AuthPage() {
    const [formMode, setFormMode] = useState("signin");

    return (
        <div className="flex flex-col items-center pt-32 gap-5">
            {formMode == "signin" ? (
                <>
                    <h1 className="text-xl font-medium">Sign In</h1>
                    <h2 className="text-sm">
                        Don&apos;t have an account? Sign Up{" "}
                        <a
                            className="cursor-pointer text-sky-500 hover:underline"
                            onClick={() => setFormMode("signup")}
                        >
                            here.
                        </a>
                    </h2>
                    <SignIn />
                </>
            ) : (
                <>
                    <h1 className="text-xl font-medium">Sign Up</h1>
                    <h2 className="text-sm">
                        Already have an account? Sign In{" "}
                        <a
                            className="cursor-pointer text-sky-500 hover:underline"
                            onClick={() => setFormMode("signin")}
                        >
                            here.
                        </a>
                    </h2>
                    <SignUp />
                </>
            )}
        </div>
    );
}
