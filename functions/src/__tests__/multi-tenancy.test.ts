describe("Multi-tenancy — cross-company isolation (requires Firestore emulator)", () => {
  it.skip("cross-company denial tests require running emulators", () => {
    // To run these tests:
    // 1. Start emulators: firebase emulators:start --only auth,firestore
    // 2. Implement tests using firebase-functions-test with online mode
    //
    // Tests to implement:
    // - blocks admin from accessing resource in different company
    // - blocks manager from accessing resource in different company
    // - blocks user from accessing resource in different company even with correct action
    // - allows access when no resource companyId is specified (fallback to auth)
    // - allows access when resource companyId matches auth companyId
  });
});
