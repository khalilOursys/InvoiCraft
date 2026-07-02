// lib/hooks/useInventory.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, CreateMovementDto, UpdateMovementDto } from '@/lib/api/inventory'; 

export const useInventoryMovements = (params?: any) => {
  return useQuery({
    queryKey: ['inventory-movements', params],
    queryFn: () => inventoryApi.getMovements(params),
  });
};

export const useMovementDetail = (id: number) => {
  return useQuery({
    queryKey: ['movement-detail', id],
    queryFn: () => inventoryApi.getMovementById(id),
    enabled: !!id,
  });
};

export const useCreateMovement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateMovementDto) => inventoryApi.createMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      /* toast.success('Movement created successfully'); */
    },
    onError: (error: Error) => {
        console.error('Failed to create movement', error.message);
      /* toast.error(error.message || 'Failed to create movement'); */
    },
  });
};

export const useUpdateMovement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMovementDto }) => 
      inventoryApi.updateMovement(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['movement-detail', variables.id] });
      /* toast.success('Movement updated successfully'); */
    },
    onError: (error: Error) => {
        console.error('Failed to update movement', error.message);
      /* toast.error(error.message || 'Failed to update movement'); */
    },
  });
};

export const useCancelMovement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => 
      inventoryApi.cancelMovement(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      /* toast.success('Movement cancelled successfully'); */
    },
    onError: (error: Error) => {
        console.error('Failed to cancel movement', error.message);
      /* toast.error(error.message || 'Failed to cancel movement'); */
    },
  });
};

export const useProductInventory = (productId: number) => {
  return useQuery({
    queryKey: ['product-inventory', productId],
    queryFn: () => inventoryApi.getProductInventory(productId),
    enabled: !!productId,
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: any }) =>
      inventoryApi.adjustStock(productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-inventory', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      /* toast.success('Stock adjusted successfully'); */
    },
    onError: (error: Error) => {
        console.error('Failed to adjust stock', error.message);
      /* toast.error(error.message || 'Failed to adjust stock'); */
    },
  });
};

export const useStockAlerts = () => {
  return useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => inventoryApi.getStockAlerts(),
    refetchInterval: 30000,
  });
};