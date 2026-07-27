process.argv.push("--china-daily-life");

async function runChinaDailyLifeTemplate() {
  await import("./generate-office-sentences-template");
}

runChinaDailyLifeTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
