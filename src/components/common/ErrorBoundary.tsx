import React, { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCw, Trash2, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[CRITICAL APPLICATION ERROR]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearLocalState = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage clear errors
    }
    window.location.reload();
  };

  private handleCopyError = (): void => {
    const { error, errorInfo } = this.state;
    const text = `APPLICATION ERROR:
${error?.message || 'Unknown Error'}

STACK TRACE:
${error?.stack || 'No stack trace available'}

COMPONENT STACK:
${errorInfo?.componentStack || 'No component stack available'}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      }).catch(() => {
        // Fallback
      });
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-2xl w-full bg-slate-900 border border-rose-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-rose-900/50 pb-4">
              <div className="p-3 bg-rose-950/80 text-rose-400 rounded-xl border border-rose-800/80">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">APPLICATION ERROR</h1>
                <p className="text-xs text-rose-400 mt-0.5">An unexpected UI rendering exception was captured.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Error Message</label>
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-rose-300 break-words">
                {error?.message || 'An unknown runtime error occurred in a React component.'}
              </div>
            </div>

            {errorInfo?.componentStack && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Component Context</label>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearLocalState}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/40 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>Clear Local State &amp; Reload</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition cursor-pointer ml-auto"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied Details' : 'Copy Error Details'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
