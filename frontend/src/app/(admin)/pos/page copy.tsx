'use client';

import { useState } from 'react';
import ProductGrid from '@/components/pos/ProductGrid';
import ShoppingCart from '@/components/pos/ShoppingCart';
import CheckoutModal from '@/components/pos/CheckoutModal';

export interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
    image: string; // This will now be an image URL
    stock: number;
}

export interface CartItem extends Product {
    quantity: number;
}

const sampleProducts: Product[] = [
    { id: 1, name: 'Espresso', price: 3.50, category: 'Coffee', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=150&h=150&fit=crop', stock: 50 },
    { id: 2, name: 'Latte', price: 4.50, category: 'Coffee', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=150&h=150&fit=crop', stock: 45 },
    { id: 3, name: 'Cappuccino', price: 4.00, category: 'Coffee', image: 'https://images.unsplash.com/photo-1534778101976-62847782c5ce?w=150&h=150&fit=crop', stock: 40 },
    { id: 4, name: 'Americano', price: 3.00, category: 'Coffee', image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=150&h=150&fit=crop', stock: 55 },
    { id: 5, name: 'Croissant', price: 2.50, category: 'Pastry', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=150&h=150&fit=crop', stock: 30 },
    { id: 6, name: 'Danish Pastry', price: 3.00, category: 'Pastry', image: 'https://images.unsplash.com/photo-1571327073757-71c13c5de30d?w=150&h=150&fit=crop', stock: 25 },
    { id: 7, name: 'Chocolate Cake', price: 5.00, category: 'Dessert', image: 'https://images.unsplash.com/photo-1578985545062-69928b1b9582?w=150&h=150&fit=crop', stock: 20 },
    { id: 8, name: 'Cheesecake', price: 5.50, category: 'Dessert', image: 'https://images.unsplash.com/photo-1524351199678-882a83a5f6f9?w=150&h=150&fit=crop', stock: 18 },
    { id: 9, name: 'Green Tea', price: 3.00, category: 'Tea', image: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=150&h=150&fit=crop', stock: 35 },
    { id: 10, name: 'Black Tea', price: 2.50, category: 'Tea', image: 'https://images.unsplash.com/photo-1597481499750-3e6b8b4f6dfd?w=150&h=150&fit=crop', stock: 40 },
    { id: 11, name: 'Orange Juice', price: 4.00, category: 'Beverage', image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=150&h=150&fit=crop', stock: 30 },
    { id: 12, name: 'Iced Coffee', price: 4.50, category: 'Coffee', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=150&h=150&fit=crop', stock: 35 },
];

// Rest of the component remains the same...
export default function POSPage() {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    const categories = ['All', 'Coffee', 'Tea', 'Pastry', 'Dessert', 'Beverage'];

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

    const handleCheckoutComplete = () => {
        clearCart();
        setIsCheckoutOpen(false);
    };

    const filteredProducts = sampleProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex h-screen">
                {/* Products Section */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <h1 className="text-2xl font-semibold text-gray-800">Point of Sale</h1>
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
                        <ProductGrid products={filteredProducts} onAddToCart={addToCart} />
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
                    />
                </div>
            </div>

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                onComplete={handleCheckoutComplete}
                cartItems={cartItems}
                totalAmount={getTotalAmount()}
            />
        </div>
    );
}