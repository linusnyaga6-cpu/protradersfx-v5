import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: any;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>System Fault Detected</CardTitle>
              <CardDescription>
                The interface encountered an unexpected error.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-secondary rounded-md text-xs font-mono text-muted-foreground overflow-x-auto">
                {this.state.error?.message || "Unknown error"}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="w-full gap-2"
                data-testid="button-recover"
              >
                <RefreshCcw className="h-4 w-4" />
                Reinitialize Workspace
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
