import styles from './Lucin.module.css'

interface LucinProps {
  height?: string
  amplitude?: number
}

export default function Lucin({ height = '30%', amplitude = 0 }: LucinProps) {
  // Map amplitude (0-1) to scale (1.0 to 1.5) and animation speed
  const scale = 1 + (amplitude * 0.5)
  const animationDuration = Math.max(3.5, 6 - (amplitude * 2.5))
  
  return (
    <div 
      className={styles.lucin} 
      style={{ 
        height,
        transform: `scale(${scale})`,
        transition: 'transform 0.08s ease-out',
        animationDuration: `${animationDuration}s, 8s`
      }}
    />
  );
}
