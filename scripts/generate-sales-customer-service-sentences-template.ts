process.argv.push("--sales-customer-service");

async function runSalesCustomerServiceTemplate() {
  await import("./generate-office-sentences-template");
}

runSalesCustomerServiceTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
