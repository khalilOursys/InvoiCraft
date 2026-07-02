'use client';

import { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CreditCard, DollarSign, Smartphone, X, Edit2, Search, User, Percent } from 'lucide-react';
import { CartItem } from '@/app/(admin)/pos/page';
import { useCreateOrder, useUpdateOrder, useOrderById } from '@/hooks/useOrders';
import { useToast } from '@/components/providers/ToastProvider';
import { CreateOrderDto } from '@/lib/api/orders';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (paymentMethod: 'CASH' | 'CREDIT_CARD' | 'MOBILE_PAYMENT', paymentAmount: number) => void;
    cartItems: CartItem[];
    totalAmount: number;
    isUpdateMode?: boolean;
    editingOrderId?: number | null;
}

export default function CheckoutModal({
    isOpen,
    onClose,
    onComplete,
    cartItems,
    totalAmount,
    isUpdateMode = false,
    editingOrderId = null,
}: CheckoutModalProps) {
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'CREDIT_CARD' | 'mobile'>('cash');
    const [cashAmount, setCashAmount] = useState<number>(0);
    const [tableNumber, setTableNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [discountPercent, setDiscountPercent] = useState<number>(0);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [clients, setClients] = useState<any[]>([]);

    const { data: existingOrder, isLoading: isLoadingOrder } = useOrderById(
        isUpdateMode && editingOrderId ? editingOrderId : null
    );

    const createOrderMutation = useCreateOrder();
    const updateOrderMutation = useUpdateOrder();
    const { showToast } = useToast();

    // Calculate totals with proper tax per product
    const calculateTotals = useMemo(() => {
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const taxDetails: { vatRate: number; taxableAmount: number; taxAmount: number }[] = [];
        const taxMap = new Map<number, { taxableAmount: number; taxAmount: number }>();

        cartItems.forEach(item => {
            const vatRate = item.vatRate || 19;
            const itemTotal = item.price * item.quantity;
            const itemTax = itemTotal * (vatRate / 100);

            const existing = taxMap.get(vatRate) || { taxableAmount: 0, taxAmount: 0 };
            taxMap.set(vatRate, {
                taxableAmount: existing.taxableAmount + itemTotal,
                taxAmount: existing.taxAmount + itemTax
            });
        });

        taxMap.forEach((value, key) => {
            taxDetails.push({
                vatRate: key,
                taxableAmount: value.taxableAmount,
                taxAmount: value.taxAmount
            });
        });

        const totalTax = taxDetails.reduce((sum, detail) => sum + detail.taxAmount, 0);
        const discountAmount = subtotal * (discountPercent / 100);
        const discountedSubtotal = subtotal - discountAmount;
        const total = discountedSubtotal + totalTax;

        return {
            subtotal,
            totalTax,
            taxDetails,
            discountAmount,
            discountedSubtotal,
            total
        };
    }, [cartItems, discountPercent]);

    const { subtotal, totalTax, taxDetails, discountAmount, discountedSubtotal, total } = calculateTotals;

    useEffect(() => {
        setCashAmount(total);
    }, [total]);

    const change = cashAmount - total;

    // Search clients
    useEffect(() => {
        if (clientSearch.length > 1) {
            const searchClients = async () => {
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}clients/search?search=${clientSearch}`);
                    const data = await response.json();
                    console.log(data.clients);

                    setClients(data.clients);
                } catch (error) {
                    console.error('Error searching clients:', error);
                }
            };
            searchClients();
        } else {
            setClients([]);
        }
    }, [clientSearch]);

    // Load existing order data
    useEffect(() => {
        if (isUpdateMode && existingOrder) {
            const existingPayment = existingOrder.orderPayments?.[0];
            if (existingPayment) {
                const method = existingPayment.method.toLowerCase();
                if (method === 'cash') {
                    setPaymentMethod('cash');
                    setCashAmount(existingPayment.amount);
                } else if (method === 'credit_card') {
                    setPaymentMethod('CREDIT_CARD');
                } else if (method === 'mobile_payment') {
                    setPaymentMethod('mobile');
                }
            }
            setTableNumber(existingOrder.tableNumber || '');
            setNotes(existingOrder.notes || '');
            setDiscountPercent(existingOrder.discountPercent || 0);
            setSelectedClientId(existingOrder.clientId || null);
            if (existingOrder.clientId && existingOrder.client) {
                setClientSearch(existingOrder.client.name);
            }
        }
    }, [isUpdateMode, existingOrder]);

    useEffect(() => {
        if (!isOpen) {
            resetForm();
        }
    }, [isOpen, total]);

    const resetForm = () => {
        setPaymentMethod('cash');
        setCashAmount(total);
        setTableNumber('');
        setNotes('');
        setDiscountPercent(0);
        setSelectedClientId(null);
        setClientSearch('');
        setShowClientDropdown(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const selectedPaymentMethod = paymentMethod.toUpperCase() as 'CASH' | 'CREDIT_CARD' | 'MOBILE_PAYMENT';
        const finalPaymentAmount = paymentMethod === 'cash' ? cashAmount : total;

        const orderData: CreateOrderDto = {
            items: cartItems.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                price: item.price,
            })),
            subtotal: subtotal,
            discountPercent: discountPercent,
            discountAmount: discountAmount,
            discountedSubtotal: discountedSubtotal,
            tax: totalTax,
            total: total,
            clientId: selectedClientId || undefined,
            payment: {
                amount: finalPaymentAmount,
                method: selectedPaymentMethod,
                change: paymentMethod === 'cash' && cashAmount >= total ? change : 0,
            },
            tableNumber: tableNumber || undefined,
            notes: notes || undefined,
        };

        try {
            if (isUpdateMode && editingOrderId) {
                await updateOrderMutation.mutateAsync({
                    id: editingOrderId,
                    data: orderData,
                });
                showToast('Order updated successfully!', 'success');
                onComplete(selectedPaymentMethod, finalPaymentAmount);
            } else {
                await createOrderMutation.mutateAsync(orderData);
                showToast('Order completed successfully!', 'success');
                onComplete(selectedPaymentMethod, finalPaymentAmount);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to process order', 'error');
        }
    };

    const isLoading = createOrderMutation.isPending || updateOrderMutation.isPending || isLoadingOrder;

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            {isUpdateMode && <Edit2 className="w-5 h-5 text-blue-600" />}
                            <Dialog.Title className="text-xl font-semibold text-gray-800">
                                {isUpdateMode ? 'Update Order' : 'Checkout'}
                            </Dialog.Title>
                        </div>
                        <Dialog.Close asChild>
                            <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {isUpdateMode && editingOrderId && (
                        <div className="bg-blue-50 p-3 border-b border-blue-200">
                            <p className="text-sm text-blue-700 flex items-center gap-2">
                                <Edit2 className="w-4 h-4" />
                                Editing Order #{editingOrderId}
                            </p>
                        </div>
                    )}

                    {isLoadingOrder && isUpdateMode ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-gray-600">Loading order details...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-4">
                            {/* Client Selection */}
                            <div className="mb-6">
                                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Client (Optional)
                                </h3>
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={clientSearch}
                                            onChange={(e) => {
                                                setClientSearch(e.target.value);
                                                setShowClientDropdown(true);
                                                if (!e.target.value) setSelectedClientId(null);
                                            }}
                                            onFocus={() => setShowClientDropdown(true)}
                                            placeholder="Search client by name, phone, or email..."
                                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    {showClientDropdown && clients.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {clients.map((client) => (
                                                <button
                                                    key={client.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClientId(client.id);
                                                        setClientSearch(client.name);
                                                        setShowClientDropdown(false);
                                                    }}
                                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="font-medium">{client.name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {client.phone} | {client.email}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedClientId && (
                                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-700">
                                            Selected Client ID: {selectedClientId}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Order Summary */}
                            <div className="mb-6">
                                <h3 className="font-medium text-gray-800 mb-3">Order Summary</h3>
                                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                    {cartItems.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <div>
                                                <span>{item.name} x{item.quantity}</span>
                                                <span className="ml-2 text-xs text-gray-500">
                                                    (VAT: {item.vatRate || 19}%)
                                                </span>
                                            </div>
                                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-gray-200 pt-2 space-y-1">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal:</span>
                                        <span>${subtotal.toFixed(2)}</span>
                                    </div>

                                    {/* Discount Section */}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 flex items-center gap-1">
                                            <Percent className="w-3 h-3" />
                                            Discount:
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={discountPercent}
                                                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="0"
                                                max="100"
                                                step="1"
                                            />
                                            <span>%</span>
                                        </div>
                                    </div>

                                    {discountPercent > 0 && (
                                        <>
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span>Discount Amount:</span>
                                                <span>-${discountAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-gray-600">
                                                <span>After Discount:</span>
                                                <span>${discountedSubtotal.toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Tax Section */}
                                    <div className="border-t border-gray-100 pt-1">
                                        <div className="flex justify-between text-sm text-gray-600 font-medium">
                                            <span>Total Tax:</span>
                                            <span>${totalTax.toFixed(2)}</span>
                                        </div>

                                        {taxDetails.map((detail) => (
                                            <div key={detail.vatRate} className="flex justify-between text-xs text-gray-500 ml-4">
                                                <span>VAT {detail.vatRate}% (on ${detail.taxableAmount.toFixed(2)}):</span>
                                                <span>${detail.taxAmount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-200">
                                        <span>Total to Pay:</span>
                                        <span className="text-lg text-blue-600">${total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="mb-6">
                                <h3 className="font-medium text-gray-800 mb-3">Payment Method</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === 'cash'
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <DollarSign className="w-6 h-6 mx-auto mb-1" />
                                        <div className="text-sm">Cash</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('CREDIT_CARD')}
                                        className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === 'CREDIT_CARD'
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <CreditCard className="w-6 h-6 mx-auto mb-1" />
                                        <div className="text-sm">Card</div>
                                    </button>
                                    {/* <button
                                        type="button"
                                        onClick={() => setPaymentMethod('mobile')}
                                        className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === 'mobile'
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Smartphone className="w-6 h-6 mx-auto mb-1" />
                                        <div className="text-sm">Mobile</div>
                                    </button> */}
                                </div>
                            </div>

                            {/* Cash Payment Details */}
                            {paymentMethod === 'cash' && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cash Amount
                                    </label>
                                    <input
                                        type="number"
                                        value={cashAmount}
                                        onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        step={0.01}
                                        min={0}
                                    />
                                    {cashAmount >= total && cashAmount > 0 && (
                                        <div className="mt-2 text-sm text-green-600">
                                            Change: ${change.toFixed(2)}
                                        </div>
                                    )}
                                    {cashAmount < total && cashAmount > 0 && (
                                        <div className="mt-2 text-sm text-red-600">
                                            Insufficient amount {/* (Need: ${total.toFixed(2)}) */}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Table Number & Notes */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Table Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={tableNumber}
                                    onChange={(e) => setTableNumber(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Special Instructions (Optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </Dialog.Close>
                                <button
                                    type="submit"
                                    /* disabled={isLoading || (paymentMethod === 'cash' && cashAmount < total)} */
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading
                                        ? 'Processing...'
                                        : isUpdateMode
                                            ? 'Update Order'
                                            : 'Complete Order'
                                    }
                                </button>
                            </div>
                        </form>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}