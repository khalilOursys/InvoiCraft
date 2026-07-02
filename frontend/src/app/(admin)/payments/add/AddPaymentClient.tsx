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
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}payments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
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