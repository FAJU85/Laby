/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Workspace,
  UserRole,
  IntensityMatrix,
  ExecutionMode,
  ExperimentDesignConfig,
  StatResultRow,
  ProvenanceManifest,
  JournalComplianceAudit,
  PlatformAuditLog
} from './types/proteomics';
import { HeLaPresetMatrix } from './data/presets';
import { runDifferentialExpression, computeQuickHash } from './utils/mathStats';
import { TopBar } from './components/TopBar';
import { WS1WorkspaceAccess } from './components/WS1WorkspaceAccess';
import { WS2MatrixIngestion } from './components/WS2MatrixIngestion';
import { WS3ExecutionMode } from './components/WS3ExecutionMode';
import { WS4GuidedStatistics } from './components/WS4GuidedStatistics';
import { WS5VisualizationExport } from './components/WS5VisualizationExport';
import { WS6MethodsGenerator } from './components/WS6MethodsGenerator';
import { WS7JournalCompliance } from './components/WS7JournalCompliance';
import { WS8ProofreadingStudio } from './components/WS8ProofreadingStudio';
import { WS9PlatformSecurity } from './components/WS9PlatformSecurity';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('ingestion');

  // WS1: Workspace & Access Control State
  const [workspace, setWorkspace] = useState<Workspace>({
    id: 'ws-oncology-lab-01',
    name: 'Oncology & Signaling Research Group',
    institution: 'Dana-Farber / Harvard Medical School',
    ownerEmail: 'pi.oncology@lab.org',
    userRole: 'Owner',
    membersCount: 6,
    createdDate: '2026-01-15',
    isIsolated: true,
  });

  // WS2: Ingested Matrix State
  const [matrix, setMatrix] = useState<IntensityMatrix>(HeLaPresetMatrix);

  // WS3: Execution Mode State
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('local');

  // WS4: Experiment Design Config
  const [config, setConfig] = useState<ExperimentDesignConfig>({
    groupFactor: 'Condition',
    groupA: 'Drug_Treated',
    groupB: 'Control',
    paired: false,
    referenceLevel: 'Control',
    log2Transform: true,
    normalization: 'median',
    imputation: 'mindet_lod',
    statTest: 'welch_ttest',
    fdrCorrection: 'benjamini_hochberg',
    pCutoff: 0.05,
    log2FCCutoff: 1.0,
  });

  // Initial calculated statistics results
  const [results, setResults] = useState<StatResultRow[]>(() =>
    runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, {
      groupFactor: 'Condition',
      groupA: 'Drug_Treated',
      groupB: 'Control',
      paired: false,
      referenceLevel: 'Control',
      log2Transform: true,
      normalization: 'median',
      imputation: 'mindet_lod',
      statTest: 'welch_ttest',
      fdrCorrection: 'benjamini_hochberg',
      pCutoff: 0.05,
      log2FCCutoff: 1.0,
    })
  );

  // WS6: Provenance Manifest State
  const [manifest, setManifest] = useState<ProvenanceManifest | null>(() => {
    const reproHash = computeQuickHash(JSON.stringify({ config, matrixHash: HeLaPresetMatrix.sha256Checksum }));
    return {
      pipelineVersion: 'Proteomics Pipeline v1.0.0 (Cloudflare WASM)',
      reproducibilityHash: reproHash,
      timestamp: new Date().toISOString(),
      datasetName: HeLaPresetMatrix.filename,
      datasetChecksum: HeLaPresetMatrix.sha256Checksum,
      executionMode: 'local',
      parameters: config,
      summaryStats: {
        totalProteinsTested: HeLaPresetMatrix.proteins.length,
        significantUpCount: 12,
        significantDownCount: 8,
        fdrThreshold: 0.05,
        log2FCThreshold: 1.0,
      },
    };
  });

  // WS7: Journal Compliance Audit State
  const [compliance, setCompliance] = useState<JournalComplianceAudit>({
    score: 95,
    status: 'Pass',
    checks: [
      {
        id: 'rule-1',
        category: 'MIAPE',
        title: 'Sample Replicate Count (n >= 3)',
        passed: true,
        severity: 'critical',
        details: '8 total sample replicates (4 Control vs 4 Treated).',
        remediation: 'Proteomics standards require at least 3 biological replicates per condition group.',
      },
      {
        id: 'rule-2',
        category: 'MIAPE',
        title: 'Explicit False Discovery Rate (FDR) Threshold',
        passed: true,
        severity: 'critical',
        details: 'FDR Correction set to: Benjamini-Hochberg (q = 0.05).',
        remediation: 'Declare Benjamini-Hochberg or Bonferroni multiple testing adjustment in manuscript.',
      },
      {
        id: 'rule-3',
        category: 'PRIDE / MassIVE',
        title: 'Repository Data Availability Statement',
        passed: true,
        severity: 'critical',
        details: `Dataset SHA-256 Checksum ${HeLaPresetMatrix.sha256Checksum.slice(0, 16)}... linked to R2 storage manifest.`,
        remediation: 'Include PRIDE / MassIVE PXD accession code or R2 repository link in manuscript.',
      },
      {
        id: 'rule-4',
        category: 'Figures',
        title: 'Vector Graphic & Editable Text Standard',
        passed: true,
        severity: 'warning',
        details: 'SVG export mode preserves raw <text> elements without path rasterization.',
        remediation: 'Export figures using the WS5 SVG engine to comply with journal resolution and font requirements.',
      },
      {
        id: 'rule-5',
        category: 'Manuscript',
        title: 'UniProtKB Accession Mapping',
        passed: true,
        severity: 'warning',
        details: 'Canonical protein identifiers mapped to UniProtKB Human release 2026_01.',
        remediation: 'Verify that all reported proteins use standard UniProt accessions (e.g., P04637).',
      },
    ],
  });

  // Platform Audit Logs
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([
    {
      id: 'log-1',
      timestamp: '2026-10-24 21:28:10',
      workspaceId: 'ws-oncology-lab-01',
      actor: 'pi.oncology@lab.org',
      action: 'LOAD_PRESET_MATRIX',
      status: 'SUCCESS',
      details: 'Loaded HeLa_Proteomics_TMT16plex_Matrix.csv (2,500 proteins)',
    },
    {
      id: 'log-2',
      timestamp: '2026-10-24 21:29:05',
      workspaceId: 'ws-oncology-lab-01',
      actor: 'pi.oncology@lab.org',
      action: 'RUN_GUIDED_STATS',
      status: 'SUCCESS',
      details: 'Welch t-test + Benjamini-Hochberg FDR executed on WASM worker thread',
    },
    {
      id: 'log-3',
      timestamp: '2026-10-24 21:30:00',
      workspaceId: 'ws-oncology-lab-01',
      actor: 'pi.oncology@lab.org',
      action: 'EXPORT_VECTOR_SVG',
      status: 'SUCCESS',
      details: 'Volcano_plot_nature.svg generated with editable <text> tags',
    },
  ]);

  const handleSelectMatrix = (newMatrix: IntensityMatrix) => {
    setMatrix(newMatrix);
    const conds = Array.from(new Set(newMatrix.samples.map(s => s.condition)));
    const newConfig: ExperimentDesignConfig = {
      ...config,
      groupA: conds[1] || conds[0] || 'Treatment',
      groupB: conds[0] || 'Control',
    };
    setConfig(newConfig);

    const updatedResults = runDifferentialExpression(newMatrix.proteins, newMatrix.samples, newConfig);
    setResults(updatedResults);

    // Add log
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        workspaceId: workspace.id,
        actor: workspace.ownerEmail,
        action: 'MATRIX_INGESTION',
        status: 'SUCCESS',
        details: `Ingested ${newMatrix.filename} (Checksum: ${newMatrix.sha256Checksum.slice(0, 12)}...)`,
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-900">
      {/* Top Bar Header */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workspace={workspace}
        setWorkspaceRole={(role: UserRole) => setWorkspace({ ...workspace, userRole: role })}
        onNewProject={() => setActiveTab('ingestion')}
      />

      {/* Main Content Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* WS1: Identity & Security */}
        {activeTab === 'workspace' && (
          <WS1WorkspaceAccess
            workspace={workspace}
            setWorkspace={setWorkspace}
            auditLogs={auditLogs}
          />
        )}

        {/* WS2: Matrix Ingestion */}
        {activeTab === 'ingestion' && (
          <div className="space-y-6">
            <WS2MatrixIngestion currentMatrix={matrix} onSelectMatrix={handleSelectMatrix} />
            <WS3ExecutionMode executionMode={executionMode} setExecutionMode={setExecutionMode} />
          </div>
        )}

        {/* WS4: Guided Statistics */}
        {activeTab === 'stats' && (
          <WS4GuidedStatistics
            matrix={matrix}
            config={config}
            setConfig={setConfig}
            results={results}
            setResults={setResults}
            manifest={manifest}
            setManifest={setManifest}
            executionMode={executionMode}
          />
        )}

        {/* WS5: Vector Figures & Publication Export */}
        {activeTab === 'figures' && (
          <WS5VisualizationExport matrix={matrix} stats={results} />
        )}

        {/* WS6: Methods Generator & Manifest */}
        {activeTab === 'methods' && (
          <WS6MethodsGenerator
            manifest={manifest}
            config={config}
            matrix={matrix}
            compliance={compliance}
          />
        )}

        {/* WS7: Journal Compliance Auditor */}
        {activeTab === 'compliance' && (
          <WS7JournalCompliance
            matrix={matrix}
            config={config}
            compliance={compliance}
            setCompliance={setCompliance}
          />
        )}

        {/* WS8: AI Proofreading Studio */}
        {activeTab === 'proofreader' && (
          <WS8ProofreadingStudio stats={results} matrix={matrix} />
        )}

        {/* WS9: Platform Architecture Security */}
        {activeTab === 'security' && (
          <WS9PlatformSecurity />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 text-slate-500 py-6 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Proteomics Publication Pipeline (PROT-001) · Open Source & Non-Commercial License
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('security')} className="hover:text-slate-300">
              Cloudflare Edge Architecture
            </button>
            <button onClick={() => setActiveTab('workspace')} className="hover:text-slate-300">
              Cross-Tenant Isolation
            </button>
            <a
              href="https://www.uniprot.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300"
            >
              UniProtKB Release 2026_01
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
