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
  Users, 
  Clock, 
  Activity,
  Play,
  Trophy,
  LogOut,
  Copy,
  AlertCircle,
  BarChart3,
  LayoutDashboard,
  Zap
} from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stock-zero-v1';

// --- STYLES (INLINE THEME) ---
const theme = {
  bg: '#0b0e14',       // Deep dark background
  panel: '#151a23',    // Slightly lighter panel
  border: '#2a3241',   // Borders
  text: '#ffffff',     // Main text
  textDim: '#9ca3af',  // Secondary text
  green: '#10b981',    // Profit/Buy
  red: '#ef4444',      // Loss/Sell
  blue: '#3b82f6',     // Brand
  yellow: '#eab308',   // Warnings/Fees
  font: 'system-ui, -apple-system, sans-serif',
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily: theme.font,
    display: 'flex',
    flexDirection: 'column',
  },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  card: {
    backgroundColor: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  btnPrimary: {
    backgroundColor: 'white',
    color: 'black',
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  btnSecondary: {
    backgroundColor: '#272e3b',
    color: 'white',
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontWeight: 'bold',
    border: `1px solid ${theme.border}`,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
  },
  input: {
    background: theme.bg,
    border: `1px solid ${theme.border}`,
    color: 'white',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '18px',
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: '4px',
    width: '100%',
    outline: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 24px',
    borderBottom: `1px solid ${theme.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 26, 35, 0.8)',
  },
  mainArea: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
  },
  chartContainer: {
    flex: 1,
    position: 'relative',
    padding: '20px',
    minHeight: '300px', // Forces graph height
  },
  controls: {
    padding: '24px',
    borderTop: `1px solid ${theme.border}`,
    backgroundColor: theme.panel,
  },
  sidebar: {
    borderLeft: `1px solid ${theme.border}`,
    backgroundColor: theme.panel,
    display: 'flex',
    flexDirection: 'column',
  },
};

// --- HELPER FUNCTIONS ---
const generateRoomId = () => Math.floor(1000 + Math.random() * 9000).toString();
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

// --- COMPONENTS ---

// 1. LOGIN SCREEN
const LoginScreen = ({ onLogin, error }) => {
  const [loading, setLoading] = useState(false);

  const handleGuest = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); } 
    catch (e) { onLogin(e.message); } 
    finally { setLoading(false); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.centered}>
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Activity size={48} color={theme.green} />
          </div>
          <h1 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '0 0 10px 0' }}>ZeroSum Trader</h1>
          <p style={{ textAlign: 'center', color: theme.textDim, marginBottom: '30px' }}>Real-time market simulation</p>
          
          {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}
          
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => onLogin(e.message))} style={styles.btnPrimary}>
            Sign in with Google
          </button>
          <div style={{ textAlign: 'center', color: theme.textDim, margin: '15px 0', fontSize: '14px' }}>- OR -</div>
          <button onClick={handleGuest} style={styles.btnSecondary} disabled={loading}>
            {loading ? "Connecting..." : "Continue as Guest"}
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. LOBBY SCREEN
const LobbyScreen = ({ user, onCreate, onJoin, onSignOut }) => {
  const [code, setCode] = useState('');
  return (
    <div style={styles.container}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer' }}>Sign Out</button>
      </div>
      <div style={styles.centered}>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Welcome, {user.displayName || 'Trader'}</h2>
          </div>
          
          <button onClick={onCreate} style={{ ...styles.card, padding: '24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Create Room</h3>
                <span style={{ fontSize: '12px', color: theme.textDim }}>Host a session</span>
            </div>
            <Play fill="white" />
          </button>

          <div style={{ ...styles.card, padding: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Join Room</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="0000" style={styles.input} maxLength={4} />
                <button onClick={() => onJoin(code)} disabled={code.length !== 4} style={{ ...styles.btnSecondary, width: 'auto', padding: '0 24px' }}>Join</button>
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
    <div style={styles.container}>
      <div style={{ ...styles.centered, flexDirection: 'column' }}>
        <h1 style={{ fontSize: '64px', fontFamily: 'monospace', margin: '20px 0' }}>{room.id}</h1>
        <p style={{ color: theme.textDim }}>Waiting for players...</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '40px 0', width: '100%', maxWidth: '500px' }}>
            {Object.values(room.players).map(p => (
                <div key={p.id} style={{ padding: '15px', background: theme.panel, borderRadius: '8px', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', background: theme.border, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{p.name?.[0]}</div>
                    <span>{p.name}</span>
                    {p.id === room.hostId && <span style={{ fontSize: '10px', color: theme.yellow, marginLeft: 'auto' }}>HOST</span>}
                </div>
            ))}
        </div>

        {room.hostId === user.uid ? (
            <button onClick={onStart} style={{ ...styles.btnPrimary, maxWidth: '300px', background: theme.green, color: 'white' }}>START GAME</button>
        ) : (
            <div style={{ color: theme.textDim, fontStyle: 'italic' }}>Waiting for host...</div>
        )}
        <button onClick={onLeave} style={{ marginTop: '20px', background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer' }}>Leave</button>
      </div>
    </div>
  );
};

// 4. CHART COMPONENT (Robust SVG)
const StockChart = ({ history }) => {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });

  useEffect(() => {
    const update = () => {
        if (ref.current) {
            setDims({ w: ref.current.clientWidth, h: ref.current.clientHeight });
        }
    };
    window.addEventListener('resize', update);
    update();
    setTimeout(update, 500); // check again after layout
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!history || history.length < 1) return null;

  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1];
  const start = prices[0];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.1; // 10% padding
  const range = (max - min) + (pad * 2) || 1;
  const effectiveMin = min - pad;

  const startTime = history[0].time;
  const timeRange = (history[history.length - 1].time - startTime) || 1;

  const points = history.map(h => {
      const x = ((h.time - startTime) / timeRange) * dims.w;
      const y = dims.h - ((h.price - effectiveMin) / range) * dims.h;
      return `${x},${y}`;
  }).join(' ');

  const color = current >= start ? theme.green : theme.red;

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: theme.textDim, pointerEvents: 'none' }}>
            <span>{max.toFixed(2)}</span>
            <span>{min.toFixed(2)}</span>
        </div>
        <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            <path d={`M0,${dims.h} ${points} L${dims.w},${dims.h} Z`} fill="url(#g)" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={dims.w} cy={dims.h - ((current - effectiveMin) / range) * dims.h} r="4" fill={color} />
        </svg>
    </div>
  );
};

// 5. GAME ROOM
const GameRoom = ({ room, user, onTrade }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const p = room.players[user.uid];
  const price = room.price;
  const equity = p.cash + (p.shares * price);
  
  // Responsive check for mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const end = room.startTime.seconds + room.duration;
    const t = setInterval(() => setTimeLeft(Math.max(0, end - Date.now()/1000)), 1000);
    return () => clearInterval(t);
  }, [room]);

  const formatTime = s => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  const isUp = room.history.length > 1 && price >= room.history[room.history.length-2].price;

  // Dynamic Layout Styles
  const layoutStyle = isMobile 
    ? { ...styles.container, display: 'block', overflowY: 'auto' }
    : styles.grid;
  
  const mainAreaStyle = isMobile
    ? { display: 'flex', flexDirection: 'column', minHeight: '60vh' }
    : styles.mainArea;

  const sidebarStyle = isMobile
    ? { ...styles.sidebar, borderLeft: 'none', borderTop: `1px solid ${theme.border}`, height: 'auto' }
    : styles.sidebar;

  return (
    <div style={layoutStyle}>
        {/* LEFT / TOP: CHART & CONTROLS */}
        <div style={mainAreaStyle}>
            <header style={styles.header}>
                <div>
                    <div style={{ fontSize: '12px', color: theme.textDim }}>ZERO/USD</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: isUp ? theme.green : theme.red, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {formatCurrency(price)}
                        {isUp ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: theme.textDim }}>TIMER</div>
                    <div style={{ fontSize: '20px', fontFamily: 'monospace', color: timeLeft < 30 ? theme.red : theme.text }}>{formatTime(timeLeft)}</div>
                </div>
            </header>

            <div style={styles.chartContainer}>
                <StockChart history={room.history} />
            </div>

            <div style={styles.controls}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div>
                        <div style={{ fontSize: '10px', color: theme.textDim, textTransform: 'uppercase' }}>Available Cash</div>
                        <div style={{ fontSize: '18px', fontFamily: 'monospace' }}>{formatCurrency(p.cash)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: theme.textDim, textTransform: 'uppercase' }}>Shares Held</div>
                        <div style={{ fontSize: '18px', fontFamily: 'monospace', color: theme.blue }}>{p.shares}</div>
                    </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <button 
                        onClick={() => onTrade('sell')} 
                        disabled={p.shares <= 0}
                        style={{ ...styles.btnSecondary, background: 'rgba(239, 68, 68, 0.1)', borderColor: theme.red, color: theme.red, opacity: p.shares <= 0 ? 0.5 : 1 }}
                    >
                        SELL
                    </button>
                    <button 
                        onClick={() => onTrade('buy')} 
                        disabled={p.cash < price}
                        style={{ ...styles.btnSecondary, background: 'rgba(16, 185, 129, 0.1)', borderColor: theme.green, color: theme.green, opacity: p.cash < price ? 0.5 : 1 }}
                    >
                        BUY
                    </button>
                </div>
            </div>
        </div>

        {/* RIGHT / BOTTOM: LEADERBOARD */}
        <div style={sidebarStyle}>
            <div style={{ padding: '20px', borderBottom: `1px solid ${theme.border}`, background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '10px', color: theme.textDim, textTransform: 'uppercase', marginBottom: '5px' }}>Total Equity</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(equity)}</div>
                <div style={{ fontSize: '14px', color: equity >= p.initialValue ? theme.green : theme.red }}>
                    {((equity - p.initialValue) / p.initialValue * 100).toFixed(2)}%
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '10px 20px', display: 'flex', fontSize: '10px', color: theme.textDim, textTransform: 'uppercase', fontWeight: 'bold' }}>
                    <span style={{ flex: 1 }}>Trader</span>
                    <span>Net Worth</span>
                </div>
                {Object.values(room.players)
                    .sort((a,b) => (b.cash + b.shares*price) - (a.cash + a.shares*price))
                    .map((pl, i) => (
                        <div key={pl.id} style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}`, background: pl.id === user.uid ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: theme.textDim, fontFamily: 'monospace', width: '20px' }}>{i+1}</span>
                                <span style={{ fontWeight: pl.id === user.uid ? 'bold' : 'normal' }}>{pl.name}</span>
                            </div>
                            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.cash + pl.shares*price)}</span>
                        </div>
                    ))
                }
            </div>
        </div>
    </div>
  );
};

