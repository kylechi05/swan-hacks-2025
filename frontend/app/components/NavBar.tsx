import Link from "next/link";

export function NavBar() {
    return (
        <div className="flex h-16 text-sm  flex-row items-center gap-20 border-b border-(--primary-border-color) bg-(--background)/80 px-32 text-(--light-gray) transition-all">
            <Link href="/" className="text-xl font-bold">
                <span className="text-white">Tutor</span>
                <span className="text-green-600">Link</span>
            </Link>
            <Link href="/events" className="hover:text-(--off-white)">
                Events
            </Link>
            <Link href="/join-meeting" className="hover:text-(--off-white)">
                Join Meeting
            </Link>
            <Link href="/auth" className="ml-auto hover:text-(--off-white)">
                Sign in
            </Link>
        </div>
    );
}
