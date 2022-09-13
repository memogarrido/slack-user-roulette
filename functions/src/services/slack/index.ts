import {KnownBlock, WebClient} from "@slack/web-api";
import {SetupFields} from "../../models/SetupFields.enum";
import {SetupOutputs} from "../../models/StepOutputs.enum";
/**
 * Service to interact with Slack Web API https://api.slack.com/apis
 */
export class SlackService {
  private client: WebClient;
  /**
   * Create a new slack Service
   * @param {string }token  OAuth Toke for the Workspace
   */
  constructor(token: string) {
    this.client = new WebClient(token);
  }

  /**
   * Reply to the step being excecuted succesfully
   * @param {string} workflowStepExecuteId Id of the step being excecuted
   * @param {Array<string>} users List of resulting users
   */
  public async eventSuccessReply(
      workflowStepExecuteId: string,
      users: Array<string>
  ) {
    const outputs: { [key: string]: string } = {};
    for (let i = 0; i < users.length; i++) {
      outputs[`${SetupOutputs.RouletteResult}${i}`] = users[i];
    }
    await this.client.workflows.stepCompleted({
      workflow_step_execute_id: workflowStepExecuteId,
      outputs: outputs,
    });
  }

  /**
   * Open Configuration Modal on slack workflows
   * @param {string}triggerId Trigger id Received on the workflow_step_edit event
   * {@link workflow_step_edit https://api.slack.com/reference/workflows/workflow_step_edit}
   * @param {Array<KnownBlock>} blocks Block UI for the workflow setup modal
   * {@link block-kit https://api.slack.com/reference/block-kit/blocks}
   */
  public async openConfigurationModal(
      triggerId: string,
      blocks: Array<KnownBlock>
  ) {
    await this.client.views.open({
      trigger_id: triggerId,
      view: {
        type: "workflow_step",
        blocks: blocks,
      },
    });
  }

  /**
   * Save Spin roulette Step into workflow
   * @param {string } workflowStepEditId Obtained from the workflow_step_edit  event
   * {@link workflow_step_edit https://api.slack.com/reference/workflows/workflow_step_edit}
   * @param {number } resultSize number of resulting users form spinning the roulette
   */
  public async saveUserRouletteWorkflowStep(
      workflowStepEditId: string,
      resultSize: number
  ) {
    const outputs = [];

    for (let i = 0; i < resultSize; i++) {
      outputs.push({
        type: "user",
        label: `User ${i + 1}`,
        name: `${SetupOutputs.RouletteResult}${i}`,
      });
    }
    await this.client.workflows.updateStep({
      outputs: outputs,
      workflow_step_edit_id: workflowStepEditId,
      step_name: "Spint user roulette",
    });
  }

  /**
   * Open User Roulette Configuration Modal on slack workflows
   * @param {string}triggerId Trigger id Received on the workflow_step_edit event
   * {@link https://api.slack.com/reference/workflows/workflow_step_edit}
   */
  public async openUserRouletteConfigurationModal(triggerId: string) {
    await this.openConfigurationModal(triggerId, [
      {
        type: "input",
        block_id: SetupFields.SubgroupSize,
        element: {
          type: "plain_text_input",
          action_id: "title",
          placeholder: {
            type: "plain_text",
            text: "How many users do you want the roulette to return?",
          },
        },
        label: {
          type: "plain_text",
          text: "Number of users to return",
        },
      },
      {
        type: "input",
        block_id: SetupFields.Users,
        element: {
          type: "multi_users_select",
          placeholder: {
            type: "plain_text",
            text: "Select users",
            emoji: true,
          },
          action_id: "multi_users_select-action",
        },
        label: {
          type: "plain_text",
          text: "Users to choose from",
          emoji: true,
        },
      },
    ]);
  }
}
