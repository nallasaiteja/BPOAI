import { 
  Lead, ServiceCatalogue, BusinessRequirement, 
  EmailDraft, Proposal, DashboardKPIs, ExecutiveInsights 
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

class ApiService {
  private token: string | null = null;
  private currentUser: any = null;
  private authPromise: Promise<string> | null = null;

  constructor() {
    this.token = localStorage.getItem('mrg_auth_token');
    try {
      const stored = localStorage.getItem('mrg_active_user');
      if (stored) this.currentUser = JSON.parse(stored);
    } catch {
      // Ignored
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('mrg_auth_token', token);
  }

  setCurrentUser(user: any) {
    this.currentUser = user;
    localStorage.setItem('mrg_active_user', JSON.stringify(user));
  }

  getCurrentUser(): any {
    return this.currentUser || {
      username: 'admin',
      first_name: 'Hemanth',
      last_name: 'Merugu',
      role: 'SUPER_ADMIN',
      email: 'admin@meruguglobal.com'
    };
  }

  getToken(): string | null {
    return this.token;
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('mrg_auth_token');
    localStorage.removeItem('mrg_active_user');
  }

  async login(username = 'admin', password = 'adminpassword123'): Promise<{ token: string; user: any }> {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw err;
    }

    const data = await res.json();
    if (data.token) {
      this.setToken(data.token);
    }
    if (data.user) {
      this.setCurrentUser(data.user);
    }
    return data;
  }

  async ensureAuth(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    if (this.authPromise) {
      return this.authPromise;
    }
    this.authPromise = (async () => {
      try {
        const data = await this.login('admin', 'adminpassword123');
        return data.token;
      } finally {
        this.authPromise = null;
      }
    })();
    return this.authPromise;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    if (!this.token && !endpoint.includes('/auth/login/')) {
      await this.ensureAuth().catch(() => null);
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !isRetry && !endpoint.includes('/auth/login/')) {
      this.token = null;
      localStorage.removeItem('mrg_auth_token');
      await this.ensureAuth().catch(() => null);
      return this.request<T>(endpoint, options, true);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw err;
    }

    return res.json();
  }

  // Dashboard Analytics
  async getDashboardAnalytics(): Promise<{ kpis: DashboardKPIs; status_distribution: any[]; executive_insights: ExecutiveInsights }> {
    return this.request('/analytics/dashboard/');
  }

  // Leads
  async getLeads(params: Record<string, any> = {}): Promise<{ results: Lead[]; count: number }> {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/leads/${qs ? `?${qs}` : ''}`);
  }

  async getLead(id: string): Promise<Lead> {
    return this.request(`/leads/${id}/`);
  }

  async createLead(leadData: Partial<Lead>): Promise<Lead> {
    return this.request('/leads/', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
  }

  async uploadLeads(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/leads/upload/', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteAllLeads(): Promise<any> {
    return this.request('/leads/delete_all/', {
      method: 'POST',
    });
  }

  async triggerLeadPipeline(leadId: string): Promise<any> {
    return this.request(`/leads/${leadId}/process/`, {
      method: 'POST',
    });
  }

  async verifyLeadManually(leadId: string): Promise<any> {
    return this.request(`/leads/${leadId}/verify/`, {
      method: 'POST',
    });
  }

  async deleteLead(leadId: string): Promise<any> {
    return this.request(`/leads/${leadId}/`, {
      method: 'DELETE',
    });
  }

  // Service Catalogue
  async getServices(): Promise<ServiceCatalogue[]> {
    const res = await this.request<{ results: ServiceCatalogue[] }>('/services/');
    return res.results || (res as any);
  }

  async updateService(id: string, data: Partial<ServiceCatalogue>): Promise<ServiceCatalogue> {
    return this.request(`/services/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Requirements
  async getRequirements(leadId?: string): Promise<BusinessRequirement[]> {
    const ep = leadId ? `/requirements/?lead=${leadId}` : '/requirements/';
    const res = await this.request<{ results: BusinessRequirement[] }>(ep);
    return res.results || (res as any);
  }

  async approveRequirement(id: string): Promise<any> {
    return this.request(`/requirements/${id}/approve/`, { method: 'POST' });
  }

  // Email Communications
  async getEmailDrafts(statusParam?: string): Promise<EmailDraft[]> {
    const ep = statusParam ? `/email-drafts/?status=${statusParam}` : '/email-drafts/';
    const res = await this.request<{ results: EmailDraft[] }>(ep);
    return res.results || (res as any);
  }

  async approveAndSendEmail(draftId: string): Promise<any> {
    return this.request(`/email-drafts/${draftId}/approve_and_send/`, { method: 'POST' });
  }

  async rejectEmail(draftId: string, notes?: string): Promise<any> {
    return this.request(`/email-drafts/${draftId}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  // Proposals
  async getProposals(): Promise<Proposal[]> {
    const res = await this.request<{ results: Proposal[] }>('/proposals/');
    return res.results || (res as any);
  }

  async approveProposal(id: string): Promise<any> {
    return this.request(`/proposals/${id}/approve/`, { method: 'POST' });
  }

  async updateQuotation(proposalId: string, data: any): Promise<Proposal> {
    return this.request<Proposal>(`/proposals/${proposalId}/update_quotation/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async downloadProposalDocument(proposalId: string, format: 'pdf' | 'docx', filename?: string): Promise<void> {
    await this.ensureAuth().catch(() => null);
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }
    const res = await fetch(`${BASE_URL}/proposals/${proposalId}/download_${format}/`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download ${format.toUpperCase()} (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `proposal_${proposalId}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Google Workspace / Gmail OAuth
  async getGoogleAuthUrl(): Promise<{ configured: boolean; auth_url?: string; message?: string }> {
    return this.request('/auth/google_url/');
  }

  async getGoogleAuthStatus(): Promise<{ configured: boolean; connected: boolean; email?: string | null; sender_name?: string }> {
    return this.request('/auth/google_status/');
  }

  async disconnectGoogleAuth(): Promise<any> {
    return this.request('/auth/google_disconnect/', { method: 'POST' });
  }

  // Gemini AI Engine
  async getGeminiStatus(): Promise<{ provider: string; configured: boolean; model: string; masked_key?: string }> {
    return this.request('/auth/gemini_status/');
  }

  async saveGeminiConfig(apiKey: string, model: string = 'gemini-2.5-flash'): Promise<any> {
    return this.request('/auth/gemini_config/', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey, model }),
    });
  }

  // Users & RBAC
  async getUsers(): Promise<any[]> {
    const res = await this.request<{ results: any[] }>('/users/');
    return res.results || (res as any);
  }
}

export const api = new ApiService();
