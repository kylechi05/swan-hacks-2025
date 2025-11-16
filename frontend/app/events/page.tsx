import Link from "next/link";

export default function EventsPage() {
    return (
        <div className="flex min-h-screen flex-col gap-16 bg-(--background) px-36 py-20 text-(--off-white)">
            <h1 className="text-center text-4xl font-semibold">Events</h1>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Request Help Card */}
                <div className="flex h-64 flex-col gap-4 rounded-2xl border border-(--primary-border-color) p-8">
                    <h2 className="text-2xl font-semibold">Request Help</h2>
                    <p className="text-(--light-gray)">
                        Need assistance? Create a session and get matched with a
                        tutor.
                    </p>
                    <Link
                        href="/events/create"
                        className="mt-auto cursor-pointer rounded-lg border-2 border-green-600 bg-gradient-to-r from-green-600/35 to-green-600/35 px-4 py-2 text-center text-white transition-all hover:scale-105 hover:border-green-400 hover:from-green-600/50 hover:to-green-600/50">
                        Create Event
                    </Link>

                </div>

                {/* Tutor Others Card */}
                <div className="flex h-64 flex-col gap-4 rounded-2xl border border-(--primary-border-color) p-8">
                    <h2 className="text-2xl font-semibold">Tutor Others</h2>
                    <p className="text-(--light-gray)">
                        Want to help others? Sign up as a tutor and start
                        teaching.
                    </p>
                    <Link
                        href="/events/tutor"
                        className="mt-auto cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-center text-white transition-all hover:scale-105 hover:border-green-700 hover:bg-green-500"
                    >
                        Sign Up to Tutor
                    </Link>
                </div>
            </div>
        </div>
    );
}
