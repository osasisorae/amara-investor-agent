'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface KYCUploadCardBoundaryProps {
  children: ReactNode;
}

interface KYCUploadCardBoundaryState {
  hasError: boolean;
}

export class KYCUploadCardBoundary extends Component<
  KYCUploadCardBoundaryProps,
  KYCUploadCardBoundaryState
> {
  state: KYCUploadCardBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): KYCUploadCardBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('KYC upload card crashed:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100">
          <div className="text-sm font-semibold">KYC upload hit an error</div>
          <div className="mt-2 text-sm leading-6 text-rose-100/85">
            The upload widget failed to render correctly. Your chat is still
            active. Retry the widget or reload the page if this persists.
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 rounded-full border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/10"
          >
            Retry upload widget
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
