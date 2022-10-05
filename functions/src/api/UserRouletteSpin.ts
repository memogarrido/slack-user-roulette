import * as functions from "firebase-functions";
import {ReasonPhrases, StatusCodes} from "http-status-codes";
import {isSignatureValid} from "../services/Auth";
import {RouletteService} from "../services/roulette";
import {SlackService} from "../services/slack";
export const spinRoulette = functions
    .runWith({secrets: ["SLACK_SIGNING_SECRET", "SLACK_TOKEN"]})
    .https.onRequest(async (request, response) => {
      const requestTimeStamp = request.header("X-Slack-Request-Timestamp");
      const requestSignature = request.header("X-Slack-Signature");
      const rawBody = request.rawBody.toString();
      functions.logger.debug("REQUEST BODY", request.body, "REQUEST HEADERS", request.headers);
      if ( !( process.env.SLACK_SIGNING_SECRET && process.env.SLACK_TOKEN && requestTimeStamp && requestSignature ) ) {
        response.sendStatus(StatusCodes.BAD_REQUEST);
        return;
      }
      if ( !isSignatureValid( process.env.SLACK_SIGNING_SECRET, requestTimeStamp, rawBody, requestSignature ) ) {
        functions.logger.warn("Signature invalid");
        response.sendStatus(StatusCodes.UNAUTHORIZED);
        return;
      }
      const slackService = new SlackService(process.env.SLACK_TOKEN);
      const rouletteService = new RouletteService();
      const event = {...request.body.event};
      switch (request.body.type) {
        case "url_verification":
          response.status(StatusCodes.OK).send(request.body.challenge);
          functions.logger.info("url_verification");
          return;
        case "event_callback":
          response.status(StatusCodes.OK).send(ReasonPhrases.OK);
          functions.logger.info("event_callback");
          functions.logger.debug("OUTPUTS", event.workflow_step.outputs);
          if (event.type === "workflow_step_execute") {
            functions.logger.info("workflow_step_execute");
            try {
              const groups = await rouletteService.spinRoulette(
                  event.workflow_step.workflow_id,
                  event.workflow_step.step_id
              );
              const users:Array<Array<string>> = [];
              for (const group of groups) {
                const usersInGroup = group.map((u)=>u.userId);
                users.push(usersInGroup);
              }
              functions.logger.debug("users", users);
              functions.logger.debug("groups", groups);
              await slackService.eventSuccessReply(
                  event.workflow_step.workflow_step_execute_id,
                  users
              );
              response.status(StatusCodes.OK).send();
              return;
            } catch (e) {
              functions.logger.error(e);
              response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
              return;
            }
          }
          response.status(StatusCodes.NOT_IMPLEMENTED).send();
          return;
      }
      response.status(StatusCodes.NOT_IMPLEMENTED).send();
      return;
    });
