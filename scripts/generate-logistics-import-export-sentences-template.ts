process.argv.push("--logistics-import-export");

async function runLogisticsImportExportSentencesTemplate() {
  await import("./generate-office-sentences-template");
}

runLogisticsImportExportSentencesTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
