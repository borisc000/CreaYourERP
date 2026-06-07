// Re-export everything from shared RBAC for backward compatibility.
// CRM-specific code should migrate to import from "../../shared/rbac" directly.
export {
  rbacCors as crmCors,
  SERVICE_ACTIONS,
  type ServiceAction,
  type AuthContext as CRMAuthContext,
  actionAllowed,
  getAuthContext as getCRMAuthContext,
  assertAction as assertCRMAction,
} from "../../shared/rbac";
