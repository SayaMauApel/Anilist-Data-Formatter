/* === REQUIRED PACKAGES ===
npm install node-fetch
*/

const fs = require("fs"); // Save file module DO NOT TOUCH!
const path = require("path");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// === CONFIGURATION ===
const REQUESTS_PER_MINUTE = 20; // Safe rate limit
const DELAY_MS = 60000 / REQUESTS_PER_MINUTE; // 3000ms = 20 requests/min
const PER_PAGE = 50; // Max allowed by AniList API
let currentPage = 1;
let totalAnime = 0;
let shuttingDown = false;

// === TIMESTAMPED FILE NAME ===
const pad = (n) => n.toString().padStart(2, "0");
const now = new Date();
const timestamp = [
  now.getFullYear().toString().slice(2),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  pad(now.getHours()),
  pad(now.getMinutes()),
  pad(now.getSeconds())
].join("_");



// === GRAPHQL QUERY ===
const query = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
        }
        episodes
        format
        season
        seasonYear
      }
    }
  }
`;

// === FETCH A PAGE OF ANIME ===
const fetchAnimePage = async (page) => {
  const variables = { page, perPage: PER_PAGE };

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  return json.data.Page.media;
};

// === FORMAT ANIME INTO GRAPHQL ALIAS BLOCK ===
const formatAnimeQuery = (anime) => {
  const safeTitle = anime.title.romaji
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return `${safeTitle}: Media(id: ${anime.id}, type: ANIME) {
  title { romaji english }
  episodes
  format
  season
  seasonYear
}`;
};

// handles if there are no animes, shutdowns, 3sec interval and more the main loop is here.
const crawlContinuously = async () => {
  console.log("GraphQL anime data tool is running. Press Ctrl+C to exit.\n");
  console.log("The Crawling has begun\n");

  while (!shuttingDown) {
    console.log(`Fetching page ${currentPage}...`);

    try {
      const animeList = await fetchAnimePage(currentPage);

      if (!animeList || animeList.length === 0) {
        console.log("No more anime found. Stopping.");
        break;
      }

      const formattedBlocks = animeList.map(formatAnimeQuery).join("\n\n");
      if (!fs.existsSync("GraphQL")) {
  fs.mkdirSync("GraphQL");
}
const filename = path.join("GraphQL", `Anlist anime data tool - results-${timestamp}.txt`);
      fs.appendFileSync(filename, formattedBlocks + "\n\n");

      totalAnime += animeList.length;
      console.log(`Crawled ${totalAnime} anime so far`);
      currentPage++;

      console.log(`Waiting ${DELAY_MS / 3000}s before next request...\n`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    } catch (err) {
      console.error("Error fetching data:", err.message);
      break;
    }
  }

  console.log("Crawler stopped");
};

// === SHUTDOWN HANDLER ===
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  shuttingDown = true;
});

crawlContinuously();
