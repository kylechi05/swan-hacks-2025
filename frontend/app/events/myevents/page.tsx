"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/authContext";
import { EventDisplay } from "./components/eventDisplay";

export default function MyEvents() {
    const { token, user } = useAuth();
    const [tuteeEvents, setTuteeEvents] = useState<any[]>([]);
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
                const res = await fetch("http://localhost:6969/events/tutee", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch tutee events");
                const data = await res.json();
                const tuteeEvents = data.events;

                const pendingTuteeEvents = tuteeEvents.filter(
                    (e) =>
                        e.possible_tutors.length === 0 && e.userid_tutor === null,
                );
                setPendingTuteeEvents(pendingTuteeEvents);

                const actionTuteeEvents = tuteeEvents.filter(
                    (e) =>
                        e.possible_tutors.length > 0 &&
                        e.userid_tutor === null,
                );
                setActionTuteeEvents(actionTuteeEvents);

                const scheduledTuteeEvents = tuteeEvents.filter(
                    (e) => e.userid_tutor !== null,
                );
                setScheduledTuteeEvents(scheduledTuteeEvents);
            } catch (err: any) {
                setError(err.message);
            }
        };

        const getTutorEvents = async () => {
            try {
                const res = await fetch("http://localhost:6969/events/tutor", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch tutor events");
                const data = await res.json();
                const tutorEvents = data.events;
                const pendingTutorEvents = tutorEvents.filter(
                    (event) =>
                        event.possible_tutors?.some(
                            (pt: any) => pt.userid_tutor === user.userid,
                        ) && event.userid_tutor === null,
                );

                const acceptedTutorEvents = tutorEvents.filter(
                    (event) => event.userid_tutor === user.userid,
                );

                setPendingTutorEvents(pendingTutorEvents);
                setAcceptedTutorEvents(acceptedTutorEvents);
            } catch (err: any) {
                setError(err.message);
            }
        };

        Promise.all([getTuteeEvents(), getTutorEvents()]).finally(() =>
            setLoading(false),
        );
    }, [token]);

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
                                        <EventDisplay event={event} />
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
                                        <EventDisplay event={event} />
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
                                        <EventDisplay event={event} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            <section>
                <h2 className="mb-4 text-xl">Events I&apos;m Tutoring</h2>
                <div className="flex gap-8">
                    <div className="w-1/2">
                        <h3 className="mb-2 text-lg">Pending</h3>
                        {pendingTutorEvents.length === 0 ? (
                            <p>No pending events.</p>
                        ) : (
                            <ul className="space-y-4">
                                {pendingTutorEvents.map((event) => (
                                    <li
                                        key={event.eventid}
                                        className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                                    >
                                        <EventDisplay event={event} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Accepted */}
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
                                        <EventDisplay event={event} />
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
