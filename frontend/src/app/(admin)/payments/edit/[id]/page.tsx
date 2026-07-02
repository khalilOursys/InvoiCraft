// src/app/payments/edit/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PaymentForm } from "@/components/payments/PaymentForm";

// ✅ Updated Payment interface with full invoice objects
interface Payment {
  id: number;
  amount: number;
  method: string;
  invoiceNumber: string;
  purchaseInvoiceId?: number;
  saleInvoiceId?: number;
  supplierId?: number;
  clientId?: number;
  purchaseInvoice?: {
    id: number;
    invoiceNumber: string;
  };
  saleInvoice?: {
    id: number;
    invoiceNumber: string;
  };
  supplier?: {
    id: number;
    name: string;
  };
  client?: {
    id: number;
    name: string;
  };
}

const fetchPayment = async (id: string): Promise<Payment> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}payments/${id}`
  );
  if (!response.ok) throw new Error("Failed to fetch payment");
  return response.json();
};

const updatePayment = async ({ id, data }: { id: string; data: any }) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}payments/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update payment");
  }
  return response.json();
};

export default function EditPaymentPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();

  const [initialData, setInitialData] = useState<any>(null);

  const { data: payment, isLoading: isLoadingPayment } = useQuery({
    queryKey: ["payment", id],
    queryFn: () => fetchPayment(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (payment) {
      const isPurchase = !!payment.purchaseInvoiceId;

      // ✅ Get invoice number from the full invoice object
      let invoiceNumber = "";
      if (isPurchase && payment.purchaseInvoice) {
        invoiceNumber = payment.purchaseInvoice.invoiceNumber;
      } else if (!isPurchase && payment.saleInvoice) {
        invoiceNumber = payment.saleInvoice.invoiceNumber;
      }

      console.log("Invoice Number:", invoiceNumber); // ✅ Now you have the invoice number

      setInitialData({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        invoiceNumber: invoiceNumber, // ✅ Pass invoice number to form
        paymentType: isPurchase ? "purchase" : "sale",
        invoiceId: isPurchase
          ? payment.purchaseInvoiceId
          : payment.saleInvoiceId,
        entityId: isPurchase ? payment.supplierId : payment.clientId,
      });
    }
  }, [payment]);

  const mutation = useMutation({
    mutationFn: ({ data }: { data: any }) => updatePayment({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
    },
  });

  if (isLoadingPayment || !initialData) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Modifier le paiement" />
      <PaymentForm
        initialData={initialData}
        isEditing={true}
        onSubmit={async (data) => {
          await mutation.mutateAsync({ data });
        }}
        isLoading={mutation.isPending}
      />
    </div>
  );
}