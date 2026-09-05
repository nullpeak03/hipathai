import { SignIn } from "@clerk/nextjs"
import { Brain } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">HiPath AI</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to continue your learning journey</p>
        </div>
        <div className="bg-background border rounded-lg p-6 shadow-sm">
          <SignIn
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
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/onboarding"
          />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  )
}