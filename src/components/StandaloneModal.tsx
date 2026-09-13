import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode, CheckCircle2, ExternalLink, Eye, EyeOff } from 'lucide-react';

interface StandaloneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandaloneModal: React.FC<StandaloneModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      let text = '';
      try {
        const res = await fetch('/contact_center_simulator.html');
        if (res.ok) text = await res.text();
      } catch {
        // Fallback
      }
      if (!text) {
        try {
          const res = await fetch('./index.html');
          if (res.ok) text = await res.text();
        } catch {
          // Fallback to outerHTML if running offline
          text = document.documentElement.outerHTML;
        }
      }
      const blob = new Blob([text || document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      setIsLoading(true);
      let text = '';
      try {
        const res = await fetch('/contact_center_simulator.html');
        if (res.ok) text = await res.text();
      } catch {
        // Fallback
      }
      if (!text) {
        try {
          const res = await fetch('./index.html');
          if (res.ok) text = await res.text();
        } catch {
          text = document.documentElement.outerHTML;
        }
      }
      await navigator.clipboard.writeText(text || document.documentElement.outerHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy error', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full p-5 sm:p-6 shadow-2xl relative transition-all ${
        showPreview ? 'max-w-5xl h-[90vh] flex flex-col' : 'max-w-xl'
      }`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Main App Standalone HTML
            </h3>
            <p className="text-xs text-slate-400">
              Single HTML File &bull; Double-Click to Launch &bull; 100% Same Features &bull; 0 Dependencies
            </p>
          </div>
        </div>

        {showPreview ? (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Standalone HTML Preview
              </span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Hide Preview
              </button>
            </div>
            <iframe
              src="/contact_center_simulator.html"
              title="Standalone Contact Center Simulator"
              className="w-full flex-1 rounded-xl border border-slate-800 bg-slate-950"
            />
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2 mb-5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>The Main App is a 100% Standalone Single HTML File</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              The main application HTML (<code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">index.html</code>) has all JavaScript, CSS, and mathematical simulation engines bundled directly into the file. Simply <strong className="text-slate-200">double-click the HTML file</strong> to launch the complete application with 100% identical functions, views, calculations, and styling—no separate files, no local server, and no internet connection required.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div>&bull; Left Panel Flow: Upload, Config, Results</div>
              <div>&bull; Main Panel Tabs: KPIs, Roster, Table, Charts, Solver</div>
              <div>&bull; Discrete-Event Simulation &amp; Erlang</div>
              <div>&bull; Just double-click to launch in any browser</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 mt-4 pt-3 border-t border-slate-800">
          <a
            href="/contact_center_simulator.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[140px] py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
          >
            <ExternalLink className="w-4 h-4" />
            Open Standalone HTML
          </a>

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Close Preview' : 'In-App Preview'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading}
            className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download File
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            disabled={isLoading}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Code
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
