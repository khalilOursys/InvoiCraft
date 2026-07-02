// components/pos/OrderSelector.tsx
'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Clock, CheckCircle, XCircle, Package, Calendar, DollarSign } from 'lucide-react';

interface OrderItem {
    productId: number;
    quantity: number;
    price: number;
    product?: {
        id: number;
        name: string;
        img?: string;
    };
}

interface Order {
    id: number;
    orderNumber: string;
    createdAt: string;
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    items: OrderItem[];
    payment?: {
        method: string;
        amount: number;
    };
    tableNumber?: string;
    notes?: string;
}

interface OrderSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    isLoading: boolean;
    onSelectOrder: (order: Order) => void;
}

export default function OrderSelector({
    isOpen,
    onClose,
    orders,
    isLoading,
    onSelectOrder
}: OrderSelectorProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');

    if (!isOpen) return null;

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.id.toString().includes(searchTerm) ||
            order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.tableNumber && order.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return <Clock className="w-4 h-4" />;
            case 'completed':
                return <CheckCircle className="w-4 h-4" />;
            case 'cancelled':
                return <XCircle className="w-4 h-4" />;
            default:
                return <Package className="w-4 h-4" />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
                        <Dialog.Title className="text-xl font-semibold text-gray-800">
                            Select Order to Update
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-[57px] z-10">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by order ID, number, or table..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-y-auto p-4" style={{ height: '400px' }}>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="text-center py-12">
                                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No orders found</p>
                                {searchTerm && (
                                    <p className="text-sm text-gray-400 mt-2">
                                        Try adjusting your search criteria
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
                                {filteredOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={`border rounded-lg p-4 transition-all flex flex-col h-full ${order.status === 'completed'
                                            ? 'bg-gray-50 opacity-75'
                                            : 'hover:shadow-lg hover:border-blue-300 cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-800 break-words">
                                                    {order.orderNumber || `Order #${order.id}`}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                        {getStatusIcon(order.status)}
                                                        {order.status}
                                                    </span>
                                                    {order.tableNumber && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                            Table {order.tableNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right ml-2">
                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(order.createdAt)}
                                                </div>
                                                <div className="flex items-center gap-1 text-lg font-bold text-gray-800 mt-1">
                                                    <DollarSign className="w-4 h-4" />
                                                    {order.total?.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100 pt-3 mt-2 flex-1">
                                            <div className="text-sm text-gray-600 mb-2">
                                                Items ({order.items?.length || 0}):
                                            </div>
                                            <div className="space-y-1 max-h-24 overflow-y-auto">
                                                {order.items?.slice(0, 3).map((item, idx) => (
                                                    <div key={idx} className="text-sm flex justify-between">
                                                        <span className="text-gray-600 truncate flex-1 mr-2">
                                                            {item.product?.name || `Product ${item.productId}`} x{item.quantity}
                                                        </span>
                                                        <span className="text-gray-800 whitespace-nowrap">
                                                            ${(item.price * item.quantity).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                                {order.items?.length > 3 && (
                                                    <div className="text-xs text-gray-400 text-center pt-1">
                                                        +{order.items.length - 3} more items
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {order.notes && (
                                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                                📝 {order.notes}
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            {order.status !== 'completed' ? (
                                                <button
                                                    onClick={() => onSelectOrder(order)}
                                                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                                >
                                                    Update Order
                                                </button>
                                            ) : (
                                                <div className="w-full px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium text-center">
                                                    Order Completed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-3 flex justify-end z-10">
                        <Dialog.Close asChild>
                            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                                Close
                            </button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}