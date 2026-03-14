import axios from 'axios';
import mockJobs from './mockQueue';

// Use mock API by default, switch to real API when Backend M1 is ready
const USE_MOCK_API = process.env.REACT_APP_USE_MOCK_API !== 'false';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class QueueClient {
  constructor() {
    this.useMockAPI = USE_MOCK_API;
    this.mockJobs = mockJobs;
  }

  // Fetch all queue jobs
  async getJobs(filters = {}) {
    if (this.useMockAPI) {
      return new Promise((resolve) => {
        setTimeout(() => {
          let jobs = [...this.mockJobs];
          if (filters.status) {
            jobs = jobs.filter((job) => job.status === filters.status);
          }
          resolve(jobs);
        }, 200);
      });
    }

    try {
      const response = await axios.get(`${API_BASE}/jobs`, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      throw error;
    }
  }

  // Fetch a single job by ID
  async getJob(id) {
    if (this.useMockAPI) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const job = this.mockJobs.find((j) => j.id === id);
          if (job) resolve(job);
          else reject(new Error(`Job ${id} not found`));
        }, 100);
      });
    }

    try {
      const response = await axios.get(`${API_BASE}/jobs/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch job:', error);
      throw error;
    }
  }

  // Approve a job (transition to published state)
  async approveJob(id) {
    if (this.useMockAPI) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const job = this.mockJobs.find((j) => j.id === id);
          if (job) {
            job.status = 'approved';
            job.audit_log.push({
              action: 'approved',
              actor: 'user@example.com',
              timestamp: new Date().toISOString()
            });
          }
          resolve(job);
        }, 300);
      });
    }

    try {
      const response = await axios.post(`${API_BASE}/jobs/${id}/approve`);
      return response.data;
    } catch (error) {
      console.error('Failed to approve job:', error);
      throw error;
    }
  }

  // Reject a job (return to drafted state)
  async rejectJob(id, reason = '') {
    if (this.useMockAPI) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const job = this.mockJobs.find((j) => j.id === id);
          if (job) {
            job.status = 'rejected';
            job.audit_log.push({
              action: 'rejected',
              actor: 'user@example.com',
              reason,
              timestamp: new Date().toISOString()
            });
          }
          resolve(job);
        }, 300);
      });
    }

    try {
      const response = await axios.post(`${API_BASE}/jobs/${id}/reject`, { reason });
      return response.data;
    } catch (error) {
      console.error('Failed to reject job:', error);
      throw error;
    }
  }

  // Unpublish a job (revert published article to drafted state)
  async unpublishJob(id) {
    if (this.useMockAPI) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const job = this.mockJobs.find((j) => j.id === id);
          if (job) {
            job.status = 'drafted';
            job.audit_log.push({
              action: 'unpublished',
              actor: 'user@example.com',
              timestamp: new Date().toISOString()
            });
          }
          resolve(job);
        }, 300);
      });
    }

    try {
      const response = await axios.post(`${API_BASE}/jobs/${id}/unpublish`);
      return response.data;
    } catch (error) {
      console.error('Failed to unpublish job:', error);
      throw error;
    }
  }
}

export default new QueueClient();
