// app/inventory/page.tsx
"use client";

import { useState } from "react";
import InventoryMovementsTable from "@/components/inventory/InventoryMovementsTable";
import CreateMovementModal from "@/components/inventory/CreateMovementModal";

export default function InventoryPage() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Gestion des stocks
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Suivez et gérez tous les mouvements de stock
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nouveau mouvement
                    </button>
                </div>

                <InventoryMovementsTable />

                <CreateMovementModal
                    open={isCreateModalOpen}
                    onOpenChange={setIsCreateModalOpen}
                    onSuccess={() => {
                        // Rafraîchir les données du tableau
                    }}
                />
            </div>
        </div>
    );
}