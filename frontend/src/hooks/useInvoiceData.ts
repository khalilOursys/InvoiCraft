"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { log } from "console";

export const notify = (type: number, msg: string) => {
  console.log(type === 1 ? "Success:" : "Error:", msg);
};

export const useInvoiceData = (invoiceType: string, isUpdate: boolean = false) => {
  const router = useRouter();

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  // State
  const [date, setDate] = useState(dateString);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedCities, setSelectedCities] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [totalHT, setTotalHT] = useState(0);
  const [totalTTC, setTotalTTC] = useState(0);
  const [totalVAT, setTotalVAT] = useState(0);
  const [type, setType] = useState(invoiceType);
  const [status, setStatus] = useState("DRAFT");
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([]);
  const [shippingNoteInvoices, setShippingNoteInvoices] = useState<any[]>([]);
  const [selectedShippingNote, setSelectedShippingNote] = useState<any>(null);
  const [shippingNoteProducts, setShippingNoteProducts] = useState<any[]>([]);
  const [loadingDeliveryNotes, setLoadingDeliveryNotes] = useState(false);
  const [loadingShippingNotes, setLoadingShippingNotes] = useState(false);
  const [originalShippingNoteId, setOriginalShippingNoteId] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [generatingNumber, setGeneratingNumber] = useState(false);

  // Fetch master data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productRes, driverRes, citiesRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}products`).then(res => res.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}driver`).then(res => res.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}cities`).then(res => res.json()),
        ]);
        setProducts(productRes || []);
        setDrivers(driverRes || []);
        setCities(citiesRes || []);
      } catch (error) {
        console.error("Error fetching master data:", error);
        notify(2, "Erreur lors du chargement des données");
      }
    };
    fetchData();
  }, []);

  const calculateTotals = useCallback(() => {
    let ht = 0;
    let vat = 0;
    let ttc = 0;

    invoiceItems.forEach((item) => {
      const itemHT = (item.price || 0) * (item.quantity || 0);
      const itemVAT = itemHT * ((item.vatRate || 0) / 100);
      const itemTTC = itemHT + itemVAT;

      ht += itemHT;
      vat += itemVAT;
      ttc += itemTTC;
    });

    setTotalHT(ht);
    setTotalVAT(vat);
    setTotalTTC(ttc);
  }, [invoiceItems]);

  // Auto-generate invoice number
  const autoGenerateNumber = useCallback(async () => {
    if (isUpdate) return;
    
    setGeneratingNumber(true);
    console.log(type);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}sale-invoices/generate-number/${type}`);
      const data = await response.json();
      if (data.nextInvoiceNumber) {
        setInvoiceNumber(data.nextInvoiceNumber);
        notify(1, "Numéro de facture généré automatiquement");
      } else {
        notify(2, "Erreur lors de la génération du numéro");
      }
    } catch (error) {
      console.error("Error generating invoice number:", error);
      notify(2, "Erreur lors de la génération du numéro");
    } finally {
      setGeneratingNumber(false);
    }
  }, [type, isUpdate]);

  useEffect(() => {
    if (!isUpdate && !invoiceNumber) {
      autoGenerateNumber();
    }
  }, [isUpdate, autoGenerateNumber, invoiceNumber]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  return {
    date, setDate,
    startDate, setStartDate,
    endDate, setEndDate,
    invoiceItems, setInvoiceItems,
    invoiceNumber, setInvoiceNumber,
    products, setProducts,
    clients, setClients,
    drivers, setDrivers,
    cities, setCities,
    selectedCities, setSelectedCities,
    client, setClient,
    driver, setDriver,
    totalHT, setTotalHT,
    totalTTC, setTotalTTC,
    totalVAT, setTotalVAT,
    type, setType,
    status, setStatus,
    deliveryNotes, setDeliveryNotes,
    shippingNoteInvoices, setShippingNoteInvoices,
    selectedShippingNote, setSelectedShippingNote,
    shippingNoteProducts, setShippingNoteProducts,
    loadingDeliveryNotes, setLoadingDeliveryNotes,
    loadingShippingNotes, setLoadingShippingNotes,
    originalShippingNoteId, setOriginalShippingNoteId,
    invoice, setInvoice,
    autoGenerateNumber,
    generatingNumber,
    id: null,
    dispatch: null,
    navigate: router,
    calculateTotals,
    notify,
  };
};