# Games

Open `index.html` in a web browser for the **Level Up** game lobby, then pick a game. No install needed.

## Skin requests
Players press **Request a skin** in the top corner of the lobby to send an idea, with an optional photo. The owner sees them under **Inbox** (only the owner gets that button).

## Putting it online with Vercel
Vercel can host the game for free at an address like `levelup-edge.vercel.app`. No build step is needed:
it's a plain website. On Vercel the games play fully, but the leaderboard, the secret-code player limit and
skin requests don't work (they need the Claude version's shared storage); codes still work once per player.

1. Sign up at vercel.com with a parent or teacher, using **Continue with GitHub** (the account that owns this repo).
2. Choose **Add New → Project**, pick this repository and press **Import**.
3. Leave the settings as they are (Framework: **Other**, no build command) and press **Deploy**.
4. The work is on the branch `claude/game-development-oysmds`. Either merge it into `main` first, or in the
   project's **Settings → Environments → Production**, set the production branch to `claude/game-development-oysmds`.
5. To choose the address, open **Settings → Domains** and edit the `.vercel.app` name (for example `levelup-edge`).

## How it's organized
- `index.html` is the lobby. Every game lives inside this one page; the lobby covers the screen until you press Play.
- `games/` holds each game's own code (`rail-rush.js`/`rail-rush.css` for Dodge and Weave, `web-swing.js`/`web-swing.css` for Web Swing, `star-catcher.js`/`star-catcher.css` for Jimmy Yum-Yum, `glow-squares.js`/`glow-squares.css` for Glow Squares, `tumble-dash.js`/`tumble-dash.css` for Tumble Dash).
- `celebrate.js` is the win party every game shares: a giant bouncing rainbow "YOU WON!" and confetti (Jimmy Yum-Yum after Level 3, Glow Squares, and Tumble Dash when you're 1st or survive).
- `leaderboard.js` runs the shared storage: leaderboards, limited secret codes and skin requests. Each game has its own board with every player's best score.
  Boards work in the published game; opened as a plain file, the games still play but the board stays hidden.
- `assets/` holds the pictures on the lobby cards.

## Adding a new game
1. Put its code in `games/` and load it from `index.html`. Give it `open()` and `close()` like `window.RailRush`, and a button that calls `Lobby.show()`.
2. Swap one of the "Coming soon" slots for a game card with a `data-game` Play button and a picture in `assets/`.
3. For a leaderboard, call `Leaderboard.submit('<game>', { name, score })` when a game ends and `Leaderboard.watch('<game>', 10, rows => ...)` to show it.

## Dodge and Weave
A 3D endless runner. Dodge trains and barriers across three tracks, grab coins, and see how far you get.

- **Move:** ← → (or A / D), or swipe left/right
- **Jump:** ↑ (or W / Space), or swipe up. Jump over red-and-white barriers.
- **Roll:** ↓ (or S), or swipe down. Roll under yellow-and-black barriers.
- **Pause:** P or Esc
- **Secret codes:** press **Codes** in the top-left corner of the main menu and type a code to get a prize. Each code works once per player and only for the first 3 players in total. The codes themselves are kept secret (they are stored scrambled in `games/rail-rush.js`).
- **Leaderboard:** when a run ends, your best score is saved under your runner's name. The top 5 show on the crash screen. Press **Leaderboard** on the game's card in the lobby to see the top 20 (place, name, score).

**Customize avatar** lets you type your runner's name (it floats above them and shows on the score screen) and pick a ready-made outfit or build your own look:

- **Outfits** (bought with coins): Alina 50 (dances on the menu), Quills 50, Big Bertha 100, Marge Simpson 100, Red Renaldo 100, Luffy 100, Zoro 100, Deku 100, Denki 100, Uraraka 100, All Might 100, Shoto 100, Aizawa 100, Messi 50. Your own name stays the same whatever you wear.
- **Emotes:** Wave, Dance and Floss are free; Spin 50, Jump for Joy 75, Dab 100, and The Duggee, Moonwalk, The Worm, Ransom and I Want It That Way 50 each. Play them from the menu, the avatar maker, or number keys. Tap anything locked once to try it on (or watch the emote) before buying; tap it again to buy.
- **My own:** skin, hair, eye color, expression (Normal, Happy, Angry, Sad, Surprised, Wink, Cool), mouth (Smile, Big grin, Gritted teeth, Smirk, Shout, Surprised, Frown, Tongue out, Straight), clothes, hats and extras. Outfits with a visible face also let you pick the expression and mouth. Coins you collect are saved and can unlock the Crown (150) and the Cape (100).
- **Pets** that run beside you (bought with coins): Milo 50, Tails 50, Ember the dragon 75

## Web Swing
A 3D superhero city at sunset, with glass skyscrapers, water towers, traffic, real shadows and the river all round. You play as Spider Pig (in his red-and-blue web suit), or press the Hero button on the menu to switch to your Dodge and Weave runner.

- **Move:** WASD or the arrow keys, or drag on the left half of the screen (a joystick appears under your thumb). Drag elsewhere to turn the camera.
- **Jump and web:** Space or the red JUMP/WEB button. Jump off a roof, then hold to shoot a web at the nearest skyscraper and swing. Let go to fly.
- **Climb:** run into a wall to climb it, and jump to kick off it.
- You have 90 seconds to grab as many coins as you can. Your score is the number of coins, it has its own leaderboard, and the coins go into the Dodge and Weave bank.

## Jimmy Yum-Yum (`star-catcher.js`)
Jimmy, a hungry cartoon boy with a huge mouth. Move him under the falling burgers and hot dogs to gobble them
(10 points each), and keep away from the broccoli and carrots (they cost a life). Hearts give an extra life, up to 5.

- **Move:** ← → (or A / D), the mouse, or your finger. **P** pauses.
- **3 levels:** Level 1 is Easy (a breeze, 5 points a food), Level 2 Medium (a bit challenging, 10 points) and Level 3 Hard (everything falls at once, 20 points). Last 20 seconds on a level to move up; beat Level 3 to win a bonus and the rainbow party. You can start on any level; Enter starts Level 1.
- Every burger and hot dog is also a coin in the Dodge and Weave bank.
- It has its own leaderboard in the lobby.

## Glow Squares
You and 11 computer players (all Dodge and Weave characters, you in your own look) on a floating floor of squares.
Each round some squares glow; get onto one before the countdown ends, because the dark squares drop away and anyone on them falls out. Normally 2 fit on one square; every 2 or 3 rounds is a special round where it changes to 1, 3 or 4 (the squares show it, e.g. 1/3). The last to squeeze onto a full square falls too.
Fewer squares glow each round and players bump each other. Last one standing wins (or survive all 15 rounds).

- **Move:** WASD or the arrow keys, or drag your finger anywhere (a joystick appears under it).
- Sparkly: twinkling stars, sparkles fizzing off the glowing squares, a glitter trail behind you, sparkle bursts when someone falls and confetti when you win.
- **Score:** 10 points a round survived, plus 50 for winning. Coins: 1 a round, plus 10 for winning. It has its own leaderboard.

## Tumble Dash
Stumble Guys-style party games against 11 computer runners. Each time you play, a wheel picks one of four games at random
(never the same one twice in a row):

- 🏁 **Obstacle Race:** sweepers, stepping stones, a bridge of swinging hammers, moving platforms and punching walls. Fall off and you go back to the last checkpoint (green flags). Your place decides your score (1st = 120).
- 🧱 **Block Dash:** walls of blocks slide toward you. Run through the gaps or jump the low yellow blocks; tall blocks push you off the back.
- ⬡ **Tile Fall:** three floors of hexagon tiles; each tile flashes and drops a moment after someone steps on it. Fall through all three and you're out.
- 🌀 **Spin Zone:** spinning bars on a round platform that keep speeding up (a second bar joins later). Jump them or get knocked off.

In the survival games, last to the end wins (100 points + 5 for each player knocked out). Coins go into the Dodge and Weave bank.
**Move:** WASD or the arrow keys, Space to jump. Touch: drag on the screen to run, tap the JUMP button. Its own leaderboard.
