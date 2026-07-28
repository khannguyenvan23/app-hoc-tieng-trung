process.argv.push("--electronics");

async function runElectronicsTemplate() {
  await import("./generate-factory-template");
}

runElectronicsTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
