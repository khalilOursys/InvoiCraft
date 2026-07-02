// components/inventory/CreateMovementModal.tsx
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Toast from "@radix-ui/react-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Select from "react-select";

type Product = {
    id: number;
    name: string;
    reference: string;
    stock: number;
};

const fetchProducts = async (): Promise<Product[]> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products?limit=100`);
    if (!res.ok) throw new Error("Failed to fetch products");
    const data = await res.json();
    return data || [];
};

const createMovement = async (data: any) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}inventory/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create movement");
    return res.json();
};

interface CreateMovementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export default function CreateMovementModal({ open, onOpenChange, onSuccess }: CreateMovementModalProps) {
    const queryClient = useQueryClient();
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [formData, setFormData] = useState({
        productId: null as number | null,
        type: "INBOUND",
        quantity: 0,
        reason: "",
        notes: "",
        reference: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: products = [] } = useQuery({
        queryKey: ["products"],
        queryFn: fetchProducts,
    });

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setToastOpen(true);
    };

    const productOptions = products.map((p: Product) => ({
        value: p.id,
        label: `${p.name} (${p.reference || "No ref"}) - Stock: ${p.stock}`,
    }));

    const movementTypes = [
        { value: "INBOUND", label: "📦 Inbound - Stock Received" },
        { value: "OUTBOUND", label: "🚚 Outbound - Stock Sold/Used" },
        { value: "ADJUSTMENT", label: "⚙️ Adjustment - Manual Change" },
        { value: "RETURN", label: "🔄 Return - From Customer" },
        { value: "LOSS", label: "⚠️ Loss - Damaged/Missing" },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.productId) {
            showToast("Please select a product");
            return;
        }

        if (formData.quantity <= 0) {
            showToast("Quantity must be greater than 0");
            return;
        }

        if (!formData.reason) {
            showToast("Please provide a reason");
            return;
        }

        setIsSubmitting(true);

        try {
            await createMovement(formData);
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            showToast("✅ Movement created successfully");
            setFormData({
                productId: null,
                type: "INBOUND",
                quantity: 0,
                reason: "",
                notes: "",
                reference: "",
            });
            onSuccess?.();
            onOpenChange(false);
        } catch (err) {
            showToast("❌ Failed to create movement");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Dialog.Root open={open} onOpenChange={onOpenChange}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 w-[500px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                        <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                            Create Stock Movement
                        </Dialog.Title>

                        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Product *
                                </label>
                                <Select
                                    options={productOptions}
                                    onChange={(option: any) => setFormData({ ...formData, productId: option?.value })}
                                    placeholder="Search for a product..."
                                    isClearable
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    theme={(theme) => ({
                                        ...theme,
                                        colors: {
                                            ...theme.colors,
                                            primary: "#3b82f6",
                                            primary75: "#60a5fa",
                                            primary50: "#93c5fd",
                                            primary25: "#bfdbfe",
                                        },
                                    })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Movement Type *
                                </label>
                                <Select
                                    options={movementTypes}
                                    onChange={(option: any) => setFormData({ ...formData, type: option?.value })}
                                    defaultValue={movementTypes[0]}
                                    theme={(theme) => ({
                                        ...theme,
                                        colors: {
                                            ...theme.colors,
                                            primary: "#3b82f6",
                                        },
                                    })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Quantity *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Reason *
                                </label>
                                <input
                                    type="text"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Why is this movement happening?"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Reference (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="PO #, Invoice #, Order #, etc."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Additional details..."
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? "Creating..." : "Create Movement"}
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            <Toast.Provider swipeDirection="right">
                <Toast.Root
                    open={toastOpen}
                    onOpenChange={setToastOpen}
                    className="bg-gray-900 dark:bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg"
                >
                    <Toast.Title className="font-bold">{toastMsg}</Toast.Title>
                </Toast.Root>
                <Toast.Viewport className="fixed top-4 right-4 w-96 max-w-full outline-none z-50" />
            </Toast.Provider>
        </>
    );
}