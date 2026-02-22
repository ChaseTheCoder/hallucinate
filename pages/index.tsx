import Lucin from '../components/Lucin'
import Button from '../components/Button'

export default function Home() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:20}}>
      <Lucin height="40%" />
      <h1>Hallucinate</h1>
      <div style={{display:'flex',gap:36,flexDirection:'column'}}>
        <Button href="/join">Join Game</Button>
        <Button href="/host">Start Game</Button>
      </div>
    </div>
  )
}
