"use client";

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function SuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const source = searchParams.get("from");

    let message = "You have successfully completed the action.";
    let endmessage = "We'll keep you updated!"
    if (source === "create") {
        message = "You have successfully requested a tutor.";
        endmessage = "A tutor will review and confirm your request, so stay tuned!"
    } else if (source === "tutor") {
        message = "You have successfully scheduled tutoring.";
        endmessage = "Your session is confirmed, so stay tuned!"
    };

    return (
        <div className="flex pt-30 flex-col items-center justify-center gap-6 px-6 text-center text-(--off-white)">
            <CheckCircleIcon className="h-24 w-24 white" />
            <h1 className="text-4xl font-semibold">Request Sent!</h1>
            <p className="text-lg">{message}</p>
            
            <Link
                href="/events/myevents"
                className="cursor-pointer mt-4 rounded-lg bg-green-600 px-4 py-2 text-white transition-all hover:scale-105 hover:bg-green-400"
            >
                View my events
            </Link>
            <div className="h-1"></div>
        <div className="space-y-1 text-center p-6 border-b [border-width:1px] [border-color:var(--primary-border-color)] bg-zinc-900 rounded-xl">
            <h3 className="text-lg font-semibold">What's next?</h3>
            <p className="[color:var(--light-gray)] text-sm leading-relaxed">
              {endmessage}
            </p>
          </div>
        </div>
        
    );
}
