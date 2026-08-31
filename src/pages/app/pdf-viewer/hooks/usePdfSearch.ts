import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { PDFSearchResult } from '../types';

interface UsePdfSearchOptions {
  pdf: any;
  numPages: number;
  onJumpToPage: (pageNumber: number) => void;
}

export function usePdfSearch({ pdf, numPages, onJumpToPage }: UsePdfSearchOptions) {
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PDFSearchResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !pdf) {
        setSearchResults([]);
        setCurrentMatchIndex(-1);
        return;
      }

      const matches: PDFSearchResult[] = [];
      const cleanQuery = query.toLowerCase().trim();

      try {
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .toLowerCase();

          if (pageText.includes(cleanQuery)) {
            let count = 0;
            let pos = pageText.indexOf(cleanQuery);
            while (pos !== -1) {
              count++;
              pos = pageText.indexOf(cleanQuery, pos + cleanQuery.length);
            }

            for (let c = 0; c < count; c++) {
              matches.push({ pageNumber: i, index: matches.length });
            }
          }
        }

        setSearchResults(matches);
        if (matches.length > 0) {
          setCurrentMatchIndex(0);
          onJumpToPage(matches[0].pageNumber);
        } else {
          setCurrentMatchIndex(-1);
          toast.error('No matches found');
        }
      } catch (err) {
        console.error('[PDFViewer] Search error:', err);
      }
    },
    [pdf, numPages, onJumpToPage]
  );

  // Debounced search trigger (300ms)
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setCurrentMatchIndex(-1);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSearchNext = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    onJumpToPage(searchResults[nextIdx].pageNumber);
  }, [searchResults, currentMatchIndex, onJumpToPage]);

  const handleSearchPrev = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    onJumpToPage(searchResults[prevIdx].pageNumber);
  }, [searchResults, currentMatchIndex, onJumpToPage]);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentMatchIndex(-1);
  }, []);

  return {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    currentMatchIndex,
    handleSearchNext,
    handleSearchPrev,
    handleCloseSearch,
  };
}
