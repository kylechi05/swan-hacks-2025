import Link from "next/link";

export default function Home() {
    return (
        <div className="flex">
            <main className="w-full bg-(--background) text-(--off-white)">
                <div className="flex flex-col gap-18 px-40 py-30">
                    <h1 className="text-6xl font-medium">
                        Live tutoring that meets you anywhere
                    </h1>
                    <Link
                        href="/events"
                        className="cursor-hover w-fit rounded-full border-2 border-(--off-white) px-5 py-1"
                    >
                        Connect Now
                    </Link>
                </div>
            </main>
        </div>
    );
}
