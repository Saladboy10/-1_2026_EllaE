# Games

Open `index.html` in a web browser for the **Level Up** game lobby, then pick a game. No install needed.

## How it's organized
- `index.html` is the lobby. Every game lives inside this one page; the lobby covers the screen until you press Play.
- `games/` holds each game's own code (`rail-rush.js`, `rail-rush.css`).
- `leaderboard.js` runs the shared leaderboards. Each game has its own board with every player's best score.
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
- **Secret codes:** press **Codes** on the main menu and type a code to get a prize. Each code works once per player. Try `LEVELUP` for 100 coins.
- **Leaderboard:** when a run ends, your best score is saved under your runner's name. The top 5 show on the crash screen. Press **Leaderboard** on the game's card in the lobby to see the top 20 (place, name, score).

**Customize avatar** lets you type your runner's name (it floats above them and shows on the score screen) and pick a ready-made outfit or build your own look:

- **Outfits** (bought with coins): Alina 50 (dances on the menu), Quills 50, Big Bertha 100, Marge Simpson 100, Red Renaldo 100. Your own name stays the same whatever you wear.
- **Emotes:** Wave, Dance and Floss are free; Spin 50, Jump for Joy 75 and Dab 100. Play them from the menu, the avatar maker, or keys 1–6. Buying anything takes two taps so nothing is bought by accident.
- **My own:** skin, hair, clothes, hats and extras. Coins you collect are saved and can unlock the Crown (150) and the Cape (100).
- **Pets** that run beside you (bought with coins): Milo 50, Tails 50
