import {setupWorkflowStep} from "./api/Setup";
import {spinRoulette} from "./api/UserRouletteSpin";
import * as admin from "firebase-admin";
admin.initializeApp();
exports.spin = spinRoulette;
exports.setup = setupWorkflowStep;
