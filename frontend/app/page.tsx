import Link from "next/link";

export default function Home() {
    return (
        <div className="space-y-3 text-(--off-white)">
            <section className="space-y-6 py-12 text-center">
                <h1 className="mx-auto max-w-3xl text-5xl font-bold text-balance md:text-6xl">
                    Connect with Expert Tutors Anytime, Anywhere
                </h1>
                <p className="text-muted-foreground mx-auto max-w-2xl text-xl text-balance">
                    Master any subject with personalized one-on-one tutoring.
                    Learn from verified experts who care about your success.
                </p>
            </section>

            <section className="bg-muted/30 space-y-8 rounded-xl p-8 md:p-12">
                <div className="space-y-2 text-center">
                    <h2 className="text-3xl font-bold md:text-4xl">
                        How It Works
                    </h2>
                    <p className="text-muted-foreground mx-auto max-w-2xl">
                        Getting started with tutoring is straightforward and
                        simple.
                    </p>
                </div>

                <div className="grid gap-8 pt-3 md:grid-cols-3">
                    <div className="space-y-3 text-center">
                        <div className="bg-primary text-primary-foreground mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold">
                            1
                        </div>
                        <h3 className="text-lg font-semibold">
                            Choose Your Subject
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Browse hundreds of subjects and find the perfect
                            match for your learning goals
                        </p>
                    </div>

                    <div className="space-y-3 text-center">
                        <div className="bg-secondary text-secondary-foreground mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold">
                            2
                        </div>
                        <h3 className="text-lg font-semibold">
                            Book a Session
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Select a time that works for you and book instantly
                            with your chosen tutor
                        </p>
                    </div>

                    <div className="space-y-3 text-center">
                        <div className="bg-primary text-primary-foreground mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold">
                            3
                        </div>
                        <h3 className="text-lg font-semibold">
                            Start Learning
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Join your video session and start mastering your
                            subject with expert guidance
                        </p>
                    </div>
                </div>
                <div className="space-y-8 text-center"></div>
            </section>
        </div>
    );
}
