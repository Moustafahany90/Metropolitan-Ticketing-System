import api from './api';

export const requestService = {
  // Get list of requests with optional filters
  getRequests: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.search) params.append('search', filters.search);

    const res = await api.get(`/requests?${params.toString()}`);
    return res.data;
  },

  // Get request details by ID
  getRequestById: async (id) => {
    const res = await api.get(`/requests/${id}`);
    return res.data;
  },

  // Create a new request with multipart/form-data for attachments
  createRequest: async (formData) => {
    const res = await api.post('/requests', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // Add comment to request
  addComment: async (requestId, comment) => {
    const res = await api.post(`/requests/${requestId}/comments`, { comment });
    return res.data;
  },

  // Get categories
  getCategories: async () => {
    const res = await api.get('/requests/categories');
    return res.data;
  },

  // Get departments
  getDepartments: async () => {
    const res = await api.get('/requests/departments');
    return res.data;
  },

  // Get role-aware statistics
  getStats: async () => {
    const res = await api.get('/requests/stats');
    return res.data;
  },

  // Get assignable workers list (Supervisor/Admin)
  getAssignableWorkers: async () => {
    const res = await api.get('/requests/workers');
    return res.data;
  },

  // Assign worker to request (Supervisor/Admin)
  assignWorker: async (requestId, { workerId, expectedCurrentStatus }) => {
    const res = await api.post(`/requests/${requestId}/assign`, {
      workerId,
      expectedCurrentStatus,
    });
    return res.data;
  },

  // Reject request with reason (Supervisor/Admin)
  rejectRequest: async (requestId, { reason, expectedCurrentStatus }) => {
    const res = await api.post(`/requests/${requestId}/reject`, {
      reason,
      expectedCurrentStatus,
    });
    return res.data;
  },

  // Mark request as received (Supervisor/Admin)
  receiveRequest: async (requestId) => {
    const res = await api.post(`/requests/${requestId}/receive`);
    return res.data;
  },

  // Start work on request (Worker/Supervisor/Admin)
  startWork: async (requestId, expectedCurrentStatus) => {
    const res = await api.post(`/requests/${requestId}/start-work`, {
      expectedCurrentStatus,
    });
    return res.data;
  },

  // Complete work on request (Worker/Supervisor/Admin)
  completeWork: async (requestId, { actionTaken, maintenanceTime, finalReport, expectedCurrentStatus }) => {
    const res = await api.post(`/requests/${requestId}/complete`, {
      actionTaken,
      maintenanceTime,
      finalReport,
      expectedCurrentStatus,
    });
    return res.data;
  },

  // Request spare parts for a ticket (Worker/Supervisor/Admin)
  requestSparePart: async (requestId, { partName, quantity, notes }) => {
    const res = await api.post(`/requests/${requestId}/spare-parts`, {
      partName,
      quantity,
      notes,
    });
    return res.data;
  },

  // List spare parts across requests (Storekeeper/Supervisor/Admin)
  getSpareParts: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.requestId) params.append('requestId', filters.requestId);
    const res = await api.get(`/requests/spare-parts?${params.toString()}`);
    return res.data;
  },

  // Release spare part (Storekeeper/Supervisor/Admin)
  releaseSparePart: async (partId, { notes } = {}) => {
    const res = await api.post(`/requests/spare-parts/${partId}/release`, { notes });
    return res.data;
  },
};

