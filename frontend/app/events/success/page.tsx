"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function SuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const source = searchParams.get("from");

    let message = "You have successfully completed the action.";
    if (source === "create") message = "You have successfully requested a tutor.";
    else if (source === "tutor") message = "You have successfully scheduled tutoring.";

    return (
        <div className="flex pt-52 flex-col items-center justify-center gap-6 px-6 text-center text-(--off-white)">
            <h1 className="text-3xl font-semibold">Success!</h1>
            <p className="text-lg">{message}</p>
            
            <Link
                href="/events/myevents"
                className="cursor-pointer mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white transition-all hover:scale-105 hover:bg-blue-500"
            >
                View my events
            </Link>
        </div>
    );
}
