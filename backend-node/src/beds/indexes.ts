import { Bed } from "../models/bed.model";
import { Room } from "../models/room.model";

let indexesReady = false;
let indexesInFlight: Promise<void> | null = null;

export async function ensureBedManagementIndexes(): Promise<void> {
  if (indexesReady) {
    return;
  }
  if (!indexesInFlight) {
    indexesInFlight = Promise.all([Room.createIndexes(), Bed.createIndexes()])
      .then(() => {
        indexesReady = true;
      })
      .finally(() => {
        indexesInFlight = null;
      });
  }
  await indexesInFlight;
}
