// Simple in-memory game store
const games = {}

function makeCode(len = 6){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)]
  return s
}

function createGame(){
  let code = makeCode()
  while (games[code]) code = makeCode()
  games[code] = { players: [] }
  return code
}

module.exports = { games, createGame }
