"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"

export function Event({ event, token }) {
    const [isOpen, setIsOpen] = useState(false);
    const [startTime, setStartTime] = useState<string>("");
    const [endTime, setEndTime] = useState<string>("");
    const [error, setError] = useState<string>("");
    const router = useRouter();

    const minTime = new Date(event.available_start_time)
        .toISOString()
        .slice(0, 16);
    const maxTime = new Date(event.available_end_time)
        .toISOString()
        .slice(0, 16);

    async function handleConfirmOffer() {
        setError("");

        if (!startTime || !endTime) {
            setError("Please fill in both start and end times.");
            return;
        }

        if (endTime <= startTime) {
            setError("End time must be after start time.");
            return;
        }

        try {
            const startUnix = Math.floor(new Date(startTime).getTime() / 1000);
            const endUnix = Math.floor(new Date(endTime).getTime() / 1000);
            const res = await fetch(
                `http://localhost:6969/event/${event.eventid}/offer`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ start: startUnix, end: endUnix }),
                },
            );

            if (!res.ok) {
                console.error("Offer failed");
                setError("Failed to submit offer. Please try again.");
                return;
            }

            const data = await res.json();
            console.log("Offer confirmed:", data);
            setStartTime("");
            setEndTime("");
            setIsOpen(false);
            router.push(`/events/success?event_id=${data.event_id}&from=tutor`)
        } catch (err) {
            console.error("Request failed:", err);
            setError("Request failed. Please try again.");
        }
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-green-600">{event.title}</h2>
                    <p className="text-sm text-(--off-white)">{event.category}</p>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="cursor-pointer rounded bg-blue-500 px-3 py-1 text-white transition hover:bg-blue-600"
                >
                    {isOpen ? "Hide" : "I'm Interested"}
                </button>
            </div>

            <div
                className={`flex flex-col overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-in-out ${
                    isOpen
                        ? "max-h-96 py-4 opacity-100"
                        : "max-h-0 py-0 opacity-0"
                }`}
            >
                <p className="mb-5">{event.description}</p>

                <label className="mb-1 block text-sm font-medium text-(--light-gray)">
                    Start Time:
                </label>

                <div className="relative w-3/4">
                    <input
                        type="datetime-local"
                        className="mx-0.5 mb-2 w-full rounded-lg border border-(--primary-border-color) p-2 text-white"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        min={minTime}
                        max={maxTime}
                    />
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="pointer-events-none absolute top-1/2 right-2 h-5 w-5 -translate-y-3/4 cursor-pointer text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>

                <label className="mb-1 block text-sm font-medium text-(--light-gray)">
                    End Time:
                </label>
                <div className="relative w-3/4">
                    <input
                        type="datetime-local"
                        className="mx-0.5 mb-2 w-full rounded-lg border border-(--primary-border-color) p-2 text-white"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        min={startTime || minTime}
                        max={maxTime}
                    />
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="pointer-events-none absolute top-1/2 right-2 h-5 w-5 -translate-y-3/4 cursor-pointer text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>

                {error && (
                    <div className="my-2 rounded text-red-500">{error}</div>
                )}

                <button
                    className="mt-5 w-fit cursor-pointer rounded-lg bg-green-600 px-6 py-1 text-white transition-all hover:bg-green-500"
                    type="button"
                    onClick={handleConfirmOffer}
                >
                    Confirm Offer
                </button>
            </div>
        </div>
    );
}
