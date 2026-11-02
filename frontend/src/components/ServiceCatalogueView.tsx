import React, { useState } from 'react';
import { Briefcase, DollarSign, Clock, Check, Edit2, ShieldCheck, Sparkles, Lock } from 'lucide-react';
import { ServiceCatalogue } from '../types';
import { api } from '../services/api';
import { formatINR } from './ProposalsView';

interface ServiceCatalogueViewProps {
  services: ServiceCatalogue[];
  onUpdateService: (id: string, data: Partial<ServiceCatalogue>) => Promise<void>;
}

export const ServiceCatalogueView: React.FC<ServiceCatalogueViewProps> = ({ services, onUpdateService }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editRate, setEditRate] = useState<string>('');
  const currentUser = api.getCurrentUser();
  const canManagePricing = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SENIOR_MANAGER', 'ACCOUNTS_EXECUTIVE'].includes(currentUser?.role);

  const handleEditClick = (srv: ServiceCatalogue) => {
    setEditingId(srv.id);
    setEditPrice(String(srv.default_fixed_price));
    setEditRate(String(srv.default_hourly_rate));
  };

  const handleSave = async (id: string) => {
    await onUpdateService(id, {
      default_fixed_price: parseFloat(editPrice) || 0,
      default_hourly_rate: parseFloat(editRate) || 0,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 uppercase">
              Module 7 Service Master
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Merugu Global Service Catalogue</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-approved service offerings, commercial rates, deliverables, and matching rules.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Strict Anti-Overselling Guard: Matches only verified client needs.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((srv) => {
          const isEditing = editingId === srv.id;
          return (
            <div key={srv.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {srv.category.replace('_', ' ')}
                  </span>
                  {canManagePricing && (!isEditing ? (
                    <button
                      onClick={() => handleEditClick(srv)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      title="Edit pricing"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSave(srv.id)}
                      className="p-1 text-emerald-600 hover:text-emerald-700 rounded cursor-pointer"
                      title="Save pricing"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  ))}
                </div>

                <h3 className="font-bold text-slate-800 text-sm mb-2">{srv.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">{srv.description}</p>

                <div className="space-y-2 mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Core Deliverables:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {srv.deliverables?.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Fixed (₹)</label>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded p-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Hourly (₹)</label>
                      <input
                        type="number"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded p-1 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Standard Project</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {formatINR(srv.default_fixed_price)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Hourly Rate</span>
                      <span className="font-bold text-blue-600 font-mono">
                        {formatINR(srv.default_hourly_rate)} / hr
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
