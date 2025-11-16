"use client";

function formatDate(date: number | string) {
    const value = typeof date === "number" ? date * 1000 : date;
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short"
    }).format(new Date(value));
}


export function EventDisplay({
    event,
    startTime,
    endTime,
    children,
}: {
    event: any;
    startTime: number | string;
    endTime: number | string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col text-(--off-white)">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <span className="text-sm text-gray-400">{event.category}</span>
            </div>

            <p className="mt-2 text-sm">{event.description}</p>

            <div className="mt-1 text-xs text-(--light-gray)">
                <p>Start: {formatDate(startTime)}</p>
                <p>End: {formatDate(endTime)}</p>
            </div>

            {children && <div className="mt-2">{children}</div>}
        </div>
    );
}
