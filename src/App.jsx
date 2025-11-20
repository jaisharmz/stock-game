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
  Zap,
  Wallet
} from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stock-zero-v1';

// --- HELPER FUNCTIONS ---
const generateRoomId = () => Math.floor(1000 + Math.random() * 9000).toString();

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(val);
};

// --- COMPONENTS ---

// 1. LOGIN SCREEN
const LoginScreen = ({ onLogin, error }) => {
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error(err);
      let msg = "Guest login failed.";
      if (err.code === 'auth/operation-not-allowed') {
        msg = "Enable 'Anonymous' in Firebase Console > Authentication > Sign-in method.";
      }
      onLogin(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      onLogin(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-600/10 rounded-full ring-1 ring-blue-500/50">
            <Activity className="w-12 h-12 text-blue-500" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-white mb-2">ZeroSum Trader</h1>
        <p className="text-gray-400 text-center mb-8">Real-time high-frequency simulation.</p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-100 transition-all flex justify-center items-center gap-2"
          >
            Sign in with Google
          </button>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-900 text-gray-500">or</span></div>
          </div>
          <button 
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full bg-gray-800 text-gray-200 font-bold py-3 rounded-xl hover:bg-gray-700 transition-all flex justify-center items-center gap-2 border border-gray-700"
          >
            {loading ? <Zap className="w-4 h-4 animate-pulse" /> : <Users className="w-4 h-4" />}
            Continue as Guest
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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button onClick={onSignOut} className="text-gray-400 hover:text-white text-sm">Sign Out</button>
      </div>
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Welcome, {user.displayName || 'Trader'}</h2>
            <p className="text-gray-500">Market is open. Choose your venue.</p>
        </div>

        <button onClick={onCreate} className="w-full group relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl text-left hover:shadow-lg hover:shadow-blue-900/20 transition-all">
            <div className="relative z-10 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Create Room</h3>
                    <p className="text-blue-100 text-sm opacity-80">Host a new trading session</p>
                </div>
                <Play className="text-white opacity-80 group-hover:opacity-100 transform group-hover:scale-110 transition-all" />
            </div>
        </button>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Join Room</h3>
            <div className="flex gap-2">
                <input 
                    value={code}
                    onChange={(e) => setCode(e.target.value.slice(0,4))}
                    placeholder="0000"
                    className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 text-center font-mono text-xl tracking-widest text-white focus:border-blue-500 outline-none uppercase"
                />
                <button 
                    onClick={() => onJoin(code)}
                    disabled={code.length !== 4}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-6 rounded-xl font-bold disabled:opacity-50"
                >
                    Join
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

// 3. WAITING ROOM
const WaitingRoom = ({ room, user, onStart, onLeave }) => {
  const isHost = room.hostId === user.uid;
  
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="mb-8">
            <div className="text-gray-500 text-sm uppercase tracking-widest mb-2">Room Code</div>
            <div className="text-6xl font-mono font-bold text-white tracking-widest flex items-center justify-center gap-4">
                {room.id}
                <button onClick={() => navigator.clipboard.writeText(room.id)} className="p-2 hover:bg-gray-900 rounded-lg"><Copy className="w-6 h-6 text-gray-600" /></button>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mb-12">
            {Object.values(room.players).map(p => (
                <div key={p.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center gap-3 text-left">
                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-bold">
                        {p.name ? p.name[0] : '?'}
                    </div>
                    <div>
                        <div className="text-white font-medium">{p.name}</div>
                        {p.id === room.hostId && <div className="text-xs text-yellow-500">HOST</div>}
                    </div>
                </div>
            ))}
        </div>

        {isHost ? (
            <button onClick={onStart} className="bg-green-600 hover:bg-green-500 text-white px-12 py-4 rounded-full font-bold text-xl shadow-lg shadow-green-900/20 transition-all flex items-center gap-3">
                <Play className="fill-current" /> Open Market
            </button>
        ) : (
            <div className="flex items-center gap-3 text-gray-500 animate-pulse">
                <Clock /> Waiting for host to start...
            </div>
        )}
        
        <button onClick={onLeave} className="mt-8 text-gray-600 hover:text-gray-400 text-sm">Leave Room</button>
    </div>
  );
};

// 4. GAME: AREA CHART COMPONENT
const StockChart = ({ history }) => {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if(ref.current) setDims({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
    };
    window.addEventListener('resize', update);
    update();
    // Force update after mount to ensure flex container has sized
    setTimeout(update, 100);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!history || history.length < 2) return <div className="h-full flex items-center justify-center text-gray-700 font-mono">WAITING FOR TICKS...</div>;

  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1];
  const start = prices[0];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = (max - min) * 0.2; // 20% padding
  const effectiveMin = min - padding;
  const range = (max + padding) - effectiveMin || 1;

  const times = history.map(h => h.time);
  const timeRange = times[times.length - 1] - times[0] || 1;

  // Color logic
  const isUp = current >= start;
  const color = isUp ? '#10b981' : '#ef4444'; // Tailwind emerald-500 or red-500

  // Generate SVG Path
  const points = history.map((h) => {
    const x = ((h.time - times[0]) / timeRange) * dims.w;
    const y = dims.h - ((h.price - effectiveMin) / range) * dims.h;
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `0,${dims.h} ${points} ${dims.w},${dims.h}`;

  return (
    <div ref={ref} className="w-full h-full relative overflow-hidden">
        {/* Grid */}
        <div className="absolute inset-0 border-t border-b border-gray-800/50"></div>
        
        {/* Price Labels */}
        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-2 px-1 text-[10px] font-mono text-gray-600 pointer-events-none z-10">
            <span>{max.toFixed(2)}</span>
            <span>{min.toFixed(2)}</span>
        </div>

        <svg width="100%" height="100%" className="overflow-visible">
            <defs>
                <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            <path d={`M0,${dims.h} ${points} L${dims.w},${dims.h} Z`} fill="url(#grad)" />
            <polyline fill="none" stroke={color} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {/* Pulsing Dot */}
            <circle cx={dims.w} cy={dims.h - ((current - effectiveMin) / range) * dims.h} r="4" fill={color} />
        </svg>
    </div>
  );
};

// 5. GAME ROOM
const GameRoom = ({ room, user, onTrade }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const myData = room.players[user.uid];
  const currentPrice = room.price;
  const equity = myData.cash + (myData.shares * currentPrice);
  const profit = equity - myData.initialValue;

  useEffect(() => {
    const end = room.startTime.seconds + room.duration;
    const timer = setInterval(() => {
      const rem = end - (Date.now() / 1000);
      setTimeLeft(Math.max(0, rem));
    }, 1000);
    return () => clearInterval(timer);
  }, [room]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* LEFT: MAIN TRADING AREA */}
      <div className="flex-1 flex flex-col relative border-r border-gray-800">
        {/* Header */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50">
            <div className="flex items-center gap-4">
                <div className="font-bold text-xl tracking-tight">ZERO.USD</div>
                <div className={`text-2xl font-mono font-bold ${room.history.length > 1 && currentPrice >= room.history[room.history.length-2].price ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(currentPrice)}
                </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
                <div className="flex flex-col items-end">
                    <span className="text-gray-500 text-[10px] uppercase">Fee Pool</span>
                    <span className="text-yellow-500 font-mono">{formatCurrency(room.transactionCosts || 0)}</span>
                </div>
                <div className="bg-gray-800 px-3 py-1 rounded font-mono text-white">
                    {formatTime(timeLeft)}
                </div>
            </div>
        </header>

        {/* Chart Container - Flex 1 to fill available space */}
        <div className="flex-1 min-h-0 p-4">
            <div className="w-full h-full bg-gray-900/30 rounded-xl border border-gray-800/50 relative">
               <StockChart history={room.history} />
            </div>
        </div>

        {/* Controls */}
        <div className="h-auto border-t border-gray-800 bg-gray-900 p-6">
            <div className="flex justify-between items-end mb-4 max-w-4xl mx-auto">
                <div>
                    <div className="text-gray-500 text-xs uppercase mb-1">Buying Power</div>
                    <div className="text-2xl font-mono font-bold text-white">{formatCurrency(myData.cash)}</div>
                </div>
                <div className="text-right">
                    <div className="text-gray-500 text-xs uppercase mb-1">Position</div>
                    <div className="text-2xl font-mono font-bold text-blue-400">{myData.shares} <span className="text-sm text-gray-500">SHARES</span></div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto h-16">
                <button 
                    onClick={() => onTrade('sell')}
                    disabled={myData.shares <= 0}
                    className="bg-red-500/10 hover:bg-red-600 hover:text-white text-red-500 border border-red-500/50 rounded-lg font-bold text-lg transition-all flex flex-col items-center justify-center disabled:opacity-30"
                >
                    <span>SELL</span>
                    <span className="text-[10px] font-mono opacity-75">BID {formatCurrency(currentPrice - 1)}</span>
                </button>
                <button 
                    onClick={() => onTrade('buy')}
                    disabled={myData.cash < currentPrice}
                    className="bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-500 border border-emerald-500/50 rounded-lg font-bold text-lg transition-all flex flex-col items-center justify-center disabled:opacity-30"
                >
                    <span>BUY</span>
                    <span className="text-[10px] font-mono opacity-75">ASK {formatCurrency(currentPrice)}</span>
                </button>
            </div>
        </div>
      </div>

      {/* RIGHT: SIDEBAR */}
      <div className="w-full md:w-80 bg-gray-900 flex flex-col">
         <div className="p-6 border-b border-gray-800">
             <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">My Portfolio</div>
             <div className="flex justify-between items-baseline">
                 <span className="text-2xl font-bold text-white">{formatCurrency(equity)}</span>
                 <span className={`font-bold text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                     {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
                 </span>
             </div>
         </div>
         
         <div className="flex-1 overflow-hidden flex flex-col">
             <div className="p-4 bg-gray-800/50 text-[10px] uppercase text-gray-400 font-bold tracking-wider flex justify-between">
                 <span>Trader</span>
                 <span>Equity</span>
             </div>
             <div className="flex-1 overflow-y-auto">
                 {Object.values(room.players)
                    .sort((a,b) => (b.cash + b.shares*currentPrice) - (a.cash + a.shares*currentPrice))
                    .map((p, i) => (
                     <div key={p.id} className={`flex justify-between items-center p-4 border-b border-gray-800 ${p.id === user.uid ? 'bg-blue-900/20' : ''}`}>
                         <div className="flex items-center gap-3">
                             <span className="font-mono text-gray-500 w-4">{i+1}</span>
                             <span className="text-sm font-medium text-gray-200 truncate w-24">{p.name}</span>
                         </div>
                         <div className="font-mono text-sm text-white">
                             {formatCurrency(p.cash + (p.shares * currentPrice))}
                         </div>
                     </div>
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
};

// 6. RESULTS SCREEN
const ResultsScreen = ({ room, user, onLeave }) => {
  const finalPrice = room.price;
  const sorted = Object.values(room.players).sort((a,b) => (b.cash + b.shares*finalPrice) - (a.cash + a.shares*finalPrice));
  const winner = sorted[0];
  
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-white mb-2">Market Closed</h1>
            <div className="text-gray-400 mb-8">Winner: <span className="text-white font-bold">{winner.name}</span></div>
            
            <div className="bg-gray-800/50 rounded-xl overflow-hidden mb-8">
                {sorted.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="flex justify-between p-4 border-b border-gray-800 last:border-0">
                        <span className="text-gray-300">#{i+1} {p.name}</span>
                        <span className="font-mono text-white font-bold">{formatCurrency(p.cash + p.shares*finalPrice)}</span>
                    </div>
                ))}
            </div>
            <button onClick={onLeave} className="w-full bg-white text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200">Return to Lobby</button>
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
        setUser(null);
        setView('login');
      }
    });
  }, [view]);

  // Room Sync
  useEffect(() => {
    if (!room?.id) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoom(prev => ({ ...prev, ...data }));
        if (data.status === 'playing' && view === 'waiting') setView('game');
        if (data.status === 'finished') setView('results');
        
        // Host Auto-End
        if (data.status === 'playing' && user?.uid === data.hostId) {
            if ((Date.now()/1000) > (data.startTime.seconds + data.duration)) {
                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'finished' });
            }
        }
      } else {
        setRoom(null); setView('lobby');
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
    await updateDoc(ref, { [`players.${user.uid}`]: { id: user.uid, name: user.displayName, cash: 1000, shares: 0, initialValue: 1000 } });
    setRoom(snap.data()); setView('waiting');
  };

  const trade = async (type) => {
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
    <div className="bg-gray-950 min-h-screen text-white font-sans">
      {view === 'login' && <LoginScreen onLogin={setError} error={error} />}
      {view === 'lobby' && user && <LobbyScreen user={user} onCreate={createRoom} onJoin={joinRoom} onSignOut={() => signOut(auth)} />}
      {view === 'waiting' && room && <WaitingRoom room={room} user={user} onStart={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'playing', startTime: serverTimestamp() })} onLeave={() => {setRoom(null); setView('lobby');}} />}
      {view === 'game' && room && <GameRoom room={room} user={user} onTrade={trade} />}
      {view === 'results' && room && <ResultsScreen room={room} user={user} onLeave={() => {setRoom(null); setView('lobby');}} />}
    </div>
  );
}