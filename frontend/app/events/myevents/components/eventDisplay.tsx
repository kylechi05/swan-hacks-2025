"use client";

function formatDateTime(dateString: string) {
    const date = new Date(dateString);

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(date);
}

export function EventDisplay({ event }: { event: any }) {
    return (
        <div className="flex flex-col text-(--off-white)">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <span className="text-sm text-gray-400">{event.category}</span>
            </div>
            <p className="mt-2 text-sm">{event.description}</p>
            <div className="mt-1 text-xs text-gray-500">
                <p>Start: {formatDateTime(event.available_start_time)}</p>
                <p>End: {formatDateTime(event.available_end_time)}</p>
            </div>
        </div>
    );
}
