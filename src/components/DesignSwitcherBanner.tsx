import React from 'react';
import { LayoutDesignMode } from './Header';
import { Compass, SlidersHorizontal, Layers, Check, Sparkles } from 'lucide-react';

interface DesignSwitcherBannerProps {
  activeDesign: LayoutDesignMode;
  onSelectDesign: (design: LayoutDesignMode) => void;
}

export const DesignSwitcherBanner: React.FC<DesignSwitcherBannerProps> = ({
  activeDesign,
  onSelectDesign,
}) => {
  const designs: {
    id: LayoutDesignMode;
    name: string;
    tag: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'studio',
      name: 'Design 1: Studio Flow',
      tag: 'Guided Pipeline',
      description: 'Structured 3-step workflow on the left (Upload → Staffing → Engine) paired with a tabbed analytical stage.',
      icon: Compass,
    },
    {
      id: 'cockpit',
      name: 'Design 2: Operations Cockpit',
      tag: 'High-Density Command',
      description: 'Live top executive metric ticker strip with condensed parameter sidebar and side-by-side cockpit views.',
      icon: SlidersHorizontal,
    },
    {
      id: 'minimal',
      name: 'Design 3: Minimalist Focus',
      tag: 'Linear Clean View',
      description: 'Cardless, distraction-free aesthetic with subtle hairline dividers, generous breathing space, and crisp typography.',
      icon: Layers,
    },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Select Your Preferred Layout Design
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal normal-case">
                Live Preview &amp; Selection
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Click any design below to switch the entire application layout in real-time.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 self-end md:self-auto">
          <span>Active:</span>
          <span className="text-white font-bold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
            {designs.find(d => d.id === activeDesign)?.name.replace(/Design \d: /, '')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {designs.map(d => {
          const Icon = d.icon;
          const isSelected = activeDesign === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDesign(d.id)}
              className={`text-left p-3 rounded-xl border transition cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {d.name}
                  </span>
                </div>
                {isSelected ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                    <Check className="w-3 h-3" /> Selected
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-medium">{d.tag}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {d.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
