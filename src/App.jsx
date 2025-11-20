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
  TrendingUp, 
  TrendingDown, 
  Activity,
  Play,
  Trophy,
  Zap,
  Lock,
  Cpu,
  Wifi
} from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stock-zero-v1';

// --- GLOBAL ANIMATIONS & STYLES INJECTION ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
    
    body {
      margin: 0;
      background-color: #050505;
      background-image: 
        radial-gradient(circle at 50% 0%, #1a1a2e 0%, #000 70%),
        linear-gradient(0deg, rgba(0,0,0,0.2) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px);
      background-size: 100% 100%, 40px 40px, 40px 40px;
      color: #fff;
      font-family: 'Rajdhani', sans-serif;
      overflow: hidden; /* Prevent scroll on full app */
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0a0a0a; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    
    /* Animations */
    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }
    @keyframes pulse-glow {
      0% { box-shadow: 0 0 5px currentColor; }
      50% { box-shadow: 0 0 20px currentColor; }
      100% { box-shadow: 0 0 5px currentColor; }
    }
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes grid-move {
      0% { background-position: 0 0; }
      100% { background-position: 40px 40px; }
    }
    
    .glass-panel {
      background: rgba(20, 25, 35, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }

    .neon-text {
      text-shadow: 0 0 10px currentColor;
    }
  `}</style>
);

// --- THEME CONSTANTS ---
const theme = {
  green: '#00ff9d',
  greenDim: 'rgba(0, 255, 157, 0.1)',
  red: '#ff0055',
  redDim: 'rgba(255, 0, 85, 0.1)',
  blue: '#00f3ff',
  purple: '#bc13fe',
  bg: '#050505',
  panel: '#0f111a',
  fontDisplay: "'Rajdhani', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

// --- STYLES OBJECT ---
const s = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  centerFlex: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    position: 'relative',
    zIndex: 2,
  },
  card: {
    width: '400px',
    padding: '40px',
    borderRadius: '24px',
    border: `1px solid rgba(255,255,255,0.1)`,
    background: 'linear-gradient(145deg, rgba(20,25,35,0.9) 0%, rgba(10,12,16,0.95) 100%)',
    boxShadow: `0 0 40px rgba(0, 243, 255, 0.1)`,
    animation: 'slide-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
  },
  input: {
    background: 'rgba(0,0,0,0.3)',
    border: `1px solid ${theme.blue}`,
    color: theme.blue,
    fontFamily: theme.fontMono,
    fontSize: '24px',
    textAlign: 'center',
    letterSpacing: '0.5em',
    padding: '15px',
    borderRadius: '12px',
    width: '100%',
    outline: 'none',
    textShadow: `0 0 10px ${theme.blue}`,
    boxShadow: `inset 0 0 20px rgba(0, 243, 255, 0.1)`,
    marginBottom: '20px',
  },
  btn: (color = theme.blue) => ({
    background: `linear-gradient(180deg, ${color}22 0%, ${color}00 100%)`,
    border: `1px solid ${color}`,
    color: color,
    padding: '16px',
    borderRadius: '12px',
    fontFamily: theme.fontDisplay,
    fontWeight: '700',
    fontSize: '16px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    width: '100%',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: `0 0 15px ${color}44`,
    textShadow: `0 0 8px ${color}`,
  }),
  header: {
    height: '70px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 30px',
    background: 'rgba(10,12,16,0.8)',
    backdropFilter: 'blur(10px)',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    height: 'calc(100vh - 70px)',
  },
  chartArea: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.1)',
  },
  tradeControls: {
    height: '140px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    background: '#08090c',
    display: 'flex',
    padding: '20px 30px',
    gap: '20px',
    alignItems: 'center',
  },
  sidebar: {
    background: 'rgba(5,5,5,0.5)',
    display: 'flex',
    flexDirection: 'column',
  },
  ticker: {
    fontSize: '48px',
    fontFamily: theme.fontMono,
    fontWeight: 'bold',
    letterSpacing: '-2px',
    lineHeight: 1,
  },
  bigBtn: (type, disabled) => ({
    flex: 1,
    height: '100%',
    borderRadius: '16px',
    border: 'none',
    background: type === 'buy' 
        ? `linear-gradient(135deg, #00ff9d 0%, #00cc7d 100%)`
        : `linear-gradient(135deg, #ff0055 0%, #cc0044 100%)`,
    color: '#000',
    fontFamily: theme.fontDisplay,
    fontWeight: '800',
    fontSize: '24px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    boxShadow: disabled ? 'none' : `0 0 30px ${type === 'buy' ? theme.green : theme.red}66`,
    transform: disabled ? 'none' : 'scale(1)',
    transition: 'transform 0.1s, box-shadow 0.2s',
    position: 'relative',
    overflow: 'hidden',
  })
};

