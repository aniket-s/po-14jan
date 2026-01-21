'use client';

import * as React from 'react';
import { X, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ComboboxOption {
  label: string;
  value: string | number;
  description?: string;
  searchTerms?: string[];
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | number | null;
  onChange: (value: string | number | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select item...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found.',
  className,
  disabled = false,
  clearable = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus search input when popover opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      // Small delay to ensure popover is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(undefined);
  };

  const handleSelect = (selectedValue: string | number) => {
    onChange(selectedValue === value ? undefined : selectedValue);
    setOpen(false);
    setSearch('');
  };

  const filteredOptions = options.filter((option) => {
    if (search === '') return true;

    const searchLower = search.toLowerCase();

    // Search in label
    if (option.label.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search in description
    if (option.description?.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search in custom search terms
    if (option.searchTerms?.some(term =>
      term.toLowerCase().includes(searchLower)
    )) {
      return true;
    }

    return false;
  });

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            className,
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
        >
          <span className={cn(
            "truncate",
            !selectedOption && "text-muted-foreground"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && selectedOption && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                className="ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 inline-flex items-center cursor-pointer hover:bg-accent p-0.5"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleClear(e as any);
                  }
                }}
                onClick={handleClear}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </div>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <div className="p-2 border-b">
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="flex-1">{option.label}</span>
                        {isSelected && (
                          <Check className="ml-2 h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        {search && filteredOptions.length > 0 && (
          <div className="p-2 border-t text-xs text-muted-foreground text-center">
            Showing {filteredOptions.length} of {options.length} items
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
