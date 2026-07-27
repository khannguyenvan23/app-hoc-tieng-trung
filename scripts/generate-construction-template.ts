process.argv.push("--construction");

async function runConstructionTemplate() {
  await import("./generate-factory-template");
}

runConstructionTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
