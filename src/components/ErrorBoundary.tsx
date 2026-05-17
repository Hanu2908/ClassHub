import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown, info: unknown) {
        // You can send this to a logging service
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('Unhandled error in React tree:', error, info);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 24 }}>
                    <h2>Something went wrong</h2>
                    <p>Application encountered an unexpected error. Refresh to retry.</p>
                </div>
            );
        }

        return this.props.children;
    }
}
