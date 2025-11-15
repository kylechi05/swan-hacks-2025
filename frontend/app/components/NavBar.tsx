import Link from "next/link";

export function NavBar() {
    return (
        <div className="sticky top-0 backdrop-blur-md flex h-16 text-sm  flex-row items-center gap-20 border-b border-(--primary-border-color) bg-(--background)/85 px-32 text-(--light-gray) transition-all">
            <Link href="/" className="text-xl text-(--off-white)">
                TutorLink
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