// 6. RESULTS
const ResultsScreen = ({ room, user, onLeave }) => {
    const finalPrice = room.price;
    const sorted = Object.values(room.players).sort((a,b) => (b.cash + b.shares*finalPrice) - (a.cash + a.shares*finalPrice));
    return (
        <div style={styles.container}>
            <div style={styles.centered}>
                <div style={{ ...styles.card, textAlign: 'center' }}>
                    <Trophy size={48} color={theme.yellow} style={{ margin: '0 auto 20px auto' }} />
                    <h1 style={{ fontSize: '32px', margin: '0 0 10px 0' }}>Market Closed</h1>
                    <p style={{ color: theme.textDim, marginBottom: '30px' }}>Winner: {sorted[0].name}</p>
                    
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                        {sorted.slice(0, 5).map((p, i) => (
                            <div key={p.id} style={{ padding: '12px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between' }}>
                                <span>#{i+1} {p.name}</span>
                                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(p.cash + p.shares*finalPrice)}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={onLeave} style={styles.btnPrimary}>Back to Lobby</button>
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
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({ uid: u.uid, displayName: u.displayName || 'Guest' });
        if(view === 'login') setView('lobby');
      } else {
        setUser(null); setView('login');
      }
    });
    return () => unsub();
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
        setRoom(null); setView('lobby'); setError("Room closed");
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
    if (!snap.exists()) return setError('Room not found');
    const data = snap.data();
    if (data.status !== 'waiting') return setError('Game in progress');
    
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
    <div style={styles.container}>
      {view === 'login' && <LoginScreen onLogin={setError} error={error} />}
      {view === 'lobby' && user && <LobbyScreen user={user} onCreate={createRoom} onJoin={joinRoom} onSignOut={() => signOut(auth)} />}
      {view === 'waiting' && room && <WaitingRoom room={room} user={user} onStart={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'playing', startTime: serverTimestamp() })} onLeave={() => {setRoom(null); setView('lobby');}} />}
      {view === 'game' && room && <GameRoom room={room} user={user} onTrade={trade} />}
      {view === 'results' && room && <ResultsScreen room={room} user={user} onLeave={() => {setRoom(null); setView('lobby');}} />}
    </div>
  );
}