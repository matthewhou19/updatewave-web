import { ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'outline' | 'primary' | 'accent'
export type ButtonSize = 'default' | 'sm'

const SIZES: Record<ButtonSize, string> = {
  default: 'text-[12px] px-5 py-2.5',
  sm: 'text-[11px] px-3.5 py-2',
}

const VARIANTS: Record<ButtonVariant, string> = {
  outline: 'border-ink text-ink bg-transparent hover:bg-ink hover:text-paper',
  primary: 'border-ink bg-ink text-paper hover:bg-paper hover:text-ink',
  accent: 'border-accent bg-accent text-paper hover:opacity-90',
}

const BASE = 'inline-block font-mono tracking-wide cursor-pointer border text-center transition-colors disabled:opacity-50 disabled:cursor-wait no-underline'

export function buttonStyles(variant: ButtonVariant = 'outline', size: ButtonSize = 'default'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'default', className = '', ...rest },
  ref,
) {
  return <button ref={ref} className={`${buttonStyles(variant, size)} ${className}`} {...rest} />
})
