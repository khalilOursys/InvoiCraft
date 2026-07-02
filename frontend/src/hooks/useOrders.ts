// hooks/useOrders.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    createOrder, 
    getOrders, 
    getOrderById, 
    getTodayStats, 
    updateOrder,
    updateOrderStatus,
    getOrdersByClient,
    CreateOrderDto, 
    UpdateOrderDto,
    OrderResponse 
} from '@/lib/api/orders';

export const useCreateOrder = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (orderData: CreateOrderDto) => createOrder(orderData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['today-stats'] });
        },
        onError: (error: Error) => {
            console.error('Failed to create order:', error);
        },
    });
};

export const useUpdateOrder = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateOrderDto }) => 
            updateOrder(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['today-stats'] });
        },
        onError: (error: Error) => {
            console.error('Failed to update order:', error);
        },
    });
};

export const useOrderById = (id: number | null) => {
    return useQuery<OrderResponse>({
        queryKey: ['order', id],
        queryFn: () => getOrderById(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
};

export const useOrders = (page?: number, limit?: number) => {
    return useQuery({
        queryKey: ['orders', page, limit],
        queryFn: () => getOrders(page, limit),
        staleTime: 1 * 60 * 1000,
    });
};

export const useOrdersByClient = (clientId: number, page: number = 1, limit: number = 10) => {
    return useQuery({
        queryKey: ['orders', 'client', clientId, page, limit],
        queryFn: () => getOrdersByClient(clientId, page, limit),
        enabled: !!clientId,
    });
};

export const useTodayStats = () => {
    return useQuery({
        queryKey: ['today-stats'],
        queryFn: () => getTodayStats(),
        refetchInterval: 30000,
    });
};

export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) => 
            updateOrderStatus(id, status, notes),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
        },
        onError: (error: Error) => {
            console.error('Failed to update order status:', error);
        },
    });
};