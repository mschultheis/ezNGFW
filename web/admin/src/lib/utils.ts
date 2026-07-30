/**
 * General utility functions: Tailwind class merging (`cn`) and
 * shadcn-svelte component type helpers (`WithoutChild`, etc.).
 *
 * `cn()` combines `clsx` and `tailwind-merge` so conditional class names
 * are resolved without duplicate/conflicting Tailwind utilities.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Executes the cn operation for the admin frontend. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/** Type contract that defines the WithoutChild shape. */
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/** Type contract that defines the WithoutChildren shape. */
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
/** Type contract that defines the WithoutChildrenOrChild shape. */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
/** Type contract that defines the WithElementRef shape. */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
