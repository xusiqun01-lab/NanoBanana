import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关
export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/api/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  
  getMe: () =>
    api.get('/api/auth/me'),
};

// 图像生成相关
export const generateAPI = {
  generate: (data: {
    prompt: string;
    provider: string;
    model: string;
    size: string;
    aspectRatio: string;
    mode: 'text2img' | 'img2img' | 'multiImg';
    referenceImages?: string[];
  }) => api.post('/api/generate', data),
  
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  getHistory: () =>
    api.get('/api/history'),
};

// 管理员相关
export const adminAPI = {
  getUsers: () =>
    api.get('/api/admin/users'),
  
  updateUserRole: (userId: string, role: string) =>
    api.put(`/api/admin/users/${userId}/role`, { role }),
  
  deleteUser: (userId: string) =>
    api.delete(`/api/admin/users/${userId}`),
  
  getAllImages: () =>
    api.get('/api/admin/images'),
  
  getStats: () =>
    api.get('/api/admin/stats'),
};

export default api;
