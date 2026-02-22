import styles from './Lucin.module.css'

export default function Lucin({ height = '30%' }) {
  return (<div className={styles.lucin} style={{ height }}></div>);
}
