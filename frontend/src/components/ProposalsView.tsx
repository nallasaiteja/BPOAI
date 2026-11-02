import React, { useState, useEffect } from 'react';
import {
  FileText, Download, CheckCircle, Clock, DollarSign,
  Layers, ShieldAlert, Check, Calendar, ArrowDownToLine, Lock, Trash2,
  Pencil, X, Plus, AlertCircle, RotateCcw, Save, Tag
} from 'lucide-react';
import { Proposal, ServiceCatalogue } from '../types';
import { api } from '../services/api';

/**
 * Formats numeric values to the Indian numbering format (e.g. ₹1,25,000.00).
 */
export const formatINR = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '₹0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

interface ProposalsViewProps {
  proposals: Proposal[];
  services?: ServiceCatalogue[];
  onApprove: (id: string) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
  onUpdateQuotation?: (proposalId: string, data: any) => Promise<void>;
  onDeleteAll?: () => Promise<void>;
}

interface EditableLineItem {
  id?: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
}

export const ProposalsView: React.FC<ProposalsViewProps> = ({
  proposals,
  services = [],
  onApprove,
  onDeleteLead,
  onUpdateQuotation,
  onDeleteAll
}) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string>(proposals[0]?.id || '');
  const activeProposal = proposals.find(p => p.id === selectedProposalId) || proposals[0];
  const currentUser = api.getCurrentUser();
  const canApproveProposal = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SENIOR_MANAGER', 'ACCOUNTS_EXECUTIVE'].includes(currentUser?.role);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [editLineItems, setEditLineItems] = useState<EditableLineItem[]>([]);
  const [editDiscountPercent, setEditDiscountPercent] = useState<number | string>(0);
  const [editTaxRate, setEditTaxRate] = useState<number | string>(18.00);
  const [editNotes, setEditNotes] = useState<string>('');

  // Reset or initialize edit state when active proposal changes
  useEffect(() => {
    if (!activeProposal) return;
    setIsEditing(false);
    const quot = activeProposal.quotation;
    if (quot) {
      setEditLineItems(
        quot.line_items?.map(it => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price
        })) || []
      );
      setEditDiscountPercent(quot.discount_percentage || 0);
      setEditTaxRate(quot.tax_rate !== undefined ? quot.tax_rate : 18.00);
      setEditNotes(quot.notes || '');
    } else {
      setEditLineItems([]);
      setEditDiscountPercent(0);
      setEditTaxRate(18.00);
      setEditNotes('');
    }
  }, [activeProposal?.id]);

  const quotation = activeProposal?.quotation;
  const isPricingPending = !quotation || !quotation.line_items || quotation.line_items.length === 0 || Number(quotation.total_amount) <= 0 || quotation.is_pricing_pending;

  // Start editing handler
  const handleStartEdit = () => {
    if (!quotation) return;
    // If existing items are empty, prefill with suggestion from catalogue if available
    if ((!quotation.line_items || quotation.line_items.length === 0) && services.length > 0) {
      setEditLineItems([
        {
          description: `${services[0].name} - Implementation & Operations`,
          quantity: 1,
          unit_price: services[0].default_fixed_price || 125000
        }
      ]);
    } else {
      setEditLineItems(
        quotation.line_items?.map(it => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price
        })) || []
      );
    }
    setEditDiscountPercent(quotation.discount_percentage || 0);
    setEditTaxRate(quotation.tax_rate !== undefined ? quotation.tax_rate : 18.00);
    setEditNotes(quotation.notes || '');
    setIsEditing(true);
  };

  // Revert editing handler
  const handleRevert = () => {
    if (!quotation) {
      setIsEditing(false);
      return;
    }
    setEditLineItems(
      quotation.line_items?.map(it => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price
      })) || []
    );
    setEditDiscountPercent(quotation.discount_percentage || 0);
    setEditTaxRate(quotation.tax_rate !== undefined ? quotation.tax_rate : 18.00);
    setEditNotes(quotation.notes || '');
    setIsEditing(false);
  };

  // Line item manipulation
  const handleAddLineItem = (service?: ServiceCatalogue) => {
    setEditLineItems(prev => [
      ...prev,
      {
        description: service ? `${service.name} - Implementation & SLA` : 'Custom Service Deliverable',
        quantity: 1,
        unit_price: service ? (service.default_fixed_price || 125000) : 50000
      }
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setEditLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemField = (index: number, field: keyof EditableLineItem, value: any) => {
    setEditLineItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Live calculation during editing
  const computedSubtotal = editLineItems.reduce((acc, it) => {
    const q = Number(it.quantity) || 0;
    const p = Number(it.unit_price) || 0;
    return acc + (q * p);
  }, 0);

  const discPct = Math.max(0, Math.min(100, Number(editDiscountPercent) || 0));
  const computedDiscountAmount = (computedSubtotal * discPct) / 100;
  const computedTaxable = Math.max(0, computedSubtotal - computedDiscountAmount);
  const taxPct = Math.max(0, Number(editTaxRate) || 0);
  const computedTaxAmount = (computedTaxable * taxPct) / 100;
  const computedGrandTotal = computedTaxable + computedTaxAmount;

  // Save handler
  const handleSaveQuotation = async () => {
    if (!activeProposal) return;
    if (editLineItems.length === 0) {
      alert("Quotation must have at least one line item.");
      return;
    }
    for (let i = 0; i < editLineItems.length; i++) {
      const it = editLineItems[i];
      if (!it.description.trim()) {
        alert(`Line item #${i + 1} has an empty description.`);
        return;
      }
      const p = Number(it.unit_price);
      if (it.unit_price === '' || isNaN(p) || p < 0) {
        alert(`Please specify a valid unit price for "${it.description}".`);
        return;
      }
      const q = Number(it.quantity);
      if (isNaN(q) || q <= 0) {
        alert(`Quantity must be greater than zero for "${it.description}".`);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (onUpdateQuotation) {
        await onUpdateQuotation(activeProposal.id, {
          line_items: editLineItems.map(it => ({
            description: it.description,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price)
          })),
          discount_percentage: discPct,
          tax_rate: taxPct,
          currency: 'INR',
          notes: editNotes
        });
      } else {
        await api.updateQuotation(activeProposal.id, {
          line_items: editLineItems.map(it => ({
            description: it.description,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price)
          })),
          discount_percentage: discPct,
          tax_rate: taxPct,
          currency: 'INR',
          notes: editNotes
        });
      }
      setIsEditing(false);
    } catch (e: any) {
      alert("Error saving quotation: " + (e.message || "Failed to update"));
    } finally {
      setIsSaving(false);
    }
  };

  // Document download handler
  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!activeProposal) return;
    setDownloadingFormat(format);
    try {
      const code = activeProposal.proposal_code || `proposal_${activeProposal.id.slice(0, 8)}`;
      const filename = `${code}.${format}`;
      await api.downloadProposalDocument(activeProposal.id, format, filename);
    } catch (err: any) {
      alert(`Could not download ${format.toUpperCase()}: ${err.message || 'Error generating document'}`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Proposals List */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Proposals & Quotes ({proposals.length})
          </h3>
          <div className="flex items-center gap-2">
            {proposals.length > 0 && onDeleteAll && (
              <button
                onClick={onDeleteAll}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                title="Delete all leads & clear proposals"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete All</span>
              </button>
            )}
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Agent 9 • INR (₹)
            </span>
          </div>
        </div>

        <div className="space-y-2 max-h-[700px] overflow-y-auto">
          {proposals.length > 0 ? (
            proposals.map((prop) => {
              const isSelected = prop.id === (activeProposal?.id);
              const propQuot = prop.quotation;
              const propPending = !propQuot || !propQuot.line_items || propQuot.line_items.length === 0 || Number(propQuot.total_amount) <= 0 || propQuot.is_pricing_pending;

              return (
                <button
                  key={prop.id}
                  onClick={() => setSelectedProposalId(prop.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${isSelected
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 truncate">{prop.company_name}</span>
                    <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-bold">
                      {prop.proposal_code}
                    </span>
                  </div>
                  <div className="text-slate-600 font-medium truncate mb-1">{prop.title}</div>

                  <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-slate-100">
                    {propPending ? (
                      <span className="font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                        ⚠️ Price Not Set
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-slate-900">
                        {formatINR(propQuot.total_amount)}
                      </span>
                    )}

                    <span className={`font-semibold text-[10px] ${prop.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {prop.status}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No commercial proposals currently generated.
            </div>
          )}
        </div>
      </div>

      {/* Main Document & Quotation Preview */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {activeProposal ? (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  {activeProposal.type_display || activeProposal.proposal_type}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{activeProposal.title}</h2>
                <p className="text-xs text-slate-500">
                  Client: <strong>{activeProposal.company_name}</strong> | Ref: {activeProposal.proposal_code}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload('pdf')}
                  disabled={downloadingFormat !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  title="Download proposal as formatted PDF in INR (₹)"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-rose-600" />
                  <span>{downloadingFormat === 'pdf' ? 'Generating PDF...' : 'PDF Proposal'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload('docx')}
                  disabled={downloadingFormat !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  title="Download proposal as editable Word DOCX in INR (₹)"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>{downloadingFormat === 'docx' ? 'Generating DOCX...' : 'Word DOCX'}</span>
                </button>

                {onDeleteLead && activeProposal?.lead && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete lead '${activeProposal.company_name}' and this proposal?`)) {
                        onDeleteLead(activeProposal.lead);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    title="Delete lead and proposal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Lead</span>
                  </button>
                )}

                {activeProposal.status !== 'APPROVED' ? (
                  canApproveProposal ? (
                    isPricingPending ? (
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed border border-slate-200"
                        title="Price Not Set: Please edit and set pricing before approving"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Price Not Set (Cannot Approve)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onApprove(activeProposal.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Proposal</span>
                      </button>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Accounts / Manager Approval Required</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Approved & Locked</span>
                  </div>
                )}
              </div>
            </div>

            {/* Executive Summary & Scope */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                  1. Executive Summary
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {activeProposal.executive_summary}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                  2. Identified Challenges & Strategic Objectives
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {activeProposal.identified_challenges}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                  3. Key Deliverables & Scope
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                  {activeProposal.deliverables?.map((deliv, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{deliv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Commercial Quotation Card */}
            {activeProposal.quotation && (
              <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50 shadow-xs">
                {/* Quotation Header & Edit Control */}
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Commercial Quotation #{activeProposal.quotation.quotation_number} (INR - ₹)
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {canApproveProposal && !isEditing && activeProposal.status !== 'APPROVED' && (
                      <button
                        onClick={handleStartEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit quotation pricing, deliverables, discount and taxes"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Quotation</span>
                      </button>
                    )}

                    {isEditing && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRevert}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Discard all changes and revert to original values"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Revert</span>
                        </button>

                        <button
                          onClick={handleSaveQuotation}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Pending Warning Banner */}
                {isPricingPending && !isEditing && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 mb-0.5">Price Not Set / Pending Pricing</div>
                      <p className="text-amber-700">
                        This quotation does not currently have confirmed pricing. Quotations cannot be sent to clients or approved without complete pricing information.
                        Click <strong>"Edit Quotation"</strong> above to enter service deliverables and set unit prices in Indian Rupees (₹).
                      </p>
                    </div>
                  </div>
                )}

                {/* VIEW MODE */}
                {!isEditing && (
                  <>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-2">Item Description</th>
                            <th className="py-2 text-right">Qty</th>
                            <th className="py-2 text-right">Unit Price (₹)</th>
                            <th className="py-2 text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeProposal.quotation.line_items && activeProposal.quotation.line_items.length > 0 ? (
                            activeProposal.quotation.line_items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-2.5 text-slate-800 font-medium">{item.description}</td>
                                <td className="py-2.5 text-right text-slate-600">{item.quantity}</td>
                                <td className="py-2.5 text-right font-mono text-slate-600">
                                  {formatINR(item.unit_price)}
                                </td>
                                <td className="py-2.5 text-right font-mono font-semibold text-slate-900">
                                  {formatINR(item.total_price)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                                No line items configured. Click "Edit Quotation" to enter line items and rates.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start pt-3 border-t border-slate-200 gap-4">
                      <div className="text-[11px] text-slate-500 max-w-sm">
                        {activeProposal.quotation.notes ? (
                          <p><strong>Notes:</strong> {activeProposal.quotation.notes}</p>
                        ) : (
                          <p className="italic">Standard commercial pricing derived from official catalogue terms.</p>
                        )}
                      </div>

                      <div className="w-full sm:w-72 space-y-1.5 text-xs text-right">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-mono font-medium">
                            {isPricingPending ? 'Pending' : formatINR(activeProposal.quotation.subtotal)}
                          </span>
                        </div>

                        {Number(activeProposal.quotation.discount_amount || 0) > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>
                              Discount ({activeProposal.quotation.discount_percentage}%):
                            </span>
                            <span className="font-mono font-medium">
                              -{formatINR(activeProposal.quotation.discount_amount)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-600">
                          <span>Applicable GST ({activeProposal.quotation.tax_rate || 18}%):</span>
                          <span className="font-mono font-medium">
                            {isPricingPending ? 'Pending' : formatINR(activeProposal.quotation.tax_amount)}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                          <span>Grand Total (INR):</span>
                          <span className={`font-mono ${isPricingPending ? 'text-amber-600' : 'text-blue-600'}`}>
                            {isPricingPending ? 'Price Not Set' : formatINR(activeProposal.quotation.total_amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* EDIT MODE */}
                {isEditing && (
                  <div className="space-y-4">
                    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
                      <span className="font-medium">
                        ✏️ You are currently editing quotation line items, discounts, and tax rates.
                      </span>
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        All values in Indian Rupees (₹)
                      </span>
                    </div>

                    {/* Quick Add from Catalogue */}
                    {services.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                          Quick Add from Official Service Catalogue:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {services.map(srv => (
                            <button
                              key={srv.id}
                              type="button"
                              onClick={() => handleAddLineItem(srv)}
                              className="text-[10px] font-medium px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 rounded transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3 text-blue-600" />
                              <span>{srv.name} ({formatINR(srv.default_fixed_price)})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-2 w-7/12">Item Description</th>
                            <th className="py-2 w-2/12 text-right">Qty</th>
                            <th className="py-2 w-2/12 text-right">Unit Price (₹)</th>
                            <th className="py-2 w-2/12 text-right">Total (₹)</th>
                            <th className="py-2 w-1/12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {editLineItems.map((item, idx) => {
                            const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                            return (
                              <tr key={idx} className="group">
                                <td className="py-2 pr-2">
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => handleUpdateItemField(idx, 'description', e.target.value)}
                                    placeholder="Deliverable description or service title"
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItemField(idx, 'quantity', e.target.value)}
                                    className="w-16 px-2 py-1.5 text-xs text-right border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="500"
                                    value={item.unit_price}
                                    onChange={(e) => handleUpdateItemField(idx, 'unit_price', e.target.value)}
                                    placeholder="₹ 0"
                                    className="w-28 px-2 py-1.5 text-xs text-right font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                                  />
                                </td>
                                <td className="py-2 pl-2 text-right font-mono font-semibold text-slate-800">
                                  {formatINR(lineTotal)}
                                </td>
                                <td className="py-2 pl-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLineItem(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title="Remove this line item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => handleAddLineItem()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Custom Line Item</span>
                      </button>
                    </div>

                    {/* Discounts, Taxes & Notes Editor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Discount Percentage (%):
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={editDiscountPercent}
                            onChange={(e) => setEditDiscountPercent(e.target.value)}
                            placeholder="0"
                            className="w-32 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            GST / Tax Rate (%):
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="1"
                            value={editTaxRate}
                            onChange={(e) => setEditTaxRate(e.target.value)}
                            placeholder="18"
                            className="w-32 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Commercial Notes & Payment Terms:
                          </label>
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g. 50% advance on project kickoff, balance on completion."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      {/* Live Calculation Preview */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">
                          Live Quotation Calculation (INR)
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-mono font-semibold">{formatINR(computedSubtotal)}</span>
                        </div>

                        {discPct > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>Discount ({discPct}%):</span>
                            <span className="font-mono font-semibold">-{formatINR(computedDiscountAmount)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-600">
                          <span>GST ({taxPct}%):</span>
                          <span className="font-mono font-semibold">{formatINR(computedTaxAmount)}</span>
                        </div>

                        <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                          <span>Calculated Grand Total:</span>
                          <span className="font-mono text-blue-600 font-extrabold">{formatINR(computedGrandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Save & Revert bar */}
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleRevert}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel / Revert
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveQuotation}
                        disabled={isSaving}
                        className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? 'Saving Quotation...' : 'Save & Recalculate Quotation'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No proposal selected. Click a proposal on the left to review details.</p>
          </div>
        )}
      </div>
    </div>
  );
};
