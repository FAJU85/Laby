import React, { useState, useEffect } from 'react';
import {
  IntensityMatrix,
  ExperimentDesignConfig,
  StatResultRow,
  NormalizationMethod,
  ImputationMethod,
  StatTestType,
  FDRCorrectionMethod,
  ProvenanceManifest
} from '../types/proteomics';
import { runDifferentialExpression, computeQuickHash, computePCA } from '../utils/mathStats';
import { Sliders, Play, CheckCircle2, RotateCcw, Filter, Search, ShieldCheck, ArrowUpDown } from 'lucide-react';

interface WS4Props {
  matrix: IntensityMatrix;
  config: ExperimentDesignConfig;
  setConfig: React.Dispatch<React.SetStateAction<ExperimentDesignConfig>>;
  results: StatResultRow[];
  setResults: (res: StatResultRow[]) => void;
  manifest: ProvenanceManifest | null;
  setManifest: (manifest: ProvenanceManifest) => void;
  executionMode: 'local' | 'cloud';
}

export const WS4GuidedStatistics: React.FC<WS4Props> = ({
  matrix,
  config,
  setConfig,
  results,
  setResults,
  manifest,
  setManifest,
  executionMode,
}) => {
  const [calculating, setCalculating] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'adjPValue' | 'log2FC' | 'geneSymbol'>('adjPValue');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Conditions list
  const conditions = Array.from(new Set(matrix.samples.map(s => s.condition)));

  // Execute statistical pipeline
  const executePipeline = () => {
    setCalculating(true);

    setTimeout(() => {
      const calculatedResults = runDifferentialExpression(matrix.proteins, matrix.samples, config);
      setResults(calculatedResults);

      const sigUp = calculatedResults.filter(r => r.regulation === 'up').length;
      const sigDown = calculatedResults.filter(r => r.regulation === 'down').length;

      const paramString = JSON.stringify({ config, matrixHash: matrix.sha256Checksum });
      const reproHash = computeQuickHash(paramString);

      const newManifest: ProvenanceManifest = {
        pipelineVersion: 'Proteomics Pipeline v1.0.0 (Cloudflare WASM)',
        reproducibilityHash: reproHash,
        timestamp: new Date().toISOString(),
        datasetName: matrix.filename,
        datasetChecksum: matrix.sha256Checksum,
        executionMode,
        parameters: { ...config },
        summaryStats: {
          totalProteinsTested: calculatedResults.length,
          significantUpCount: sigUp,
          significantDownCount: sigDown,
          fdrThreshold: config.pCutoff,
          log2FCThreshold: config.log2FCCutoff,
        },
      };

      setManifest(newManifest);
      setCalculating(false);
    }, 400);
  };

  useEffect(() => {
    if (results.length === 0) {
      executePipeline();
    }
  }, [matrix]);

  // Filtered and sorted results
  const filteredResults = results
    .filter(r =>
      r.geneSymbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.accession.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

  return (
    <div className="space-y-6">
      {/* Experiment Designer Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 tracking-wide uppercase mb-1">
              <Sliders className="w-4 h-4" /> WS4 Guided Statistics Engine
            </div>
            <h2 className="text-xl font-bold text-slate-900">UI Experiment Designer & Statistical Parameters</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              No code required: Select normalization, missing value imputation, statistical test, and FDR adjustment.
            </p>
          </div>

          <button
            onClick={executePipeline}
            disabled={calculating}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 fill-slate-900 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculating Differential Expression...' : 'Run Statistical Analysis'}
          </button>
        </div>

        {/* Experiment Setup Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Group A & Group B Conditions */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Cohorts & Grouping</div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Treatment / Case Group (Group A)</label>
              <select
                value={config.groupA}
                onChange={(e) => setConfig({ ...config, groupA: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                {conditions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Control / Reference Group (Group B)</label>
              <select
                value={config.groupB}
                onChange={(e) => setConfig({ ...config, groupB: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                {conditions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.paired}
                  onChange={(e) => setConfig({ ...config, paired: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Paired Experimental Design (e.g. Before/After)</span>
              </label>
            </div>
          </div>

          {/* Normalization & Imputation */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Transformation & Imputation</div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Intensity Transformation</label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-white p-2 border border-slate-300 rounded-md">
                <input
                  type="checkbox"
                  checked={config.log2Transform}
                  onChange={(e) => setConfig({ ...config, log2Transform: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Apply Log2 Transformation: log2(x + 1)</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Normalization Strategy</label>
              <select
                value={config.normalization}
                onChange={(e) => setConfig({ ...config, normalization: e.target.value as NormalizationMethod })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                <option value="median">Median Centering (Recommended)</option>
                <option value="quantile">Quantile Normalization</option>
                <option value="zscore">Z-Score Standardization</option>
                <option value="max">Max Scaling</option>
                <option value="none">None (Raw Intensities)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Missing Value Imputation</label>
              <select
                value={config.imputation}
                onChange={(e) => setConfig({ ...config, imputation: e.target.value as ImputationMethod })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                <option value="mindet_lod font-medium">LOD / MinDet (Limit of Detection Draw)</option>
                <option value="knn">KNN (K-Nearest Neighbors)</option>
                <option value="median">Protein Median Imputation</option>
                <option value="zero">Zero Filling</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          {/* Statistical Test & Cutoffs */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">3. Hypothesis Testing & FDR</div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Statistical Test</label>
              <select
                value={config.statTest}
                onChange={(e) => setConfig({ ...config, statTest: e.target.value as StatTestType })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                <option value="welch_ttest">Welch's t-test (Unequal Variances)</option>
                <option value="student_ttest">Student's t-test (Equal Variances)</option>
                <option value="mann_whitney">Mann-Whitney U (Non-parametric)</option>
                <option value="anova">One-way ANOVA</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Multiple Testing Correction</label>
              <select
                value={config.fdrCorrection}
                onChange={(e) => setConfig({ ...config, fdrCorrection: e.target.value as FDRCorrectionMethod })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                <option value="benjamini_hochberg">Benjamini-Hochberg (BH FDR)</option>
                <option value="bonferroni">Bonferroni Correction</option>
                <option value="none">None (Raw p-values)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">FDR Cutoff (q)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.pCutoff}
                  onChange={(e) => setConfig({ ...config, pCutoff: parseFloat(e.target.value) || 0.05 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Log2 FC Cutoff</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.log2FCCutoff}
                  onChange={(e) => setConfig({ ...config, log2FCCutoff: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Reproducibility Hash Bar */}
        {manifest && (
          <div className="mt-6 p-3 bg-slate-900 rounded-lg text-slate-200 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Reproducibility Hash: <span className="text-teal-300 font-bold">{manifest.reproducibilityHash}</span></span>
            </div>
            <span className="text-slate-400 hidden sm:inline">Logged parameter state for manuscript Methods</span>
          </div>
        )}
      </div>

      {/* Differential Expression Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Differential Expression Results ({results.length.toLocaleString()} Proteins)
            </h3>
            <p className="text-xs text-slate-500">
              Significant: {results.filter(r => r.regulation === 'up').length} Up-regulated, {results.filter(r => r.regulation === 'down').length} Down-regulated (FDR &lt; {config.pCutoff}, |log2FC| &ge; {config.log2FCCutoff}).
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search protein or gene..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th
                  onClick={() => { setSortField('geneSymbol'); setSortAsc(!sortAsc); }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center gap-1">Gene Symbol / UniProt <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
                <th
                  onClick={() => { setSortField('log2FC'); setSortAsc(!sortAsc); }}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">log2 Fold Change <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">Fold Ratio</th>
                <th
                  onClick={() => { setSortField('adjPValue'); setSortAsc(!sortAsc); }}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">adj. p-value (BH) <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 font-semibold text-center">Regulation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.slice(0, 15).map((row) => (
                <tr key={row.accession} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold">
                    <span className="text-slate-900 mr-2">{row.geneSymbol}</span>
                    <a
                      href={`https://www.uniprot.org/uniprotkb/${row.accession}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:underline font-normal text-xs"
                    >
                      ({row.accession})
                    </a>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">{row.description}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${row.log2FC > 0 ? 'text-red-600' : row.log2FC < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                    {row.log2FC > 0 ? '+' : ''}{row.log2FC.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">{row.foldChangeRatio.toFixed(2)}x</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                    {row.adjPValue < 0.001 ? '< 0.001' : row.adjPValue.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      row.regulation === 'up'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : row.regulation === 'down'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {row.regulation.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
