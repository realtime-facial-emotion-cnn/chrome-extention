const emojis = ["😀", "😂", "😍", "🔥", "🎉", "❤️", "👍"];

const container = document.createElement("div");
container.className = "emoji-rain-container";
document.body.appendChild(container);

function createEmoji() {
  const emoji = document.createElement("div");
  emoji.className = "falling-emoji";
  emoji.innerText = emojis[Math.floor(Math.random() * emojis.length)];

  emoji.style.left = Math.random() * 100 + "vw";
  emoji.style.fontSize = Math.random() * 20 + 20 + "px";
  emoji.style.animationDuration = Math.random() * 3 + 2 + "s";

  container.appendChild(emoji);

  setTimeout(() => {
    emoji.remove();
  }, 5000);
}

setInterval(createEmoji, 200);