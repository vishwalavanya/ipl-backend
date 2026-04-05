const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");
const AdmZip = require("adm-zip");

const app = express();
app.use(cors());

let matchups = {};

// ✅ STEP 1: Extract ZIP (from root)
const zip = new AdmZip("./ipl.zip");
zip.extractAllTo("./", true);

console.log("✅ ZIP Extracted");

// ⚠️ IMPORTANT: change this name if your CSV name is different
const CSV_FILE = "ipl.csv"; 

// ✅ STEP 2: Read CSV and build matchup DB
fs.createReadStream(`./${CSV_FILE}`)
  .pipe(csv())
  .on("data", (row) => {
    const batsman = row.batter;
    const bowler = row.bowler;
    const runs = parseInt(row.runs_batter || 0);
    const isValid = row.valid_ball == 1;
    const isOut = row.player_out ? 1 : 0;

    if (!isValid) return;

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
  })
  .on("end", () => {
    console.log("🔥 Matchup DB Ready");
  });


// ✅ API
app.get("/matchup", (req, res) => {
  const { batsman, bowler } = req.query;

  const key = `${batsman}_${bowler}`;
  const data = matchups[key];

  if (!data) {
    return res.json({ message: "No data available" });
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


// ✅ Start server
app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
