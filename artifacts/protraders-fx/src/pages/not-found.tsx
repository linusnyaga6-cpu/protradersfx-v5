import { Link } from "wouter"
import { AlertCircle, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-mono tabular-nums">404_NOT_FOUND</CardTitle>
          <CardDescription>
            The requested workspace sector does not exist or has been decommissioned.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-2 pb-8">
          <Button asChild data-testid="button-home">
            <Link href="/" className="gap-2">
              <Home className="h-4 w-4" />
              Return to Terminal
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
