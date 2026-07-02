// components/providers/ToastProvider.tsx
'use client';

import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { useState, createContext, useContext } from 'react';

interface ToastContextType {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'success' | 'error' | 'info'>('success');

    const showToast = (msg: string, toastType: 'success' | 'error' | 'info' = 'success') => {
        setMessage(msg);
        setType(toastType);
        setOpen(true);
    };

    const getToastStyles = () => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'info':
                return 'bg-blue-50 border-blue-200 text-blue-800';
            default:
                return 'bg-gray-50 border-gray-200 text-gray-800';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            <Toast.Provider swipeDirection="right">
                {children}
                <Toast.Root
                    open={open}
                    onOpenChange={setOpen}
                    className={`fixed bottom-4 right-4 z-50 rounded-lg border p-4 shadow-lg ${getToastStyles()}`}
                    duration={3000}
                >
                    <div className="flex items-center gap-3">
                        <Toast.Description className="text-sm font-medium">
                            {message}
                        </Toast.Description>
                        <Toast.Close asChild>
                            <button className="ml-auto hover:opacity-70">
                                <X className="h-4 w-4" />
                            </button>
                        </Toast.Close>
                    </div>
                </Toast.Root>
                <Toast.Viewport />
            </Toast.Provider>
        </ToastContext.Provider>
    );
}