// --- HELPER FUNCTIONS ---
const generateRoomId = () => Math.floor(1000 + Math.random() * 9000).toString();
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

// --- COMPONENTS ---

// 1. LOGIN
const LoginScreen = ({ onLogin, error }) => {
  const [loading, setLoading] = useState(false);
  const handleGuest = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); } catch (e) { onLogin(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={s.container}>
      <div style={s.centerFlex}>
        {/* Background Decoration */}
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: theme.purple, filter: 'blur(150px)', opacity: 0.15, borderRadius: '50%', zIndex: -1 }}></div>

        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
            <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: theme.blue, filter: 'blur(20px)', opacity: 0.6 }}></div>
                <Activity size={64} color={theme.blue} style={{ position: 'relative', zIndex: 2 }} />
            </div>
          </div>
          
          <h1 style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '32px', fontWeight: '700', letterSpacing: '2px' }}>
            ZEROSUM<span style={{ color: theme.blue }}>.TRADER</span>
          </h1>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: '40px', letterSpacing: '1px', fontSize: '14px' }}>HIGH FREQUENCY SIMULATION</p>

          {error && <div style={{ padding: '15px', background: `${theme.red}22`, border: `1px solid ${theme.red}`, color: theme.red, borderRadius: '8px', marginBottom: '20px', fontSize: '12px' }}>{error}</div>}

          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => onLogin(e.message))} style={{ ...s.btn('white'), background: 'white', color: 'black', marginBottom: '15px', boxShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
            INITIATE VIA GOOGLE
          </button>
          <button onClick={handleGuest} style={s.btn(theme.blue)} disabled={loading}>
            {loading ? "ESTABLISHING UPLINK..." : "GUEST ACCESS"}
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. LOBBY
const LobbyScreen = ({ user, onCreate, onJoin, onSignOut }) => {
  const [code, setCode] = useState('');
  return (
    <div style={s.container}>
       <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 10 }}>
          <button onClick={onSignOut} style={{ background: 'transparent', border: `1px solid ${theme.red}`, color: theme.red, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Disconnect</button>
       </div>
       <div style={s.centerFlex}>
          <div style={{ ...s.card, width: '450px' }}>
             <h2 style={{ textAlign: 'center', fontSize: '24px', marginBottom: '30px' }}>
                IDENTITY: <span style={{ color: theme.blue }}>{user.displayName || 'UNKNOWN'}</span>
             </h2>
             
             <div onClick={onCreate} style={{ padding: '25px', background: `${theme.green}11`, border: `1px solid ${theme.green}`, borderRadius: '16px', marginBottom: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = `${theme.green}22`} onMouseLeave={e => e.currentTarget.style.background = `${theme.green}11`}>
                <div>
                    <div style={{ color: theme.green, fontWeight: 'bold', fontSize: '20px', marginBottom: '5px' }}>HOST MARKET</div>
                    <div style={{ color: '#aaa', fontSize: '12px' }}>CREATE NEW SESSION</div>
                </div>
                <Play fill={theme.green} color={theme.green} />
             </div>

             <div style={{ padding: '25px', background: `${theme.purple}11`, border: `1px solid ${theme.purple}`, borderRadius: '16px' }}>
                <div style={{ color: theme.purple, fontWeight: 'bold', fontSize: '20px', marginBottom: '15px' }}>JOIN MARKET</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input value={code} onChange={e => setCode(e.target.value)} placeholder="CODE" style={{ ...s.input, marginBottom: 0, fontSize: '18px', padding: '12px' }} maxLength={4} />
                    <button onClick={() => onJoin(code)} disabled={code.length !== 4} style={{ ...s.btn(theme.purple), width: 'auto', padding: '0 30px' }}>ENTER</button>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

// 3. WAITING ROOM
const WaitingRoom = ({ room, user, onStart, onLeave }) => {
  return (
    <div style={s.container}>
       <div style={s.centerFlex}>
          <div style={{ textAlign: 'center', width: '100%', maxWidth: '600px' }}>
              <div style={{ color: '#666', letterSpacing: '5px', marginBottom: '10px', fontSize: '14px' }}>SECURE CHANNEL ESTABLISHED</div>
              <h1 style={{ fontSize: '120px', fontFamily: theme.fontMono, margin: 0, color: 'white', textShadow: '0 0 40px rgba(255,255,255,0.5)', lineHeight: 0.8 }}>
                {room.id}
              </h1>
              <div style={{ color: theme.blue, marginBottom: '60px', marginTop: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <Wifi size={18} /> WAITING FOR TRADERS
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '50px' }}>
                  {Object.values(room.players).map(p => (
                      <div key={p.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', border: `1px solid ${p.id === room.hostId ? theme.blue : '#333'}` }}>
                          <div style={{ width: '10px', height: '10px', background: p.id === room.hostId ? theme.blue : '#666', borderRadius: '50%', marginRight: '15px', boxShadow: p.id === room.hostId ? `0 0 10px ${theme.blue}` : 'none' }}></div>
                          <span style={{ fontFamily: theme.fontMono, letterSpacing: '1px', fontSize: '14px' }}>{p.name.toUpperCase()}</span>
                      </div>
                  ))}
              </div>

              {room.hostId === user.uid ? (
                  <button onClick={onStart} style={{ ...s.btn(theme.green), fontSize: '24px', padding: '25px', boxShadow: `0 0 40px ${theme.green}44` }}>
                      <Zap fill="currentColor" style={{ marginRight: '10px' }}/> INITIALIZE MARKET
                  </button>
              ) : (
                  <div style={{ color: '#555', fontStyle: 'italic' }}>// Waiting for host command...</div>
              )}
              
              <button onClick={onLeave} style={{ background: 'none', border: 'none', color: '#555', marginTop: '30px', cursor: 'pointer', textDecoration: 'underline' }}>ABORT SESSION</button>
          </div>
       </div>
    </div>
  );
};

// 4. THE FLASHY CHART
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
  const start = prices[0];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.15; 
  const range = (max - min) + (pad * 2) || 1;
  const effectiveMin = min - pad;
  const startTime = history[0].time;
  const timeRange = (history[history.length - 1].time - startTime) || 1;

  const points = history.map(h => {
      const x = ((h.time - startTime) / timeRange) * dims.w;
      const y = dims.h - ((h.price - effectiveMin) / range) * dims.h;
      return `${x},${y}`;
  }).join(' ');

  const isUp = current >= start;
  const color = isUp ? theme.green : theme.red;

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        {/* Dynamic Grid Background */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: '40px 40px', animation: 'grid-move 20s linear infinite' }}></div>
        
        {/* Price Labels */}
        <div style={{ position: 'absolute', right: 10, top: 10, bottom: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', fontFamily: theme.fontMono, color: color, opacity: 0.7, pointerEvents: 'none' }}>
            <span>{max.toFixed(2)}</span>
            <span>{min.toFixed(2)}</span>
        </div>

        <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="fillGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            
            {/* Area Fill */}
            <path d={`M0,${dims.h} ${points} L${dims.w},${dims.h} Z`} fill="url(#fillGrad)" />
            
            {/* The Line with Glow */}
            <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" filter="url(#glow)" vectorEffect="non-scaling-stroke" />
            
            {/* Pulsing Orb at tip */}
            <g transform={`translate(${dims.w}, ${dims.h - ((current - effectiveMin) / range) * dims.h})`}>
                <circle r="4" fill="#fff" />
                <circle r="8" fill={color} opacity="0.5">
                    <animate attributeName="r" from="8" to="20" dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1s" repeatCount="indefinite" />
                </circle>
            </g>
        </svg>
    </div>
  );
};

// 5. GAME ROOM
const GameRoom = ({ room, user, onTrade }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [flash, setFlash] = useState(false);
  const p = room.players[user.uid];
  const price = room.price;
  const equity = p.cash + (p.shares * price);
  const initial = p.initialValue || 1000;
  const profit = equity - initial;

  useEffect(() => {
    // Flash effect on price change
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 200);
    return () => clearTimeout(t);
  }, [price]);

  useEffect(() => {
    const end = room.startTime.seconds + room.duration;
    const t = setInterval(() => setTimeLeft(Math.max(0, end - Date.now()/1000)), 1000);
    return () => clearInterval(t);
  }, [room]);

  const formatTime = s => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  const isUp = room.history.length > 1 && price >= room.history[room.history.length-2].price;
  const mainColor = isUp ? theme.green : theme.red;

  return (
    <div style={s.container}>
        {/* HEADER */}
        <header style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ padding: '5px 10px', border: `1px solid ${theme.blue}`, color: theme.blue, borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px' }}>ZERO.USD</div>
                <div style={{ ...s.ticker, color: mainColor, transition: 'color 0.3s', textShadow: flash ? `0 0 20px ${mainColor}` : 'none' }}>
                    {formatCurrency(price)}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                 <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#666', letterSpacing: '1px' }}>SESSION TIMER</div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: '24px', color: timeLeft < 30 ? theme.red : 'white' }}>{formatTime(timeLeft)}</div>
                 </div>
            </div>
        </header>

        {/* MAIN CONTENT */}
        <div style={s.mainGrid}>
            {/* Left: Chart & Controls */}
            <div style={s.chartArea}>
                {/* The Chart fills the remaining space */}
                <div style={{ flex: 1, padding: '20px', background: `radial-gradient(circle at center, ${mainColor}05 0%, transparent 70%)` }}>
                    <NeonChart history={room.history} />
                </div>

                {/* Massive Controls */}
                <div style={s.tradeControls}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ color: '#888', fontSize: '12px', letterSpacing: '1px' }}>AVAILABLE CAPITAL</div>
                        <div style={{ fontFamily: theme.fontMono, fontSize: '28px', color: 'white' }}>{formatCurrency(p.cash)}</div>
                    </div>

                    <div style={{ width: '400px', height: '80px', display: 'flex', gap: '20px' }}>
                        <button onClick={() => onTrade('sell')} disabled={p.shares <= 0} style={s.bigBtn('sell', p.shares <= 0)}>
                            SELL
                            <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '5px', opacity: 0.8 }}>BID {formatCurrency(price-1)}</div>
                        </button>
                        <button onClick={() => onTrade('buy')} disabled={p.cash < price} style={s.bigBtn('buy', p.cash < price)}>
                            BUY
                            <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '5px', opacity: 0.8 }}>ASK {formatCurrency(price)}</div>
                        </button>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'right' }}>
                        <div style={{ color: '#888', fontSize: '12px', letterSpacing: '1px' }}>POSITIONS</div>
                        <div style={{ fontFamily: theme.fontMono, fontSize: '28px', color: theme.blue }}>{p.shares} <span style={{ fontSize: '14px', color: '#555' }}>UNITS</span></div>
                    </div>
                </div>
            </div>

            {/* Right: Leaderboard */}
            <div style={s.sidebar}>
                <div style={{ padding: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ color: '#888', fontSize: '12px', letterSpacing: '2px', marginBottom: '10px' }}>TOTAL EQUITY</div>
                    <div style={{ fontSize: '36px', fontFamily: theme.fontMono, fontWeight: 'bold' }}>{formatCurrency(equity)}</div>
                    <div style={{ color: profit >= 0 ? theme.green : theme.red, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                        <span style={{ fontSize: '12px', background: profit >= 0 ? theme.greenDim : theme.redDim, padding: '2px 6px', borderRadius: '4px' }}>
                            {((profit/initial)*100).toFixed(2)}%
                        </span>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    <div style={{ padding: '10px 20px', fontSize: '10px', color: '#555', letterSpacing: '2px', marginBottom: '10px' }}>MARKET PARTICIPANTS</div>
                    {Object.values(room.players)
                        .sort((a,b) => (b.cash + b.shares*price) - (a.cash + a.shares*price))
                        .map((pl, i) => (
                            <div key={pl.id} style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', 
                                marginBottom: '10px', borderRadius: '8px', 
                                background: pl.id === user.uid ? 'rgba(0, 243, 255, 0.05)' : 'transparent',
                                border: pl.id === user.uid ? `1px solid ${theme.blue}44` : 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ fontFamily: theme.fontMono, color: i===0 ? theme.green : '#666', fontWeight: 'bold' }}>#{i+1}</div>
                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{pl.name}</div>
                                </div>
                                <div style={{ fontFamily: theme.fontMono, color: '#aaa' }}>{formatCurrency(pl.cash + pl.shares*price)}</div>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    </div>
  );
};

// 6. RESULTS
const ResultsScreen = ({ room, user, onLeave }) => {
    const finalPrice = room.price;
    const sorted = Object.values(room.players).sort((a,b) => (b.cash + b.shares*finalPrice) - (a.cash + a.shares*finalPrice));
    const winner = sorted[0];
    
    return (
        <div style={s.container}>
            <div style={s.centerFlex}>
                {/* Confetti BG */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                     {[...Array(20)].map((_,i) => (
                        <div key={i} style={{
                            position: 'absolute', left: `${Math.random()*100}%`, top: `-10%`,
                            width: '5px', height: '20px', background: [theme.green, theme.blue, theme.purple][Math.floor(Math.random()*3)],
                            animation: `scanline ${2+Math.random()}s linear infinite`
                        }}></div>
                     ))}
                </div>

                <div style={{ ...s.card, width: '500px', textAlign: 'center', background: 'rgba(10,12,16,0.95)', border: `2px solid ${theme.green}` }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <div style={{ padding: '20px', borderRadius: '50%', background: `${theme.green}22`, border: `1px solid ${theme.green}` }}>
                            <Trophy size={48} color={theme.green} />
                        </div>
                    </div>
                    
                    <div style={{ color: '#888', letterSpacing: '4px', marginBottom: '10px' }}>MARKET CLOSED</div>
                    <h1 style={{ fontSize: '48px', margin: '0 0 30px 0', color: 'white' }}>{winner.name}</h1>
                    
                    <div style={{ fontSize: '64px', fontFamily: theme.fontMono, color: theme.green, fontWeight: 'bold', textShadow: `0 0 30px ${theme.green}` }}>
                        {formatCurrency(winner.cash + winner.shares*finalPrice)}
                    </div>
                    <div style={{ marginBottom: '40px', color: theme.green }}>FINAL EQUITY</div>

                    <button onClick={onLeave} style={s.btn('white')}>RETURN TO LOBBY</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [view, setView] = useState('login'); 
  const [error, setError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({ uid: u.uid, displayName: u.displayName || 'Guest' });
        if(view === 'login') setView('lobby');
      } else {
        setUser(null); setView('login');
      }
    });
  }, [view]);

  useEffect(() => {
    if (!room?.id) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoom(prev => ({ ...prev, ...data }));
        if (data.status === 'playing' && view === 'waiting') setView('game');
        if (data.status === 'finished') setView('results');
        if (data.status === 'playing' && user?.uid === data.hostId) {
             if ((Date.now()/1000) > (data.startTime.seconds + data.duration)) {
                 updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'finished' });
             }
        }
      } else {
        setRoom(null); setView('lobby'); setError("Connection Lost");
      }
    });
    return () => unsub();
  }, [room?.id, view]);

  const createRoom = async () => {
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
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) return setError('Invalid Frequency');
    const data = snap.data();
    if (data.status !== 'waiting') return setError('Market Closed');
    await updateDoc(ref, { [`players.${user.uid}`]: { id: user.uid, name: user.displayName, cash: 1000, shares: 0, initialValue: 1000 } });
    setRoom(data); setView('waiting');
  };

  const trade = async (type) => {
    if (!room) return;
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