// lib/api/inventory.ts
import { apiClient } from './client';

export interface StockMovement {
  id: number;
  movementNumber: string;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'RETURN' | 'LOSS' | 'TRANSFER';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
    notes: string;
  product: {
    id: number;
    name: string;
    reference: string;
  };
}

export interface ProductInventory {
  id: number;
  name: string;
  reference: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minStock: number;
  criticalStock: number;
  status: 'OK' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK';
  lastStockUpdate: string;
}

export interface CreateMovementDto {
  productId: number;
  type: StockMovement['type'];
  quantity: number;
  reason: string;
  notes?: string;
  reference?: string;
}

export interface UpdateMovementDto {
  status?: StockMovement['status'];
  reason?: string;
  notes?: string;
  quantity?: number;
}

export const inventoryApi = {
  // Movements
  getMovements: (params?: {
    productId?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => 
    apiClient.get<{
      movements: StockMovement[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/inventory/movements', params),
  
  getMovementById: (id: number) => 
    apiClient.get<StockMovement>(`/inventory/movements/${id}`),
  
  createMovement: (data: CreateMovementDto) => 
    apiClient.post<StockMovement>('/inventory/movements', data),
  
  updateMovement: (id: number, data: UpdateMovementDto) => 
    apiClient.patch<StockMovement>(`/inventory/movements/${id}`, data),
  
  cancelMovement: (id: number, reason?: string) => 
    apiClient.delete<{ message: string }>(`/inventory/movements/${id}`, { reason }),
  
  // Product Inventory
  getProductInventory: (productId: number) => 
    apiClient.get<ProductInventory>(`/inventory/products/${productId}`),
  
  getInventorySummary: (params?: {
    lowStock?: boolean;
    criticalStock?: boolean;
    categoryId?: number;
    brandId?: number;
  }) => 
    apiClient.get<any[]>('/inventory/summary', params),
  
  adjustStock: (productId: number, data: {
    quantity: number;
    reason: string;
    notes?: string;
  }) => 
    apiClient.post(`/inventory/products/${productId}/adjust`, data),
  
  // Stock Alerts
  getStockAlerts: () => 
    apiClient.get<any[]>('/inventory/alerts'),
  
  getLowStockProducts: () => 
    apiClient.get<any[]>('/inventory/alerts/low-stock'),
  
  // Reservations
  reserveStock: (data: {
    productId: number;
    quantity: number;
    orderId?: number;
    sessionId?: string;
    expirationMinutes?: number;
  }) => 
    apiClient.post('/inventory/reserve', data),
  
  releaseReservation: (id: number) => 
    apiClient.delete(`/inventory/reserve/${id}`),
  
  // Inventory Counts
  createInventoryCount: (data: {
    name: string;
    scheduledDate: string;
    notes?: string;
  }) => 
    apiClient.post('/inventory/counts', data),
  
  getInventoryCounts: () => 
    apiClient.get<any[]>('/inventory/counts'),
  
  getInventoryCount: (id: number) => 
    apiClient.get(`/inventory/counts/${id}`),
  
  submitInventoryCount: (id: number, data: {
    items: Array<{
      productId: number;
      countedQuantity: number;
      notes?: string;
    }>;
  }) => 
    apiClient.put(`/inventory/counts/${id}/submit`, data),
  
  // Product Alert Settings
  getProductAlert: (productId: number) => 
    apiClient.get(`/inventory/products/${productId}/alert`),
  
  updateProductAlert: (productId: number, data: {
    minThreshold?: number;
    criticalThreshold?: number;
    maxThreshold?: number;
    reorderQuantity?: number;
    notifyEmail?: boolean;
    notifyDashboard?: boolean;
    isActive?: boolean;
  }) => 
    apiClient.put(`/inventory/products/${productId}/alert`, data),
};