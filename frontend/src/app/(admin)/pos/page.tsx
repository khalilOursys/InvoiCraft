'use client';

import { useState } from 'react';
import ProductGrid from '@/components/pos/ProductGrid';
import ShoppingCart from '@/components/pos/ShoppingCart';
import CheckoutModal from '@/components/pos/CheckoutModal';
import OrderSelector from '@/components/pos/OrderSelector';
import { useProducts, useFilterOptions } from '@/hooks/useProducts';
import { useCreateOrder, useUpdateOrder, useOrders } from '@/hooks/useOrders';
import { Product as APIProduct } from '@/lib/api/products';
import { useToast } from '@/components/providers/ToastProvider';

export interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
    image: string;
    stock: number;
    vatRate?: number;
}

export interface CartItem extends Product {
    quantity: number;
}

export default function POSPage() {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isOrderSelectorOpen, setIsOrderSelectorOpen] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
    const [isUpdateMode, setIsUpdateMode] = useState(false);

    const { showToast } = useToast();

    const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useProducts({
        search: searchTerm || undefined,
        categoryNames: selectedCategory !== 'All' ? [selectedCategory] : undefined,
        page: currentPage,
        limit: 20,
    });

    const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useOrders(1, 50);
    const createOrderMutation = useCreateOrder();
    const updateOrderMutation = useUpdateOrder();
    const { data: filterOptions, isLoading: filtersLoading } = useFilterOptions();

    const categories = ['All', ...(filterOptions?.categories?.map((cat: any) => cat.name) || [])];

    const addToCart = (product: Product) => {
        setCartItems(prevItems => {
            const existingItem = prevItems.find(item => item.id === product.id);
            if (existingItem) {
                return prevItems.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prevItems, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (id: number, newQuantity: number) => {
        if (newQuantity === 0) {
            setCartItems(prev => prev.filter(item => item.id !== id));
        } else {
            setCartItems(prev =>
                prev.map(item =>
                    item.id === id ? { ...item, quantity: newQuantity } : item
                )
            );
        }
    };

    const removeFromCart = (id: number) => {
        setCartItems(prev => prev.filter(item => item.id !== id));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const getTotalAmount = () => {
        return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
    };

    const getItemCount = () => {
        return cartItems.reduce((count, item) => count + item.quantity, 0);
    };

    const handleCheckout = () => {
        setIsCheckoutOpen(true);
    };

    const handleCheckoutComplete = async (paymentMethod: 'CASH' | 'CREDIT_CARD' | 'MOBILE_PAYMENT', paymentAmount: number) => {
        try {
            clearCart();
            setIsCheckoutOpen(false);
            setIsUpdateMode(false);
            setEditingOrderId(null);
            refetchProducts();
            refetchOrders();
        } catch (error) {
            console.error('Order failed:', error);
            showToast(error instanceof Error ? error.message : 'Failed to process order', 'error');
        }
    };

    const handleLoadOrder = (order: any) => {
        const orderItems: CartItem[] = order.items.map((item: any) => ({
            id: item.productId,
            name: item.product?.name || `Product ${item.productId}`,
            price: item.price,
            category: item.product?.category?.name || 'Uncategorized',
            image: item.product?.img || '/placeholder-image.jpg',
            stock: 999,
            vatRate: item.product?.vat || 19,
            quantity: item.quantity,
        }));

        setCartItems(orderItems);
        setEditingOrderId(order.id);
        setIsUpdateMode(true);
        setIsOrderSelectorOpen(false);
        showToast(`Order #${order.id} loaded for editing`, 'info');
    };

    const handleCancelUpdate = () => {
        clearCart();
        setIsUpdateMode(false);
        setEditingOrderId(null);
        showToast('Update mode cancelled', 'info');
    };

    const transformedProducts: Product[] = productsData?.products?.map((apiProduct: APIProduct) => ({
        id: apiProduct.id,
        name: apiProduct.name,
        price: apiProduct.salePrice,
        category: apiProduct.category?.name || 'Uncategorized',
        image: apiProduct.img || '/placeholder-image.jpg',
        stock: apiProduct.stock,
        vatRate: apiProduct.vat || 19,
    })) || [];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex h-screen">
                {/* Products Section */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header with Load Order Button */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-800">Point of Sale</h1>
                                {isUpdateMode && (
                                    <p className="text-sm text-blue-600 mt-1">
                                        Updating Order #{editingOrderId}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsOrderSelectorOpen(true)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Load Order
                                </button>

                                {isUpdateMode && (
                                    <button
                                        onClick={handleCancelUpdate}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel Update
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto">
                                {categories.map(category => (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${selectedCategory === category
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {productsLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <>
                                <ProductGrid products={transformedProducts} onAddToCart={addToCart} />
                                {productsData && productsData.totalPages > 1 && (
                                    <div className="flex justify-center gap-2 mt-6">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-3 py-1">
                                            Page {currentPage} of {productsData.totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(productsData.totalPages, p + 1))}
                                            disabled={currentPage === productsData.totalPages}
                                            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Cart Section */}
                <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
                    <ShoppingCart
                        cartItems={cartItems}
                        onUpdateQuantity={updateQuantity}
                        onRemoveItem={removeFromCart}
                        onClearCart={clearCart}
                        onCheckout={handleCheckout}
                        totalAmount={getTotalAmount()}
                        itemCount={getItemCount()}
                        isUpdateMode={isUpdateMode}
                    />
                </div>
            </div>

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                onComplete={handleCheckoutComplete}
                cartItems={cartItems}
                totalAmount={getTotalAmount()}
                isUpdateMode={isUpdateMode}
                editingOrderId={editingOrderId}
            />

            <OrderSelector
                isOpen={isOrderSelectorOpen}
                onClose={() => setIsOrderSelectorOpen(false)}
                orders={ordersData?.orders || []}
                isLoading={ordersLoading}
                onSelectOrder={handleLoadOrder}
            />
        </div>
    );
}