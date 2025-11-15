"use client";

import Link from "next/link";
import { useAuth } from "../authContext";

export function NavBar() {
    const { token } = useAuth();

    return (
        <div className="sticky top-0 flex h-16 flex-row items-center gap-20 border-b border-(--primary-border-color) bg-(--background)/85 px-32 text-sm text-(--light-gray) backdrop-blur-md transition-all">
            <Link href="/" className="text-xl text-(--off-white)">
                TutorLink
            </Link>
            <Link href="/events" className="hover:text-(--off-white)">
                Events
            </Link>
            <Link href="/join-meeting" className="hover:text-(--off-white)">
                Join Meeting
            </Link>
            {token == "" ? (
                <Link href="/auth" className="ml-auto hover:text-(--off-white)">
                    Sign in
                </Link>
            ) : (
                <Link
                    href="/profile"
                    className="ml-auto hover:text-(--off-white)"
                >
                    Profile
                </Link>
            )}
        </div>
    );
}
