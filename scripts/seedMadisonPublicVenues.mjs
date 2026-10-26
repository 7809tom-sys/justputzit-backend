import { refreshPublicActivitiesForCity } from "../server/publicVenueDiscovery.ts";

await refreshPublicActivitiesForCity("Madison", "WI");
console.log("Verified Madison public venue refresh completed.");
