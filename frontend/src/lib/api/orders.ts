// lib/api/orders.ts
export interface OrderItem {
    productId: number;
    quantity: number;
    price: number;
}

export interface OrderPayment {
    amount: number;
    method: 'CASH' | 'CREDIT_CARD' | 'MOBILE_PAYMENT';
    change?: number;
}

export interface CreateOrderDto {
    items: OrderItem[];
    subtotal: number;
    discountPercent?: number;
    discountAmount?: number;
    discountedSubtotal?: number;
    tax: number;
    total: number;
    clientId?: number;
    payment: OrderPayment;
    tableNumber?: string;
    notes?: string;
    cashierId?: number;
}

export interface UpdateOrderDto {
    items?: OrderItem[];
    subtotal?: number;
    discountPercent?: number;
    discountAmount?: number;
    discountedSubtotal?: number;
    tax?: number;
    total?: number;
    clientId?: number;
    payment?: OrderPayment;
    tableNumber?: string;
    notes?: string;
}

export interface OrderResponse {
    id: number;
    orderNumber: string;
    createdAt: string;
    updatedAt: string;
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    discountedSubtotal: number;
    tax: number;
    total: number;
    clientId?: number;
    client?: {
        id: number;
        name: string;
        phone?: string;
        email?: string;
        address?: string;
        taxNumber?: string;
    };
    tableNumber?: string;
    notes?: string;
    status: string;
    cashierId: number;
    cashier?: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
    };
    items: (OrderItem & { 
        id: number;
        total: number;
        product?: {
            id: number;
            name: string;
            img?: string;
            vat?: number;
        }
    })[];
    orderPayments: (OrderPayment & {
        id: number;
        createdAt: string;
    })[];
}

export async function createOrder(orderData: CreateOrderDto): Promise<OrderResponse> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create order');
    }
    
    return response.json();
}

export async function updateOrder(id: number, orderData: UpdateOrderDto): Promise<OrderResponse> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update order');
    }
    
    return response.json();
}

export async function getOrders(page?: number, limit?: number) {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page.toString());
    if (limit) queryParams.append('limit', limit.toString());
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders?${queryParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch orders');
    return response.json();
}

export async function getOrderById(id: number): Promise<OrderResponse> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders/${id}`);
    if (!response.ok) throw new Error('Failed to fetch order');
    return response.json();
}

export async function getOrdersByClient(clientId: number, page?: number, limit?: number) {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page.toString());
    if (limit) queryParams.append('limit', limit.toString());
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders/client/${clientId}?${queryParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch client orders');
    return response.json();
}

export async function getTodayStats() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders/today/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
}

export async function updateOrderStatus(id: number, status: string, notes?: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}orders/${id}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update order status');
    }
    
    return response.json();
}