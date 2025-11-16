"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"
import { useAuth } from "@/app/authContext";

export default function CreateEvent() {
    const { token } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        title: "",
        subject: "",
        description: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
    });

    const [error, setError] = useState("");
    const [subjects, setSubjects] = useState([]);

    useEffect(() => {
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
                    setError(errorData.message || "Failed to load subjects.");
                    return;
                }

                const data = await res.json();
                setSubjects(data.subjects);
            } catch (err) {
                console.error("Request failed:", err);
                setError("Failed to connect to server.");
            }
        }

        loadSubjects();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title || !form.subject) {
            setError("Title and Subject are required.");
            return;
        }
        setError("");
        try {
            const start = new Date(`${form.startDate}T${form.startTime}:00`);
            const startUnix = Math.floor(start.getTime() / 1000);
            const end = new Date(`${form.endDate}T${form.endTime}:00`);
            const endUnix = Math.floor(end.getTime() / 1000);

            const res = await fetch("https://api.tutorl.ink/event/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: form.title,
                    description: form.description,
                    category: form.subject,
                    available_start: startUnix,
                    available_end: endUnix,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("Error response:", errorData);
                setError(errorData.error || errorData.message || "Failed to create event.");
                return;
            }

            const data = await res.json();
            router.push(`/events/success?event_id=${data.event_id}&from=create`)
        } catch (err) {
            console.error("Request failed:", err);
            setError("Failed to connect to server.");
        }
    };

    return (
        <div className="flex min-h-screen flex-col gap-16 px-36 py-20 text-(--off-white)">
            <h1 className="text-center text-4xl font-semibold">
                Request Tutoring
            </h1>

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-8 md:grid-cols-2"
            >
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Title</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) =>
                            setForm({ ...form, title: e.target.value })
                        }
                        placeholder="Enter event title"
                        className="rounded-lg border border-(--primary-border-color) px-3 py-2"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Subject</label>

                    <select
                        value={form.subject}
                        onChange={(e) =>
                            setForm({ ...form, subject: e.target.value })
                        }
                        className="rounded-lg border border-(--primary-border-color) bg-(--background) px-3 py-2"
                        required
                    >
                        <option value="" disabled>
                            Select a subject
                        </option>

                        {subjects.length === 0 ? (
                            <option disabled>Loading subjects...</option>
                        ) : (
                            subjects.map((subj) => (
                                <option key={subj} value={subj}>
                                    {subj}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Enter description"
                        rows={4}
                        className="rounded-lg border border-(--primary-border-color) px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                            setForm({ ...form, startDate: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2"
                    />

                    <label className="mt-4 text-sm font-medium">
                        Start Time
                    </label>
                    <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                            setForm({ ...form, startTime: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">End Date</label>
                    <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) =>
                            setForm({ ...form, endDate: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2"
                    />

                    <label className="mt-4 text-sm font-medium">End Time</label>
                    <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) =>
                            setForm({ ...form, endTime: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2"
                    />
                </div>

                <div className="flex flex-col gap-4 md:col-span-2">
                    {error && (
                        <p className="text-sm font-medium text-red-500">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-white transition-all hover:scale-105 hover:bg-green-500"
                    >
                        Create Event
                    </button>
                </div>
            </form>
        </div>
    );
}
