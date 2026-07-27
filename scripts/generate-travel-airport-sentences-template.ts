process.argv.push("--travel-airport");

async function runTravelAirportTemplate() {
  await import("./generate-office-sentences-template");
}

runTravelAirportTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
