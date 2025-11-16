"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "../authContext";

export function NavBar() {
    const { token } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="sticky top-0 flex h-16 flex-row items-center gap-20 border-b border-(--primary-border-color) bg-(--background)/85 px-32 text-sm text-(--light-gray) backdrop-blur-md transition-all">
            <Link href="/" className="text-xl font-bold">
                <span className="text-white">Tutor</span>
                <span className="text-green-600">Link</span>
            </Link>
            <Link href="/events" className="hover:text-(--off-white)">
                Events
            </Link>
            <Link href="/join-meeting" className="hover:text-(--off-white)">
                Join Meeting
            </Link>

            {mounted &&
                (token === "" ? (
                    <Link
                        href="/auth"
                        className="ml-auto hover:text-(--off-white)"
                    >
                        Sign in
                    </Link>
                ) : (
                    <Link
                        href="/profile"
                        className="ml-auto hover:text-(--off-white)"
                    >
                        Profile
                    </Link>
                ))}
        </div>
    );
}
