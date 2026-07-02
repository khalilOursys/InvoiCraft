// lib/api/products.ts
import { apiClient } from './client';

export interface Product {
  id: number;
  reference: string;
  internalCode: string;
  name: string;
  description: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  salePrice: number;
  categoryId: number;
  brandId: number;
  img?: string;
}

export const productsApi = {
  getProducts: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: number;
    brandId?: number;
  }) => 
    apiClient.get<{
      products: Product[];
      total: number;
      page: number;
      totalPages: number;
    }>('/products', params),
  
  getProductById: (id: number) => 
    apiClient.get<Product>(`/products/${id}`),
  
  createProduct: (data: FormData) => {
    // For FormData, we need to handle differently
    const token = localStorage.getItem('auth_token');
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: data,
    }).then(res => res.json());
  },
  
  updateProduct: (id: number, data: FormData) => {
    const token = localStorage.getItem('auth_token');
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: data,
    }).then(res => res.json());
  },
  
  deleteProduct: (id: number) => 
    apiClient.delete(`/products/${id}`),
  
  updateStock: (id: number, operation: 'increment' | 'decrement', quantity: number, reason?: string) => 
    apiClient.patch(`/products/stock/${id}/${operation}`, { quantity, reason }),
};