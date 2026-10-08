"use client";
import {
  useId,
  useState,
  useRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { Search, Check, X } from "lucide-react";
import { Switch as S } from "radix-ui";
import { cn } from "@/lib/utils";
type Field = {
  label: string;
  help?: string;
  hint?: string;
  error?: string;
  success?: string;
};

function FieldHelp({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="field-help-wrap">
      <button
        type="button"
        className="field-help-button"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && <span className="field-help-popover">{text}</span>}
    </span>
  );
}
export function Input({
  label,
  help,
  hint,
  error,
  success,
  id: provided,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & Field) {
  const auto = useId();
  const id = provided ?? auto;
  const message = error ?? success ?? hint;
  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <FieldHelp text={help} />
      </div>
      <input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={message ? `${id}-message` : undefined}
        className={cn("input", !error && success && "input-success", className)}
      />
      {message && (
        <span
          id={`${id}-message`}
          className={cn(
            "field-hint",
            error && "text-error",
            !error && success && "text-success",
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}
export function SearchInput({
  label = "Search",
  value,
  defaultValue = "",
  onChange,
  onClear,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue"> & {
  label?: string;
  value?: string;
  defaultValue?: string;
  onClear?: () => void;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  const current = value ?? internal;
  return (
    <div className="search-field">
      <Search size={16} aria-hidden />
      <input
        {...props}
        ref={ref}
        value={current}
        onChange={(e) => {
          setInternal(e.target.value);
          onChange?.(e);
        }}
        type="search"
        aria-label={label}
        className={cn("input", className)}
      />
      {current && !props.disabled && (value === undefined || onClear) && (
        <button
          type="button"
          className="search-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            setInternal("");
            onClear?.();
            ref.current?.focus();
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
export function Textarea({
  label,
  help,
  hint,
  error,
  success,
  className,
  id: provided,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Field) {
  const auto = useId();
  const id = provided ?? auto;
  const message = error ?? success ?? hint;
  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <FieldHelp text={help} />
      </div>
      <textarea
        {...props}
        id={id}
        className={cn("input", !error && success && "input-success", className)}
        aria-invalid={!!error}
        aria-describedby={message ? `${id}-message` : undefined}
      />
      {message && (
        <span
          id={`${id}-message`}
          className={cn(
            "field-hint",
            error && "text-error",
            !error && success && "text-success",
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}
export function Select({
  label,
  help,
  id: provided,
  children,
  error,
  hint,
  success,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & Field) {
  const auto = useId();
  const id = provided ?? auto;
  const message = error ?? success ?? hint;
  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <FieldHelp text={help} />
      </div>
      <select
        {...props}
        id={id}
        className={cn("input", !error && success && "input-success", className)}
        aria-invalid={!!error}
        aria-describedby={message ? `${id}-message` : undefined}
      >
        {children}
      </select>
      {message && (
        <span
          id={`${id}-message`}
          className={cn(
            "field-hint",
            error && "text-error",
            !error && success && "text-success",
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}
export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="choice">
      <input {...props} type="checkbox" />
      {label}
    </label>
  );
}
export function Radio({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="choice">
      <input {...props} type="radio" />
      {label}
    </label>
  );
}
export function Switch({
  label,
  ...props
}: React.ComponentProps<typeof S.Root> & { label: string }) {
  const id = useId();
  return (
    <div className="choice">
      <S.Root {...props} id={id} className="switch">
        <S.Thumb className="switch-thumb">
          <Check size={12} />
        </S.Thumb>
      </S.Root>
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
