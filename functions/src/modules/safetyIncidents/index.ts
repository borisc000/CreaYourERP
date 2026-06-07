export {
  createIncident,
  updateIncident,
  investigateIncident,
  createCorrectiveAction,
  updateCorrectiveAction,
  closeCorrectiveAction,
} from "./incidentService";

export {
  listSafetyIncidents,
  getSafetyIncident,
  deleteSafetyIncident,
  listCorrectiveActions,
  getCorrectiveAction,
  deleteCorrectiveAction,
  getSafetyIncidentDashboard,
  getIncidentStatsByArea,
  getIncidentTrends,
} from "./incidentReadService";
