"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Recording {
    filename: string;
    url: string;
    participant_id: string;
    timestamp: string;
    size: number;
    size_mb: string;
    created: string;
}

interface Transcript {
    filename: string;
    participant_id: string;
    transcript: string;
    words: Array<{
        word: string;
        start_time: number;
        end_time: number;
        confidence: number;
    }>;
    language: string;
    word_count: number;
    created: string;
}

const sliderClass =
  "w-full h-2 cursor-pointer rounded-lg bg-gray-700 accent-green-500 transition-all hover:accent-green-400 focus:outline-none focus:ring-2 focus:ring-green-500";


export default function SyncedRecordingPage() {
    const params = useParams();
    const router = useRouter();
    const meetingId = params.meetingId as string;

    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSynced, setIsSynced] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showTranscripts, setShowTranscripts] = useState(true);

    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const syncCheckInterval = useRef<NodeJS.Timeout | null>(null);

    // Fetch recordings for this meeting
    useEffect(() => {
        const fetchRecordings = async () => {
            try {
                const response = await fetch(
                    `https://api.tutorl.ink/api/recordings/meeting/${meetingId}`,
                );
                if (!response.ok) throw new Error("Failed to fetch recordings");

                const data = await response.json();
                setRecordings(data.recordings);

                // Also fetch transcripts
                try {
                    const transcriptResponse = await fetch(
                        `https://api.tutorl.ink/api/transcripts/meeting/${meetingId}`,
                    );
                    if (transcriptResponse.ok) {
                        const transcriptData = await transcriptResponse.json();
                        setTranscripts(transcriptData.transcripts);
                    }
                } catch (err) {
                    console.log("No transcripts available yet");
                }

                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
                setLoading(false);
            }
        };

        fetchRecordings();
    }, [meetingId]);

    // Initialize video elements
    useEffect(() => {
        if (recordings.length === 0) return;

        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length === 0) return;

        // Set max duration
        const handleLoadedMetadata = () => {
            const maxDuration = Math.max(
                ...videos.map((v) => v?.duration || 0),
            );
            setDuration(maxDuration);
        };

        videos.forEach((video) => {
            video?.addEventListener("loadedmetadata", handleLoadedMetadata);
        });

        return () => {
            videos.forEach((video) => {
                video?.removeEventListener(
                    "loadedmetadata",
                    handleLoadedMetadata,
                );
            });
        };
    }, [recordings]);

    // Update current time
    useEffect(() => {
        const interval = setInterval(() => {
            const firstVideo = videoRefs.current[0];
            if (firstVideo) {
                setCurrentTime(firstVideo.currentTime);
                setDuration(firstVideo.duration); // Ensure duration is always accurate
            }
        }, 100);

        return () => clearInterval(interval);
    }, []);

    // Check sync status periodically
    useEffect(() => {
        if (!isPlaying) return;

        syncCheckInterval.current = setInterval(() => {
            checkSyncStatus();
        }, 2000);

        return () => {
            if (syncCheckInterval.current) {
                clearInterval(syncCheckInterval.current);
            }
        };
    }, [isPlaying]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const togglePlayPause = async () => {
        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length === 0) return;

        if (isPlaying) {
            videos.forEach((v) => v?.pause());
            setIsPlaying(false);
        } else {
            syncVideos();
            try {
                await Promise.all(videos.map((v) => v?.play()));
                setIsPlaying(true);
            } catch (err) {
                console.error("Error playing videos:", err);
            }
        }
    };

    const syncVideos = () => {
        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length === 0) return;

        const targetTime = videos[0]?.currentTime || 0;
        videos.forEach((v, i) => {
            if (i > 0 && v) {
                v.currentTime = targetTime;
            }
        });

        setIsSynced(true);
        setTimeout(() => checkSyncStatus(), 1000);
    };

    const checkSyncStatus = () => {
        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length < 2) return;

        const times = videos.map((v) => v?.currentTime || 0);
        const maxDiff = Math.max(...times) - Math.min(...times);

        setIsSynced(maxDiff <= 0.5);
    };

    const skipBackward = () => {
        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length === 0 || !videos[0]) return;

        const newTime = Math.max(0, videos[0].currentTime - 5);
        videos.forEach((v) => {
            if (v) v.currentTime = newTime;
        });
    };

    const skipForward = () => {
        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length === 0 || !videos[0]) return;

        const newTime = Math.min(
            videos[0].duration || 0,
            videos[0].currentTime + 5,
        );
        videos.forEach((v) => {
            if (v) v.currentTime = newTime;
        });
    };

    const resetVideos = () => {
        const videos = videoRefs.current.filter((v) => v !== null);
        videos.forEach((v) => {
            if (v) {
                v.currentTime = 0;
                v.pause();
            }
        });
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const videos = videoRefs.current.filter((v) => v !== null);
        if (videos.length === 0 || !videos[0]) return;

        const seekTime =
            (parseFloat(e.target.value) / 100) * (videos[0].duration || 0);
        videos.forEach((v) => {
            if (v) v.currentTime = seekTime;
        });
        setCurrentTime(seekTime);
    };

    const handleVolumeChange = (index: number, value: number) => {
        const video = videoRefs.current[index];
        if (video) {
            video.volume = value / 100;
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="mb-4 text-4xl">⏳</div>
                    <p className="text-xl text-gray-300">
                        Loading recordings...
                    </p>
                </div>
            </div>
        );
    }

    if (error || recordings.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="mb-4 text-4xl">❌</div>
                    <p className="mb-4 text-xl text-gray-300">
                        {error || "No recordings found for this meeting"}
                    </p>
                    <button
                        onClick={() => router.push("/profile")}
                        className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                    >
                        Back to Profile
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-(--off-white)">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 shadow-lg">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <h1 className="text-3xl font-bold">
                        🎬 Synced Meeting Playback
                    </h1>
                    <button
                        onClick={() => router.back()}
                        className="rounded-lg bg-white/20 px-4 py-2 font-semibold transition hover:bg-white/30"
                    >
                        ← Back
                    </button>
                </div>
            </div>

            <div className="mx-auto max-w-7xl p-6">
                {/* Controls Panel */}
                <div className="mb-6 rounded-xl bg-gray-800 p-6 shadow-xl">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-green-400">
                            Playback Controls
                        </h2>
                        <div
                            className={`rounded-full px-4 py-2 font-semibold ${
                                isSynced
                                    ? "bg-green-600 text-white"
                                    : "bg-red-600 text-white"
                            }`}
                        >
                            {isSynced ? "✓ Synced" : "⚠ Out of Sync"}
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="mb-6 flex flex-wrap gap-3">
                        <button
                            onClick={togglePlayPause}
                            className="flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-500"
                        >
                            <span>{isPlaying ? "⏸️" : "▶️"}</span>
                            <span>{isPlaying ? "Pause All" : "Play All"}</span>
                        </button>
                        <button
                            onClick={syncVideos}
                            className="flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-500"
                        >
                            🔄 Re-sync Videos
                        </button>
                        <button
                            onClick={skipBackward}
                            className="cursor-pointer rounded-lg bg-gray-700 px-6 py-3 font-semibold transition hover:bg-gray-600"
                        >
                            ⏪ -5s
                        </button>
                        <button
                            onClick={skipForward}
                            className="cursor-pointer rounded-lg bg-gray-700 px-6 py-3 font-semibold transition hover:bg-gray-600"
                        >
                            ⏩ +5s
                        </button>
                        <button
                            onClick={resetVideos}
                            className="cursor-pointer rounded-lg bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-700"
                        >
                            ⏮️ Reset
                        </button>
                    </div>

                    {/* Timeline */}
                    <div className="mb-6">
                        <div className="mb-2 flex justify-between text-sm text-gray-400">
                            <span>Timeline</span>
                            <span>
                                {formatTime(currentTime)} /{" "}
                                {formatTime(duration)}
                            </span>
                        </div>

                        <input
                            type="range"
                            min={0}
                            max={duration}
                            step={0.01}
                            value={currentTime}
                            onChange={(e) => {
                                const seekTime = parseFloat(e.target.value);
                                setCurrentTime(seekTime);
                                videoRefs.current.forEach((v) => {
                                    if (v) v.currentTime = seekTime;
                                });
                            }}
                            className={sliderClass}
                        />
                    </div>

                    {/* Volume Controls */}
                    <div className="space-y-3">
                        {recordings.map((recording, index) => (
                            <div
                                key={recording.filename}
                                className="flex items-center gap-4"
                            >
                                <label className="min-w-[150px] text-sm text-gray-400">
                                    Participant {index + 1}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="100"
                                    onChange={(e) =>
                                        handleVolumeChange(
                                            index,
                                            parseInt(e.target.value),
                                        )
                                    }
                                    className={sliderClass}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Video Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {recordings.map((recording, index) => (
                        <div
                            key={recording.filename}
                            className="overflow-hidden rounded-xl bg-gray-800 shadow-xl"
                        >
                            <div className="border-b-2 border-green-600 bg-gray-700 p-4">
                                <h3 className="text-lg font-bold text-green-400">
                                    Participant {index + 1}
                                </h3>
                                <p className="text-sm text-gray-400">
                                    {recording.participant_id.substring(0, 16)}
                                    ... | {recording.size_mb} MB
                                </p>
                            </div>
                            <video
                                ref={(el) => {
                                    videoRefs.current[index] = el;
                                }}
                                src={`https://api.tutorl.ink${recording.url}`}
                                preload="metadata"
                                className="w-full bg-black"
                            />
                        </div>
                    ))}
                </div>

                {/* Info Panel */}
                <div className="mt-6 rounded-xl border-2 border-green-600 bg-green-900/20 p-6">
                    <h3 className="mb-4 text-xl font-bold text-green-400">
                        💡 Synced Playback Tips
                    </h3>
                    <ul className="space-y-2 text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>
                                Videos are automatically synchronized when you
                                press play
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>
                                Use the timeline to seek to any point in the
                                meeting
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>
                                Adjust individual participant volumes with the
                                sliders
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>
                                If videos go out of sync, click "Re-sync Videos"
                                to realign them
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>
                                Keyboard shortcuts: Space (play/pause), ← (back
                                5s), → (forward 5s)
                            </span>
                        </li>
                    </ul>
                </div>

                {/* Transcripts Section */}
                {transcripts.length > 0 && (
                    <div className="mt-6 rounded-xl bg-gray-800 p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-green-400">
                                📝 Transcripts
                            </h3>
                            <button
                                onClick={() =>
                                    setShowTranscripts(!showTranscripts)
                                }
                                className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 font-semibold transition hover:bg-green-500"
                            >
                                {showTranscripts ? "Hide" : "Show"}
                            </button>
                        </div>

                        {showTranscripts && (
                            <div className="space-y-6">
                                {transcripts.map((transcript, index) => (
                                    <div
                                        key={transcript.filename}
                                        className="rounded-lg border border-gray-700 bg-gray-900 p-4"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-lg font-semibold text-green-300">
                                                Participant {index + 1}
                                            </h4>
                                            <div className="text-(--light-gray)) text-sm">
                                                {transcript.word_count} words |{" "}
                                                {transcript.language}
                                            </div>
                                        </div>
                                        <p className="text-(--light-gray)) leading-relaxed">
                                            {transcript.transcript ||
                                                "Transcription in progress..."}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {transcripts.length === 0 && (
                            <p className="text-center text-(--light-gray)">
                                Transcripts are being generated... This may take
                                a few minutes.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
