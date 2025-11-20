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
  PiggyBank
} from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBQAwmZP12UYlng6yW5Q_6QL9hXRF-Lqgk",
  authDomain: "stock-game-ce19d.firebaseapp.com",
  projectId: "stock-game-ce19d",
  storageBucket: "stock-game-ce19d.firebasestorage.app",
  messagingSenderId: "700701993342",
  appId: "1:700701993342:web:873354a6d11cb3d8c22b2f",
  measurementId: "G-V3K0JYTJLG"
};
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
      onLogin(null, "Google Login failed. Ensure Firebase Auth is enabled.");
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
        onLogin(null, "Guest login failed.");
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-green-500/10 rounded-full">
            <Activity className="w-12 h-12 text-green-500" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-white mb-2">ZeroSum Trader</h1>
        <p className="text-gray-400 text-center mb-8">Enter the trading floor.</p>
        
        {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm text-center">
                {error}
            </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
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
                <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-500">Or</span>
            </div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={isLoggingIn}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-lg transition-all"
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button onClick={onSignOut} className="text-gray-500 hover:text-white text-sm">Sign Out</button>
      </div>
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl text-white font-bold">Welcome, {user.displayName || 'Trader'}</h2>
          <p className="text-gray-400">Choose your trading strategy</p>
        </div>

        <div className="grid gap-4">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-green-500/50 transition cursor-pointer group" onClick={onCreateRoom}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20">
                  <Activity className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white">Create Room</h3>
                  <p className="text-sm text-gray-400">Start a new trading session</p>
                </div>
              </div>
              <Play className="w-5 h-5 text-gray-500 group-hover:text-blue-400" />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Join Room</h3>
                <p className="text-sm text-gray-400">Enter a 4-digit code</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.slice(0, 4))}
                placeholder="Code"
                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-center tracking-widest text-lg uppercase"
              />
              <button
                onClick={() => onJoinRoom(roomCode)}
                disabled={roomCode.length !== 4}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition"
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
       navigator.clipboard.writeText(text);
    } else {
       const textArea = document.createElement("textarea");
       textArea.value = text;
       document.body.appendChild(textArea);
       textArea.select();
       document.execCommand('copy');
       document.body.removeChild(textArea);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onLeave} className="text-gray-400 hover:text-white flex items-center space-x-2">
            <LogOut className="w-4 h-4" />
            <span>Leave</span>
          </button>
          <div className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-700">
            <span className="text-gray-400 text-sm uppercase tracking-wider">Room Code:</span>
            <span className="text-white font-mono font-bold text-xl select-all">{room.id}</span>
            <button onClick={copyCode} className="text-gray-400 hover:text-white p-1">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center mb-8">
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Waiting for Traders</h2>
          <p className="text-gray-400">The market will open shortly. Prepare your strategy.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {playersList.map((p) => (
            <div key={p.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center text-white font-bold">
                  {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                </div>
                <span className="text-white font-medium">{p.name || 'Unknown Trader'}</span>
              </div>
              {p.id === room.hostId && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30">HOST</span>
              )}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={onStartGame}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all transform hover:scale-[1.01] flex items-center justify-center space-x-2"
          >
            <Play className="w-5 h-5" />
            <span>Open Market (Start Game)</span>
          </button>
        ) : (
          <div className="text-center text-gray-500 animate-pulse">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </div>
  );
};

// 4. GAME SCREEN
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

  if (!history || history.length < 2) return <div className="h-full flex items-center justify-center text-gray-600">Waiting for data...</div>;

  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices) - 1;
  const maxPrice = Math.max(...prices) + 1;
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
  const color = isUp ? '#22c55e' : '#ef4444'; 

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-xs text-gray-600 p-1">
            <span>{maxPrice.toFixed(0)}</span>
            <span>{((maxPrice+minPrice)/2).toFixed(0)}</span>
            <span>{minPrice.toFixed(0)}</span>
        </div>
        
        <svg width="100%" height="100%" className="overflow-visible">
            <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            <path 
                d={`M0,${height} L${points} L${width},${height} Z`} 
                fill="url(#chartGradient)" 
            />
            <polyline 
                fill="none" 
                stroke={color} 
                strokeWidth="2" 
                points={points} 
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    </div>
  );
};

