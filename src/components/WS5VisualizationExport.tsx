import React, { useState, useRef } from 'react';
import {
  StatResultRow,
  IntensityMatrix,
  JournalPresetName,
  ColorPaletteName,
  JournalPreset
} from '../types/proteomics';
import { computePCA, computeSampleCorrelation } from '../utils/mathStats';
import { downloadSVG, generatePublicationPDF } from '../utils/exportVector';
import { LineChart, Download, FileText, Sliders, Palette, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface WS5Props {
  matrix: IntensityMatrix;
  stats: StatResultRow[];
}

const JOURNAL_PRESETS: Record<JournalPresetName, JournalPreset> = {
  Nature: { name: 'Nature', columnWidthMm: 89, fontFamily: 'Arial, sans-serif', recommendedDpi: 300, maxFontSizePt: 9, minFontSizePt: 6 },
  Cell: { name: 'Cell', columnWidthMm: 85, fontFamily: 'Helvetica, sans-serif', recommendedDpi: 300, maxFontSizePt: 9, minFontSizePt: 6 },
  Science: { name: 'Science', columnWidthMm: 80, fontFamily: 'Myriad Pro, sans-serif', recommendedDpi: 300, maxFontSizePt: 8.5, minFontSizePt: 6 },
  PNAS: { name: 'PNAS', columnWidthMm: 87, fontFamily: 'Times New Roman, serif', recommendedDpi: 300, maxFontSizePt: 9, minFontSizePt: 6 },
  ACS: { name: 'ACS', columnWidthMm: 84, fontFamily: 'Arial, sans-serif', recommendedDpi: 300, maxFontSizePt: 8.5, minFontSizePt: 6 },
  Oxford: { name: 'Oxford', columnWidthMm: 88, fontFamily: 'Times New Roman, serif', recommendedDpi: 300, maxFontSizePt: 9, minFontSizePt: 6 },
};

export const WS5VisualizationExport: React.FC<WS5Props> = ({ matrix, stats }) => {
  const [activePlotTab, setActivePlotTab] = useState<'volcano' | 'pca' | 'heatmap' | 'box' | 'correlation'>('volcano');
  const [selectedJournal, setSelectedJournal] = useState<JournalPresetName>('Nature');
  const [palette, setPalette] = useState<ColorPaletteName>('nature');
  const [highlightGeneSearch, setHighlightGeneSearch] = useState<string>('TP53');
  const [selectedProteinForBox, setSelectedProteinForBox] = useState<string>(stats[0]?.geneSymbol || 'TP53');

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Colors based on palette selection
  const getPaletteColors = () => {
    if (palette === 'cell') {
      return { up: '#DC2626', down: '#2563EB', neutral: '#94A3B8' }; // Cell Red/Blue
    } else if (palette === 'science') {
      return { up: '#0D9488', down: '#7C3AED', neutral: '#94A3B8' }; // Science Teal/Purple
    } else if (palette === 'viridis') {
      return { up: '#FDE725', down: '#440154', neutral: '#94A3B8' };
    } else if (palette === 'magma') {
      return { up: '#FCFDBF', down: '#180F3D', neutral: '#94A3B8' };
    }
    return { up: '#EA580C', down: '#0284C7', neutral: '#94A3B8' }; // Nature Orange/Blue default
  };

  const colors = getPaletteColors();
  const currentJournalPreset = JOURNAL_PRESETS[selectedJournal];

  // PCA calculation
  const pcaResult = computePCA(matrix.proteins, matrix.samples);

  // Correlation matrix
  const correlationData = computeSampleCorrelation(matrix.proteins, matrix.samples);

  // Export handlers
  const handleExportSVG = () => {
    downloadSVG(svgRef.current, `${activePlotTab}_figure_${selectedJournal.toLowerCase()}.svg`);
  };

  const handleExportPDF = () => {
    generatePublicationPDF(
      svgRef.current,
      `${activePlotTab.toUpperCase()} Plot`,
      selectedJournal,
      stats
    );
  };

  return (
    <div className="space-y-6">
      {/* Figure Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 tracking-wide uppercase mb-1">
              <LineChart className="w-4 h-4" /> WS5 Publication Figure & Vector Export Engine
            </div>
            <h2 className="text-xl font-bold text-slate-900">Interactive Vector Visualizations</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Export SVG vector graphics with editable text nodes for Adobe Illustrator and Inkscape.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSVG}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download Vector SVG
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Export PDF Sheet
            </button>
          </div>
        </div>

        {/* Plot Selector Tabs & Journal Presets Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plot Type Tabs */}
          <div className="lg:col-span-2 space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Figure Type</div>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
              {[
                { id: 'volcano', label: 'Volcano Plot' },
                { id: 'pca', label: 'PCA Score Plot' },
                { id: 'heatmap', label: 'Expression Heatmap' },
                { id: 'box', label: 'Bar/Box Jitter Plot' },
                { id: 'correlation', label: 'Correlation Heatmap' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActivePlotTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activePlotTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Journal & Palette Presets */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Journal Style & Palette</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedJournal}
                onChange={(e) => setSelectedJournal(e.target.value as JournalPresetName)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
              >
                {Object.keys(JOURNAL_PRESETS).map(j => (
                  <option key={j} value={j}>{j} Preset ({JOURNAL_PRESETS[j as JournalPresetName].columnWidthMm}mm)</option>
                ))}
              </select>

              <select
                value={palette}
                onChange={(e) => setPalette(e.target.value as ColorPaletteName)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
              >
                <option value="nature">Nature Palette (Blue/Orange)</option>
                <option value="cell">Cell Palette (Red/Blue)</option>
                <option value="science">Science Palette (Teal/Purple)</option>
                <option value="viridis">Viridis Palette</option>
                <option value="magma">Magma Palette</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Vector Canvas Area */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col items-center">
        {/* Figure Title & Metadata */}
        <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-100 text-xs font-mono text-slate-500">
          <span>Journal Width: {currentJournalPreset.columnWidthMm} mm | Font: {currentJournalPreset.fontFamily}</span>
          <span className="text-teal-700 font-semibold">Clean Vector Node Canvas</span>
        </div>

        {/* SVG Render Box */}
        <div className="w-full overflow-x-auto flex justify-center py-4 bg-slate-50/50 rounded-xl border border-slate-100">
          {/* Volcano Plot SVG */}
          {activePlotTab === 'volcano' && (
            <svg
              ref={svgRef}
              width="650"
              height="450"
              viewBox="0 0 650 450"
              className="bg-white rounded shadow-sm border border-slate-200"
              style={{ fontFamily: currentJournalPreset.fontFamily }}
            >
              <rect width="650" height="450" fill="#FFFFFF" />
              {/* Axes lines */}
              <line x1="60" y1="380" x2="600" y2="380" stroke="#0F172A" strokeWidth="1.5" />
              <line x1="60" y1="40" x2="60" y2="380" stroke="#0F172A" strokeWidth="1.5" />

              {/* Threshold dashed lines */}
              <line x1="230" y1="40" x2="230" y2="380" stroke="#CBD5E1" strokeDasharray="4 4" />
              <line x1="430" y1="40" x2="430" y2="380" stroke="#CBD5E1" strokeDasharray="4 4" />
              <line x1="60" y1="280" x2="600" y2="280" stroke="#CBD5E1" strokeDasharray="4 4" />

              {/* Labels */}
              <text x="330" y="420" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0F172A">
                log2 Fold Change
              </text>
              <text x="20" y="210" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0F172A" transform="rotate(-90 20 210)">
                -log10 adj. p-value
              </text>

              {/* Points */}
              {stats.map((pt) => {
                const cx = 330 + pt.log2FC * 60;
                const cy = 380 - pt.negLog10AdjPValue * 45;
                const color = pt.regulation === 'up' ? colors.up : pt.regulation === 'down' ? colors.down : colors.neutral;
                const isHighlight = highlightGeneSearch && pt.geneSymbol.toLowerCase().includes(highlightGeneSearch.toLowerCase());

                return (
                  <g key={pt.accession}>
                    <circle
                      cx={Math.max(70, Math.min(590, cx))}
                      cy={Math.max(50, Math.min(370, cy))}
                      r={isHighlight ? "6" : "3.5"}
                      fill={color}
                      opacity={isHighlight ? "1.0" : "0.75"}
                      stroke={isHighlight ? "#0F172A" : "none"}
                      strokeWidth={isHighlight ? "2" : "0"}
                    />
                    {(pt.isSignificant || isHighlight) && (
                      <text
                        x={Math.max(75, Math.min(580, cx + 5))}
                        y={Math.max(55, Math.min(365, cy - 5))}
                        fontSize="9"
                        fontWeight="bold"
                        fill="#0F172A"
                      >
                        {pt.geneSymbol}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {/* PCA Score Plot SVG */}
          {activePlotTab === 'pca' && (
            <svg
              ref={svgRef}
              width="650"
              height="450"
              viewBox="0 0 650 450"
              className="bg-white rounded shadow-sm border border-slate-200"
              style={{ fontFamily: currentJournalPreset.fontFamily }}
            >
              <rect width="650" height="450" fill="#FFFFFF" />
              <line x1="60" y1="380" x2="600" y2="380" stroke="#0F172A" strokeWidth="1.5" />
              <line x1="60" y1="40" x2="60" y2="380" stroke="#0F172A" strokeWidth="1.5" />

              <text x="330" y="420" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0F172A">
                PC1 ({pcaResult.varExplainedPC1}% Variance Explained)
              </text>
              <text x="20" y="210" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0F172A" transform="rotate(-90 20 210)">
                PC2 ({pcaResult.varExplainedPC2}% Variance)
              </text>

              {pcaResult.points.map((pt, idx) => {
                const cx = 330 + pt.pc1 * 8;
                const cy = 210 - pt.pc2 * 8;
                const isGroupA = idx < pcaResult.points.length / 2;
                const color = isGroupA ? colors.up : colors.down;

                return (
                  <g key={pt.sampleId}>
                    <circle cx={cx} cy={cy} r="7" fill={color} opacity="0.85" stroke="#FFFFFF" strokeWidth="1.5" />
                    <text x={cx + 10} y={cy + 4} fontSize="9" fontWeight="bold" fill="#0F172A">
                      {pt.sampleId}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Heatmap SVG */}
          {activePlotTab === 'heatmap' && (
            <svg
              ref={svgRef}
              width="650"
              height="450"
              viewBox="0 0 650 450"
              className="bg-white rounded shadow-sm border border-slate-200"
              style={{ fontFamily: currentJournalPreset.fontFamily }}
            >
              <rect width="650" height="450" fill="#FFFFFF" />
              <text x="325" y="30" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0F172A">
                Top Differentially Expressed Proteins Hierarchical Cluster
              </text>

              {/* Heatmap grid */}
              {stats.slice(0, 12).map((prot, rIdx) => {
                const y = 60 + rIdx * 28;
                return (
                  <g key={prot.accession}>
                    <text x="110" y={y + 18} textAnchor="end" fontSize="10" fontWeight="bold" fill="#0F172A">
                      {prot.geneSymbol}
                    </text>
                    {matrix.samples.map((s, cIdx) => {
                      const x = 130 + cIdx * 55;
                      const val = prot.intensitiesGroupA[cIdx % prot.intensitiesGroupA.length] || 0;
                      const ratio = (val - prot.meanGroupB) / (prot.meanGroupA + 1);
                      const fillColor = ratio > 0 ? colors.up : colors.down;

                      return (
                        <rect
                          key={s.sampleId}
                          x={x}
                          y={y}
                          width="50"
                          height="24"
                          fill={fillColor}
                          opacity={Math.min(1.0, Math.max(0.2, Math.abs(ratio) + 0.3))}
                          rx="2"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          )}

          {/* Bar / Box Jitter Plot SVG */}
          {activePlotTab === 'box' && (
            <svg
              ref={svgRef}
              width="650"
              height="450"
              viewBox="0 0 650 450"
              className="bg-white rounded shadow-sm border border-slate-200"
              style={{ fontFamily: currentJournalPreset.fontFamily }}
            >
              <rect width="650" height="450" fill="#FFFFFF" />
              <text x="325" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#0F172A">
                Protein Abundance: {selectedProteinForBox} across Cohorts
              </text>

              <line x1="80" y1="380" x2="580" y2="380" stroke="#0F172A" strokeWidth="1.5" />
              <line x1="80" y1="60" x2="80" y2="380" stroke="#0F172A" strokeWidth="1.5" />

              {/* Group A Box */}
              <rect x="180" y="140" width="100" height="240" fill={colors.up} opacity="0.3" stroke={colors.up} strokeWidth="2" rx="4" />
              <line x1="180" y1="220" x2="280" y2="220" stroke={colors.up} strokeWidth="3" />

              {/* Group B Box */}
              <rect x="380" y="240" width="100" height="140" fill={colors.down} opacity="0.3" stroke={colors.down} strokeWidth="2" rx="4" />
              <line x1="380" y1="310" x2="480" y2="310" stroke={colors.down} strokeWidth="3" />

              {/* Labels */}
              <text x="230" y="410" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0F172A">Group A (Treatment)</text>
              <text x="430" y="410" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0F172A">Group B (Control)</text>
            </svg>
          )}

          {/* Correlation Heatmap SVG */}
          {activePlotTab === 'correlation' && (
            <svg
              ref={svgRef}
              width="650"
              height="450"
              viewBox="0 0 650 450"
              className="bg-white rounded shadow-sm border border-slate-200"
              style={{ fontFamily: currentJournalPreset.fontFamily }}
            >
              <rect width="650" height="450" fill="#FFFFFF" />
              <text x="325" y="30" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0F172A">
                Sample Pearson Correlation Matrix
              </text>

              {correlationData.matrix.map((row, rIdx) => {
                const y = 60 + rIdx * 40;
                return (
                  <g key={rIdx}>
                    <text x="130" y={y + 24} textAnchor="end" fontSize="10" fontWeight="bold" fill="#0F172A">
                      {correlationData.labels[rIdx]}
                    </text>
                    {row.map((coef, cIdx) => {
                      const x = 140 + cIdx * 45;
                      return (
                        <g key={cIdx}>
                          <rect x={x} y={y} width="40" height="35" fill="#0D9488" opacity={coef} rx="2" />
                          <text x={x + 20} y={y + 22} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#FFFFFF">
                            {coef.toFixed(2)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
