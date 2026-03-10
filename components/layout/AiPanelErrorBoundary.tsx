'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AiPanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[ai/panel] runtime error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full bg-white border-l border-gray-200 flex flex-col items-center justify-center px-4 text-center">
          <h3 className="text-sm font-semibold text-gray-900">AI panel hit an error</h3>
          <p className="text-xs text-gray-500 mt-1">
            Refresh the page to reset the assistant. Your leads and conversations are still safe.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
