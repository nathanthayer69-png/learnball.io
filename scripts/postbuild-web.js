// Adds the link-preview card (Open Graph / Twitter) and page title to the built index.html.
const fs = require("fs");
const file = "dist/index.html";
let html = fs.readFileSync(file, "utf8");
const title = "LearnBall · Do you know ball?";
const desc = "The daily sports trivia game where rare answers score more. 7 prompts, 25 seconds each. Climb from the Backyard to the Hall of Fame.";
const url = "https://learnball.io";
const img = `${url}/og.png`;
const tags = [
  `<meta name="description" content="${desc}">`,
  `<meta name="theme-color" content="#0a1022">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="LearnBall">`,
  `<meta property="og:title" content="${title}">`,
  `<meta property="og:description" content="${desc}">`,
  `<meta property="og:url" content="${url}">`,
  `<meta property="og:image" content="${img}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:title" content="${title}">`,
  `<meta name="twitter:description" content="${desc}">`,
  `<meta name="twitter:image" content="${img}">`,
].join("\n    ");
html = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
if (!html.includes("og:image")) html = html.replace("</head>", `    ${tags}\n  </head>`);
fs.writeFileSync(file, html);
console.log("Added link preview tags to", file);
