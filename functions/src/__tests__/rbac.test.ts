import { actionAllowed, SERVICE_ACTIONS, type AuthContext, type ServiceAction } from "../shared/rbac";

describe("RBAC — actionAllowed", () => {
  const adminCtx: AuthContext = {
    uid: "u1", role: "admin", companyId: "c1", name: "Admin", email: "a@t.com", allowedModules: [], serviceActions: [],
  };
  const managerCtx: AuthContext = {
    uid: "u2", role: "manager", companyId: "c1", name: "Manager", email: "m@t.com", allowedModules: ["hr"], serviceActions: [],
  };
  const userNoModulesCtx: AuthContext = {
    uid: "u3", role: "user", companyId: "c1", name: "User", email: "u@t.com", allowedModules: [], serviceActions: [],
  };
  const userWithModulesCtx: AuthContext = {
    uid: "u4", role: "user", companyId: "c1", name: "User", email: "u@t.com", allowedModules: ["hr"], serviceActions: [],
  };
  const userWithActionsCtx: AuthContext = {
    uid: "u5", role: "user", companyId: "c1", name: "User", email: "u@t.com", allowedModules: [], serviceActions: ["hr.manage_contracts"],
  };

  it("admin bypasses all actions", () => {
    for (const action of SERVICE_ACTIONS) {
      expect(actionAllowed(adminCtx, action as ServiceAction)).toBe(true);
    }
  });

  it("manager with allowedModules has access to module actions", () => {
    expect(actionAllowed(managerCtx, "hr.manage_contracts")).toBe(true);
    expect(actionAllowed(managerCtx, "quote.create")).toBe(false); // manager allowedModules = ["hr"], quote maps to ["quotes"]
  });

  it("user without allowedModules or serviceActions is denied", () => {
    expect(actionAllowed(userNoModulesCtx, "hr.manage_contracts")).toBe(false);
    expect(actionAllowed(userNoModulesCtx, "quote.create")).toBe(false);
  });

  it("profile actions are allowed for authenticated users", () => {
    expect(actionAllowed(userNoModulesCtx, "profile.view")).toBe(true);
    expect(actionAllowed(userNoModulesCtx, "profile.edit")).toBe(true);
  });

  it("user with allowedModules fallback gets module access", () => {
    expect(actionAllowed(userWithModulesCtx, "hr.manage_contracts")).toBe(true);
  });

  it("user with explicit serviceActions is allowed even without modules", () => {
    expect(actionAllowed(userWithActionsCtx, "hr.manage_contracts")).toBe(true);
    expect(actionAllowed(userWithActionsCtx, "quote.create")).toBe(false);
  });

  it("hard denial: crm.delete_lead is denied for non-admin regardless of modules", () => {
    expect(actionAllowed(managerCtx, "crm.delete_lead")).toBe(false);
    expect(actionAllowed(userWithModulesCtx, "crm.delete_lead")).toBe(false);
  });

  it("unknown action is denied for non-admin", () => {
    expect(actionAllowed(userNoModulesCtx, "unknown.action" as ServiceAction)).toBe(false);
  });
});

describe("RBAC — assertAction (requires Firestore emulator)", () => {
  it.skip("assertAction cross-company tests require running emulators (firebase emulators:start)", () => {
    // To run these tests:
    // 1. Start emulators: firebase emulators:start --only auth,firestore
    // 2. Run: npm test -- --testPathPattern=multi-tenancy
    //
    // Tests to implement:
    // - throws permission-denied when resource companyId differs from auth companyId
    // - returns AuthContext when resource companyId matches
    // - throws permission-denied when user lacks action permission
    // - allows action when user has explicit serviceActions
  });
});
