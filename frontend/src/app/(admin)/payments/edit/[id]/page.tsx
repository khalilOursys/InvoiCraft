// src/app/payments/edit/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PaymentForm } from "@/components/payments/PaymentForm";

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
  receiptFile?: string;
  receiptFileName?: string;
  // CHECK specific fields
  checkDate?: string;
  checkBank?: string;
  checkNumber?: string;
  // TRAIT specific fields
  traitDate?: string;
  traitNumber?: string;
}

const fetchPayment = async (id: string): Promise<Payment> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}payments/${id}`
  );
  if (!response.ok) throw new Error("Failed to fetch payment");
  return response.json();
};

const updatePayment = async ({ id, data }: { id: string; data: any }) => {
  // Check if we're sending FormData (for file upload)
  const isFormData = data instanceof FormData;

  // If it's FormData, remove any association fields that shouldn't be updated
  if (isFormData) {
    // We can't delete from FormData easily, so we need to handle this differently
    // Actually, we'll let the service handle it, but we won't send association fields
    // The form should not include these fields in edit mode
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}payments/${id}`,
    {
      method: "PUT",
      body: isFormData ? data : JSON.stringify(data),
      ...(isFormData ? {} : {
        headers: {
          "Content-Type": "application/json",
        },
      }),
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

      let invoiceNumber = "";
      if (isPurchase && payment.purchaseInvoice) {
        invoiceNumber = payment.purchaseInvoice.invoiceNumber;
      } else if (!isPurchase && payment.saleInvoice) {
        invoiceNumber = payment.saleInvoice.invoiceNumber;
      }

      // Format dates for input fields (YYYY-MM-DD)
      const formatDate = (dateString?: string) => {
        if (!dateString) return "";
        try {
          const date = new Date(dateString);
          return date.toISOString().split('T')[0];
        } catch {
          return "";
        }
      };

      setInitialData({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        invoiceNumber: invoiceNumber,
        paymentType: isPurchase ? "purchase" : "sale",
        invoiceId: isPurchase
          ? payment.purchaseInvoiceId
          : payment.saleInvoiceId,
        entityId: isPurchase ? payment.supplierId : payment.clientId,
        receiptFile: payment.receiptFile,
        receiptFileName: payment.receiptFileName,
        // CHECK fields
        checkDate: formatDate(payment.checkDate),
        checkBank: payment.checkBank || "",
        checkNumber: payment.checkNumber || "",
        // TRAIT fields
        traitDate: formatDate(payment.traitDate),
        traitNumber: payment.traitNumber || "",
      });
    }
  }, [payment]);

  const mutation = useMutation({
    mutationFn: ({ data }: { data: any }) => {
      // Remove association fields from update data
      // These should not be sent in the update request
      const updateData = { ...data };

      // Remove association fields that shouldn't be updated
      delete updateData.purchaseInvoiceId;
      delete updateData.saleInvoiceId;
      delete updateData.supplierId;
      delete updateData.clientId;
      delete updateData.paymentType;
      delete updateData.invoiceId;
      delete updateData.entityId;
      delete updateData.invoiceNumber;
      delete updateData.remainingBalance;
      delete updateData.id;

      // If it's FormData (file upload), we need to handle it differently
      // because we can't delete from FormData
      if (updateData instanceof FormData) {
        // Create a new FormData without the association fields
        const newFormData = new FormData();
        for (const [key, value] of updateData.entries()) {
          // Skip association fields
          if (!['purchaseInvoiceId', 'saleInvoiceId', 'supplierId', 'clientId', 'paymentType', 'invoiceId', 'entityId', 'invoiceNumber', 'remainingBalance', 'id'].includes(key)) {
            newFormData.append(key, value);
          }
        }
        return updatePayment({ id, data: newFormData });
      }

      return updatePayment({ id, data: updateData });
    },
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