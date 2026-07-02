'use client';

import { CartItem } from '@/app/(admin)/pos/page';
import { Trash2, ShoppingBag, Edit2 } from 'lucide-react';
import Image from 'next/image';

interface ShoppingCartProps {
    cartItems: CartItem[];
    onUpdateQuantity: (id: number, quantity: number) => void;
    onRemoveItem: (id: number) => void;
    onClearCart: () => void;
    onCheckout: () => void;
    totalAmount: number;
    itemCount: number;
    isUpdateMode?: boolean;
}

export default function ShoppingCart({
    cartItems,
    onUpdateQuantity,
    onRemoveItem,
    onClearCart,
    onCheckout,
    totalAmount,
    itemCount,
    isUpdateMode = false,
}: ShoppingCartProps) {
    const tax = totalAmount * 0.1;
    const grandTotal = totalAmount + tax;
    console.log(cartItems);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">Shopping Cart</h2>
                    <ShoppingBag className="w-5 h-5 text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 mt-1">{itemCount} items</p>
            </div>

            {isUpdateMode && (
                <div className="bg-blue-50 p-3 border-b border-blue-200">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Edit2 className="w-4 h-4" />
                        <span>Update Mode: Modifying existing order</span>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                {cartItems.length === 0 ? (
                    <div className="text-center py-12">
                        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Your cart is empty</p>
                        <p className="text-sm text-gray-400 mt-2">Click on products to add them</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cartItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-200">
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="object-cover"
                                                    sizes="48px"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ShoppingBag className="w-6 h-6 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-800">{item.name}</h4>
                                            <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                                        >
                                            -
                                        </button>
                                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => onRemoveItem(item.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {cartItems.length > 0 && (
                <div className="border-t border-gray-200 p-4">
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal:</span>
                            <span>${totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Tax (10%):</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
                            <span>Total:</span>
                            <span>${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClearCart}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={onCheckout}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {isUpdateMode ? 'Update Order' : 'Checkout'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}