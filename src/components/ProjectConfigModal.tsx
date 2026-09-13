import React, { useState } from 'react';
import {
  X,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileJson,
} from 'lucide-react';
import { WorkforceConfig } from '../types';

interface ProjectConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WorkforceConfig;
  onApplyConfig: (newConfig: WorkforceConfig) => void;
  onResetParameters: () => void;
  onResetProject: () => void;
  onHardClear: () => void;
}

export const ProjectConfigModal: React.FC<ProjectConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onApplyConfig,
  onResetParameters,
  onResetProject,
  onHardClear,
}) => {
  const [clearInputText, setClearInputText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const exportObj = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      description: 'Contact Center Erlang + Roster + DES Configuration',
      config,
    };
    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CC_Simulator_Config_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const importedConfig = parsed.config || parsed;
        if (typeof importedConfig.totalHC !== 'number') {
          throw new Error('Invalid configuration format: missing totalHC property');
        }
        onApplyConfig({ ...config, ...importedConfig });
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 4000);
      } catch (err: any) {
        setImportError(`Failed to import configuration: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 my-8 text-slate-100 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Project &amp; Configuration Controls
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                  PRD Sections 83, 84, 86, 87
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Export and import assumptions JSON, or perform controlled project and cache resets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto pr-1 space-y-6 py-4 flex-1">
          {/* Section 1: Export / Import Configuration */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5" />
              1. Configuration Export &amp; Import (PRD 84 &amp; 87)
            </h3>
            <p className="text-xs text-slate-300">
              Save all workforce parameters, shrinkage, adherence, curfew, team rules, and simulation settings into a portable JSON file to recreate simulations instantly on another machine.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Export Configuration JSON
              </button>

              <label className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                Import Configuration JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>

            {importSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Configuration imported successfully! All parameters updated.
              </div>
            )}

            {importError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                {importError}
              </div>
            )}
          </div>

          {/* Section 2: Reset Controls (PRD Section 86) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              2. Reset Controls (PRD Section 86)
            </h3>
            <p className="text-xs text-slate-400">
              Three distinct reset functions with strictly separated impact tiers:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Reset Parameters */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                  Reset Parameters
                </div>
                <p className="text-[11px] text-slate-400">
                  Restore parameters to recommended PRD defaults while <strong className="text-slate-200">retaining your uploaded demand dataset</strong>.
                </p>
                <button
                  onClick={() => {
                    onResetParameters();
                    onClose();
                  }}
                  className="w-full mt-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
                >
                  Reset Parameters Only
                </button>
              </div>

              {/* Reset Project */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  Reset Project
                </div>
                <p className="text-[11px] text-slate-400">
                  Remove uploaded dataset, roster, results, and reset all parameters to initial clean state.
                </p>
                <button
                  onClick={() => {
                    onResetProject();
                    onClose();
                  }}
                  className="w-full mt-2 px-3 py-1.5 text-xs font-medium bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 rounded border border-amber-800/80 transition"
                >
                  Reset Entire Project
                </button>
              </div>
            </div>

            {/* Hard Clear */}
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/60 space-y-3 mt-4">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Hard Clear (Destructive Action)
              </div>
              <p className="text-[11px] text-slate-300">
                Wipes LocalStorage, cached browser state, custom presets, column mappings, and returns the workspace to pristine zero state.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder='Type "CLEAR" to confirm...'
                  value={clearInputText}
                  onChange={e => setClearInputText(e.target.value)}
                  className="w-full sm:w-64 bg-slate-950 border border-rose-900/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  disabled={clearInputText !== 'CLEAR'}
                  onClick={() => {
                    onHardClear();
                    onClose();
                  }}
                  className="w-full sm:w-auto px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition"
                >
                  Execute Hard Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
