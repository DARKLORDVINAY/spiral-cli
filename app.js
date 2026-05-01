const PIECES = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

const baseValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const pst = {
  p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
};

let state;
let selected = null;
let legalTargets = [];
let lastMove = null;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");

document.getElementById("newGameBtn").addEventListener("click", newGame);

function newGame() {
  state = {
    board: [
      ["r","n","b","q","k","b","n","r"],
      ["p","p","p","p","p","p","p","p"],
      [".",".",".",".",".",".",".","."],
      [".",".",".",".",".",".",".","."],
      [".",".",".",".",".",".",".","."],
      [".",".",".",".",".",".",".","."],
      ["P","P","P","P","P","P","P","P"],
      ["R","N","B","Q","K","B","N","R"],
    ],
    turn: "w",
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    halfMove: 0,
    fullMove: 1,
  };
  selected = null;
  legalTargets = [];
  lastMove = null;
  render();
  setStatus("Your move.");
}

function inBounds(r,c){ return r>=0&&r<8&&c>=0&&c<8; }
const isWhite=(p)=>p!=="."&&p===p.toUpperCase();
const isBlack=(p)=>p!=="."&&p===p.toLowerCase();
const sideOf=(p)=>isWhite(p)?"w":isBlack(p)?"b":null;

function cloneState(s){ return JSON.parse(JSON.stringify(s)); }

function render(){
  boardEl.innerHTML="";
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const sq=document.createElement("button");
    sq.className=`square ${(r+c)%2===0?"light":"dark"}`;
    sq.dataset.r=r; sq.dataset.c=c;
    const piece=state.board[r][c];
    sq.textContent=PIECES[piece]||"";
    if(selected&&selected[0]===r&&selected[1]===c) sq.classList.add("selected");
    if(legalTargets.some(([tr,tc])=>tr===r&&tc===c)) sq.classList.add("highlight");
    if(lastMove && ((lastMove.from[0]===r&&lastMove.from[1]===c)||(lastMove.to[0]===r&&lastMove.to[1]===c))) sq.classList.add("last-move");
    sq.addEventListener("click", onSquareClick);
    boardEl.appendChild(sq);
  }
}

function onSquareClick(e){
  if(state.turn!=="w") return;
  const r=Number(e.currentTarget.dataset.r), c=Number(e.currentTarget.dataset.c);
  const piece=state.board[r][c];

  if(selected){
    const move=allMoves(state,"w").find(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]&&m.to[0]===r&&m.to[1]===c);
    if(move){
      applyMove(state,move);
      selected=null; legalTargets=[]; lastMove=move;
      render();
      postMoveFlow();
      return;
    }
  }

  if(piece!=="."&&isWhite(piece)){
    selected=[r,c];
    legalTargets=allMoves(state,"w").filter(m=>m.from[0]===r&&m.from[1]===c).map(m=>m.to);
  } else { selected=null; legalTargets=[]; }
  render();
}

function postMoveFlow(){
  const result = gameResult(state);
  if(result){ setStatus(result); return; }
  setStatus("Bot is thinking...");
  setTimeout(()=>{
    const move=bestMove(state,4);
    if(move){ applyMove(state,move); lastMove=move; }
    render();
    setStatus(gameResult(state)||"Your move.");
  },60);
}

function gameResult(s){
  const side=s.turn;
  const moves=allMoves(s,side);
  const check=isCheck(s,side);
  if(moves.length===0) return check ? (side==="w"?"Checkmate. Bot wins.":"Checkmate. You win!") : "Draw by stalemate.";
  return null;
}

function allMoves(s,side){
  const list=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=s.board[r][c];
    if(p==='.'||sideOf(p)!==side) continue;
    pseudoMoves(s,r,c,p).forEach(m=>{
      const next=cloneState(s); applyMove(next,m);
      if(!isCheck(next,side)) list.push(m);
    });
  }
  return list;
}

function pseudoMoves(s,r,c,p){
  const side=sideOf(p), dir=side==="w"?-1:1, out=[];
  const add=(tr,tc,opt={})=>{ if(inBounds(tr,tc)) out.push({from:[r,c],to:[tr,tc],...opt}); };
  const board=s.board;
  switch(p.toLowerCase()){
    case 'p': {
      const start=side==="w"?6:1, promo=side==="w"?0:7;
      if(inBounds(r+dir,c)&&board[r+dir][c]==='.'){
        if(r+dir===promo) add(r+dir,c,{promo:side==="w"?"Q":"q"}); else add(r+dir,c);
        if(r===start&&board[r+2*dir][c]==='.') add(r+2*dir,c,{double:true});
      }
      [-1,1].forEach(dc=>{
        const tr=r+dir, tc=c+dc;
        if(!inBounds(tr,tc)) return;
        const target=board[tr][tc];
        if(target!=='.'&&sideOf(target)!==side){
          if(tr===promo) add(tr,tc,{promo:side==="w"?"Q":"q"}); else add(tr,tc);
        }
      });
      if(s.enPassant){
        const [er,ec]=s.enPassant;
        if(er===r+dir&&Math.abs(ec-c)===1) add(er,ec,{enPassant:true});
      }
      break;
    }
    case 'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{
      const tr=r+dr, tc=c+dc; if(!inBounds(tr,tc)) return;
      if(board[tr][tc]==='.'||sideOf(board[tr][tc])!==side) add(tr,tc);
    }); break;
    case 'b': slide([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case 'r': slide([[1,0],[-1,0],[0,1],[0,-1]]); break;
    case 'q': slide([[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]); break;
    case 'k': {
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){
        const tr=r+dr, tc=c+dc; if(!inBounds(tr,tc)) continue;
        if(board[tr][tc]==='.'||sideOf(board[tr][tc])!==side) add(tr,tc);
      }
      const rights=side==="w"?["K","Q"]:["k","q"];
      if(rights[0] in s.castling){
        if(s.castling[rights[0]] && board[r][c+1]==='.' && board[r][c+2]==='.' && !isAttacked(s,r,c,opp(side)) && !isAttacked(s,r,c+1,opp(side)) && !isAttacked(s,r,c+2,opp(side))) add(r,c+2,{castle:"K"});
        if(s.castling[rights[1]] && board[r][c-1]==='.' && board[r][c-2]==='.' && board[r][c-3]==='.' && !isAttacked(s,r,c,opp(side)) && !isAttacked(s,r,c-1,opp(side)) && !isAttacked(s,r,c-2,opp(side))) add(r,c-2,{castle:"Q"});
      }
      break;
    }
  }
  function slide(dirs){
    dirs.forEach(([dr,dc])=>{ let tr=r+dr, tc=c+dc;
      while(inBounds(tr,tc)){
        if(board[tr][tc]==='.') add(tr,tc);
        else { if(sideOf(board[tr][tc])!==side) add(tr,tc); break; }
        tr+=dr; tc+=dc;
      }
    });
  }
  return out;
}

