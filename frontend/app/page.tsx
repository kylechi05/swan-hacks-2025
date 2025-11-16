import Link from "next/link";

export default function Home() {
  return (
    <div className="text-(--off-white) py-3">
      <div className="bg-gradient-to-b from-green-900 to-green-1000 py-40 -mt-25 pb-10">
        <section className="space-y-12 text-center">
          <h1 className="mx-auto max-w-3xl text-5xl font-bold text-white md:text-6xl">
            Connect with Expert Tutors Anytime, Anywhere
          </h1>
          <p className="mx-auto max-w-2xl text-xl pb-5 text-green-100">
            Master any subject with personalized one-on-one tutoring.<br />
            Learn from verified experts who care about your success.
          </p>
          <div className="max-w-xs mx-auto cursor-pointer rounded-lg bg-green-700 px-4 py-2 text-center text-white transition-all hover:scale-105 hover:bg-green-600">
            <Link href="/events" className="text-2xl font-bold hover:text-white ml-auto">
              Get Started
            </Link>
          </div>
        </section>
      </div>

      <section className="bg-muted/30 space-y-8 pt-15 rounded-xl p-8 md:p-8">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">How It Works</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-(--light-gray)">
            Getting started with tutoring is straightforward and simple.
          </p>
        </div>

        <div className="flex flex-row pt-3 pb-10 px-20 gap-x-12">
          <div className="flex-[2] space-y-3 text-center p-6 border-b [border-width:1px] [border-color:var(--primary-border-color)] bg-zinc-900 rounded-xl">
            <div className="bg-primary text-primary-foreground mx-auto flex h-8 w-16 items-center justify-center rounded-full text-2xl font-bold">
              1
            </div>
            <h3 className="text-lg font-semibold">Choose Your Subject</h3>
            <p className="[color:var(--light-gray)] text-sm leading-relaxed">
              Browse hundreds of subjects and find the perfect match for your learning goals
            </p>
          </div>

          <div className="flex-[2] space-y-4 text-center p-6 border-b [border-width:1px] [border-color:var(--primary-border-color)] bg-zinc-900 rounded-xl">
            <div className="bg-secondary text-secondary-foreground mx-auto flex h-8 w-16 items-center justify-center rounded-full text-2xl font-bold">
              2
            </div>
            <h3 className="text-lg font-semibold">Book a Session</h3>
            <p className="[color:var(--light-gray)] text-sm leading-relaxed">
              Select a time that works for you and book instantly with your chosen tutor
            </p>
          </div>

          <div className="flex-[2] space-y-3 text-center p-6 border-b [border-width:1px] [border-color:var(--primary-border-color)] bg-zinc-900 rounded-xl">
            <div className="bg-primary text-primary-foreground mx-auto flex h-8 w-16 items-center justify-center rounded-full text-2xl font-bold">
              3
            </div>
            <h3 className="text-lg font-semibold">Start Learning</h3>
            <p className="[color:var(--light-gray)] text-sm leading-relaxed">
              Join your video session and start mastering your subject with expert guidance
            </p>
          </div>
        </div>
        <div className="space-y-10"></div>
      </section>
    </div>
  );
}
