"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../authContext";

interface Recording {
    filename: string;
    meeting_id: string;
    participant_id: string;
    timestamp: string;
    size: string;
    created: string;
}

interface MeetingGroup {
    meeting_id: string;
    recordings: Recording[];
    created: string;
}

export default function RecordingsListPage() {
    const { user, token } = useAuth();
    const router = useRouter();
    const [meetings, setMeetings] = useState<MeetingGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const eventIDs: number[] = [];

                const tuteeRes = await fetch(
                    "https://api.tutorl.ink/events/tutee",
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    },
                );
                if (!tuteeRes.ok)
                    throw new Error("Failed to fetch tutee events");
                const tuteeData = await tuteeRes.json();
                tuteeData.events.forEach((e: any) => eventIDs.push(e.eventid));

                const tutorRes = await fetch(
                    "https://api.tutorl.ink/events/tutor",
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    },
                );
                if (!tutorRes.ok)
                    throw new Error("Failed to fetch tutor events");
                const tutorData = await tutorRes.json();
                tutorData.events.forEach((e: any) => {
                    if (!eventIDs.includes(e.eventid)) {
                        eventIDs.push(e.eventid);
                    }
                });

                const recordingsRes = await fetch(
                    "https://api.tutorl.ink/api/recordings",
                );
                if (!recordingsRes.ok)
                    throw new Error("Failed to fetch recordings");
                const recordingsData = await recordingsRes.json();

                const filteredMeetings = recordingsData.filter((meeting: any) =>
                    true
                    //eventIDs.includes(Number(meeting.meeting_id)),
                );

                setMeetings(filteredMeetings);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(
                    err instanceof Error ? err.message : "Failed to load data",
                );
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const viewSyncedRecording = (meetingId: string) => {
        router.push(`/recordings/${meetingId}`);
    };

    return (
        <div className="min-h-screen text-(--off-white)">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 shadow-lg">
                <div className="mx-auto max-w-7xl">
                    <h1 className="text-3xl font-bold">📹 Your Recordings</h1>
                    <p className="mt-2 text-gray-200">
                        View and replay your tutoring sessions
                    </p>
                </div>
            </div>

            <div className="mx-auto max-w-7xl p-6">
                {loading ? (
                    <div className="flex min-h-[400px] items-center justify-center">
                        <div className="text-center">
                            <div className="mb-4 text-4xl">⏳</div>
                            <p className="text-xl text-(--light-gray)">
                                Loading recordings...
                            </p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex min-h-[400px] items-center justify-center">
                        <div className="text-center">
                            <div className="mb-4 text-6xl">⚠️</div>
                            <h2 className="mb-2 text-2xl font-bold text-red-400">
                                Error Loading Recordings
                            </h2>
                            <p className="text-(--medium-gray)">{error}</p>
                        </div>
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="flex min-h-[400px] items-center justify-center">
                        <div className="text-center">
                            <div className="mb-4 text-6xl">📹</div>
                            <h2 className="mb-2 text-2xl font-bold text-green-400">
                                No Recordings Yet
                            </h2>
                            <p className="text-gray-400">
                                Your meeting recordings will appear here after
                                sessions are completed
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {meetings.map((meeting) => (
                            <div
                                key={meeting.meeting_id}
                                className="overflow-hidden rounded-xl bg-gray-800 shadow-xl transition hover:scale-105"
                            >
                                <div className="border-b-2 border-green-600 bg-gray-700 p-5">
                                    <h3 className="text-xl font-bold text-green-500">
                                        Meeting #
                                        {meeting.meeting_id.substring(0, 8)}
                                    </h3>
                                    <p className="text-sm text-(--light-gray)">
                                        {meeting.recordings.length}{" "}
                                        Participant(s)
                                    </p>
                                </div>

                                <div className="p-5">
                                    <div className="mb-4 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-(--light-gray)">
                                                Created:
                                            </span>
                                            <span className="font-semibold">
                                                {new Date(
                                                    meeting.created,
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-(--light-gray)">
                                                Duration:
                                            </span>
                                            <span className="font-semibold">
                                                {
                                                    meeting.recordings[0]
                                                        .timestamp
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() =>
                                            viewSyncedRecording(
                                                meeting.meeting_id,
                                            )
                                        }
                                        className="w-full cursor-pointer rounded-lg bg-green-600 py-3 font-semibold transition hover:bg-green-500"
                                    >
                                        {meeting.recordings.length > 1
                                            ? "View Synced 🎬"
                                            : "Play ▶️"}
                                    </button>

                                    <div className="mt-3 flex gap-2">
                                        {meeting.recordings.map((rec, idx) => (
                                            <a
                                                key={rec.filename}
                                                href={`https://api.tutorl.ink/recordings/${rec.filename}`}
                                                download
                                                className="flex-1 rounded-lg border-2 border-blue-600 py-2 text-center text-sm font-semibold transition hover:bg-blue-600"
                                                title={`Download Participant ${idx + 1}`}
                                            >
                                                Download ⬇️
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info Card */}
                <div className="mt-8 rounded-xl border-2 border-green-600 bg-green-900/20 p-6">
                    <h3 className="mb-4 text-xl font-bold text-green-400">
                        ℹ️ About Recordings
                    </h3>
                    <div className="space-y-2 text-gray-300">
                        <p>
                            • Each meeting is automatically recorded from both
                            participants&apos; perspectives
                        </p>
                        <p>
                            • Click &quot;View Synced&quot; to watch both videos
                            side-by-side in perfect sync
                        </p>
                        <p>
                            • Download individual recordings using the download
                            buttons
                        </p>
                        <p>
                            • Recordings are stored securely and only accessible
                            to meeting participants
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
