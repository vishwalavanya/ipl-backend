const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");
const AdmZip = require("adm-zip");

// ✅ Load mapping
const playersMap = require("./players.json");

const app = express();
app.use(cors());

let matchups = {};

// =============================
// ✅ STEP 1: EXTRACT ZIP
// =============================
try {
  const zip = new AdmZip("./archive.zip");
  zip.extractAllTo("./", true);
  console.log("✅ ZIP Extracted");
} catch (err) {
  console.error("❌ Error extracting ZIP:", err);
}

// =============================
// ✅ STEP 2: CHECK CSV
// =============================
const CSV_FILE = "./IPL.csv";

if (!fs.existsSync(CSV_FILE)) {
  console.error("❌ CSV file not found:", CSV_FILE);
} else {
  console.log("✅ CSV Found");
}

// =============================
// ✅ STEP 3: BUILD MATCHUPS
// =============================
fs.createReadStream(CSV_FILE)
  .pipe(csv())
  .on("data", (row) => {
    try {
      const batsman = row.batter;
      const bowler = row.bowler;
      const runs = parseInt(row.runs_batter || 0);
      const isValid = row.valid_ball == 1;
      const isOut = row.player_out ? 1 : 0;

      if (!isValid || !batsman || !bowler) return;

      const key = `${batsman}_${bowler}`;

      if (!matchups[key]) {
        matchups[key] = {
          runs: 0,
          balls: 0,
          outs: 0,
          fours: 0,
          sixes: 0
        };
      }

      matchups[key].runs += runs;
      matchups[key].balls += 1;
      matchups[key].outs += isOut;

      if (runs === 4) matchups[key].fours += 1;
      if (runs === 6) matchups[key].sixes += 1;

    } catch (err) {
      console.log("Row error:", err);
    }
  })
  .on("end", () => {
    console.log("🔥 Matchup DB Ready");
    console.log("Total matchups:", Object.keys(matchups).length);
  });

// =============================
// ✅ STEP 4: NAME CONVERSION (IMPORTANT)
// =============================
function convertName(name) {
  if (!name) return name;

  // ✅ 1. Exact mapping
  if (playersMap[name]) return playersMap[name];

  // ✅ 2. Remove (2) like names
  const cleanName = name.replace(/\(\d+\)/, "").trim();
  if (playersMap[cleanName]) return playersMap[cleanName];

  // ✅ 3. Fallback: last name match
  const lastName = cleanName.split(" ").slice(-1)[0].toLowerCase();

  for (let key in matchups) {
    const [batsman] = key.split("_");

    if (batsman.toLowerCase().includes(lastName)) {
      return batsman;
    }
  }

  // ❗ If nothing found, return original
  return name;
}

// =============================
// ✅ STEP 5: MATCHUP API
// =============================
app.get("/matchup", (req, res) => {
  let { batsman, bowler } = req.query;

  if (!batsman || !bowler) {
    return res.json({
      error: "Please provide batsman and bowler"
    });
  }

  // ✅ Convert names
  batsman = convertName(batsman);
  bowler = convertName(bowler);

  const key = `${batsman}_${bowler}`;
  const data = matchups[key];

  if (!data) {
    return res.json({
      batsman,
      bowler,
      message: "No data available"
    });
  }

  const strikeRate = (data.runs / data.balls) * 100;

  res.json({
    batsman,
    bowler,
    runs: data.runs,
    balls: data.balls,
    outs: data.outs,
    fours: data.fours,
    sixes: data.sixes,
    strikeRate: strikeRate.toFixed(2)
  });
});

// =============================
// ✅ STEP 6: DEBUG PLAYERS
// =============================
app.get("/players", (req, res) => {
  const players = new Set();

  Object.keys(matchups).forEach(key => {
    const [batsman, bowler] = key.split("_");
    players.add(batsman);
    players.add(bowler);
  });

  res.json(Array.from(players));
});

// =============================
// ✅ STEP 7: START SERVER
// =============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