const GameRoom = ({ room, user, onTrade }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [tradeError, setTradeError] = useState(null);
  
  const myData = room.players[user.uid];
  const currentPrice = room.price;
  // In this game, stock value is marked to market
  const netWorth = myData.cash + (myData.shares * currentPrice);
  const initialWorth = myData.initialValue || 1000;
  const profit = netWorth - initialWorth;
  const profitPercent = (profit / initialWorth) * 100;

  const leaderboard = Object.values(room.players).sort((a, b) => {
    const netA = a.cash + (a.shares * currentPrice);
    const netB = b.cash + (b.shares * currentPrice);
    return netB - netA;
  });

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
      // Pre-validation
      if (type === 'buy') {
          const fee = currentPrice * 0.001;
          if (myData.cash < (currentPrice + fee)) {
              setTradeError("Insufficient cash for price + 0.1% fee");
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row">
      {/* LEFT: Main Trading Area */}
      <div className="flex-1 p-4 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-4">
                <div>
                    <h2 className="text-gray-400 text-xs uppercase tracking-wider">Ticker</h2>
                    <div className="font-bold text-xl">ZERO</div>
                </div>
                <div className="hidden sm:block h-8 w-px bg-gray-700"></div>
                <div>
                   <h2 className="text-gray-400 text-xs uppercase tracking-wider flex items-center gap-1">
                     <PiggyBank className="w-3 h-3" /> Fee Pool
                   </h2>
                   <div className="font-mono text-yellow-500">{formatCurrency(room.transactionCosts || 0)}</div>
                </div>
            </div>
            <div className="text-center">
                <div className="text-gray-400 text-xs uppercase tracking-wider">Price</div>
                <div className={`text-3xl font-mono font-bold ${room.history.length > 1 && room.price >= room.history[room.history.length-2].price ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(room.price)}
                </div>
            </div>
            <div className="text-right">
                <div className="text-gray-400 text-xs uppercase tracking-wider">Time</div>
                <div className={`font-mono text-xl font-bold ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {formatTime(timeLeft)}
                </div>
            </div>
        </div>

        {/* Chart */}
        <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 p-6 mb-4 relative min-h-[300px]">
            <StockChart history={room.history} />
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 relative">
            {tradeError && (
                <div className="absolute top-2 left-0 right-0 text-center text-red-400 text-xs animate-pulse">
                    {tradeError}
                </div>
            )}
            <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex justify-between text-sm text-gray-400 mb-2">
                    <span>Cash: <span className="text-white font-mono">{formatCurrency(myData.cash)}</span></span>
                    <span>Shares: <span className="text-white font-mono">{myData.shares}</span></span>
                </div>
                
                <button 
                    onClick={() => handleTrade('sell')}
                    disabled={myData.shares <= 0}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 font-bold py-4 rounded-xl transition flex flex-col items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="text-lg">SELL</span>
                    <div className="text-xs font-normal opacity-75 flex flex-col items-center">
                        <span>Price: {formatCurrency(currentPrice - 1)}</span>
                        <span>(Impact: -$1.00)</span>
                    </div>
                </button>
                
                <button 
                    onClick={() => handleTrade('buy')}
                    disabled={myData.cash < currentPrice}
                    className="bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/50 font-bold py-4 rounded-xl transition flex flex-col items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="text-lg">BUY</span>
                    <div className="text-xs font-normal opacity-75 flex flex-col items-center">
                        <span>Price: {formatCurrency(currentPrice)}</span>
                        <span>(Impact: +$1.00)</span>
                    </div>
                </button>
            </div>
        </div>
      </div>

      {/* RIGHT: Sidebar / Leaderboard */}
      <div className="w-full md:w-80 bg-gray-800 border-l border-gray-700 p-4 flex flex-col h-screen overflow-y-auto">
        <div className="mb-6 p-4 bg-gray-700/30 rounded-xl">
            <h3 className="text-gray-400 text-xs uppercase mb-1">Your Portfolio</h3>
            <div className="text-2xl font-bold text-white mb-1">{formatCurrency(netWorth)}</div>
            <div className={`text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)} ({profitPercent.toFixed(2)}%)
            </div>
        </div>

        <h3 className="text-gray-400 text-xs uppercase mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Live Rankings
        </h3>
        
        <div className="space-y-2 flex-1">
            {leaderboard.map((player, index) => {
                const pNet = player.cash + (player.shares * currentPrice);
                const isMe = player.id === user.uid;
                return (
                    <div key={player.id} className={`p-3 rounded-lg flex items-center justify-between ${isMe ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-gray-700/30'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-600 text-gray-300'}`}>
                                {index + 1}
                            </div>
                            <div>
                                <div className={`text-sm font-medium ${isMe ? 'text-blue-400' : 'text-white'}`}>
                                    {player.name} {isMe && '(You)'}
                                </div>
                                <div className="text-xs text-gray-400">{player.shares} shares</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-mono font-medium text-white">{formatCurrency(pNet)}</div>
                        </div>
                    </div>
                );
            })}
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 text-center">
            <div className="mb-6 flex justify-center">
                <div className={`p-4 rounded-full ${isWinner ? 'bg-yellow-500/20' : 'bg-gray-700'}`}>
                    <Trophy className={`w-12 h-12 ${isWinner ? 'text-yellow-500' : 'text-gray-400'}`} />
                </div>
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-2">Session Closed</h1>
            <p className="text-gray-400 mb-8">Final Market Price: <span className="text-white font-mono">{formatCurrency(currentPrice)}</span></p>
            <p className="text-gray-500 text-sm mb-6">Total Transaction Fees collected: {formatCurrency(room.transactionCosts || 0)}</p>

            <div className="bg-gray-700/30 rounded-xl p-6 mb-8">
                <div className="text-sm text-gray-400 uppercase tracking-wide mb-2">Winner</div>
                <div className="text-2xl font-bold text-white mb-1">{winner.name}</div>
                <div className="text-3xl font-mono font-bold text-green-400">
                    {formatCurrency(winner.cash + (winner.shares * currentPrice))}
                </div>
            </div>

            <div className="space-y-2 mb-8 max-h-60 overflow-y-auto">
                {leaderboard.map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center p-3 hover:bg-gray-700 rounded transition text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-mono w-6">#{i+1}</span>
                            <span className="text-white">{p.name}</span>
                        </div>
                        <span className="font-mono text-gray-300">
                            {formatCurrency(p.cash + (p.shares * currentPrice))}
                        </span>
                    </div>
                ))}
            </div>

            <button 
                onClick={onLeave}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
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
  const [view, setView] = useState('login'); // login, lobby, waiting, game, results
  const [error, setError] = useState('');

  // 1. Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            // Wait for user action now
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
    
    // We perform a Read before Write here to ensure we use the latest state for validation
    // In a production app, use runTransaction() for absolute safety.
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
            // Buy Logic: 
            // 1. Pay Current Price + Fee
            // 2. Price goes UP by 1
            fee = currentPrice * 0.001;
            const totalCost = currentPrice + fee;

            if (myData.cash < totalCost) {
                // Ideally show error UI, but here we just abort
                return; 
            }

            newCash -= totalCost;
            newShares += 1;
            newPrice += 1;
        } 
        else if (type === 'sell') {
            // Sell Logic:
            // 1. Price goes DOWN by 1
            // 2. Sell at NEW Price
            // 3. Pay Fee on NEW Price
            
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
        {/* Error Toast */}
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