import React from 'react';
import { StatusScreen } from './StatusScreen';
import { captureException } from '../lib/monitoring';

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
    console.error('Unhandled error in render tree:', error, info.componentStack);
    // No-ops when EXPO_PUBLIC_SENTRY_DSN isn't set — console logging above
    // is the real, current-state behavior either way.
    captureException(error, { componentStack: info.componentStack ?? undefined });
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
