'use client';

import { Product } from '@/app/(admin)/pos/page';
import Image from 'next/image';

interface ProductGridProps {
    products: Product[];
    onAddToCart: (product: Product) => void;
}

export default function ProductGrid({ products, onAddToCart }: ProductGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
                <div
                    key={product.id}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => onAddToCart(product)}
                >
                    <div className="relative w-full h-40">
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-t-lg"
                        />

                    </div>
                    <div className="p-4">
                        <h3 className="font-semibold text-gray-800">{product.name}</h3>
                        <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-blue-600">
                                ${product.price.toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-400">Stock: {product.stock}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}