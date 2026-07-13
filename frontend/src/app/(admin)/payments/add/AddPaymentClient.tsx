// src/app/payments/add/AddPaymentClient.tsx
"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PaymentForm } from "@/components/payments/PaymentForm";

interface AddPaymentClientProps {
    supplierId?: string;
    clientId?: string;
    invoiceType?: "purchase" | "sale";
}

const addPayment = async (paymentData: any) => {
    // Check if we're sending FormData (for file upload)
    const isFormData = paymentData instanceof FormData;

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}payments`, {
        method: "POST",
        body: isFormData ? paymentData : JSON.stringify(paymentData),
        // Don't set Content-Type for FormData - browser will set it with boundary
        ...(isFormData ? {} : {
            headers: {
                "Content-Type": "application/json",
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create payment");
    }
    return response.json();
};

export default function AddPaymentClient({
    supplierId,
    clientId,
    invoiceType
}: AddPaymentClientProps) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: addPayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payments"] });
        },
    });

    return (
        <div>
            <PageBreadcrumb pageTitle="Ajouter un paiement" />
            <PaymentForm
                isEditing={false}
                supplierId={supplierId}
                clientId={clientId}
                invoiceType={invoiceType}
                onSubmit={mutation.mutateAsync}
                isLoading={mutation.isPending}
            />
        </div>
    );
}