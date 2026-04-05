const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");
const AdmZip = require("adm-zip");

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
// ✅ STEP 2: CHECK FILE EXISTS
// =============================
const CSV_FILE = "./IPL.csv";

if (!fs.existsSync(CSV_FILE)) {
  console.error("❌ CSV file not found:", CSV_FILE);
} else {
  console.log("✅ CSV Found");
}

// =============================
// ✅ STEP 3: BUILD MATCHUP DB
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
// ✅ STEP 4: API ENDPOINT
// =============================
app.get("/matchup", (req, res) => {
  const { batsman, bowler } = req.query;

  if (!batsman || !bowler) {
    return res.json({
      error: "Please provide batsman and bowler"
    });
  }

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
// ✅ STEP 5: SERVER START
// =============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
