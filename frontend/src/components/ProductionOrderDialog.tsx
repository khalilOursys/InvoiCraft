// components/ProductionOrderDialog.tsx
import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Toast from "@radix-ui/react-toast";
import { X, Plus, Trash2, Package, AlertCircle } from "lucide-react";

type Material = {
    id: number;
    name: string;
    unit: string;
    amount: number;
    purchasePrice: number;
};

type Service = {
    id: number;
    name: string;
    price: number;
    description?: string;
};

type CraftProduct = {
    id: number;
    name: string;
    unit: string;
    amount: number;
    totalCost: number;
    salePrice: number;
    craftMaterials: {
        id: number;
        amount: number;
        rawMaterial: Material;
    }[];
    craftServices: {
        id: number;
        service: Service;
    }[];
};

type ProductionOrderData = {
    unit: string;
    amount: number;
    productId: number;
    marginPercent: number;
    vat: number;
    materials: { rawMaterialId: number; amount: number }[];
    serviceIds: number[];
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    notes?: string;
    expectedDelivery?: Date;
};

interface ProductionOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId: number;
    productName: string;
    onSuccess?: () => void;
}

export default function ProductionOrderDialog({
    open,
    onOpenChange,
    productId,
    productName,
    onSuccess,
}: ProductionOrderDialogProps) {
    const [craftProducts, setCraftProducts] = useState<CraftProduct[]>([]);
    const [selectedCraftProduct, setSelectedCraftProduct] =
        useState<CraftProduct | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");

    // Production Order Form State
    const [formData, setFormData] = useState<Partial<ProductionOrderData>>({
        amount: 1,
        marginPercent: 30,
        vat: 19,
        priority: "MEDIUM",
        materials: [],
        serviceIds: [],
    });

    // Custom quantity inputs for materials
    const [materialQuantities, setMaterialQuantities] = useState<{
        [key: number]: number;
    }>({});

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg(msg);
        setToastType(type);
        setToastOpen(true);
    };

    // Fetch craft products for this product
    useEffect(() => {
        if (open && productId) {
            fetchCraftProducts();
        }
    }, [open, productId]);

    const fetchCraftProducts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}craft-products/product/${productId}`
            );
            if (!res.ok) throw new Error("Failed to fetch craft products");
            const data = await res.json();
            setCraftProducts(data);

            // Auto-select first craft product if available
            if (data.length > 0) {
                setSelectedCraftProduct(data[0]);
                // Initialize material quantities
                const quantities: { [key: number]: number } = {};
                data[0].craftMaterials.forEach((m) => {
                    quantities[m.rawMaterial.id] = m.amount;
                });
                setMaterialQuantities(quantities);

                // Set form data with materials and services from craft product
                setFormData((prev) => ({
                    ...prev,
                    unit: data[0].unit,
                    materials: data[0].craftMaterials.map((m) => ({
                        rawMaterialId: m.rawMaterial.id,
                        amount: m.amount,
                    })),
                    serviceIds: data[0].craftServices.map((s) => s.service.id),
                }));
            }
        } catch (error) {
            showToast("Failed to load craft products", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCraftProductSelect = (craftProduct: CraftProduct) => {
        setSelectedCraftProduct(craftProduct);

        // Update material quantities
        const quantities: { [key: number]: number } = {};
        craftProduct.craftMaterials.forEach((m) => {
            quantities[m.rawMaterial.id] = m.amount;
        });
        setMaterialQuantities(quantities);

        setFormData({
            ...formData,
            unit: craftProduct.unit,
            materials: craftProduct.craftMaterials.map((m) => ({
                rawMaterialId: m.rawMaterial.id,
                amount: m.amount,
            })),
            serviceIds: craftProduct.craftServices.map((s) => s.service.id),
        });
    };

    const handleMaterialQuantityChange = (
        materialId: number,
        value: number
    ) => {
        setMaterialQuantities((prev) => ({
            ...prev,
            [materialId]: value,
        }));

        // Update form data materials with new quantity
        setFormData((prev) => ({
            ...prev,
            materials: prev.materials?.map((m) =>
                m.rawMaterialId === materialId ? { ...m, amount: value } : m
            ) || [],
        }));
    };

    const handleSubmit = async () => {
        if (!selectedCraftProduct) {
            showToast("Please select a craft product first", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                productId,
                amount: formData.amount || 1,
                // Ensure materials have updated quantities
                materials: Object.entries(materialQuantities).map(
                    ([rawMaterialId, amount]) => ({
                        rawMaterialId: parseInt(rawMaterialId),
                        amount,
                    })
                ),
            };

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}production-orders`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create production order");
            }

            showToast(
                `✅ Production order created for ${productName} successfully!`,
                "success"
            );
            onOpenChange(false);
            if (onSuccess) onSuccess();

            // Reset form
            setFormData({
                amount: 1,
                marginPercent: 30,
                vat: 19,
                priority: "MEDIUM",
                materials: [],
                serviceIds: [],
            });
            setMaterialQuantities({});
        } catch (error: any) {
            showToast(
                error.message || "❌ Failed to create production order",
                "error"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Dialog.Root open={open} onOpenChange={onOpenChange}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-3xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                            <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                                Create Production Order
                            </Dialog.Title>
                            <Dialog.Close className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </Dialog.Close>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : craftProducts.length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                    <p className="text-gray-600 dark:text-gray-400">
                                        No craft products found for this product.
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                        Please create a craft product first.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Craft Product Selection */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Select Craft Product
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {craftProducts.map((cp) => (
                                                <button
                                                    key={cp.id}
                                                    onClick={() => handleCraftProductSelect(cp)}
                                                    className={`p-3 text-left border rounded-lg transition-colors ${selectedCraftProduct?.id === cp.id
                                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                        }`}
                                                >
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {cp.name || `Craft #${cp.id}`}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        Unit: {cp.unit} | Stock: {cp.amount}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedCraftProduct && (
                                        <>
                                            {/* Materials */}
                                            <div className="mb-6">
                                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                    Materials
                                                </h3>
                                                <div className="space-y-2">
                                                    {selectedCraftProduct.craftMaterials.map((m) => (
                                                        <div
                                                            key={m.id}
                                                            className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                                        >
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-900 dark:text-white">
                                                                    {m.rawMaterial.name}
                                                                </div>
                                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Unit: {m.rawMaterial.unit} | Available:{" "}
                                                                    {m.rawMaterial.amount}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-sm text-gray-600 dark:text-gray-400">
                                                                    Qty:
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={materialQuantities[m.rawMaterial.id] || 0}
                                                                    onChange={(e) =>
                                                                        handleMaterialQuantityChange(
                                                                            m.rawMaterial.id,
                                                                            parseFloat(e.target.value) || 0
                                                                        )
                                                                    }
                                                                    className="w-20 px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                                />
                                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                                    {m.rawMaterial.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Services */}
                                            {selectedCraftProduct.craftServices.length > 0 && (
                                                <div className="mb-6">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        Services
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {selectedCraftProduct.craftServices.map((s) => (
                                                            <div
                                                                key={s.id}
                                                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                                            >
                                                                <div>
                                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                                        {s.service.name}
                                                                    </div>
                                                                    {s.service.description && (
                                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                            {s.service.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {s.service.price} DT
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Order Details */}
                                            <div className="border-t dark:border-gray-700 pt-4">
                                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                    Order Details
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                            Quantity to Produce
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={formData.amount || 1}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    amount: parseFloat(e.target.value) || 0,
                                                                })
                                                            }
                                                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                            Margin %
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={formData.marginPercent || 30}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    marginPercent: parseFloat(e.target.value) || 0,
                                                                })
                                                            }
                                                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                            VAT %
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={formData.vat || 19}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    vat: parseFloat(e.target.value) || 0,
                                                                })
                                                            }
                                                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                            Priority
                                                        </label>
                                                        <select
                                                            value={formData.priority || "MEDIUM"}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    priority: e.target.value as
                                                                        | "LOW"
                                                                        | "MEDIUM"
                                                                        | "HIGH"
                                                                        | "URGENT",
                                                                })
                                                            }
                                                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        >
                                                            <option value="LOW">Low</option>
                                                            <option value="MEDIUM">Medium</option>
                                                            <option value="HIGH">High</option>
                                                            <option value="URGENT">Urgent</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                        Notes (Optional)
                                                    </label>
                                                    <textarea
                                                        value={formData.notes || ""}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                notes: e.target.value,
                                                            })
                                                        }
                                                        rows={2}
                                                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        placeholder="Add any notes about this production order..."
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
                            <button
                                onClick={() => onOpenChange(false)}
                                className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !selectedCraftProduct}
                                className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                        Creating...
                                    </>
                                ) : (
                                    "Create Order"
                                )}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Toast */}
            <Toast.Provider swipeDirection="right">
                <Toast.Root
                    open={toastOpen}
                    onOpenChange={setToastOpen}
                    className={`fixed bottom-4 right-4 px-4 py-3 rounded-md shadow-lg z-50 max-w-md ${toastType === "success"
                            ? "bg-green-600 dark:bg-green-700"
                            : "bg-red-600 dark:bg-red-700"
                        } text-white`}
                >
                    <Toast.Title className="font-medium">{toastMsg}</Toast.Title>
                </Toast.Root>
                <Toast.Viewport className="fixed bottom-0 right-0 p-4 z-50" />
            </Toast.Provider>
        </>
    );
}