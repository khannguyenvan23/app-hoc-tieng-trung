process.argv.push("--work-calls-messages");

async function runWorkCallsMessagesSentencesTemplate() {
  await import("./generate-office-sentences-template");
}

runWorkCallsMessagesSentencesTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
