import axios from 'axios';
import * as mockQueue from './mockQueue.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export async function getJobs() {
  if (USE_MOCK) return mockQueue.getJobs();
  const { data } = await api.get('/jobs');
  return data;
}

export async function getJob(id) {
  if (USE_MOCK) return mockQueue.getJob(id);
  const { data } = await api.get(`/jobs/${id}`);
  return data;
}

export async function approveJob(id) {
  if (USE_MOCK) return mockQueue.approveJob(id);
  const { data } = await api.post(`/jobs/${id}/approve`);
  return data;
}

export async function rejectJob(id, reason) {
  if (USE_MOCK) return mockQueue.rejectJob(id, reason);
  const { data } = await api.post(`/jobs/${id}/reject`, { reason });
  return data;
}

export async function unpublishJob(id) {
  if (USE_MOCK) return mockQueue.unpublishJob(id);
  const { data } = await api.post(`/jobs/${id}/unpublish`);
  return data;
}

export async function publishArticle(id) {
  if (USE_MOCK) return mockQueue.publishArticle(id);
  const { data } = await api.post('/articles/publish', { id });
  return data;
}
