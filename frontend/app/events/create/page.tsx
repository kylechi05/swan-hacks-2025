"use client";
import { useState } from "react";

export default function CreateEvent() {
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

    const subjects = [
        "Math",
        "Science",
        "English",
        "History",
        "Computer Science",
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title || !form.subject) {
            setError("Title and Subject are required.");
            return;
        }
        setError("");
        console.log("Event data:", form);
        // TODO: send to API
    };

    return (
        <div className="flex min-h-screen flex-col gap-16 px-36 py-20 text-(--off-white)">
            <h1 className="text-center text-4xl font-semibold">Request Tutoring</h1>

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-8 md:grid-cols-2"
            >
                {/* Title */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Title</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) =>
                            setForm({ ...form, title: e.target.value })
                        }
                        placeholder="Enter event title"
                        className="rounded-lg border border-(--primary-border-color) px-3 py-2 placeholder-(--medium-gray)"
                        required
                    />
                </div>

                {/* Subject */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Subject</label>
                    <select
                        value={form.subject}
                        onChange={(e) =>
                            setForm({ ...form, subject: e.target.value })
                        }
                        className="rounded-lg border border-(--primary-border-color) bg-(--background) px-3 py-2.25 placeholder-(--medium-gray)"
                        required
                    >
                        <option value="" disabled>
                            Select a subject
                        </option>
                        {subjects.map((subj) => (
                            <option key={subj} value={subj}>
                                {subj}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Enter description"
                        rows={4}
                        className="rounded-lg border border-(--primary-border-color) px-3 py-2 placeholder-(--medium-gray)"
                    />
                </div>

                {/* Start Date & Time */}
                <div className="flex flex-col gap-2">
                    <label className="font-medium text-sm">Start Date</label>
                    <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                            setForm({ ...form, startDate: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2 placeholder-(--medium-gray)"
                    />
                    <label className="mt-4 font-medium text-sm">Start Time</label>
                    <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                            setForm({ ...form, startTime: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2 placeholder-(--medium-gray)"
                    />
                </div>

                {/* End Date & Time */}
                <div className="flex flex-col gap-2">
                    <label className="font-medium text-sm">End Date</label>
                    <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) =>
                            setForm({ ...form, endDate: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2 placeholder-(--medium-gray)"
                    />
                    <label className="mt-4 font-medium text-sm">End Time</label>
                    <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) =>
                            setForm({ ...form, endTime: e.target.value })
                        }
                        required
                        className="rounded-lg border border-(--primary-border-color) p-2 placeholder-(--medium-gray)"
                    />
                </div>

                {/* Error Message & Submit Button */}
                <div className="flex flex-col gap-4 md:col-span-2">
                    {error && (
                        <p className="font-medium text-sm text-red-500">{error}</p>
                    )}
                    <button
                        type="submit"
                        className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-all hover:scale-105 hover:bg-blue-500"
                    >
                        Create Event
                    </button>
                </div>
            </form>
        </div>
    );
}
