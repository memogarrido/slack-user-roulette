import * as functions from "firebase-functions";
import {ReasonPhrases, StatusCodes} from "http-status-codes";
import {isSignatureValid} from "../services/Auth";
import {SetupFields} from "../models/SetupFields.enum";
import {SlackService} from "../services/slack";
import {RouletteService} from "../services/roulette";

export const setupWorkflowStep = functions
    .runWith({secrets: ["SLACK_SIGNING_SECRET", "SLACK_TOKEN"]})
    .https.onRequest(async (request, response) => {
      const requestTimeStamp = request.header("X-Slack-Request-Timestamp");
      const requestSignature = request.header("X-Slack-Signature");

      functions.logger.debug("Rquest temp log", request.body, request.headers);
      const rawBody = request.rawBody.toString();
      if ( !( process.env.SLACK_SIGNING_SECRET && process.env.SLACK_TOKEN && requestTimeStamp && requestSignature ) ) {
        response.sendStatus(StatusCodes.BAD_REQUEST);
        return;
      }
      if ( !isSignatureValid( process.env.SLACK_SIGNING_SECRET, requestTimeStamp, rawBody, requestSignature ) ) {
        functions.logger.warn("Signature invalid");
        response.sendStatus(StatusCodes.UNAUTHORIZED);
        return;
      }
      const payload = JSON.parse(request.body.payload);

      const slackService = new SlackService(process.env.SLACK_TOKEN);
      const rouletteService = new RouletteService();
      functions.logger.debug("PAYLOAD", payload);
      switch (payload.type) {
        case "workflow_step_edit":
          functions.logger.info("workflow_step_edit");
          try {
            await slackService.openUserRouletteConfigurationModal(
                payload.trigger_id
            );
            response.status(StatusCodes.OK).send(ReasonPhrases.OK);
          } catch (e) {
            functions.logger.error(e);
            response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
          }
          return;
        case "view_submission":
          functions.logger.info("view_submission");
          try {
            const groupSize =
            payload.view.state.values[SetupFields.SubgroupSize]["title"].value;
            const users =
            payload.view.state.values[SetupFields.Users][
                "multi_users_select-action"
            ].selected_users;
            await rouletteService.setupWheel(
                payload.workflow_step.workflow_id,
                payload.workflow_step.step_id,
                users,
                groupSize
            );
            await slackService.saveUserRouletteWorkflowStep(
                payload.workflow_step.workflow_step_edit_id,
            groupSize < users.legth ? groupSize : users.legth
            );
            response.status(StatusCodes.OK).send();
            return;
          } catch (e) {
            functions.logger.error(e);
            response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
          }
      }
      response.sendStatus(StatusCodes.BAD_REQUEST);
      return;
    });
