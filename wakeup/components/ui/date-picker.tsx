'use client'

import * as React from "react"
// Temporarily disabled until calendar component is available
// import { format } from "date-fns"
// import { Calendar as CalendarIcon } from "lucide-react"
// import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
// import { Calendar } from "@/components/ui/calendar"
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "日付を選択",
  className
}: DatePickerProps) {
  // Temporary fallback component until calendar is available
  return (
    <input
      type="date"
      value={date ? date.toISOString().split('T')[0] : ''}
      onChange={(e) => onDateChange?.(e.target.value ? new Date(e.target.value) : undefined)}
      placeholder={placeholder}
      className={`border rounded px-3 py-2 ${className || ''}`}
    />
  )
}