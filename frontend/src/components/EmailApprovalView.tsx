import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, CheckCircle2, XCircle, Clock, ShieldCheck, 
  Sparkles, Calendar, User, Eye, AlertCircle, Lock, Trash2
} from 'lucide-react';
import { EmailDraft } from '../types';
import { api } from '../services/api';

interface EmailApprovalViewProps {
  drafts: EmailDraft[];
  onApprove: (draftId: string) => Promise<void>;
  onReject: (draftId: string, notes?: string) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
}

export const EmailApprovalView: React.FC<EmailApprovalViewProps> = ({ drafts, onApprove, onReject, onDeleteLead }) => {
  const activeDrafts = drafts.filter(d => !d.status || d.status === 'AWAITING_APPROVAL' || d.status === 'DRAFT');
  const [selectedDraftId, setSelectedDraftId] = useState<string>(activeDrafts[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const currentUser = api.getCurrentUser();
  const canApprove = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SENIOR_MANAGER', 'BPO_TEAM_LEADER'].includes(currentUser?.role);

  useEffect(() => {
    if (activeDrafts.length === 0) {
      setSelectedDraftId('');
    } else if (!selectedDraftId || !activeDrafts.some(d => d.id === selectedDraftId)) {
      setSelectedDraftId(activeDrafts[0]?.id || '');
    }
  }, [activeDrafts, selectedDraftId]);

  const activeDraft = activeDrafts.find(d => d.id === selectedDraftId) || (activeDrafts.length > 0 ? activeDrafts[0] : null);

  const handleApprove = async () => {
    if (!activeDraft) return;
    setIsProcessing(true);
    try {
      await onApprove(activeDraft.id);
    } catch (e) {
      alert('Error approving email: ' + (e as any).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!activeDraft) return;
    setIsProcessing(true);
    try {
      await onReject(activeDraft.id, rejectNote);
      setIsRejectOpen(false);
      setRejectNote('');
    } catch (e) {
      alert('Error rejecting email: ' + (e as any).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Drafts List */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Outreach Approval Queue ({activeDrafts.length})
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Human-in-the-Loop
          </span>
        </div>

        <div className="space-y-2 max-h-[700px] overflow-y-auto">
          {activeDrafts.length > 0 ? (
            activeDrafts.map((draft) => {
              const isSelected = draft.id === (activeDraft?.id);
              return (
                <button
                  key={draft.id}
                  onClick={() => setSelectedDraftId(draft.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                    isSelected 
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 truncate">{draft.lead_name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      {draft.confidence_score}% confidence
                    </span>
                  </div>
                  <div className="text-slate-600 font-medium truncate mb-1">{draft.subject}</div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span className="font-mono">{draft.lead_email}</span>
                    <span>{draft.email_type.replace('_', ' ')}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No emails currently awaiting approval.
            </div>
          )}
        </div>
      </div>

      {/* Draft Review & Approval Panel */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {activeDraft ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                  {activeDraft.email_type.replace('_', ' ')}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{activeDraft.subject}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  To: <strong>{activeDraft.lead_name}</strong> &lt;{activeDraft.lead_email}&gt;
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onDeleteLead && activeDraft?.lead && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete lead '${activeDraft.lead_name}' and all associated email outreach?`)) {
                        onDeleteLead(activeDraft.lead);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    title="Delete this lead and cancel outreach"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Lead</span>
                  </button>
                )}

                {canApprove ? (
                  <>
                    <button
                      onClick={() => setIsRejectOpen(true)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Dispatching...' : 'Approve & Send'}</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Senior Manager Sign-off Required</span>
                  </div>
                )}
              </div>
            </div>

            {/* Email Body Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Rendered Email Preview</span>
                </span>
                <span className="text-[11px] text-slate-400">Strict Anti-Hallucination Guard Active</span>
              </div>
              <div 
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs leading-relaxed text-slate-800"
                dangerouslySetInnerHTML={{ __html: activeDraft.body_html }}
              />
            </div>

            {/* Automated Follow-up Cadence Visualization */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <span className="text-xs font-semibold text-blue-900 block mb-2">
                Automated Follow-up Schedule (Module 11)
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded-lg border border-blue-200 shadow-xs">
                  <span className="text-[10px] text-blue-600 font-bold block">Day 0</span>
                  <span className="text-[11px] font-medium text-slate-700">Intro Dispatch</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs opacity-75">
                  <span className="text-[10px] text-slate-500 font-bold block">Day 3</span>
                  <span className="text-[11px] font-medium text-slate-700">Follow-up 1</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs opacity-75">
                  <span className="text-[10px] text-slate-500 font-bold block">Day 7</span>
                  <span className="text-[11px] font-medium text-slate-700">Follow-up 2</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs opacity-75">
                  <span className="text-[10px] text-slate-500 font-bold block">Day 14</span>
                  <span className="text-[11px] font-medium text-slate-700">Final Follow-up</span>
                </div>
              </div>
              <p className="text-[10px] text-blue-700/80 mt-2">
                * Follow-up sequence automatically halts if recipient replies, unsubscribes, or books a meeting.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 text-xs">
            Select an outreach draft from the queue to review and approve.
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-800 text-sm mb-2">Reject Email Outreach</h3>
            <p className="text-xs text-slate-500 mb-3">Provide feedback to guide prompt refinement:</p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Tone too aggressive, adjust value proposition..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsRejectOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
