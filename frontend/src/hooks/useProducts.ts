// hooks/useProducts.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchProducts, fetchAllProducts, fetchFilterOptions, Product } from '@/lib/api/products';

export const useProducts = (searchParams?: {
    search?: string;
    categoryNames?: string[];
    brandNames?: string[];
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: ['products', searchParams],
        queryFn: () => fetchProducts(searchParams),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useAllProducts = () => {
    return useQuery({
        queryKey: ['all-products'],
        queryFn: fetchAllProducts,
        staleTime: 5 * 60 * 1000,
    });
};

export const useFilterOptions = () => {
    return useQuery({
        queryKey: ['filter-options'],
        queryFn: fetchFilterOptions,
        staleTime: 30 * 60 * 1000, // 30 minutes
    });
};

export const useInfiniteProducts = (searchParams?: {
    search?: string;
    categoryNames?: string[];
    brandNames?: string[];
    minPrice?: number;
    maxPrice?: number;
}) => {
    return useInfiniteQuery({
        queryKey: ['infinite-products', searchParams],
        queryFn: ({ pageParam = 1 }) => fetchProducts({ ...searchParams, page: pageParam, limit: 20 }),
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.totalPages) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
    });
};