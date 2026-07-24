process.argv.push("--factory");

async function main() {
  await import("./generate-office-sentences-template");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
