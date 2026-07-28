process.argv.push("--commercial-contract-negotiation");

async function runCommercialContractNegotiationSentencesTemplate() {
  await import("./generate-office-sentences-template");
}

runCommercialContractNegotiationSentencesTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
