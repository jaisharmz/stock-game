import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
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
  DollarSign, 
  Activity,
  Play,
  Trophy,
  LogOut,
  Copy,
  AlertCircle,
  PiggyBank,
  BarChart3,
  LayoutDashboard
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

const formatCompactNumber = (number) => {
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(number);
};

// --- COMPONENTS ---

// 1. AUTH / LOGIN SCREEN
const LoginScreen = ({ onLogin, error }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Login Error:", err);
      let msg = `Login failed: ${err.message}`;
      if (err.code === 'auth/operation-not-allowed') {
        msg = "Google Login is not enabled in Firebase Console. Enable it in Auth > Sign-in method.";
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = "Domain unauthorized. Add it to 'Authorized Domains' in Firebase Console > Auth > Settings.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = "Sign-in cancelled.";
      }
      onLogin(null, msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoggingIn(true);
    try {
        await signInAnonymously(auth);
    } catch (err) {
        console.error(err);
        onLogin(null, "Guest login failed. Enable Anonymous Auth in Firebase Console.");
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-green-500/10 rounded-full ring-1 ring-green-500/30">
            <Activity className="w-12 h-12 text-green-500" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">ZeroSum Trader</h1>
        <p className="text-gray-400 text-center mb-8">High-frequency trading simulation.</p>
        
        {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
            </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3.5 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 shadow-lg"
          >
            {isLoggingIn ? (
                <span className="animate-pulse">Connecting...</span>
            ) : (
                <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                </>
            )}
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-gray-900 text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={isLoggingIn}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-xl transition-all border border-gray-700"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. LOBBY SCREEN
const LobbyScreen = ({ user, onJoinRoom, onCreateRoom, onSignOut }) => {
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-6 right-6">
        <button onClick={onSignOut} className="text-gray-500 hover:text-white text-sm transition-colors px-4 py-2 rounded-lg hover:bg-gray-900">Sign Out</button>
      </div>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl text-white font-bold tracking-tight">Welcome, {user.displayName || 'Trader'}</h2>
          <p className="text-gray-400">Select your trading venue</p>
        </div>

        <div className="grid gap-4">
          <button className="w-full bg-gray-900 p-6 rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-all cursor-pointer group text-left relative overflow-hidden" onClick={onCreateRoom}>
             <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-5">
                <div className="p-3.5 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <Activity className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Create Room</h3>
                  <p className="text-sm text-gray-400 mt-1">Host a new market session</p>
                </div>
              </div>
              <Play className="w-6 h-6 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </div>
          </button>

          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
            <div className="flex items-center space-x-5 mb-6">
              <div className="p-3.5 bg-purple-500/10 rounded-xl">
                <Users className="w-7 h-7 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Join Room</h3>
                <p className="text-sm text-gray-400 mt-1">Enter access code</p>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.slice(0, 4))}
                placeholder="0000"
                className="flex-1 bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none font-mono text-center tracking-[0.5em] text-xl uppercase placeholder:tracking-normal"
              />
              <button
                onClick={() => onJoinRoom(roomCode)}
                disabled={roomCode.length !== 4}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. WAITING ROOM
const WaitingRoom = ({ room, user, onStartGame, onLeave }) => {
  const isHost = room.hostId === user.uid;
  const playersList = Object.values(room.players || {});

  const copyCode = () => {
    const text = room.id;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <header className="flex justify-between items-center mb-12">
          <button onClick={onLeave} className="text-gray-500 hover:text-white flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Exit Lobby</span>
          </button>
          <div className="flex items-center gap-3 bg-gray-900 pl-5 pr-2 py-2 rounded-full border border-gray-800">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Room ID</span>
            <span className="text-white font-mono font-bold text-xl tracking-widest">{room.id}</span>
            <button onClick={copyCode} className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-full transition-all">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-yellow-500/5 rounded-full mb-6 ring-1 ring-yellow-500/20 relative">
                <div className="absolute inset-0 rounded-full border border-yellow-500/30 animate-ping opacity-20"></div>
                <Clock className="w-10 h-10 text-yellow-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Market Opening Soon</h2>
            <p className="text-gray-400 max-w-md mx-auto">Waiting for traders to take their positions. The host will ring the opening bell.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 flex-1 content-start">
          {playersList.map((p) => (
            <div key={p.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex items-center justify-between hover:border-gray-700 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                </div>
                <span className="text-white font-medium text-lg">{p.name || 'Unknown'}</span>
              </div>
              {p.id === room.hostId && (
                <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md border border-yellow-500/20 tracking-wider">HOST</span>
              )}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={onStartGame}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-5 rounded-2xl shadow-lg shadow-green-900/30 transition-all transform hover:scale-[1.01] flex items-center justify-center space-x-3 text-lg"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>Open Market</span>
          </button>
        ) : (
          <div className="text-center p-6 rounded-2xl bg-gray-900/50 border border-gray-800 border-dashed">
            <span className="text-gray-500 animate-pulse font-medium">Host controls the opening bell...</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 4. GAME SCREEN COMPONENTS

// A. Price Chart
const StockChart = ({ history }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateDims);
    updateDims();
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  if (!history || history.length < 2) return <div className="h-full flex items-center justify-center text-gray-600 font-mono text-sm">AWAITING MARKET DATA...</div>;

  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices) - 2;
  const maxPrice = Math.max(...prices) + 2;
  const priceRange = maxPrice - minPrice || 1;
  
  const times = history.map(h => h.time);
  const startTime = times[0];
  const totalTime = times[times.length - 1] - startTime || 1;

  const { width, height } = dimensions;
  const points = history.map((h, i) => {
    const x = ((h.time - startTime) / totalTime) * width;
    const y = height - ((h.price - minPrice) / priceRange) * height;
    return `${x},${y}`;
  }).join(' ');

  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#10b981' : '#ef4444'; 

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
        {/* Y-Axis Labels */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-gray-600 p-1 select-none z-10">
            <span className="bg-gray-800/80 px-1 rounded w-fit">{maxPrice.toFixed(0)}</span>
            <span className="bg-gray-800/80 px-1 rounded w-fit">{((maxPrice+minPrice)/2).toFixed(0)}</span>
            <span className="bg-gray-800/80 px-1 rounded w-fit">{minPrice.toFixed(0)}</span>
        </div>
        
        <svg width="100%" height="100%" className="overflow-visible">
            <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#374151" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />

            <path 
                d={`M0,${height} L${points} L${width},${height} Z`} 
                fill="url(#chartGradient)" 
            />
            <polyline 
                fill="none" 
                stroke={color} 
                strokeWidth="2.5" 
                points={points} 
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    </div>
  );
};

// B. Positions Bar Chart
const PositionsChart = ({ players }) => {
    const playerArray = Object.values(players);
    const maxShares = Math.max(...playerArray.map(p => p.shares), 10); // Min 10 for scale

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-end justify-around space-x-4 px-4 pb-8 pt-4">
                {playerArray.map(p => {
                    const heightPct = Math.max((p.shares / maxShares) * 100, 2); // Min 2% height
                    return (
                        <div key={p.id} className="flex flex-col items-center flex-1 h-full justify-end group">
                            <div className="mb-2 text-white font-mono font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                {p.shares}
                            </div>
                            <div 
                                className="w-full max-w-[60px] bg-blue-500 rounded-t-md hover:bg-blue-400 transition-all relative"
                                style={{ height: `${heightPct}%` }}
                            >
                            </div>
                            <div className="mt-3 text-xs text-gray-400 font-medium truncate w-full text-center max-w-[80px]">
                                {p.name}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="text-center text-xs text-gray-600 uppercase tracking-wider border-t border-gray-800 pt-2">
                Share Distribution
            </div>
        </div>
    );
};

// C. Leaderboard Sidebar Table
const LeaderboardTable = ({ players, currentPrice, myId }) => {
    const sortedPlayers = Object.values(players).sort((a, b) => {
        const netA = a.cash + (a.shares * currentPrice);
        const netB = b.cash + (b.shares * currentPrice);
        return netB - netA;
    });

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-4 pb-2 border-b border-gray-800">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Trader</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-4 text-right">Equity</div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {sortedPlayers.map((p, idx) => {
                    const equity = p.cash + (p.shares * currentPrice);
                    const isMe = p.id === myId;
                    return (
                        <div key={p.id} className={`grid grid-cols-12 py-3 px-4 border-b border-gray-800/50 items-center text-sm ${isMe ? 'bg-blue-500/10' : 'hover:bg-gray-800/50'}`}>
                            <div className={`col-span-1 font-mono ${idx === 0 ? 'text-yellow-500' : 'text-gray-600'}`}>{idx + 1}</div>
                            <div className="col-span-5 font-medium text-white truncate pr-2">
                                {p.name} {isMe && <span className="text-blue-400 text-xs ml-1">(You)</span>}
                            </div>
                            <div className="col-span-2 text-right font-mono text-gray-400">{p.shares}</div>
                            <div className={`col-span-4 text-right font-mono font-medium ${isMe ? 'text-blue-400' : 'text-white'}`}>
                                {formatCompactNumber(equity)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// D. Main Game View
const GameRoom = ({ room, user, onTrade }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [tradeError, setTradeError] = useState(null);
  const [activeTab, setActiveTab] = useState('price'); // 'price' or 'positions'
  
  const myData = room.players[user.uid];
  const currentPrice = room.price;
  const netWorth = myData.cash + (myData.shares * currentPrice);
  const initialWorth = myData.initialValue || 1000;
  const profit = netWorth - initialWorth;
  const profitPercent = (profit / initialWorth) * 100;

  useEffect(() => {
    if (!room.startTime) return;
    const end = room.startTime.seconds + room.duration;
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const remaining = end - now;
      setTimeLeft(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(timer);
  }, [room.startTime, room.duration]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTrade = (type) => {
      setTradeError(null);
      if (type === 'buy') {
          const fee = currentPrice * 0.001;
          if (myData.cash < (currentPrice + fee)) {
              setTradeError("Insufficient cash");
              return;
          }
      }
      if (type === 'sell' && myData.shares <= 0) {
          setTradeError("No shares to sell");
          return;
      }
      onTrade(type);
  };

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col md:flex-row overflow-hidden">
      
      {/* LEFT: Main Trading Dashboard */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Bar */}
        <div className="flex-none p-4 pb-2">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div>
                            <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Instrument</div>
                            <div className="text-2xl font-bold text-white tracking-tight">ZERO.USD</div>
                        </div>
                        <div className="hidden sm:block h-10 w-px bg-gray-800"></div>
                        <div>
                             <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Market Price</div>
                            <div className={`text-3xl font-mono font-bold tracking-tight ${room.history.length > 1 && room.price >= room.history[room.history.length-2].price ? 'text-emerald-500' : 'text-red-500'}`}>
                                {formatCurrency(room.price)}
                            </div>
                        </div>
                         <div className="hidden md:block h-10 w-px bg-gray-800"></div>
                         <div className="hidden md:block">
                            <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Fee Pool</div>
                            <div className="font-mono text-yellow-500 text-xl">{formatCurrency(room.transactionCosts || 0)}</div>
                         </div>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Session Timer</div>
                        <div className={`font-mono text-3xl font-bold ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex-none px-4 pt-2 flex gap-2">
            <button 
                onClick={() => setActiveTab('price')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'price' ? 'bg-gray-800 text-white border-t border-x border-gray-700' : 'bg-gray-900/50 text-gray-500 hover:text-gray-300'}`}
            >
                <TrendingUp className="w-4 h-4" /> Price Action
            </button>
            <button 
                onClick={() => setActiveTab('positions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'positions' ? 'bg-gray-800 text-white border-t border-x border-gray-700' : 'bg-gray-900/50 text-gray-500 hover:text-gray-300'}`}
            >
                <BarChart3 className="w-4 h-4" /> Market Depth
            </button>
        </div>

        {/* Chart Area */}
        <div className="flex-1 px-4 pb-4 min-h-0">
            <div className="h-full bg-gray-800 rounded-b-xl rounded-tr-xl border border-gray-700 p-6 shadow-inner relative">
                {activeTab === 'price' ? (
                    <StockChart history={room.history} />
                ) : (
                    <PositionsChart players={room.players} />
                )}
            </div>
        </div>

        {/* Order Entry */}
        <div className="flex-none bg-gray-900 border-t border-gray-800 p-6">
            {tradeError && (
                <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
                    <span className="bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-bounce">{tradeError}</span>
                </div>
            )}
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                 <div className="flex justify-between bg-black/30 p-4 rounded-xl border border-gray-800">
                    <div>
                        <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Available Cash</div>
                        <div className="text-white font-mono text-xl">{formatCurrency(myData.cash)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Positions</div>
                        <div className="text-white font-mono text-xl">{myData.shares} <span className="text-xs text-gray-500">SHARES</span></div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleTrade('sell')}
                        disabled={myData.shares <= 0}
                        className="group relative bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-4 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-500"
                    >
                        <div className="text-lg font-bold">SELL</div>
                        <div className="text-[10px] font-mono opacity-70 group-hover:text-white/90">
                             BID: {formatCurrency(currentPrice - 1)}
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => handleTrade('buy')}
                        disabled={myData.cash < currentPrice}
                         className="group relative bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white border border-green-500/30 hover:border-green-500 py-4 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green-500"
                    >
                        <div className="text-lg font-bold">BUY</div>
                        <div className="text-[10px] font-mono opacity-70 group-hover:text-white/90">
                            ASK: {formatCurrency(currentPrice)}
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* RIGHT: Pro Sidebar */}
      <div className="w-full md:w-96 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
        {/* My Portfolio Summary */}
        <div className="p-6 border-b border-gray-800 bg-gray-800/50">
            <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <LayoutDashboard className="w-3 h-3" /> Account Overview
            </h3>
            <div className="flex justify-between items-end mb-2">
                <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(netWorth)}</div>
                <div className={`text-sm font-bold px-2 py-1 rounded ${profit >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {profit >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                </div>
            </div>
            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full ${profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`} 
                    style={{ width: `${Math.min(Math.abs(profitPercent), 100)}%` }}
                ></div>
            </div>
        </div>

        {/* Market Leaderboard */}
        <div className="flex-1 flex flex-col min-h-0">
             <div className="p-4 pb-2">
                <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3 h-3" /> Market Participants
                </h3>
            </div>
            <LeaderboardTable players={room.players} currentPrice={currentPrice} myId={user.uid} />
        </div>
      </div>
    </div>
  );
};

// 5. RESULTS SCREEN
const ResultsScreen = ({ room, user, onLeave }) => {
  const currentPrice = room.price;
  const leaderboard = Object.values(room.players).sort((a, b) => {
    const netA = a.cash + (a.shares * currentPrice); 
    const netB = b.cash + (b.shares * currentPrice);
    return netB - netA;
  });
  
  const winner = leaderboard[0];
  const isWinner = winner.id === user.uid;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 p-10 text-center relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-2 ${isWinner ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
            
            <div className="mb-8 flex justify-center">
                <div className={`p-6 rounded-full ring-4 ${isWinner ? 'bg-yellow-500/10 ring-yellow-500/20' : 'bg-gray-800 ring-gray-700'}`}>
                    <Trophy className={`w-16 h-16 ${isWinner ? 'text-yellow-500' : 'text-gray-500'}`} />
                </div>
            </div>
            
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">Market Closed</h1>
            <div className="flex justify-center gap-8 text-sm mb-10">
                <div className="bg-gray-800 px-4 py-2 rounded-lg">
                    <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">Final Price</span>
                    <span className="text-white font-mono font-bold text-lg">{formatCurrency(currentPrice)}</span>
                </div>
                <div className="bg-gray-800 px-4 py-2 rounded-lg">
                    <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">Fees Collected</span>
                    <span className="text-yellow-500 font-mono font-bold text-lg">{formatCurrency(room.transactionCosts || 0)}</span>
                </div>
            </div>

            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 mb-8 border border-gray-700">
                <div className="text-xs text-yellow-500 font-bold uppercase tracking-[0.2em] mb-3">Top Trader</div>
                <div className="text-3xl font-bold text-white mb-2">{winner.name}</div>
                <div className="text-4xl font-mono font-bold text-green-400">
                    {formatCurrency(winner.cash + (winner.shares * currentPrice))}
                </div>
            </div>

            <div className="space-y-1 mb-10 text-left bg-gray-950/50 rounded-xl border border-gray-800 overflow-hidden">
                {leaderboard.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center p-4 border-b border-gray-800 last:border-0">
                        <div className="flex items-center gap-4">
                            <span className={`font-mono text-sm font-bold w-6 ${i === 0 ? 'text-yellow-500' : 'text-gray-600'}`}>#{i+1}</span>
                            <span className="text-white font-medium">{p.name}</span>
                        </div>
                        <span className="font-mono text-gray-400 font-medium">
                            {formatCurrency(p.cash + (p.shares * currentPrice))}
                        </span>
                    </div>
                ))}
            </div>

            <button 
                onClick={onLeave}
                className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.01]"
            >
                Return to Lobby
            </button>
        </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

export default function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [view, setView] = useState('login'); 
  const [error, setError] = useState('');

  // 1. Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({ 
            uid: u.uid, 
            displayName: u.displayName || (u.isAnonymous ? 'Guest Trader' : 'Trader') 
        });
        if (view === 'login') setView('lobby');
      } else {
        setUser(null);
        setView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Room Listener
  useEffect(() => {
    if (!room?.id) return;

    const unsub = onSnapshot(
        doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id),
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRoom(prev => ({ ...prev, ...data }));
                
                if (data.status === 'playing' && view === 'waiting') setView('game');
                if (data.status === 'finished') setView('results');
                
                // Client-side check for game end (Host triggers)
                if (data.status === 'playing' && data.startTime && user?.uid === data.hostId) {
                    const now = Date.now() / 1000;
                    const end = data.startTime.seconds + data.duration;
                    if (now >= end) {
                        finishGame(room.id);
                    }
                }
            } else {
                setRoom(null);
                setView('lobby');
                setError('Room was closed.');
            }
        },
        (err) => console.error("Room sync error:", err)
    );
    return () => unsub();
  }, [room?.id, view, user?.uid]);

  // --- ACTIONS ---

  const handleLoginError = (u, err) => {
      setError(err);
  };

  const handleSignOut = () => {
      signOut(auth);
      setView('login');
  };

  const createRoom = async () => {
    if (!user) return;
    const roomId = generateRoomId();
    const initialPrice = 100;
    
    const newRoom = {
        id: roomId,
        hostId: user.uid,
        status: 'waiting',
        createdAt: serverTimestamp(),
        price: initialPrice,
        history: [{ price: initialPrice, time: Date.now() }],
        transactionCosts: 0,
        duration: 300, // 5 minutes
        players: {
            [user.uid]: {
                id: user.uid,
                name: user.displayName,
                cash: 1000,
                shares: 0,
                initialValue: 1000
            }
        }
    };

    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), newRoom);
        setRoom(newRoom);
        setView('waiting');
    } catch (e) {
        console.error(e);
        setError('Failed to create room');
    }
  };

  const joinRoom = async (code) => {
    if (!user) return;
    try {
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
            setError('Room not found');
            return;
        }
        
        const roomData = roomSnap.data();
        if (roomData.status !== 'waiting') {
            setError('Game already in progress');
            return;
        }

        const playerData = {
            id: user.uid,
            name: user.displayName,
            cash: 1000,
            shares: 0,
            initialValue: 1000
        };

        await updateDoc(roomRef, {
            [`players.${user.uid}`]: playerData
        });

        setRoom(roomData);
        setView('waiting');
    } catch (e) {
        console.error(e);
        setError('Failed to join room');
    }
  };

  const startGame = async () => {
    if (!room) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), {
        status: 'playing',
        startTime: serverTimestamp()
    });
  };

  const finishGame = async (roomId) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), {
        status: 'finished'
    });
  };

  const executeTrade = async (type) => {
    if (!room || !user) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    
    try {
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        
        const currentPrice = data.price;
        const myData = data.players[user.uid];
        
        let newCash = myData.cash;
        let newShares = myData.shares;
        let newPrice = currentPrice;
        let fee = 0;

        if (type === 'buy') {
            fee = currentPrice * 0.001;
            const totalCost = currentPrice + fee;

            if (myData.cash < totalCost) return; 

            newCash -= totalCost;
            newShares += 1;
            newPrice += 1;
        } 
        else if (type === 'sell') {
            if (myData.shares <= 0) return;

            newPrice = currentPrice - 1;
            fee = newPrice * 0.001;
            const revenue = newPrice - fee;

            newCash += revenue;
            newShares -= 1;
        }

        await updateDoc(roomRef, {
            [`players.${user.uid}.cash`]: newCash,
            [`players.${user.uid}.shares`]: newShares,
            price: newPrice,
            transactionCosts: increment(fee),
            history: arrayUnion({ price: newPrice, time: Date.now() })
        });
        
    } catch (e) {
        console.error("Trade failed", e);
    }
  };

  const leaveRoom = () => {
    setRoom(null);
    setView('lobby');
    setError('');
  };

  return (
    <div className="font-sans text-white">
        {error && (
            <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2 animate-bounce">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
            </div>
        )}

        {view === 'login' && <LoginScreen onLogin={handleLoginError} error={error} />}
        {view === 'lobby' && user && <LobbyScreen user={user} onCreateRoom={createRoom} onJoinRoom={joinRoom} onSignOut={handleSignOut} />}
        {view === 'waiting' && room && <WaitingRoom room={room} user={user} onStartGame={startGame} onLeave={leaveRoom} />}
        {view === 'game' && room && <GameRoom room={room} user={user} onTrade={executeTrade} />}
        {view === 'results' && room && <ResultsScreen room={room} user={user} onLeave={leaveRoom} />}
    </div>
  );
}