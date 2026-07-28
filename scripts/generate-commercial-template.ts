process.argv.push("--commercial");

async function runCommercialTemplate() {
  await import("./generate-factory-template");
}

runCommercialTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
