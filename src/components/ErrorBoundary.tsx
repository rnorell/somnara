import React from 'react';
import { StatusScreen } from './StatusScreen';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No crash-reporting service is configured in this project — console
    // logging is the honest current behavior, not a stand-in for telemetry.
    console.error('Unhandled error in render tree:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <StatusScreen
          icon="alert-triangle"
          tone="danger"
          title="Something went wrong"
          message="Somnara ran into an unexpected problem. Try again — if it keeps happening, restart the app."
          actionLabel="Try Again"
          onAction={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
