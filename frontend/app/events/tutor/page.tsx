"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/authContext";
import { Event } from "./components/event";

export default function TutorEvent() {
    const [allEvents, setAllEvents] = useState([]);
    const { token } = useAuth();

    useEffect(() => {
        async function getAllEvents() {
            try {
                const res = await fetch("http://localhost:6969/events", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    return;
                }

                const data = await res.json();
                setAllEvents(data.events);
                console.log(data.events);
            } catch (err) {
                console.error("Request failed:", err);
            }
        }
        getAllEvents();
    }, []);

    return (
        <div className="px-36 py-12 text-(--off-white)">
            <h1 className="mb-4 text-2xl">Tutoring Events</h1>
            {allEvents.length === 0 ? (
                <p>No events found.</p>
            ) : (
                <ul className="space-y-4">
                    {allEvents.map((event) => (
                        <li
                            key={event.eventid}
                            className="rounded-xl border border-(--primary-border-color) px-6 py-4"
                        >
                            <Event event={event} token={token} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
