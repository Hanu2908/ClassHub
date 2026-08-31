export interface PageLayout {
  pageNumber: number;
  width: number;
  height: number;
  offsetTop: number;
}

export type PDFDisplayMode = 'original' | 'dark' | 'sepia';

export interface PDFSearchResult {
  pageNumber: number;
  index: number;
}

export interface PDFPageContainerProps {
  pageLayout: PageLayout;
  pdf: any;
  scale: number;
  renderScale: number;
  containerWidth: number;
  isFastScrolling: boolean;
  isInRange: boolean;
  isInCacheBuffer: boolean;
  searchQuery: string;
  displayMode: PDFDisplayMode;
  rotation: number;
}

export interface PDFHeaderBarProps {
  title: string;
  range?: string;
  displayMode: PDFDisplayMode;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onShare: () => void;
  onDownload: () => void;
  onSelectDisplayMode: (mode: PDFDisplayMode) => void;
  onRotateClockwise: () => void;
  onResetZoom: () => void;
  onBack: () => void;
}

export interface PDFSearchBarProps {
  searchQuery: string;
  searchResults: PDFSearchResult[];
  currentMatchIndex: number;
  onSearchChange: (query: string) => void;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  onClose: () => void;
}

export interface PDFPagePillProps {
  activePageNum: number;
  numPages: number;
  pageInputValue: string;
  onPageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPageInputBlur: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export interface PDFZoomFooterProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
