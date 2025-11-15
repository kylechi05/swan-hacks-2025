import Link from "next/link"

export function NavBar() {
    return (
        <div className="flex flex-row items-center h-16 bg-blue-200 px-20 gap-12">
            <Link href="/">NAVBAR</Link>
            <Link href="/events">Events</Link>
            <Link href="/auth" className="ml-auto">Sign in</Link>
        </div>
    )
}