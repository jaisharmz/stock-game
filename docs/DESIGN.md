# ZeroSum: design

## The game, from the start

The game has had three versions.

1. `Stock Game.ipynb` (Colab, April 20, 2023). Players take turns buying or selling one stock in a Python loop. The price starts at 0 and moves by exactly the number of shares traded, and an order of v shares at price c costs c + (c+1) + ... + (c+v-1). The same notebook draws random-walk charts with a volatility parameter and adds a `Bot` class that softmaxes two random scores to choose between buying and selling.
2. `Stock_Study.ipynb` (Colab, May 2024). Not a game, but its question became one: given 60 days of AAPL, z-score the recent returns, say "x% chance up", and check the call against the price some days later.
3. The React app in this repository (November 19, 2025, built with Gemini). Rooms with four-digit codes, a five-minute clock, $1,000 of starting cash, a price that starts at $100 and moves $1 per share, a 0.1% fee, and a live leaderboard. It kept the 2023 price rule and scored players by cash plus shares times the last price.

The idea under all three is the same: the price is a straight line in the number of shares held. The cost of an order is the area under that line, which depends only on where it starts and ends. Buying and selling back therefore costs nothing but the fee, and the market is zero-sum among its players. With nothing underneath it, the price is only a record of who wanted in first, and the free market round keeps that game.

## The scoring fix

Scoring by the last price lets a player print money. With s shares held at price p, buying one more costs p and lifts the price to p + 1, so cash + shares x price rises by s + 1. A player alone who keeps buying gains $1, $3, $6, $10, and so on, from nothing (`test/engine.test.js` checks this, and the second figure on the How it works page draws it).

ZeroSum scores a position at its liquidation value: what the shares would fetch if their holder sold them back alone, right now. Your own orders then never move your own score except by the fee, and only other players' orders can. Jai chose this on October 20, 2026, over keeping the last price or giving every round an underlying.

## Extensions built

| Extension | Why it fits | Where it is |
| --- | --- | --- |
| Kahoot-style rooms: a host screen with a QR code, phones as controllers, a podium after each round, 5 to 30 minutes | Jai's request on October 20, 2026; the 2025 rooms lasted five minutes and had no rounds | `src/ui/Room.jsx`, `src/engine/host.js` |
| Card market | The Traders at Berkeley market-making game: private cards, a contract on their sum, public draws from the same deck | `src/engine/kinds.js` |
| Chart market | `Stock_Study.ipynb`'s question, with a synthetic stock (lognormal steps, sometimes a news jump) so no market data has to be licensed | `src/engine/kinds.js` |
| Question market | Kahoot's format with a price instead of four buttons; host-written questions plus a pack whose every answer is computed and then checked a second way in the tests | `src/engine/questions.js` |
| Bots | The 2023 softmax bot and the 2024 z-score trade, plus momentum and an informed trader; they fill small rooms and make practice possible | `src/engine/bots.js` |
| Practice | The same room against bots in the browser, with no account and no database writes | `src/data/local.js` |
| Committed hidden values | A SHA-256 commitment before trading, checked by the database at settlement | `firestore.rules` |
| Recaps and a profile | Every round replayed from its trades, and lifetime numbers recomputed from the rooms' records | `src/ui/Recap.jsx`, `src/data/recap.js` |
| How it works | Three figures that run the engine: an order's fills under the line, the two scoring rules, and four random traders whose profits sum to minus their fees | `src/ui/How.jsx` |
| Invite-only access that can open later | Invite links, an admin page, and one switch to open hosting to everyone | `src/data/access.js`, `src/ui/Admin.jsx` |

## Decisions

Jai answered three questions on October 20, 2026.

- A room code admits any Google-signed-in person to that room only. Hosting needs an invite. Friends join a game night in one step, and opening up later only means letting anyone host.
- Free-market rounds score at liquidation value (above).
- The host may trade in every round. The host's screen deals the hidden rounds, so in those rounds the host is tagged as dealer and sits off the podium.

Choices made without asking, because each follows from a constraint:

- No server and no Cloud Functions, matching Läsa and staying on the free plan. The rules check every trade, so a client cannot lie about a fill. The host's screen runs the clock, the reveals and the bots.
- Money is integer cents everywhere, because the rules recompute the same arithmetic and must agree with the client to the cent.
- Phones listen only to the market, their own position and their own card while a round is live. The projector shows the full leaderboard, as Kahoot does, which keeps reads per trade near one per screen.
- No people in the code. The first person to claim an unowned deployment becomes its admin. Läsa writes the owner's email into its rules instead; both use the same `invite` and `open` modes.

## What comes next

- A limit-order book with a rotating market maker, which is the other half of the Traders at Berkeley game. It needs matching logic the rules cannot verify cheaply, so it wants a Cloud Function.
- A pairs round: two correlated stocks, trading the spread, after *Jack Street* (Hacklytics 2025), which flagged stocks that broke from their usual partners.
- A rating across rooms, Elo-style. It needs everyone's history, so it belongs in a scheduled function rather than in each browser.
- Bots trained by reinforcement learning against the other bots, as a test of whether a learned strategy beats the hand-written ones.
- Cleanup of finished rooms, through a Firestore TTL policy on `expiresAt` once history older than some age stops mattering.
