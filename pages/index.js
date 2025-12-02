import Blob from '../components/Blob'
import Button from '../components/Button'

export default function Home() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:20}}>
      <Blob />
      <h1>Gaime</h1>
      <div style={{display:'flex',gap:36,flexDirection:'column'}}>
        <Button href="/join">Join Game</Button>
        <Button href="/start">Start Game</Button>
      </div>
    </div>
  )
}
