import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  increment,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Activity,
  Play,
  Trophy,
  Zap,
  Wifi,
  Cpu,
  Radio,
  Disc,
  Crosshair
} from 'lucide-react';

// --- FIREBASE SETUP ---
// Ensure these are defined in your environment or passed in via window/global
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {}; 
// Fallback if config is missing just to prevent white screen crash during copy/paste test
const app = Object.keys(firebaseConfig).length ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stock-zero-v1';

// --- THEME & STYLES ---
const theme = {
  cyan: '#00f3ff',
  magenta: '#ff00ff',
  yellow: '#ffe600',
  green: '#00ff9d',
  bg: '#030305',
  glass: 'rgba(10, 10, 16, 0.6)',
  fontDisplay: "'Rajdhani', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700;800&family=JetBrains+Mono:wght@400;800&display=swap');
    
    * { box-sizing: border-box; }

    body {
      margin: 0;
      background-color: ${theme.bg};
      color: #fff;
      font-family: ${theme.fontDisplay};
      overflow: hidden;
      user-select: none;
    }

    /* CRT Scanline Effect */
    .scanlines {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      background-size: 100% 2px, 3px 100%;
      z-index: 999;
      pointer-events: none;
    }

    /* Animated Background Grid */
    .cyber-grid {
      position: absolute;
      width: 200vw;
      height: 200vh;
      top: -50%;
      left: -50%;
      background-image: 
        linear-gradient(rgba(0, 243, 255, 0.3) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 0, 255, 0.3) 1px, transparent 1px);
      background-size: 100px 100px;
      transform: perspective(500px) rotateX(60deg);
      animation: grid-move 10s linear infinite;
      opacity: 0.2;
      z-index: 0;
    }

    @keyframes grid-move {
      0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
      100% { transform: perspective(500px) rotateX(60deg) translateY(100px); }
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #000; }
    ::-webkit-scrollbar-thumb { background: ${theme.cyan}; }

    /* Animations */
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes pulse-neon { 0%, 100% { box-shadow: 0 0 10px ${theme.cyan}, inset 0 0 10px ${theme.cyan}; } 50% { box-shadow: 0 0 20px ${theme.cyan}, inset 0 0 20px ${theme.cyan}; } }
    @keyframes glitch-anim {
      0% { transform: translate(0); }
      20% { transform: translate(-2px, 2px); }
      40% { transform: translate(-2px, -2px); }
      60% { transform: translate(2px, 2px); }
      80% { transform: translate(2px, -2px); }
      100% { transform: translate(0); }
    }

    .cyber-card {
      background: rgba(10, 11, 15, 0.75);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 0 40px rgba(0,0,0,0.8);
      position: relative;
      overflow: hidden;
    }
    
    /* Angled Corners using clip-path */
    .clip-corners {
      clip-path: polygon(
        20px 0, 100% 0, 
        100% calc(100% - 20px), calc(100% - 20px) 100%, 
        0 100%, 0 20px
      );
    }
    
    .glitch-text:hover {
      animation: glitch-anim 0.3s cubic-bezier(.25, .46, .45, .94) both infinite;
      color: ${theme.magenta};
    }

    .neon-btn {
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    
    .neon-btn:active { transform: scale(0.98); }
    
    .neon-btn::after {
      content: '';
      position: absolute;
      top: -50%; left: -50%;
      width: 200%; height: 200%;
      background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
      transform: rotate(45deg) translateY(-100%);
      transition: 0.5s;
    }
    .neon-btn:hover::after { transform: rotate(45deg) translateY(100%); }

  `}</style>
);

// --- UI COMPONENTS ---

const CyberButton = ({ children, onClick, color = theme.cyan, disabled, style, huge }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className="neon-btn clip-corners"
    style={{
      background: disabled ? '#222' : `linear-gradient(135deg, ${color}22 0%, ${color}00 100%)`,
      border: 'none',
      borderLeft: `4px solid ${disabled ? '#555' : color}`,
      color: disabled ? '#666' : '#fff',
      padding: huge ? '30px' : '15px 30px',
      fontFamily: theme.fontDisplay,
      fontSize: huge ? '24px' : '16px',
      fontWeight: '700',
      width: '100%',
      boxShadow: disabled ? 'none' : `0 0 20px ${color}22`,
      textShadow: disabled ? 'none' : `0 0 10px ${color}`,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }}
  >
    {children}
  </button>
);

const GlitchText = ({ text, size = '24px', color = '#fff' }) => (
  <div className="glitch-text" style={{ 
    fontSize: size, 
    color: color, 
    fontFamily: theme.fontMono, 
    fontWeight: '800',
    textShadow: `2px 0 ${theme.magenta}, -2px 0 ${theme.cyan}`
  }}>
    {text}
  </div>
);

const Container = ({ children }) => (
  <div style={{ 
    height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', 
    position: 'relative', alignItems: 'center', justifyContent: 'center' 
  }}>
    <div className="scanlines" />
    <div className="cyber-grid" />
    {/* Floating ambient particles */}
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
       <div style={{ position: 'absolute', top: '20%', left: '20%', width: '300px', height: '300px', background: theme.magenta, filter: 'blur(150px)', opacity: 0.1, animation: 'float 10s infinite ease-in-out' }}></div>
       <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: '400px', height: '400px', background: theme.cyan, filter: 'blur(150px)', opacity: 0.1, animation: 'float 15s infinite ease-in-out reverse' }}></div>
    </div>
    <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  </div>
);

// --- HELPER FUNCTIONS ---
const generateRoomId = () => Math.floor(1000 + Math.random() * 9000).toString();
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

// --- SCREENS ---

// 1. LOGIN SCREEN
const LoginScreen = ({ onLogin, error }) => {
  const [loading, setLoading] = useState(false);

  const handleGuest = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); } catch (e) { onLogin(e.message); } finally { setLoading(false); }
  };

  return (
    <Container>
      <div className="cyber-card clip-corners" style={{ padding: '60px', maxWidth: '500px', width: '90%', textAlign: 'center', borderTop: `2px solid ${theme.cyan}` }}>
        <div style={{ marginBottom: '40px', display: 'inline-block', padding: '20px', border: `1px dashed ${theme.cyan}`, borderRadius: '50%' }}>
           <Cpu size={64} color={theme.cyan} />
        </div>
        
        <h1 style={{ fontSize: '48px', margin: '0 0 10px 0', lineHeight: 0.9 }}>
          ZERO<span style={{ color: theme.cyan }}>SUM</span>
        </h1>
        <p style={{ color: theme.magenta, letterSpacing: '4px', fontSize: '14px', marginBottom: '50px', textTransform: 'uppercase' }}>High Frequency Trading Sim</p>

        {error && <div style={{ color: theme.magenta, border: `1px solid ${theme.magenta}`, padding: '10px', marginBottom: '20px', fontFamily: theme.fontMono }}>ERROR: {error}</div>}

        <CyberButton onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => onLogin(e.message))} color="#fff" style={{ marginBottom: '20px', color: 'black', background: '#fff' }}>
          Auth via Google
        </CyberButton>
        
        <CyberButton onClick={handleGuest} color={theme.cyan} disabled={loading}>
          {loading ? "INITIALIZING..." : "ENTER AS GUEST"}
        </CyberButton>
      </div>
    </Container>
  );
};

// 2. LOBBY SCREEN
const LobbyScreen = ({ user, onCreate, onJoin, onSignOut }) => {
  const [code, setCode] = useState('');
  
  return (
    <Container>
      <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 50 }}>
          <button onClick={onSignOut} style={{ background: 'transparent', border: `1px solid ${theme.magenta}`, color: theme.magenta, padding: '10px 20px', fontFamily: theme.fontMono, cursor: 'pointer' }}>[ DISCONNECT ]</button>
      </div>

      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '1000px', width: '100%' }}>
        
        {/* Profile Card */}
        <div className="cyber-card clip-corners" style={{ width: '300px', padding: '30px', borderTop: `4px solid ${theme.yellow}` }}>
           <div style={{ color: '#888', fontSize: '12px', letterSpacing: '2px' }}>OPERATOR ID</div>
           <GlitchText text={user.displayName || 'UNKNOWN'} size="32px" color={theme.yellow} />
           <div style={{ marginTop: '20px', fontSize: '14px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', background: theme.green, borderRadius: '50%', boxShadow: `0 0 10px ${theme.green}` }} />
              SYSTEM ONLINE
           </div>
        </div>

        {/* Action Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '400px' }}>
           
           <div className="cyber-card clip-corners" style={{ padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderLeft: `4px solid ${theme.green}` }} onClick={onCreate}>
              <div>
                <h3 style={{ margin: 0, fontSize: '24px', color: theme.green }}>HOST NODE</h3>
                <span style={{ color: '#666', fontSize: '12px' }}>INITIATE NEW MARKET SESSION</span>
              </div>
              <Play color={theme.green} size={32} fill={theme.green} style={{ filter: `drop-shadow(0 0 10px ${theme.green})` }}/>
           </div>

           <div className="cyber-card clip-corners" style={{ padding: '30px', borderLeft: `4px solid ${theme.magenta}` }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '24px', color: theme.magenta }}>JOIN NODE</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  value={code} 
                  onChange={e => setCode(e.target.value)}
                  maxLength={4}
                  placeholder="0000"
                  style={{ 
                    background: 'rgba(0,0,0,0.5)', border: `1px solid ${theme.magenta}`, 
                    color: theme.magenta, padding: '10px', fontFamily: theme.fontMono, 
                    fontSize: '24px', width: '100px', textAlign: 'center', outline: 'none' 
                  }} 
                />
                <CyberButton onClick={() => onJoin(code)} color={theme.magenta} disabled={code.length !== 4}>CONNECT</CyberButton>
              </div>
           </div>

        </div>
      </div>
    </Container>
  );
};

// 3. WAITING ROOM
const WaitingRoom = ({ room, user, onStart, onLeave }) => {
  return (
    <Container>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
         <div style={{ fontSize: '14px', color: theme.cyan, letterSpacing: '8px', marginBottom: '10px' }}>SECURE CONNECTION</div>
         <h1 style={{ fontSize: '120px', margin: 0, fontFamily: theme.fontMono, color: 'transparent', WebkitTextStroke: `2px ${theme.cyan}`, textShadow: `0 0 20px ${theme.cyan}` }}>
            {room.id}
         </h1>
         <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px', color: '#888' }}>
            <Wifi className="animate-pulse" /> WAITING FOR UPLINK...
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', width: '100%', maxWidth: '800px', marginBottom: '50px' }}>
         {Object.values(room.players).map(p => (
            <div key={p.id} className="cyber-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: p.id === room.hostId ? `1px solid ${theme.yellow}` : `1px solid #333` }}>
               <div style={{ width: '40px', height: '40px', background: `linear-gradient(135deg, ${p.id === room.hostId ? theme.yellow : theme.cyan}, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000' }}>
                  {p.name[0].toUpperCase()}
               </div>
               <div style={{ fontFamily: theme.fontMono }}>{p.name}</div>
            </div>
         ))}
      </div>

      {room.hostId === user.uid ? (
         <div style={{ width: '300px' }}>
            <CyberButton onClick={onStart} color={theme.green} huge>START MARKET</CyberButton>
         </div>
      ) : (
         <div style={{ color: '#666', fontFamily: theme.fontMono }}>// WAITING FOR HOST COMMAND //</div>
      )}

      <button onClick={onLeave} style={{ marginTop: '40px', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', textDecoration: 'underline' }}>ABORT SEQUENCE</button>
    </Container>
  );
};

// 4. CHART COMPONENT
const NeonChart = ({ history }) => {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });

  useEffect(() => {
    const update = () => ref.current && setDims({ w: ref.current.clientWidth, h: ref.current.clientHeight });
    window.addEventListener('resize', update);
    update();
    setTimeout(update, 100);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!history || history.length < 1) return null;

  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.2; 
  const range = (max - min) + (pad * 2) || 1;
  const effectiveMin = min - pad;
  const startTime = history[0].time;
  const timeRange = (history[history.length - 1].time - startTime) || 1;

  const points = history.map(h => {
      const x = ((h.time - startTime) / timeRange) * dims.w;
      const y = dims.h - ((h.price - effectiveMin) / range) * dims.h;
      return `${x},${y}`;
  }).join(' ');

  const isUp = current >= history[0].price;
  const color = isUp ? theme.green : theme.magenta;

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
       {/* Grid lines inside chart */}
       <div style={{ position: 'absolute', inset: 0, borderBottom: `1px solid ${color}44`, borderLeft: `1px solid ${color}44`, opacity: 0.5 }}>
          {[0.25, 0.5, 0.75].map(p => (
            <div key={p} style={{ position: 'absolute', left: 0, right: 0, top: `${p*100}%`, borderTop: `1px dashed ${color}22` }} />
          ))}
       </div>

       <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={`M0,${dims.h} ${points} L${dims.w},${dims.h} Z`} fill="url(#fill)" />
          <polyline points={points} fill="none" stroke={color} strokeWidth="3" filter="url(#glow)" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          
          {/* Current Price Beacon */}
          <g transform={`translate(${dims.w}, ${dims.h - ((current - effectiveMin) / range) * dims.h})`}>
             <circle r="5" fill="#fff" />
             <circle r="20" fill={color} opacity="0.2" className="animate-pulse" />
             <line x1="-1000" y1="0" x2="0" y2="0" stroke={color} strokeDasharray="4 4" opacity="0.5" />
          </g>
       </svg>
       
       <div style={{ position: 'absolute', top: 10, left: 10, fontFamily: theme.fontMono, fontSize: '12px', color: color }}>
          MAX: {max.toFixed(2)}
       </div>
    </div>
  );
};

// 5. GAME ROOM
const GameRoom = ({ room, user, onTrade }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const p = room.players[user.uid];
  const price = room.price;
  const equity = p.cash + (p.shares * price);
  const profit = equity - p.initialValue;
  const isUp = room.history.length > 1 && price >= room.history[room.history.length-2].price;
  const mainColor = isUp ? theme.green : theme.magenta;

  useEffect(() => {
    const end = room.startTime.seconds + room.duration;
    const t = setInterval(() => setTimeLeft(Math.max(0, end - Date.now()/1000)), 1000);
    return () => clearInterval(t);
  }, [room]);

  const formatTime = s => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  return (
    <Container>
       {/* Top HUD */}
       <div style={{ width: '100%', height: '80px', background: 'rgba(0,0,0,0.8)', borderBottom: `1px solid #333`, padding: '0 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '5px 10px', background: theme.cyan, color: 'black', fontWeight: 'bold', fontSize: '12px' }}>LIVE</div>
              <div style={{ fontFamily: theme.fontMono, fontSize: '42px', color: mainColor, textShadow: `0 0 20px ${mainColor}` }}>
                {formatCurrency(price)}
              </div>
              <div style={{ color: mainColor }}>{isUp ? '▲' : '▼'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#666', fontSize: '10px', letterSpacing: '2px' }}>TIME REMAINING</div>
              <div style={{ fontFamily: theme.fontMono, fontSize: '32px', color: timeLeft < 30 ? theme.magenta : '#fff' }}>{formatTime(timeLeft)}</div>
          </div>
       </div>

       <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 80px)' }}>
          {/* Left: Main Trading Desk */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
             <div style={{ flex: 1, padding: '40px', position: 'relative' }}>
                <NeonChart history={room.history} />
             </div>
             
             {/* Trading Console */}
             <div style={{ height: '200px', background: '#08080a', borderTop: '1px solid #333', display: 'flex', alignItems: 'center', padding: '0 40px', gap: '40px', boxShadow: '0 -20px 50px rgba(0,0,0,0.5)', zIndex: 50 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#666', fontSize: '12px', letterSpacing: '1px', marginBottom: '5px' }}>AVAILABLE CASH</div>
                    <div style={{ fontSize: '36px', fontFamily: theme.fontMono, color: '#fff' }}>{formatCurrency(p.cash)}</div>
                </div>

                <div style={{ display: 'flex', gap: '20px', width: '500px' }}>
                   <CyberButton huge color={theme.magenta} onClick={() => onTrade('sell')} disabled={p.shares <= 0}>
                      SELL <span style={{ fontSize: '14px', display: 'block', opacity: 0.7 }}>@{formatCurrency(price-1)}</span>
                   </CyberButton>
                   <CyberButton huge color={theme.green} onClick={() => onTrade('buy')} disabled={p.cash < price}>
                      BUY <span style={{ fontSize: '14px', display: 'block', opacity: 0.7 }}>@{formatCurrency(price)}</span>
                   </CyberButton>
                </div>

                <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ color: '#666', fontSize: '12px', letterSpacing: '1px', marginBottom: '5px' }}>HOLDINGS</div>
                    <div style={{ fontSize: '36px', fontFamily: theme.fontMono, color: theme.cyan }}>{p.shares} <span style={{ fontSize: '16px' }}>UNIT</span></div>
                </div>
             </div>
          </div>

          {/* Right: Leaderboard & Stats */}
          <div style={{ width: '350px', background: 'rgba(0,0,0,0.6)', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '30px', borderBottom: '1px solid #333', background: `linear-gradient(180deg, ${profit >= 0 ? theme.green : theme.magenta}11 0%, transparent 100%)` }}>
                  <div style={{ color: '#888', fontSize: '12px', letterSpacing: '2px' }}>TOTAL EQUITY</div>
                  <div style={{ fontSize: '32px', fontFamily: theme.fontMono, fontWeight: 'bold' }}>{formatCurrency(equity)}</div>
                  <div style={{ color: profit >= 0 ? theme.green : theme.magenta, fontSize: '16px', marginTop: '5px' }}>
                      {profit > 0 ? '+' : ''}{formatCurrency(profit)} ({((profit/p.initialValue)*100).toFixed(2)}%)
                  </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#555', letterSpacing: '2px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Radio size={12} className="animate-pulse"/> MARKET PARTICIPANTS
                  </div>
                  {Object.values(room.players)
                      .sort((a,b) => (b.cash + b.shares*price) - (a.cash + a.shares*price))
                      .map((pl, i) => (
                          <div key={pl.id} style={{ 
                              display: 'flex', justifyContent: 'space-between', padding: '15px', marginBottom: '10px',
                              background: pl.id === user.uid ? `${theme.cyan}11` : 'rgba(255,255,255,0.03)',
                              borderLeft: pl.id === user.uid ? `2px solid ${theme.cyan}` : '2px solid transparent'
                          }}>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                  <span style={{ fontFamily: theme.fontMono, color: i===0 ? theme.yellow : '#666' }}>#{i+1}</span>
                                  <span style={{ fontWeight: pl.id===user.uid ? 'bold' : 'normal' }}>{pl.name}</span>
                              </div>
                              <div style={{ fontFamily: theme.fontMono, color: '#aaa' }}>{formatCurrency(pl.cash + pl.shares*price)}</div>
                          </div>
                      ))
                  }
              </div>
          </div>
       </div>
    </Container>
  );
};

// 6. RESULTS SCREEN
const ResultsScreen = ({ room, user, onLeave }) => {
    const finalPrice = room.price;
    const sorted = Object.values(room.players).sort((a,b) => (b.cash + b.shares*finalPrice) - (a.cash + a.shares*finalPrice));
    const winner = sorted[0];
    const isWinner = winner.id === user.uid;

    return (
        <Container>
             {/* Background Confetti / Rain */}
             {isWinner && (
                 <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                    {[...Array(50)].map((_,i) => (
                        <div key={i} style={{
                            position: 'absolute', left: `${Math.random()*100}%`, top: -20,
                            width: '4px', height: '20px', background: [theme.yellow, theme.cyan, theme.magenta][Math.floor(Math.random()*3)],
                            animation: `grid-move ${1+Math.random()*2}s linear infinite`
                        }} />
                    ))}
                 </div>
             )}

            <div className="cyber-card clip-corners" style={{ 
                padding: '60px', width: '600px', textAlign: 'center', 
                border: `2px solid ${theme.yellow}`,
                boxShadow: `0 0 100px ${theme.yellow}22`
            }}>
                <Trophy size={64} color={theme.yellow} style={{ marginBottom: '20px', filter: `drop-shadow(0 0 20px ${theme.yellow})` }} />
                
                <div style={{ color: '#888', letterSpacing: '5px', marginBottom: '10px' }}>SESSION COMPLETE</div>
                <h1 style={{ fontSize: '64px', margin: 0, color: '#fff' }}>{winner.name}</h1>
                <div style={{ color: theme.yellow, fontSize: '18px', marginBottom: '40px' }}>DOMINATING TRADER</div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '8px', marginBottom: '40px' }}>
                    <div style={{ fontSize: '14px', color: '#aaa' }}>FINAL EQUITY</div>
                    <div style={{ fontSize: '56px', fontFamily: theme.fontMono, color: theme.green, fontWeight: 'bold', textShadow: `0 0 20px ${theme.green}` }}>
                        {formatCurrency(winner.cash + winner.shares*finalPrice)}
                    </div>
                </div>

                <CyberButton onClick={onLeave} color="#fff" style={{ background: '#fff', color: '#000' }}>
                    RETURN TO LOBBY
                </CyberButton>
            </div>
        </Container>
    );
};


// --- MAIN APP CONTROLLER ---

export default function App() {
  // Note: This assumes firebase is initialized correctly at the top. 
  // If you are pasting this into a specific environment, ensure standard firebase v9+ imports work.
  
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [view, setView] = useState('login'); 
  const [error, setError] = useState('');

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({ uid: u.uid, displayName: u.displayName || `Trader-${u.uid.slice(0,4)}` });
        if(view === 'login') setView('lobby');
      } else {
        setUser(null); setView('login');
      }
    });
  }, [view]);

  // Room Listener
  useEffect(() => {
    if (!room?.id || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoom(prev => ({ ...prev, ...data }));
        if (data.status === 'playing' && view === 'waiting') setView('game');
        if (data.status === 'finished') setView('results');
        
        // Host logic to end game
        if (data.status === 'playing' && user?.uid === data.hostId) {
             if ((Date.now()/1000) > (data.startTime.seconds + data.duration)) {
                 updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'finished' });
             }
        }
      } else {
        setRoom(null); setView('lobby'); setError("CONNECTION LOST");
      }
    });
    return () => unsub();
  }, [room?.id, view]);

  const createRoom = async () => {
    if (!db) return;
    const id = generateRoomId();
    const newRoom = {
        id, hostId: user.uid, status: 'waiting', createdAt: serverTimestamp(),
        price: 100, history: [{ price: 100, time: Date.now() }], transactionCosts: 0, duration: 300,
        players: { [user.uid]: { id: user.uid, name: user.displayName, cash: 1000, shares: 0, initialValue: 1000 } }
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', id), newRoom);
    setRoom(newRoom); setView('waiting');
  };

  const joinRoom = async (code) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) return setError('INVALID FREQUENCY');
    const data = snap.data();
    if (data.status !== 'waiting') return setError('MARKET CLOSED');
    await updateDoc(ref, { [`players.${user.uid}`]: { id: user.uid, name: user.displayName, cash: 1000, shares: 0, initialValue: 1000 } });
    setRoom(data); setView('waiting');
  };

  const trade = async (type) => {
    if (!room || !db) return;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const p = data.players[user.uid];
    const price = data.price;
    
    if (type === 'buy') {
        const cost = price * 1.001;
        if (p.cash >= cost) {
            await updateDoc(ref, {
                [`players.${user.uid}.cash`]: p.cash - cost,
                [`players.${user.uid}.shares`]: p.shares + 1,
                price: price + 1,
                transactionCosts: increment(cost - price),
                history: arrayUnion({ price: price + 1, time: Date.now() })
            });
        }
    } else if (type === 'sell' && p.shares > 0) {
        const rev = (price - 1) * 0.999;
        await updateDoc(ref, {
            [`players.${user.uid}.cash`]: p.cash + rev,
            [`players.${user.uid}.shares`]: p.shares - 1,
            price: price - 1,
            transactionCosts: increment((price-1) - rev),
            history: arrayUnion({ price: price - 1, time: Date.now() })
        });
    }
  };

  if (!auth || !db) return <div style={{ padding: 20, color: 'red' }}>FIREBASE CONFIG MISSING</div>;

  return (
    <>
      <GlobalStyles />
      {view === 'login' && <LoginScreen onLogin={setError} error={error} />}
      {view === 'lobby' && user && <LobbyScreen user={user} onCreate={createRoom} onJoin={joinRoom} onSignOut={() => signOut(auth)} />}
      {view === 'waiting' && room && <WaitingRoom room={room} user={user} onStart={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'playing', startTime: serverTimestamp() })} onLeave={() => {setRoom(null); setView('lobby');}} />}
      {view === 'game' && room && <GameRoom room={room} user={user} onTrade={trade} />}
      {view === 'results' && room && <ResultsScreen room={room} user={user} onLeave={() => {setRoom(null); setView('lobby');}} />}
    </>
  );
}