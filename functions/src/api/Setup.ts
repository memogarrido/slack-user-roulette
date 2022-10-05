import * as functions from "firebase-functions";
import {ReasonPhrases, StatusCodes} from "http-status-codes";
import {isSignatureValid} from "../services/Auth";
import {SetupFields} from "../models/SetupFields.enum";
import {SlackService} from "../services/slack";
import {RouletteService} from "../services/roulette";

export const setupWorkflowStep = functions .runWith({secrets: ["SLACK_SIGNING_SECRET", "SLACK_TOKEN"]})
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
            await slackService.openUserRouletteConfigurationModal( payload.trigger_id );
            response.status(StatusCodes.OK).send(ReasonPhrases.OK);
          } catch (e) {
            functions.logger.error(e);
            response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
          }
          return;
        case "block_actions":
          functions.logger.info("block_actions");
          try {
            const numberOfInputGroups = payload.view.state.values[SetupFields.NumberOfInputGroups]["title"] .value;
            await slackService.updateConfigModalWithUserInputs( payload.trigger_id, payload.view, numberOfInputGroups );
            response.status(StatusCodes.OK).send();
            return;
          } catch (e) {
            functions.logger.error(e);
            response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
          }
        case "view_submission":
          functions.logger.info("view_submission");
          try {
            let resultSize = parseInt(payload.view.state.values[SetupFields.SubgroupSize]["title"].value);
            let numberOfResults = parseInt( payload.view.state.values[SetupFields.NumberOfResults]["title"].value);
            const numberOfInputGroups = parseInt(
                payload.view.state.values[SetupFields.NumberOfInputGroups]["title"].value
            );
            const usersSets: Array<Array<string>> = [];
            let totalUsers = 0;
            for (let i = 0; i < numberOfInputGroups; i++) {
              const users =
               payload.view.state.values[`${SetupFields.Users}${i+1}`]["multi_users_select-action"].selected_users;
              usersSets.push(users);
              totalUsers += users.length;
            }
            if (resultSize > totalUsers) {
              resultSize = totalUsers;
            }
            if (resultSize * numberOfResults > totalUsers) {
              numberOfResults = Math.ceil(totalUsers / resultSize);
            }
            await rouletteService.setupWheel(
                payload.workflow_step.workflow_id,
                payload.workflow_step.step_id,
                usersSets,
                resultSize,
                numberOfResults
            );

            await slackService.saveUserRouletteWorkflowStep(
                payload.workflow_step.workflow_step_edit_id,
                resultSize,
                numberOfResults
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
