import type { CSSProperties, ReactNode } from 'react'
import styles from './GlassBubble.module.css'

type GlassBubbleProps = {
  children: ReactNode
  style?: CSSProperties
  contentStyle?: CSSProperties
}

export default function GlassBubble({ children, style, contentStyle }: GlassBubbleProps) {
  return (
    <div className={styles.glassBubble} style={style}>
      <span className={styles.rim} aria-hidden="true" />
      <span className={styles.highlight} aria-hidden="true" />
      <span className={styles.shadow} aria-hidden="true" />
      <div className={styles.content} style={contentStyle}>{children}</div>
    </div>
  )
}
