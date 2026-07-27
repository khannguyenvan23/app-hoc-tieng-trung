process.argv.push("--friendship");

async function runFriendshipTemplate() {
  await import("./generate-office-sentences-template");
}

runFriendshipTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
