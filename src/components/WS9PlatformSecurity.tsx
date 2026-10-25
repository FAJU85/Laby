import React from 'react';
import { Server, Shield, HardDrive, Zap, BarChart2, CheckCircle2, Lock, Clock } from 'lucide-react';

export const WS9PlatformSecurity: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 tracking-wide uppercase mb-1">
              <Shield className="w-4 h-4" /> WS9 Platform Architecture & Security Operations
            </div>
            <h2 className="text-xl font-bold text-slate-900">Cloudflare Infrastructure & Retention Telemetry</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Real-time monitoring of Workers API, Hyperdrive Postgres metadata, Durable Objects job state, and R2 retention policies.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Security Review Signed Off
          </span>
        </div>

        {/* System Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-1">
              <Server className="w-4 h-4 text-teal-600" /> Cloudflare Workers API
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">100% Edge</div>
            <div className="text-xs text-slate-500 mt-1">280+ edge locations worldwide</div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-1">
              <HardDrive className="w-4 h-4 text-teal-600" /> Hyperdrive Postgres
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">1.2 ms Latency</div>
            <div className="text-xs text-slate-500 mt-1">Connection pooled metadata index</div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-1">
              <Zap className="w-4 h-4 text-teal-600" /> Durable Objects
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">12 Active Jobs</div>
            <div className="text-xs text-slate-500 mt-1">Single-key state synchronization</div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-1">
              <Lock className="w-4 h-4 text-teal-600" /> WAF & Turnstile
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">0 Bot Threats</div>
            <div className="text-xs text-slate-500 mt-1">Strict rate limiting on /upload</div>
          </div>
        </div>
      </div>

      {/* Retention Policy Asymmetry & Storage Rules */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" /> R2 Retention Policy Asymmetry
        </h3>
        <p className="text-xs text-slate-600 mb-4">
          To minimize storage costs while guaranteeing user trust, heavy matrix artifacts follow ephemeral lifecycle rules while manuscript workspaces remain durable.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
            <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
              Class A: Heavy Matrix Artifacts (Ephemeral)
            </div>
            <div className="text-sm font-semibold text-slate-900 mb-2">0–30 Day Ephemeral Retention Window</div>
            <p className="text-xs text-slate-600">
              Raw .csv/.tsv intensity matrices and temporary computational caches are automatically purged after 30 days via R2 lifecycle rules (`r2://proteomics-matrices-ephemeral`).
            </p>
          </div>

          <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl">
            <div className="text-xs font-bold text-teal-900 uppercase tracking-wider mb-1">
              Class B: Manuscript Workspaces (Durable)
            </div>
            <div className="text-sm font-semibold text-slate-900 mb-2">Durable Retention Until Account Deletion</div>
            <p className="text-xs text-slate-600">
              Generated Methods text, reproducibility manifests, vector SVG/PDF figures, and compliance audit certificates remain permanently accessible until explicit user deletion.
            </p>
          </div>
        </div>
      </div>

      {/* Logpush & Analytics Engine Telemetry Dashboard */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-teal-600" /> Cloudflare Logpush & Analytics Telemetry
        </h3>

        <div className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
          <div className="text-slate-400 pb-2 border-b border-slate-800 flex justify-between">
            <span>[Logpush Event Stream - Last 100 Requests]</span>
            <span className="text-emerald-400">Stream Status: Healthy (0% Errors)</span>
          </div>
          <div>2026-10-24 21:30:12 UTC | POST /api/proofread | HTTP 200 | 240ms | Client IP: 188.16.2.14 | Turnstile: Passed</div>
          <div>2026-10-24 21:29:45 UTC | GET /api/matrix/sha256 | HTTP 200 | 12ms | R2 ETag Match | Cache: HIT</div>
          <div>2026-10-24 21:28:30 UTC | POST /api/stats/welch | HTTP 200 | 45ms | Marimo WASM Local Execution</div>
        </div>
      </div>
    </div>
  );
};
