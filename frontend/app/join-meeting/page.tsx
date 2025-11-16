"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
    const [meetingId, setMeetingId] = useState("");
    const router = useRouter();

    const handleJoinMeeting = () => {
        if (meetingId.trim()) {
            // Navigate to the meeting page with the meeting ID
            router.push(`/meeting/${meetingId}`);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-(--background) px-8 py-20 text-(--off-white)">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-semibold">Join a Meeting</h1>
                    <p className="mt-4 text-(--light-gray)">
                        Enter the meeting ID to join your tutoring session
                    </p>
                </div>

                <div className="space-y-6 rounded-2xl border border-(--primary-border-color) bg-zinc-900 p-8">
                    <div className="space-y-2">
                        <label 
                            htmlFor="meetingId" 
                            className="block text-sm font-medium text-(--off-white)"
                        >
                            Meeting ID
                        </label>
                        <input
                            id="meetingId"
                            type="text"
                            value={meetingId}
                            onChange={(e) => setMeetingId(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
                            placeholder="Enter meeting ID"
                            className="w-full rounded-lg border border-(--primary-border-color) bg-(--background) px-4 py-3 text-(--off-white) placeholder-gray-500 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/50"
                        />
                    </div>

                    <button
                        onClick={handleJoinMeeting}
                        disabled={!meetingId.trim()}
                        className="w-full cursor-pointer rounded-lg bg-green-600 px-4 py-3 text-center font-semibold text-white transition-all hover:scale-105 hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-green-600"
                    >
                        Join Meeting
                    </button>
                </div>

                <div className="text-center">
                    <p className="text-sm text-(--light-gray)">
                        Don't have a meeting ID?{" "}
                        <a 
                            href="/events" 
                            className="text-green-600 hover:text-green-500 hover:underline"
                        >
                            Create or find events
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}