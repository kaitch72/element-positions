// =============================================================
// Element careers sync script
// 1. Downloads the WordPress careers RSS feed
// 2. Cleans up each job (titles, locations, job type)
// 3. Writes feeds/jobs.xml in the same format as the Openland feed
//
// Runs automatically on GitHub Actions. To test on your computer:
//   node scripts/update-jobs.mjs
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE_URL = "https://www.everybitmatters.com/careers/feed/";
const OUTPUT_FILE = "feeds/jobs.xml";

// Words that stay lowercase in titles (unless they're the first word)
const SMALL_WORDS = new Set(["and", "or", "of", "the", "a", "an", "in", "for", "to", "at", "by", "with"]);
// Words that should always be all caps
const ACRONYMS = new Set(["hr", "it", "ui", "ux", "av", "ceo", "cfo", "nh", "tx", "ma", "me", "vt", "ny"]);

// ---------- Step 1: download ----------
async function getFeedText() {
  // FEED_FILE lets you test with a saved copy instead of the live site
  if (process.env.FEED_FILE) return readFile(process.env.FEED_FILE, "utf8");

  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "element-signage-feed (GitHub Actions)" }
  });
  if (!response.ok) throw new Error(`Careers feed returned HTTP ${response.status}`);
  return response.text();
}

// ---------- Step 2: read the RSS ----------
function decodeEntities(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]).trim() : "";
}

function parseItems(xml) {
  if (!/<rss[\s>]/.test(xml) || !/<channel>/.test(xml)) {
    throw new Error("Download didn't look like an RSS feed (the site may be down or changed)");
  }
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => ({
    rawTitle: getTag(m[1], "title"),
    link: getTag(m[1], "link"),
    guid: getTag(m[1], "guid"),
    pubDate: getTag(m[1], "pubDate")
  }));
}

// ---------- Step 3: clean up ----------
function titleCase(text) {
  let first = true;
  return text.replace(/[A-Za-z0-9']+/g, word => {
    const lower = word.toLowerCase();
    let result;
    if (ACRONYMS.has(lower)) result = lower.toUpperCase();
    else if (!first && SMALL_WORDS.has(lower)) result = lower;
    else result = lower.charAt(0).toUpperCase() + lower.slice(1);
    first = false;
    return result;
  });
}

function cleanJob(item) {
  let title = item.rawTitle.replace(/\s+/g, " ").trim();
  let city = "", state = "";

  // "portsmouth, nh-based design build project manager"
  //   -> location "Portsmouth, NH", title "design build project manager"
  const based = title.match(/^([a-z .'-]+),\s*([a-z]{2})[\s-]+based\s+/i);
  if (based) {
    city = titleCase(based[1].trim());
    state = based[2].toUpperCase();
    title = title.slice(based[0].length);
  }

  // Remove accidentally repeated phrases:
  // "design internship program internship program" -> "design internship program"
  title = title.replace(/\b(\w+(?:\s+\w+){0,3})\s+\1\b/gi, "$1");

  // Tidy slashes: "construction/ project" -> "construction/project"
  title = title.replace(/\s*\/\s*/g, "/");

  title = titleCase(title);

  const isInternship = /\bintern(ship)?\b/i.test(title);
  const id = (item.guid.match(/[?&]p=(\d+)/) || [])[1] || item.link;

  return {
    guid: id,
    title,
    link: item.link,
    location: city ? `${city}, ${state}` : "",
    city,
    state,
    // Element only posts internships and full-time roles
    employmentType: isInternship ? "Internship" : "Full Time",
    remote: "false",
    pubDate: item.pubDate
  };
}

// ---------- Step 4: write jobs.xml ----------
function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildXml(jobs) {
  const items = jobs.map(job => `    <item>
${Object.entries(job).map(([tag, value]) => `      <${tag}>${escapeXml(value)}</${tag}>`).join("\n")}
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Element Group Careers</title>
    <source>${escapeXml(SOURCE_URL)}</source>
    <jobCount>${jobs.length}</jobCount>
${items}
  </channel>
</rss>
`;
}

// ---------- Run ----------
async function main() {
  const xml = await getFeedText();
  const jobs = parseItems(xml).filter(item => item.rawTitle).map(cleanJob);

  await mkdir("feeds", { recursive: true });

  // Only rewrite the file when the jobs actually changed,
  // so GitHub doesn't get an empty commit every 15 minutes.
  const output = buildXml(jobs);
  const existing = await readFile(OUTPUT_FILE, "utf8").catch(() => "");
  if (existing === output) {
    console.log(`No changes (${jobs.length} jobs).`);
    return;
  }

  await writeFile(OUTPUT_FILE, output);
  console.log(`Wrote ${jobs.length} jobs to ${OUTPUT_FILE}:`);
  jobs.forEach(job => console.log(`  - ${job.title}${job.location ? " (" + job.location + ")" : ""}${job.employmentType ? " [" + job.employmentType + "]" : ""}`));
}

main().catch(error => {
  // Exiting with an error makes the GitHub run fail (and email you),
  // and leaves the last good jobs.xml untouched so the sign keeps working.
  console.error("Update failed:", error.message);
  process.exit(1);
});
