'use client'
import React from 'react'
import styles from './Tag.module.css'

export default function Tag({ text, tone }: { text: string; tone?: 'brand' | 'neutral' }) {
  const cls = [styles.tag, tone === 'brand' ? styles.brand : ''].join(' ')
  return <span className={cls}>{text}</span>
}

