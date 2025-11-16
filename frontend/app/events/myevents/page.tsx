"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/authContext";
import { EventDisplay } from "./components/eventDisplay";

function formatDate(date: number | string) {
    const value = typeof date === "number" ? date * 1000 : date;
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value));
}

export default function MyEvents() {
    const { token, user } = useAuth();

    const [pendingTuteeEvents, setPendingTuteeEvents] = useState([]);
    const [actionTuteeEvents, setActionTuteeEvents] = useState([]);
    const [scheduledTuteeEvents, setScheduledTuteeEvents] = useState([]);

    const [pendingTutorEvents, setPendingTutorEvents] = useState([]);
    const [acceptedTutorEvents, setAcceptedTutorEvents] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const getTuteeEvents = async () => {
            try {
                const res = await fetch("https://api.tutorl.ink/events/tutee", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch tutee events");

                const data = await res.json();
                const events = data.events;
                console.log("TUTEE", events)

                setPendingTuteeEvents(
                    events.filter(
                        (e) =>
                            e.possible_tutors.length === 0 &&
                            e.userid_tutor === null,
                    ),
                );

                setActionTuteeEvents(
                    events.filter(
                        (e) =>
                            e.possible_tutors.length > 0 &&
                            e.userid_tutor === null,
                    ),
                );

                setScheduledTuteeEvents(
                    events.filter((e) => e.userid_tutor !== null),
                );
            } catch (err: any) {
                setError(err.message);
            }
        };

        const getTutorEvents = async () => {
            try {
                const res = await fetch("https://api.tutorl.ink/events/tutor", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch tutor events");

                const data = await res.json();
                const events = data.events;
                console.log(events)

                setPendingTutorEvents(
                    events.filter(
                        (event) =>
                            event.possible_tutors?.some(
                                (pt: any) => pt.userid_tutor === user.userid,
                            ) && event.userid_tutor === null,
                    ),
                );

                setAcceptedTutorEvents(
                    events.filter(
                        (event) => event.userid_tutor?.userid_tutor === user.userid,
                    ),
                );
            } catch (err: any) {
                setError(err.message);
            }
        };

        Promise.all([getTuteeEvents(), getTutorEvents()]).finally(() =>
            setLoading(false),
        );
    }, []);

    const handleSelectTutor = async (eventId: number, tutorId: number) => {
        try {
            const res = await fetch(
                `https://api.tutorl.ink/event/${eventId}/accept`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ userid_tutor: tutorId }),
                },
            );
            if (!res.ok) throw new Error("Failed to accept tutor");

            alert("Tutor accepted successfully!");
            // refresh
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading)
        return <div className="text-(--off-white)">Loading events...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="px-18 py-8 text-(--off-white)">
            <h1 className="mb-6 text-2xl">My Events</h1>
            <section className="mb-12">
                <h2 className="mb-4 text-xl">Events I Requested</h2>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div>
                        <h3 className="mb-2 text-lg">Pending</h3>
                        {pendingTuteeEvents.length === 0 ? (
                            <p>No pending events.</p>
                        ) : (
                            <ul className="space-y-4">
                                {pendingTuteeEvents.map((event) => (
                                    <li
                                        key={event.eventid}
                                        className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                                    >
                                        <EventDisplay
                                            event={event}
                                            startTime={
                                                event.available_start_time
                                            }
                                            endTime={event.available_end_time}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <h3 className="mb-2 text-lg">Action Required</h3>
                        {actionTuteeEvents.length === 0 ? (
                            <p>No events.</p>
                        ) : (
                            <ul className="space-y-4">
                                {actionTuteeEvents.map((event) => (
                                    <li
                                        key={event.eventid}
                                        className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                                    >
                                        <EventDisplay
                                            event={event}
                                            startTime={
                                                event.available_start_time
                                            }
                                            endTime={event.available_end_time}
                                        >
                                            <div className="mt-2">
                                                <h4 className="mb-1 text-sm font-medium">
                                                    Possible Tutors:
                                                </h4>
                                                <ul className="space-y-1">
                                                    {event.possible_tutors.map(
                                                        (tutor: any) => (
                                                            <li
                                                                key={
                                                                    tutor.userid_tutor
                                                                }
                                                                className="flex items-center justify-between"
                                                            >
                                                                <span>
                                                                    {tutor.name ||
                                                                        `Tutor ${tutor.userid_tutor}`}
                                                                </span>
                                                                <span className="flex flex-col text-xs text-gray-400">
                                                                    <span>
                                                                        Start:{" "}
                                                                        {formatDate(
                                                                            tutor.start,
                                                                        )}
                                                                        {""}
                                                                    </span>
                                                                    <span>
                                                                        End:{" "}
                                                                        {formatDate(
                                                                            tutor.end,
                                                                        )}
                                                                    </span>
                                                                </span>
                                                                <button
                                                                    className="ml-2 cursor-pointer rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500"
                                                                    onClick={() =>
                                                                        handleSelectTutor(
                                                                            event.eventid,
                                                                            tutor.userid_tutor,
                                                                        )
                                                                    }
                                                                >
                                                                    Select
                                                                </button>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </div>
                                        </EventDisplay>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <h3 className="mb-2 text-lg">Scheduled</h3>
                        {scheduledTuteeEvents.length === 0 ? (
                            <p>No scheduled events.</p>
                        ) : (
                            <ul className="space-y-4">
                                {scheduledTuteeEvents.map((event) => (
                                    <li
                                        key={event.eventid}
                                        className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                                    >
                                        <EventDisplay
                                            event={event}
                                            startTime={
                                                event.userid_tutor.start
                                            }
                                            endTime={event.userid_tutor.end}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            <section>
                <h2 className="mb-4 text-xl">Events I&apos;m Tutoring</h2>
                <div className="flex gap-16">
                    <div className="w-1/2">
                        <h3 className="mb-2 text-lg">Pending</h3>
                        {pendingTutorEvents.length === 0 ? (
                            <p>No pending events.</p>
                        ) : (
                            <ul className="space-y-4">
                                {pendingTutorEvents.map((event) => {
                                    const tutorSlot =
                                        event.possible_tutors.find(
                                            (pt: any) =>
                                                pt.userid_tutor === user.userid,
                                        );

                                    return (
                                        <li
                                            key={event.eventid}
                                            className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                                        >
                                            <EventDisplay
                                                event={event}
                                                startTime={tutorSlot.start}
                                                endTime={tutorSlot.end}
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="w-1/2">
                        <h3 className="mb-2 text-lg">Scheduled</h3>
                        {acceptedTutorEvents.length === 0 ? (
                            <p>No accepted events.</p>
                        ) : (
                            <ul className="space-y-4">
                                {acceptedTutorEvents.map((event) => (
                                    <li
                                        key={event.eventid}
                                        className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                                    >
                                        <EventDisplay
                                            event={event}
                                            startTime={tutorSlot.start}
                                            endTime={tutorSlot.end}
                                        />{" "}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
