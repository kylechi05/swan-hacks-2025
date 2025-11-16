"use client";

export function EventDisplay({ event }: { event: any }) {
    return (
        <div className="flex flex-col text-(--off-white)">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <span className="text-sm text-gray-400">{event.category}</span>
            </div>
            <p className="mt-2 text-sm">{event.description}</p>
            <p className="mt-1 text-xs text-gray-500">
                Available:{" "}
                {new Date(event.available_start_time * 1000).toLocaleString()} –{" "}
                {new Date(event.available_end_time * 1000).toLocaleString()}
            </p>
        </div>
    );
}
