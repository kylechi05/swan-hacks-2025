import Link from "next/link"

export function NavBar() {
    return (
        <div className="flex flex-row items-center h-16 bg-(--background) text-(--light-gray) px-32 gap-20 transition-all">
            <Link href="/" className="text-(--off-white) text-xl">TutorLink</Link>
            <Link href="/events" className="hover:text-(--off-white)">Events</Link>
            <Link href="/auth" className="hover:text-(--off-white) ml-auto">Sign in</Link>
        </div>
    )
}