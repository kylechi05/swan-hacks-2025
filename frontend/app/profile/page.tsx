"use client";

import { useAuth } from "../authContext";

export default function ProfilePage() {
    const { user } = useAuth();

    return (
        <div className="px-32 py-16 text-(--off-white) flex flex-col gap-5 w-1/2">
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
        </div>
    );
}
