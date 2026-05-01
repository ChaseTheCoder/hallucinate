import type { CSSProperties, ReactNode } from 'react'
import styles from './GlassBubble.module.css'

type GlassBubbleProps = {
  children: ReactNode
  style?: CSSProperties
  contentStyle?: CSSProperties
  showGlow?: boolean
}

export default function GlassBubble({ children, style, contentStyle, showGlow = false }: GlassBubbleProps) {
  return (
    <div className={`${styles.glassBubble} ${showGlow ? styles.glow : ''}`} style={style}>
      <span className={styles.rim} aria-hidden="true" />
      <span className={styles.highlight} aria-hidden="true" />
      <span className={styles.shadow} aria-hidden="true" />
      <div className={styles.content} style={contentStyle}>{children}</div>
    </div>
  )
}
