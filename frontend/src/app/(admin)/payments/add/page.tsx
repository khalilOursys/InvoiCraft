// src/app/payments/add/page.tsx
import { Suspense } from "react";
import AddPaymentClient from "./AddPaymentClient";

// Validate the type parameter
function validateInvoiceType(type: string | undefined): "purchase" | "sale" | undefined {
  if (type === "purchase" || type === "sale") {
    return type;
  }
  return undefined;
}

export default async function AddPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; clientId?: string; type?: string }>;
}) {
  const params = await searchParams;

  const supplierId = params.supplierId || undefined;
  const clientId = params.clientId || undefined;
  const invoiceType = validateInvoiceType(params.type);

  return (
    <Suspense fallback={
      <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Chargement...</div>
        </div>
      </div>
    }>
      <AddPaymentClient
        supplierId={supplierId}
        clientId={clientId}
        invoiceType={invoiceType}
      />
    </Suspense>
  );
}