"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/authContext";
import { Event } from "./components/event";

export default function TutorEvent() {
    const [subjects, setSubjects] = useState<string[]>([]);
    const [allEvents, setAllEvents] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>("All");
    const { token } = useAuth();

    useEffect(() => {
        async function getAllEvents() {
            try {
                const res = await fetch("https://api.tutorl.ink/events", {
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

        async function loadSubjects() {
            try {
                const res = await fetch("https://api.tutorl.ink/subjects", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    return;
                }

                const data = await res.json();
                setSubjects(data.subjects);
            } catch (err) {
                console.error("Request failed:", err);
            }
        }

        loadSubjects();
        getAllEvents();
    }, [token]);

    // Filtered events based on selected subject
    const filteredEvents =
        selectedSubject === "All"
            ? allEvents
            : allEvents.filter((event) => event.category === selectedSubject);

    return (
        <div className="px-36 py-12 text-(--off-white)">
            <h1 className="mb-4 text-2xl">Tutoring Events</h1>
            <div className="flex flex-row w-full gap-24">
                {/* Subject Filter */}
                <div className="w-1/4 shrink-0">
                    <label className="mt-8 mb-2 block text-sm font-medium">
                        Filter by Subject
                    </label>
                    <select
                        className="w-full rounded border border-(--primary-border-color) bg-(--background) p-2 text-(--off-white)"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                    >
                        <option value="All">All</option>
                        {subjects.map((subject) => (
                            <option key={subject} value={subject}>
                                {subject}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Event List */}
                {filteredEvents.length === 0 ? (
                    <p>No events found.</p>
                ) : (
                    <ul className="space-y-4 w-full">
                        {filteredEvents.map((event) => (
                            <li
                                key={event.eventid}
                                className="rounded-xl border border-(--primary-border-color) px-8 py-4"
                            >
                                <Event event={event} token={token} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
