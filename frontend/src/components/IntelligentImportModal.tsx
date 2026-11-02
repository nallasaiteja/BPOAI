import React, { useState, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, ArrowLeft, RefreshCw, Sparkles, Layers,
  ShieldCheck, Download, Trash2, Eye, Check, X, FileText,
  HelpCircle, AlertCircle, BookmarkPlus
} from 'lucide-react';
import { api } from '../services/api';
import {
  FileInspectionResult,
  MappingPreviewResult,
  CommitImportResult,
  LeadMappingTemplate,
  ColumnSuggestion
} from '../types';

interface IntelligentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  showToast?: (msg: string) => void;
}

type WizardStep = 'upload' | 'sheets_and_headers' | 'mapping' | 'preview' | 'complete';

export const IntelligentImportModal: React.FC<IntelligentImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Inspection state
  const [inspection, setInspection] = useState<FileInspectionResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [hasHeaders, setHasHeaders] = useState<boolean>(true);

  // Column Mappings state: original_col -> destination_field
  const [mappings, setMappings] = useState<Record<string, string>>({});

  // Templates
  const [templates, setTemplates] = useState<LeadMappingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Preview & Result state
  const [previewData, setPreviewData] = useState<MappingPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  // Load templates on open
  useEffect(() => {
    if (isOpen) {
      api.getMappingTemplates()
        .then((data) => setTemplates(data || []))
        .catch(() => setTemplates([]));
    } else {
      // Reset state on close
      setCurrentStep('upload');
      setFile(null);
      setInspection(null);
      setMappings({});
      setPreviewData(null);
      setCommitResult(null);
      setErrorMsg(null);
      setSaveAsTemplate(false);
      setTemplateName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // STEP 1: Handle File Upload & Inspection
  const handleFileDrop = async (selectedFile: File) => {
    if (!selectedFile) return;

    // Check size limit (15MB)
    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMsg('File exceeds 15MB limit. Please upload a smaller file or split it.');
      return;
    }

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setErrorMsg('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setIsAnalyzing(true);

    try {
      const result = await api.inspectLeadFile(selectedFile);
      setInspection(result);
      setSelectedSheet(result.active_sheet || result.sheet_names[0] || '');
      setHasHeaders(result.has_headers);

      // Pre-fill mappings from suggestions
      const initialMap: Record<string, string> = {};
      result.columns.forEach((col: ColumnSuggestion) => {
        initialMap[col.original_col] = col.suggested_field || '__ignore__';
      });
      setMappings(initialMap);

      if (result.sheet_names.length > 1 || !result.has_headers || result.header_confidence < 85) {
        setCurrentStep('sheets_and_headers');
      } else {
        setCurrentStep('mapping');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || err?.error || 'Failed to inspect file.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-inspect if sheet or header toggle changes
  const handleSheetChange = async (newSheet: string) => {
    if (!file || newSheet === selectedSheet) return;
    setSelectedSheet(newSheet);
    setIsAnalyzing(true);
    try {
      const result = await api.inspectLeadFile(file, newSheet, hasHeaders);
      setInspection(result);
      setHasHeaders(result.has_headers);
      const updatedMap: Record<string, string> = {};
      result.columns.forEach((col: ColumnSuggestion) => {
        updatedMap[col.original_col] = col.suggested_field || '__ignore__';
      });
      setMappings(updatedMap);
    } catch (err: any) {
      setErrorMsg('Failed to read sheet: ' + (err.message || 'Error'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHeaderToggle = async (newHasHeaders: boolean) => {
    setHasHeaders(newHasHeaders);
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const result = await api.inspectLeadFile(file, selectedSheet, newHasHeaders);
      setInspection(result);
      const updatedMap: Record<string, string> = {};
      result.columns.forEach((col: ColumnSuggestion) => {
        updatedMap[col.original_col] = col.suggested_field || '__ignore__';
      });
      setMappings(updatedMap);
    } catch (err: any) {
      setErrorMsg('Failed to re-parse with selected header setting.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Template handling
  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl || !inspection) return;

    const newMappings = { ...mappings };
    inspection.columns.forEach((col) => {
      if (tmpl.mappings[col.original_col]) {
        newMappings[col.original_col] = tmpl.mappings[col.original_col];
      }
    });
    setMappings(newMappings);
    if (showToast) showToast(`Applied mapping template: ${tmpl.name}`);
  };

  // Validation Warnings
  const mappedFields = Object.values(mappings).filter((f) => f && f !== '__ignore__');
  const duplicateDestinations = mappedFields.filter((item, index) => mappedFields.indexOf(item) !== index);
  const hasCompanyName = mappedFields.includes('company_name');
  const hasEmail = mappedFields.includes('business_email');

  // STEP 3 -> 4: Preview Mapping
  const handleGeneratePreview = async () => {
    if (!inspection) return;
    if (!hasCompanyName) {
      setErrorMsg('Please map at least one column to "Company Name".');
      return;
    }
    if (!hasEmail) {
      setErrorMsg('Please map at least one column to "Business Email / Primary Email".');
      return;
    }
    setErrorMsg(null);
    setIsGeneratingPreview(true);

    try {
      const preview = await api.previewLeadMapping(
        inspection.file_token,
        mappings,
        hasHeaders,
        selectedSheet
      );
      setPreviewData(preview);
      setCurrentStep('preview');
    } catch (err: any) {
      setErrorMsg(err?.message || err?.error || 'Failed to generate preview.');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // STEP 4 -> 5: Commit Import
  const handleCommitImport = async () => {
    if (!inspection) return;
    setIsCommitting(true);
    setErrorMsg(null);

    try {
      const result = await api.commitLeadImport(
        inspection.file_token,
        mappings,
        hasHeaders,
        selectedSheet,
        saveAsTemplate && templateName.trim() ? templateName.trim() : undefined
      );
      setCommitResult(result);
      setCurrentStep('complete');
      await onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || err?.error || 'Failed to commit import.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDownloadRejectionReport = async () => {
    if (!commitResult?.batch_id) return;
    setIsDownloadingReport(true);
    try {
      const blob = await api.downloadRejectionReport(commitResult.batch_id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rejection_report_${commitResult.batch_number || 'audit'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download rejection report via API:', err);
      // Fallback direct link
      const fallbackUrl = commitResult.rejection_report_url || `/api/v1/leads/rejection-report/?batch_id=${commitResult.batch_id}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // Helper for confidence badges
  const renderConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          {confidence}% High
        </span>
      );
    }
    if (confidence >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <HelpCircle className="w-3 h-3 text-amber-600" />
          {confidence}% Med
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        {confidence}% Low
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100">
        
        {/* Modal Header & Stepper */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Intelligent Bulk Lead Ingestion & Mapping
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-format parsing (CSV/XLS/XLSX), smart header detection, pattern matching, and transaction-safe ingestion.
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
            <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${currentStep === 'upload' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400'}`}>
              1. Upload
            </span>
            <span className="text-slate-300">→</span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${currentStep === 'sheets_and_headers' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400'}`}>
              2. Headers
            </span>
            <span className="text-slate-300">→</span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${currentStep === 'mapping' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400'}`}>
              3. Map Columns
            </span>
            <span className="text-slate-300">→</span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${currentStep === 'preview' || currentStep === 'complete' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400'}`}>
              4. Preview & Import
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Notice:</span> {errorMsg}
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-700">
          
          {/* STEP 1: UPLOAD */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileDrop(e.dataTransfer.files[0]);
                }}
                className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/20 hover:bg-blue-50/50 rounded-2xl p-10 text-center transition-all cursor-pointer group"
                onClick={() => {
                  const input = document.getElementById('bulk-lead-file-input');
                  if (input) input.click();
                }}
              >
                <input
                  id="bulk-lead-file-input"
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
                  }}
                />
                
                {isAnalyzing ? (
                  <div className="py-6 flex flex-col items-center">
                    <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                    <p className="text-sm font-semibold text-slate-800">
                      Analyzing File & Detecting Schema...
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Inspecting delimiter, cell content distributions, phone/email syntax, and detecting whether row 1 is a header or real lead data.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-blue-100 group-hover:bg-blue-200 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                      <Upload className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">
                      Drag & Drop your Lead File here, or Browse
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      Supports CSV (any delimiter: comma, tab, semicolon), Excel (.xlsx, .xls, multi-sheet workbooks)
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-[11px] text-slate-600 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Smart Headerless Detection &bull; Formula Injection Shield &bull; Max 15MB</span>
                    </div>
                  </>
                )}
              </div>

              {/* Supported Attributes Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  What can this intelligent importer recognize?
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Company Name / Organization</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Primary & Secondary Emails</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Contact Person & Designation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Phone & Mobile Numbers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Website & LinkedIn URLs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Industry, Country, Revenue</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SHEETS & HEADER CONFIRMATION */}
          {currentStep === 'sheets_and_headers' && inspection && (
            <div className="space-y-5">
              {/* File Info Bar */}
              <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">{inspection.filename}</span>
                  <span className="text-slate-400">({inspection.file_type.toUpperCase()})</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>Total Rows: <b>{inspection.total_rows}</b></span>
                  {inspection.delimiter && <span>Delimiter: <b>'{inspection.delimiter}'</b></span>}
                  {inspection.encoding && <span>Encoding: <b>{inspection.encoding}</b></span>}
                </div>
              </div>

              {/* Multi-sheet selector (if applicable) */}
              {inspection.sheet_names && inspection.sheet_names.length > 1 && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Excel Sheet to Ingest:
                  </label>
                  <p className="text-[11px] text-slate-500 mb-3">
                    This workbook contains multiple sheets. Choose which sheet you want to import leads from:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inspection.sheet_names.map((sheet) => (
                      <button
                        key={sheet}
                        type="button"
                        onClick={() => handleSheetChange(sheet)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedSheet === sheet
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sheet}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Header Detection Intelligence Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Header Intelligence Analysis
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      The engine analyzed the first several rows of your file to determine if row 1 is a header row or real lead data.
                    </p>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      hasHeaders
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {hasHeaders ? 'Headers Detected' : 'Headerless File (Data in Row 1)'}
                  </span>
                </div>

                {/* Analysis Reasons */}
                {inspection.header_reasons && inspection.header_reasons.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-700">Detection Evidence:</span>
                    {inspection.header_reasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Interactive Override Toggle */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      Does the first row contain column names?
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Uncheck if your file starts immediately with lead details (e.g. Row 1 is a company or contact).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleHeaderToggle(!hasHeaders)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        hasHeaders ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          hasHeaders ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-semibold text-slate-700 min-w-10">
                      {hasHeaders ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('upload')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('mapping')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  Confirm & Review Column Mappings
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: COLUMN MAPPING STUDIO */}
          {currentStep === 'mapping' && inspection && (
            <div className="space-y-4">
              {/* Header Banner & Template Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs">
                  <span className="font-bold text-slate-800">
                    {inspection.filename}
                  </span>
                  <span className="text-slate-500 ml-2">
                    ({inspection.total_rows} rows &bull; {hasHeaders ? 'With Headers' : 'Headerless'})
                  </span>
                </div>

                {/* Templates Dropdown */}
                {templates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 font-medium">Template:</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Apply Saved Mapping --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Validation Warning Alert */}
              {(!hasCompanyName || !hasEmail || duplicateDestinations.length > 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Mapping Attention Required:</span>
                  </div>
                  {!hasCompanyName && (
                    <p className="text-[11px]">&bull; <b>Company Name</b> is not mapped yet. Every lead requires a company name.</p>
                  )}
                  {!hasEmail && (
                    <p className="text-[11px]">&bull; <b>Business Email / Primary Email</b> is not mapped yet. Primary email is required.</p>
                  )}
                  {duplicateDestinations.length > 0 && (
                    <p className="text-[11px]">&bull; Warning: Duplicate destination mappings detected: <b>{duplicateDestinations.join(', ')}</b>. Multiple columns should not map to the same field.</p>
                  )}
                </div>
              )}

              {/* Column Mapping Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Original Column</th>
                        <th className="py-2.5 px-3">Sample Cell Values</th>
                        <th className="py-2.5 px-3">Destination Field</th>
                        <th className="py-2.5 px-3">Confidence & Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspection.columns.map((col) => {
                        const currentDest = mappings[col.original_col] || '__ignore__';
                        const isDuplicate = duplicateDestinations.includes(currentDest);

                        return (
                          <tr key={col.original_col} className="hover:bg-slate-50/70 transition-colors">
                            {/* Original Column */}
                            <td className="py-3 px-3 align-top">
                              <div className="font-semibold text-slate-800">
                                {col.original_col}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Column {col.col_letter}
                              </span>
                            </td>

                            {/* Sample Values */}
                            <td className="py-3 px-3 align-top max-w-[220px]">
                              <div className="flex flex-wrap gap-1">
                                {col.sample_values && col.sample_values.length > 0 ? (
                                  col.sample_values.slice(0, 3).map((val, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono truncate max-w-[180px]"
                                      title={val}
                                    >
                                      {val}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No sample values</span>
                                )}
                              </div>
                            </td>

                            {/* Destination Dropdown */}
                            <td className="py-3 px-3 align-top min-w-[200px]">
                              <select
                                value={currentDest}
                                onChange={(e) =>
                                  setMappings({
                                    ...mappings,
                                    [col.original_col]: e.target.value,
                                  })
                                }
                                className={`w-full text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
                                  isDuplicate
                                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 font-medium'
                                    : currentDest === '__ignore__'
                                    ? 'border-slate-200 bg-slate-50 text-slate-400'
                                    : 'border-blue-300 bg-white text-slate-800 font-medium'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                              >
                                <option value="__ignore__">-- Ignore this column --</option>
                                
                                <optgroup label="Core Lead Fields">
                                  <option value="company_name">Company Name *</option>
                                  <option value="business_email">Business Email / Primary Email *</option>
                                  <option value="website_url">Website / Domain</option>
                                </optgroup>

                                <optgroup label="Contact Person">
                                  <option value="contact_person">Contact Person (Full Name)</option>
                                  <option value="first_name">First Name</option>
                                  <option value="last_name">Last Name</option>
                                  <option value="designation">Job Title / Designation</option>
                                </optgroup>

                                <optgroup label="Communications">
                                  <option value="contact_number">Primary Phone Number</option>
                                  <option value="mobile_number">Mobile Number</option>
                                  <option value="secondary_email">Secondary Email</option>
                                </optgroup>

                                <optgroup label="Firmographics & Location">
                                  <option value="industry">Industry</option>
                                  <option value="country">Country</option>
                                  <option value="state">State</option>
                                  <option value="city">City</option>
                                  <option value="company_description">Company Description</option>
                                  <option value="employee_count">Employee Count</option>
                                  <option value="annual_revenue">Annual Revenue</option>
                                  <option value="linkedin_url">LinkedIn URL</option>
                                </optgroup>

                                <optgroup label="Miscellaneous">
                                  <option value="lead_source">Lead Source</option>
                                  <option value="notes">Notes / Comments</option>
                                </optgroup>
                              </select>
                            </td>

                            {/* Confidence & Reason */}
                            <td className="py-3 px-3 align-top">
                              <div className="flex flex-col gap-1">
                                {renderConfidenceBadge(col.confidence)}
                                <span className="text-[10px] text-slate-500 leading-tight">
                                  {col.reason}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Save Mapping Template Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5 text-blue-600" />
                    Save this configuration as reusable template
                  </span>
                </label>

                {saveAsTemplate && (
                  <input
                    type="text"
                    placeholder="Template Name (e.g. Apollo Export, Zysk Format)"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1 text-xs w-64 bg-white focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('sheets_and_headers')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Header Settings
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview || !hasCompanyName || !hasEmail}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isGeneratingPreview ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Validating Records...
                    </>
                  ) : (
                    <>
                      Preview Ingestion &bull; Next
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW & VALIDATION SUMMARY */}
          {currentStep === 'preview' && previewData && (
            <div className="space-y-5">
              {/* Validation Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Total Rows Detected</span>
                  <span className="text-xl font-bold text-slate-800">{previewData.total_rows}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] text-emerald-700 block font-medium">Valid Ready to Ingest</span>
                  <span className="text-xl font-bold text-emerald-800">{previewData.valid_count}</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[11px] text-amber-700 block font-medium">Duplicates (Will Skip)</span>
                  <span className="text-xl font-bold text-amber-800">{previewData.duplicate_count}</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[11px] text-rose-700 block font-medium">Invalid / Incomplete</span>
                  <span className="text-xl font-bold text-rose-800">{previewData.invalid_count}</span>
                </div>
              </div>

              {/* Sample Mapped Records Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Live Record Preview (Sample Mapped Rows)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Showing first {previewData.sample_rows.length} rows
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="max-h-[260px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Row #</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Company Name</th>
                          <th className="py-2 px-3">Business Email</th>
                          <th className="py-2 px-3">Contact Person</th>
                          <th className="py-2 px-3">Phone</th>
                          <th className="py-2 px-3">Website</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.sample_rows.map((row) => (
                          <tr key={row.row_num} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                              {row.row_num}
                            </td>
                            <td className="py-2 px-3">
                              {row.status === 'valid' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              )}
                              {row.status === 'duplicate' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Duplicate
                                </span>
                              )}
                              {row.status === 'invalid' && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                                  title={row.errors.join(', ')}
                                >
                                  Invalid
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {row.normalized_data.company_name || (
                                <span className="text-rose-400 italic">Missing</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                              {row.normalized_data.business_email || (
                                <span className="text-rose-400 italic">Missing</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {row.normalized_data.contact_person || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                              {row.normalized_data.contact_number || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-[140px]">
                              {row.normalized_data.website_url || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Rejection / Duplicates Callout */}
              {(previewData.invalid_count > 0 || previewData.duplicate_count > 0) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-[11px]">
                    <span className="font-semibold text-slate-800">Clean Pipeline Guarantee:</span> Valid rows ({previewData.valid_count}) will be securely imported. Invalid or duplicate records are safely skipped and will be documented in a downloadable audit rejection report.
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('mapping')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Adjust Mappings
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={isCommitting || previewData.valid_count === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isCommitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Ingesting Leads...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Ingest {previewData.valid_count} Leads
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: IMPORT COMPLETE */}
          {currentStep === 'complete' && commitResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Bulk Lead Import Successful!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {commitResult.summary_message}
              </p>

              {/* Batch Card */}
              <div className="max-w-md mx-auto bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch Number:</span>
                  <span className="font-mono font-bold text-slate-800">{commitResult.batch_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Successfully Ingested:</span>
                  <span className="font-bold text-emerald-700">{commitResult.imported_count} leads</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duplicates Skipped:</span>
                  <span className="font-medium text-amber-700">{commitResult.duplicate_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invalid Skipped:</span>
                  <span className="font-medium text-rose-700">{commitResult.rejected_count}</span>
                </div>
              </div>

              {/* Download Rejection Report if any rejected */}
              {commitResult.has_rejections && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadRejectionReport}
                    disabled={isDownloadingReport}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 text-slate-600 ${isDownloadingReport ? 'animate-bounce' : ''}`} />
                    {isDownloadingReport ? 'Generating Audit CSV...' : 'Download Skipped Records Audit Report (.csv)'}
                  </button>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors"
                >
                  Done & View Leads
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

