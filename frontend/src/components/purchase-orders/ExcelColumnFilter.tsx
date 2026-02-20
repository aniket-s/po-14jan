'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TextFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextFilter({ value, onChange, placeholder }: TextFilterProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (val: string) => {
    setLocalValue(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), 300);
  };

  return (
    <Input
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder ?? 'Filter...'}
      className="h-7 text-xs"
    />
  );
}

interface SelectFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export function SelectFilter({ value, onChange, options, placeholder }: SelectFilterProps) {
  return (
    <Select value={value || '__all__'} onValueChange={(v) => onChange(v === '__all__' ? '' : v)}>
      <SelectTrigger className="h-7 text-xs">
        <SelectValue placeholder={placeholder ?? 'All'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-1">
      <Input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-7 text-xs"
        placeholder="From"
      />
      <Input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="h-7 text-xs"
        placeholder="To"
      />
    </div>
  );
}
