import React, { useState } from 'react';
import { IntensityMatrix } from '../types/proteomics';
import { PRESET_DATASETS } from '../data/presets';
import { computeSHA256 } from '../utils/mathStats';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ShieldCheck, Database, RefreshCw } from 'lucide-react';

interface WS2Props {
  currentMatrix: IntensityMatrix;
  onSelectMatrix: (matrix: IntensityMatrix) => void;
}

export const WS2MatrixIngestion: React.FC<WS2Props> = ({ currentMatrix, onSelectMatrix }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Parse uploaded CSV / TSV file
  const handleFileUpload = async (file: File) => {
    setParsing(true);
    setValidationError(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length < 2) {
        setValidationError('Malformed file error: The uploaded file contains fewer than 2 lines. Matrix requires header row + protein intensity rows.');
        setParsing(false);
        return;
      }

      const delimiter = file.name.endsWith('.tsv') ? '\t' : ',';
      const header = lines[0].split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));

      // Check header columns
      if (header.length < 3) {
        setValidationError('Malformed matrix schema: Minimum 3 columns required (Accession, GeneSymbol, and at least 1 sample intensity column).');
        setParsing(false);
        return;
      }

      const accessionCol = header[0];
      const geneCol = header[1];
      const sampleCols = header.slice(2);

      // Compute SHA-256 checksum
      const checksum = await computeSHA256(text);

      const parsedSamples = sampleCols.map((colName, idx) => {
        const isTreatment = colName.toLowerCase().includes('treat') || colName.toLowerCase().includes('cancer') || idx >= Math.floor(sampleCols.length / 2);
        return {
          sampleId: colName,
          condition: isTreatment ? 'Treatment_Group' : 'Control_Group',
          replicate: (idx % Math.ceil(sampleCols.length / 2)) + 1
        };
      });

      const parsedProteins = [];
      let zeroCount = 0;
      let missingCount = 0;
      let totalCells = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;

        const accession = cols[0] || `PROT_${i}`;
        const geneSymbol = cols[1] || accession;
        const intensities: Record<string, number> = {};

        sampleCols.forEach((sid, sIdx) => {
          totalCells++;
          const rawVal = parseFloat(cols[sIdx + 2]);
          if (isNaN(rawVal) || cols[sIdx + 2] === '' || cols[sIdx + 2] === 'NA') {
            missingCount++;
            intensities[sid] = NaN;
          } else if (rawVal === 0) {
            zeroCount++;
            intensities[sid] = 0;
          } else {
            intensities[sid] = rawVal;
          }
        });

        parsedProteins.push({
          accession,
          geneSymbol,
          description: `Proteomics Matrix Entry ${accession}`,
          intensities
        });
      }

      const missingPct = totalCells > 0 ? Number(((missingCount / totalCells) * 100).toFixed(1)) : 0;

      const newMatrix: IntensityMatrix = {
        id: `user-matrix-${Date.now()}`,
        filename: file.name,
        sha256Checksum: checksum,
        fileSizeBytes: file.size,
        uploadedAt: new Date().toISOString().split('T')[0],
        samples: parsedSamples,
        proteins: parsedProteins,
        totalProteinsCount: parsedProteins.length,
        missingValuePercentage: missingPct,
        zeroIntensityCount: zeroCount,
        schemaValidationStatus: 'valid',
        validationMessages: [
          `Uploaded file validated: ${parsedProteins.length} proteins x ${parsedSamples.length} sample columns.`,
          `SHA-256 Checksum computed: ${checksum.slice(0, 16)}...`,
          `Missing values detected: ${missingPct}% (${missingCount} missing cells). Handled during guided statistics.`
        ]
      };

      onSelectMatrix(newMatrix);
      setParsing(false);
    } catch (err: any) {
      setValidationError(`Matrix Parsing Error: ${err.message || 'Unable to parse file matrix. Verify CSV/TSV format.'}`);
      setParsing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview & Preset Selector Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 tracking-wide uppercase mb-1">
              <Database className="w-4 h-4" /> WS2 Matrix Ingestion & Validation
            </div>
            <h2 className="text-xl font-bold text-slate-900">Proteomics Intensity Matrix Ingestion</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Upload processed MS intensity matrices (.csv / .tsv) or test immediately with pre-loaded lab presets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md">
              R2 Bucket: <span className="text-slate-900 font-semibold">r2://proteomics-matrices-ephemeral</span>
            </span>
          </div>
        </div>

        {/* Pre-loaded Lab Dataset Presets */}
        <div className="mt-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Quick-Try Preloaded Lab Presets (Instant 1-Click Load)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESET_DATASETS.map((preset) => {
              const isSelected = currentMatrix.id === preset.matrix.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectMatrix(preset.matrix)}
                  className={`p-4 text-left rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-teal-50/50 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-mono text-teal-700 uppercase">{preset.matrix.filename}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                  </div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{preset.title}</div>
                  <div className="text-xs text-slate-500">{preset.subtitle}</div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>{preset.matrix.totalProteinsCount} Proteins</span>
                    <span>{preset.matrix.samples.length} Samples</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* File Upload Drag & Drop Zone */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4 text-teal-600" /> Upload Custom Intensity Matrix & Metadata
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Drop your .csv or .tsv file containing raw or log-transformed mass spectrometry intensity measurements.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragActive ? 'border-teal-500 bg-teal-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
            id="matrix-file-input"
          />
          <label htmlFor="matrix-file-input" className="cursor-pointer block">
            <FileSpreadsheet className="w-10 h-10 text-teal-600 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-900">
              {parsing ? 'Parsing and computing SHA-256 checksum...' : 'Click to upload or drag & drop matrix file'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Supports .csv and .tsv matrices up to 50MB. (Format: Accession, GeneSymbol, Sample_1, Sample_2...)
            </div>
          </label>
        </div>

        {/* Actionable Human-Readable Diagnostics Error Display */}
        {validationError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-0.5">Schema Validation Failed</div>
              <div>{validationError}</div>
              <div className="mt-2 text-red-600 font-mono">Action: Verify your header columns match: "Accession, GeneSymbol, Sample1, Sample2..."</div>
            </div>
          </div>
        )}
      </div>

      {/* Active Loaded Matrix Diagnostics & Preview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">{currentMatrix.filename}</div>
              <div className="text-xs font-mono text-slate-500">SHA-256: {currentMatrix.sha256Checksum}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Schema Validated
            </span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500">Total Proteins</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{currentMatrix.totalProteinsCount.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500">Sample Replicates</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{currentMatrix.samples.length}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500">Missing Values</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{currentMatrix.missingValuePercentage}%</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500">Zero Intensity Cells</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{currentMatrix.zeroIntensityCount}</div>
          </div>
        </div>

        {/* Validation Messages List */}
        <div className="space-y-1.5 mb-6">
          {currentMatrix.validationMessages.map((msg, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
        </div>

        {/* Data Table Preview */}
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          Intensity Matrix Data Preview (First 5 Rows)
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-2 px-3 font-semibold">Accession</th>
                <th className="py-2 px-3 font-semibold">Gene Symbol</th>
                {currentMatrix.samples.map(s => (
                  <th key={s.sampleId} className="py-2 px-3 font-semibold text-right">
                    {s.sampleId} ({s.condition})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentMatrix.proteins.slice(0, 5).map((p) => (
                <tr key={p.accession} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-teal-700">{p.accession}</td>
                  <td className="py-2 px-3 text-slate-900 font-semibold">{p.geneSymbol}</td>
                  {currentMatrix.samples.map(s => (
                    <td key={s.sampleId} className="py-2 px-3 text-right text-slate-800">
                      {Number.isFinite(p.intensities[s.sampleId]) ? p.intensities[s.sampleId].toLocaleString() : 'NA'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
