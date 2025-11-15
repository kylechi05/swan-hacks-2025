import Link from "next/link";


export default function Home() {
    return (
        <div className="space-y-3">
      <section className="text-center space-y-6 py-12">
        <h1 className="text-5xl md:text-6xl font-bold text-balance max-w-3xl mx-auto">
          Connect with Expert Tutors Anytime, Anywhere
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          Master any subject with personalized one-on-one tutoring. Learn from verified experts who care about your success.
        </p>
      </section>


      <section className="bg-muted/30 rounded-xl p-8 md:p-12 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Getting started with tutoring is straightforward and simple.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 pt-3">
          <div className="space-y-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto">
              1
            </div>
            <h3 className="font-semibold text-lg">Choose Your Subject</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Browse hundreds of subjects and find the perfect match for your learning goals
            </p>
          </div>

          <div className="space-y-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-2xl font-bold mx-auto">
              2
            </div>
            <h3 className="font-semibold text-lg">Book a Session</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Select a time that works for you and book instantly with your chosen tutor
            </p>
          </div>

          <div className="space-y-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto">
              3
            </div>
            <h3 className="font-semibold text-lg">Start Learning</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Join your video session and start mastering your subject with expert guidance
            </p>
          </div>
        </div >
        <div className="space-y-8 text-center"></div>
      </section>

    </div>
    )
}
