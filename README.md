# ZeroSum

ZeroSum is a trading game for a room of friends. One screen hosts, the way Kahoot does, and everyone else trades on their phone after typing a five-letter code or scanning a QR code. A room runs 5 to 30 minutes as a series of short markets, with a podium after each one.

The price is a straight line in the number of shares everyone holds: with q shares out, a share costs p0 + s·q. An order walks along the line and pays every step, so its cost is the area under the line. That area does not depend on the path, so buying and selling back costs only the fee, and whatever one player makes, the others lose. Winning means getting in before the others move the price, or knowing better than they do what a share will pay. The How it works page in the app draws this with the game's own code.

## Rounds

| Round | A share pays | Where it came from |
| --- | --- | --- |
| Free market | Nothing outside the market. You score what your shares would fetch if you sold them back alone at the end. | `Stock Game.ipynb` (April 2023) and the 2025 React version |
| Card market | The sum of every player's secret card (1 to 50, from a deck that may be lopsided). Public cards from the same deck appear while you trade. | The Traders at Berkeley market-making game |
| Chart market | A stock's close 20 days after the chart ends. Sixteen of those days are revealed during the round; the last four stay hidden. | `Stock_Study.ipynb` (May 2024), which asked the same question of AAPL |
| Question market | The answer to a question, in dollars. The host can write their own questions; otherwise they come from a built-in math and probability pack. | Kahoot |

Each round ranks players by profit. First place earns 1000 points and last earns 0, so a round with big prices counts the same as one with small prices. Bots can fill a room: Coinflip (the softmax bot from the 2023 notebook), Trendy (momentum), Reverter (the z-score trade from `Stock_Study.ipynb`), and Insider, which trades toward its best estimate of what a share pays.

Practice runs a whole room against bots in your browser, with no account and nothing saved.

## Run it

Node 22 or newer, and Java 21 or newer for the Firebase emulators.

```bash
npm install
npm run dev:emu      # the app against local Auth and Firestore emulators, http://localhost:5182
npm test             # the game engine
npm run test:rules   # firestore.rules in the emulator: honest trades pass, forged ones fail
```

`npm run dev` runs the app against the real project on http://localhost:5181 and reads its web config from `.env.local` (copy `.env.example`). A Firebase web config identifies a project and is not a secret; the rules protect the data.

In emulator mode, `await __signInAs("bob", "Bob")` in the browser console signs in as a made-up account, so one person can play several. Give each account its own host, such as `localhost:5182` and `bob.localhost:5182`, because the browser keeps one sign-in per origin. The dev server also offers 25-second rounds, to watch a whole room go by in a few minutes.

## Deploy

The project is `stock-game-ce19d`. These steps need the owner's own login and clicks.

1. `npx firebase-tools login`
2. In the Firebase console, turn on Authentication with the Google provider, and create a Firestore database in production mode.
3. `npm run deploy` builds the app and deploys Hosting, `firestore.rules` and `firestore.indexes.json`. The site is then at https://stock-game-ce19d.web.app.
4. Open the site, sign in, and press "Claim this deployment". The first person to claim an unowned deployment becomes its admin, so no name or email is written into the code.
5. Make invites on the Admin page and send the links. An invite lets someone host rooms. Anyone signed in can join a room whose code they have.
6. To let anyone host, press "Open hosting to everyone" on the Admin page. No code changes.

## How it stays honest without a server

There is no backend. `firestore.rules` does the server's job, and the client cannot get around it.

- Trades. An order is one transaction that moves the market, updates the trader's position, and appends a trade record. Each of the three documents checks the other two, and the position check recomputes the order's cost from the price line. `test/rules.test.js` tries a cheaper fill, a skipped fee, a made-up price, someone else's name, an order over the size limit, a position over its limit, a second order within 250 ms, and an order after the round's clock runs out, and the rules refuse each one.
- Hidden values. When a card, chart or question round opens, the host's screen publishes the SHA-256 hash of the value and a random salt. The database accepts a settlement only if its text hashes to that commitment, so the host cannot change the answer after seeing the trades.
- Cards. A card is readable only by its player and by the host's screen, which dealt it. A host who also trades is tagged as dealer in those rounds and sits off that round's podium.
- Scores. Leaderboards, recaps and the profile page recompute every score from the rule-checked positions and the settlement, so there is no stored score to tamper with.
- Access. Sign-in is Google only. Hosting needs an invite, unless an admin has opened hosting to everyone. Rooms cannot be listed, so a room is found only by its code. Players write only their own player and position documents, and bots act only through the host's screen.

## Layout

```
src/engine/    the game as plain functions in integer cents: the price line, round kinds,
               questions, bots, scoring, and the host's round planner
src/data/      Firestore and practice backends behind one session interface, the host loop,
               invites and access, recaps
src/ui/        React screens: home, setup, room (lobby, live round, results, final), recap,
               profile, admin, how it works
firestore.rules
test/          engine tests and rules tests
docs/DESIGN.md what the game is, the extensions, and the decisions behind them
```

## Limits

- The host's screen runs the room. If it closes mid-round, trading continues until the round's clock runs out, and the room picks up again when the host reopens it.
- Every trade writes to one market document, so a room suits a group of friends better than a stadium. A room of hundreds needs the market in Realtime Database or behind a server.
- The free Spark plan allows 50,000 Firestore reads and 20,000 writes a day. Each trade costs three writes and one read per open screen, so one or two busy rooms can use a day's quota. Move to the Blaze plan before opening to the public; it keeps the free quota and charges cents beyond it.
