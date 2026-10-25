import React from 'react';
import { ExecutionMode } from '../types/proteomics';
import { Cpu, Cloud, CheckCircle2, Zap, Terminal } from 'lucide-react';

interface WS3Props {
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
}

export const WS3ExecutionMode: React.FC<WS3Props> = ({ executionMode, setExecutionMode }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 tracking-wide uppercase mb-1">
            <Cpu className="w-4 h-4" /> WS3 Execution Layer Architecture
          </div>
          <h3 className="text-lg font-bold text-slate-900">Execution Mode Selection</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Explicitly select client-side WASM processing vs containerized Cloud Marimo execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            Active Mode: <span className="text-teal-700 font-bold">{executionMode.toUpperCase()}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Mode Option */}
        <button
          onClick={() => setExecutionMode('local')}
          className={`p-5 rounded-xl border text-left transition-all relative ${
            executionMode === 'local'
              ? 'bg-teal-50/50 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Local Mode (Marimo WASM / Pyodide)</span>
            </div>
            {executionMode === 'local' && <CheckCircle2 className="w-5 h-5 text-teal-600" />}
          </div>

          <p className="text-xs text-slate-600 mb-4">
            Runs 100% inside your browser WebAssembly engine. Complete privacy and zero server-side compute cost.
          </p>

          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Zero server latency or cold starts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Standard LFQ & TMT matrices (&lt; 20,000 proteins)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Client-side WebWorker parallel execution</span>
            </div>
          </div>
        </button>

        {/* Cloud Mode Option */}
        <button
          onClick={() => setExecutionMode('cloud')}
          className={`p-5 rounded-xl border text-left transition-all relative ${
            executionMode === 'cloud'
              ? 'bg-teal-50/50 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Cloud className="w-5 h-5 text-teal-600" />
              <span>Cloud Mode (Containerized Marimo Pool)</span>
            </div>
            {executionMode === 'cloud' && <CheckCircle2 className="w-5 h-5 text-teal-600" />}
          </div>

          <p className="text-xs text-slate-600 mb-4">
            Offloads intensive matrix calculations to isolated Cloudflare / Cloud Run containers. Ideal for massive datasets.
          </p>

          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>High-memory container allocation (up to 32GB RAM)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Real-time container execution log streaming</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Supports complex multi-factorial linear models</span>
            </div>
          </div>
        </button>
      </div>

      {/* Cloud Mode Container Terminal Logs Preview */}
      {executionMode === 'cloud' && (
        <div className="mt-6 p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-400" />
              <span className="font-bold">Marimo Container Logs [marimo-worker-pod-492]</span>
            </div>
            <span className="text-emerald-400">Container Ready (0.12s)</span>
          </div>
          <div>[INFO] Mounted R2 matrix input stream...</div>
          <div>[INFO] Pyodide / SciPy 1.12 initialized in isolated environment.</div>
          <div>[SUCCESS] Container allocated 4 vCPU / 8GB RAM for task execution.</div>
        </div>
      )}
    </div>
  );
};