function opp(side){ return side==='w'?'b':'w'; }

function applyMove(s,m){
  const [fr,fc]=m.from,[tr,tc]=m.to;
  const piece=s.board[fr][fc];
  s.board[fr][fc]='.';
  if(m.enPassant){ s.board[fr][tc]='.'; }
  if(m.castle==='K'){ s.board[tr][5]=s.board[tr][7]; s.board[tr][7]='.'; }
  if(m.castle==='Q'){ s.board[tr][3]=s.board[tr][0]; s.board[tr][0]='.'; }
  s.board[tr][tc]=m.promo||piece;

  if(piece==='K'){ s.castling.K=false; s.castling.Q=false; }
  if(piece==='k'){ s.castling.k=false; s.castling.q=false; }
  if(fr===7&&fc===0) s.castling.Q=false;
  if(fr===7&&fc===7) s.castling.K=false;
  if(fr===0&&fc===0) s.castling.q=false;
  if(fr===0&&fc===7) s.castling.k=false;

  if(tr===7&&tc===0) s.castling.Q=false;
  if(tr===7&&tc===7) s.castling.K=false;
  if(tr===0&&tc===0) s.castling.q=false;
  if(tr===0&&tc===7) s.castling.k=false;

  s.enPassant = m.double ? [(fr+tr)/2, fc] : null;
  s.turn=opp(s.turn);
}

function locateKing(s,side){
  const k=side==='w'?'K':'k';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(s.board[r][c]===k) return [r,c];
}
function isCheck(s,side){ const [kr,kc]=locateKing(s,side); return isAttacked(s,kr,kc,opp(side)); }

function isAttacked(s,r,c,bySide){
  for(let i=0;i<8;i++) for(let j=0;j<8;j++){
    const p=s.board[i][j];
    if(p==='.'||sideOf(p)!==bySide) continue;
    if(p.toLowerCase()==='p'){
      const dir=bySide==='w'?-1:1;
      if(i+dir===r && (j-1===c||j+1===c)) return true;
      continue;
    }
    for(const m of pseudoMovesNoCastle(s,i,j,p)) if(m.to[0]===r&&m.to[1]===c) return true;
  }
  return false;
}
function pseudoMovesNoCastle(s,r,c,p){ return pseudoMoves({...s,castling:{}},r,c,p).filter(m=>!m.castle); }

function evaluate(s){
  let score=0;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=s.board[r][c]; if(p==='.') continue;
    const low=p.toLowerCase();
    const idx=isWhite(p)?r*8+c:(7-r)*8+c;
    const val=baseValues[low] + pst[low][idx];
    score += isWhite(p)?val:-val;
  }
  return score;
}

function bestMove(s,depth){
  const moves=allMoves(s,s.turn);
  let best=null, bestScore=s.turn==='w'?-Infinity:Infinity;
  for(const m of moves){
    const next=cloneState(s); applyMove(next,m);
    const score=minimax(next,depth-1,-Infinity,Infinity);
    if(s.turn==='b' ? score<bestScore : score>bestScore){ bestScore=score; best=m; }
  }
  return best;
}

function minimax(s,depth,alpha,beta){
  const result=gameResult(s);
  if(result) return result.includes('You win')?99999:result.includes('Bot wins')?-99999:0;
  if(depth===0) return evaluate(s);
  const moves=allMoves(s,s.turn);
  if(s.turn==='w'){
    let v=-Infinity;
    for(const m of moves){ const n=cloneState(s); applyMove(n,m); v=Math.max(v,minimax(n,depth-1,alpha,beta)); alpha=Math.max(alpha,v); if(beta<=alpha) break; }
    return v;
  }
  let v=Infinity;
  for(const m of moves){ const n=cloneState(s); applyMove(n,m); v=Math.min(v,minimax(n,depth-1,alpha,beta)); beta=Math.min(beta,v); if(beta<=alpha) break; }
  return v;
}

function setStatus(t){ statusEl.textContent=t; }

newGame();
