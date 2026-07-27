process.argv.push("--logistics");

async function runLogisticsImportExportTemplate() {
  await import("./generate-factory-template");
}

runLogisticsImportExportTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
