import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a compact page-number sequence with ellipses for pagination footers. */
export function getVisiblePages(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [1];
  if (currentPage <= 3) {
    for (let i = 2; i <= Math.min(4, totalPages - 1); i++) {
      pages.push(i);
    }
    if (totalPages > 4) {
      pages.push("...");
    }
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push("...");
    const start = Math.max(2, totalPages - 2);
    for (let i = start; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push("...");
    pages.push(currentPage - 1);
    pages.push(currentPage);
    pages.push(currentPage + 1);
    pages.push("...");
    pages.push(totalPages);
  }
  return pages;
}
