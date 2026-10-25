import React from 'react';
import { UserRole, Workspace } from '../types/proteomics';
import { Shield, Sparkles, Layers, Sliders, LineChart, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';

interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  workspace: Workspace;
  setWorkspaceRole: (role: UserRole) => void;
  onNewProject: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  workspace,
  setWorkspaceRole,
  onNewProject,
}) => {
  const navItems = [
    { id: 'ingestion', label: '1. Ingestion', icon: Layers },
    { id: 'stats', label: '2. Guided Stats', icon: Sliders },
    { id: 'figures', label: '3. Vector Figures', icon: LineChart },
    { id: 'methods', label: '4. Methods & Manifest', icon: FileText },
    { id: 'compliance', label: '5. Journal Audit', icon: CheckCircle2 },
    { id: 'proofreader', label: '6. AI Proofreader', icon: Sparkles },
    { id: 'workspace', label: 'Security & Access', icon: Shield },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-8 h-16">
        {/* Zone 1: Single Brand Title */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); setActiveTab('ingestion'); }}
          className="flex items-center gap-2 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-mono text-sm font-bold">
            P1
          </div>
          <span>Proteomics Pipeline</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
            PROT-001
          </span>
        </a>

        {/* Zone 2: Navigation Links (Single-line, 1-2 words) */}
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Role Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md">
            <span className="text-slate-400">Role:</span>
            <select
              value={workspace.userRole}
              onChange={(e) => setWorkspaceRole(e.target.value as UserRole)}
              className="bg-transparent text-teal-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Owner" className="bg-slate-800 text-slate-100">Owner</option>
              <option value="Analyst" className="bg-slate-800 text-slate-100">Analyst</option>
              <option value="Viewer" className="bg-slate-800 text-slate-100">Viewer</option>
            </select>
          </div>

          <button
            onClick={onNewProject}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-md transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            + Load Dataset
          </button>
        </div>
      </div>

      {/* Mobile Tab Bar Bar fallback */}
      <div className="lg:hidden flex items-center gap-1 px-4 py-2 bg-slate-950 border-t border-slate-800 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                isActive ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
