"use client";

import { useAuth } from "../authContext";

export default function ProfilePage() {
    const { user } = useAuth();

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/auth";
    };

    return (
        <div className="flex w-1/2 flex-col gap-5 px-32 py-16 text-(--off-white)">
            <h1 className="text-2xl">User Profile</h1>
            <div className="grid grid-cols-2">
                <div className="flex flex-col justify-start">
                    <h2>Name</h2>
                    <h2>Email</h2>
                </div>
                <div className="flex flex-col items-end">
                    <h2 className="w-fit">{user?.name}</h2>
                    <h2 className="w-fit">{user?.email}</h2>
                </div>
            </div>
            <button
                onClick={handleLogout}
                className="mt-8 w-fit cursor-pointer rounded-lg bg-green-600 px-4 py-1 font-semibold text-white transition-all hover:scale-105 hover:bg-green-500"
            >
                Logout
            </button>
        </div>
    );
}
