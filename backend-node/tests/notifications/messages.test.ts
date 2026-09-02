import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  admissionRequiredMessage,
  bedAssignedMessage,
  bedMaintenanceMessage,
  bedReleasedMessage,
  consultationStartedMessage,
  formatNotificationToken,
  isInternalDisplayName,
  isInternalNotificationText,
  newPatientMessage,
  newPatientWaitingMessage,
  patientNotificationSubject,
  receptionistActivatedMessage,
  returningPatientMessage,
  returningPatientWaitingMessage,
} from "../../src/notifications/messages";

describe("notification messages", () => {
  it("formats stored tokens as four-digit display numbers", () => {
    assert.equal(formatNotificationToken("P0008"), "0008");
    assert.equal(formatNotificationToken("20260822-P0007"), "0007");
    assert.equal(formatNotificationToken("08"), "0008");
    assert.equal(formatNotificationToken("aaaaaaaaaaaaaaaaaaaaaaaa"), "");
  });

  it("builds human-readable patient and token copy", () => {
    assert.deepEqual(newPatientMessage("Priya Shah", "0001", 1), {
      title: "New patient registered",
      message: "Priya Shah has been registered for visit #1 with token 0001.",
    });
    assert.deepEqual(returningPatientMessage("Rahul Patel", "0007", 2), {
      title: "Returning patient",
      message: "Rahul Patel has returned for visit #2 with token 0007.",
    });
    assert.deepEqual(returningPatientWaitingMessage("Rahul Patel", "0007", 2), {
      title: "Returning patient waiting",
      message: "Rahul Patel is waiting for consultation (visit #2, token 0007).",
    });
    assert.deepEqual(newPatientWaitingMessage("Priya Shah", "0001", 1), {
      title: "New patient waiting",
      message: "Priya Shah is waiting for consultation (visit #1, token 0001).",
    });
    assert.deepEqual(consultationStartedMessage("Kiran Desai", "0012", 1), {
      title: "Consultation started",
      message: "Consultation for Kiran Desai (visit #1, token 0012) has started.",
    });
    assert.deepEqual(bedAssignedMessage("Priya Shah", "0001", 1, "101", "A"), {
      title: "Bed assigned",
      message: "Priya Shah was assigned to bed A in room 101 (visit #1, token 0001).",
    });
    assert.deepEqual(bedReleasedMessage("Priya Shah", "0001", 1, "101", "A"), {
      title: "Bed released",
      message: "Priya Shah was released from bed A in room 101 (visit #1, token 0001).",
    });
    assert.deepEqual(bedMaintenanceMessage("101", "A"), {
      title: "Bed marked for maintenance",
      message: "Bed A in room 101 was marked for maintenance.",
    });
    assert.deepEqual(admissionRequiredMessage("Priya Shah", "0001", 1), {
      title: "Admission required",
      message: "Priya Shah requires admission (visit #1, token 0001).",
    });
    assert.deepEqual(receptionistActivatedMessage("Priya Shah"), {
      title: "Receptionist activated",
      message: "Priya Shah's receptionist account has been activated.",
    });
  });

  it("reads the patient_name field and rejects internal test names", () => {
    assert.deepEqual(
      patientNotificationSubject({
        patient_name: "  Rahul Patel  ",
        token_number: "20260822-P0007",
        visit_number: 2,
      }),
      { name: "Rahul Patel", token: "0007", visitNumber: 2 },
    );
    assert.equal(
      patientNotificationSubject({
        patient_name: "Node Return One",
        token_number: "P0001",
        visit_number: 1,
      }),
      null,
    );
    assert.equal(
      patientNotificationSubject({
        patient_name: "Node Lookup Twin node.pat.1787397312105",
        token_number: "P0002",
        visit_number: 1,
      }),
      null,
    );
  });

  it("detects internal test names and titles", () => {
    assert.equal(isInternalDisplayName("Node Pat Stats"), true);
    assert.equal(isInternalDisplayName("Node Return One"), true);
    assert.equal(isInternalDisplayName("Node Lookup Twin node.pat.1787397312105"), true);
    assert.equal(isInternalDisplayName("Node Rcpt Updated"), true);
    assert.equal(isInternalDisplayName("Rahul Patel"), false);
    assert.equal(isInternalDisplayName("Priya Shah"), false);
    assert.equal(
      isInternalNotificationText(
        "New patient registered",
        "Node Return One has been registered with token 0001.",
      ),
      true,
    );
    assert.equal(
      isInternalNotificationText("New patient registered", "Rahul Patel has been registered with token 0008."),
      false,
    );
  });
});
