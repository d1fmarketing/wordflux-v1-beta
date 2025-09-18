'use client'
import React from 'react'
import styles from './button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', className, ...rest }, ref
) {
  const cls = [styles.btn, styles[variant], className].filter(Boolean).join(' ')
  return <button ref={ref} {...rest} className={cls} />
})

export default Button
