import { SignUp } from "@clerk/nextjs"
import { Brain } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">HiPath AI</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
          <p className="text-muted-foreground">Start your personalized learning journey for free</p>
        </div>
        <div className="bg-background border rounded-lg p-6 shadow-sm">
          <SignUp
            appearance={{
              elements: {
                formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
                card: "shadow-none border-0 bg-transparent",
                headerTitle: "text-2xl font-bold",
                headerSubtitle: "text-muted-foreground",
                socialButtonsBlockButton: "border bg-background hover:bg-muted",
              },
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/onboarding"
          />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}